import "server-only";
import { ConflictError } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/server";
import { CA_MAX, EXAM_MAX, type ScoreRow, type SubjectProgress } from "@/lib/types";
import { classTermStudentIds } from "./termReports";

/** The class's subjects in report-sheet order, each with how many of its students have marks this term. */
export async function listSubjectProgress(
  classId: string,
  termId: string
): Promise<{ subjects: SubjectProgress[]; students: number }> {
  const supa = serviceClient();
  const [{ data: subjects, error }, studentIds] = await Promise.all([
    supa.from("class_subjects").select("subject_id, position, subjects(name)").eq("class_id", classId),
    classTermStudentIds(classId, termId),
  ]);
  if (error) throw new Error(error.message);
  // Counted the way the sheet shows them: the sheet's students, by student,
  // leaving out anyone exempt from the subject (and any old mark of theirs).
  const entered = new Map<string, number>();
  const exempt = new Map<string, number>();
  if (studentIds.length) {
    const { data: ex, error: exErr } = await supa
      .from("student_subject_exemptions")
      .select("student_id, subject_id")
      .in("student_id", studentIds);
    if (exErr) throw new Error(exErr.message);
    const exemptPair = new Set((ex ?? []).map((r) => `${r.student_id}|${r.subject_id}`));
    for (const r of ex ?? []) exempt.set(r.subject_id as string, (exempt.get(r.subject_id as string) ?? 0) + 1);
    // One row per student per subject: a big class (100 students × 18
    // subjects) passes Supabase's 1000-row cap, so read a page at a time.
    for (let from = 0; ; from += 1000) {
      const { data, error: scoreErr } = await supa
        .from("term_scores")
        .select("student_id, subject_id")
        .eq("term_id", termId)
        .in("student_id", studentIds)
        .order("id")
        .range(from, from + 999);
      if (scoreErr) throw new Error(scoreErr.message);
      for (const r of data ?? []) {
        if (exemptPair.has(`${r.student_id}|${r.subject_id}`)) continue;
        entered.set(r.subject_id as string, (entered.get(r.subject_id as string) ?? 0) + 1);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return {
    students: studentIds.length,
    subjects: (subjects ?? [])
      .map((r) => ({
        subjectId: r.subject_id as string,
        name: ((r.subjects as unknown as { name: string } | null)?.name ?? "") as string,
        position: (r.position as number | null) ?? Infinity,
        entered: entered.get(r.subject_id as string) ?? 0,
        taking: studentIds.length - (exempt.get(r.subject_id as string) ?? 0),
      }))
      // Subjects without a place in the report order go last, A–Z (as on the report sheet).
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .map(({ subjectId, name, entered, taking }) => ({ subjectId, name, entered, taking })),
  };
}

/** The class's students for the term, A–Z, with their marks in one subject. */
export async function listSubjectSheet(classId: string, termId: string, subjectId: string): Promise<ScoreRow[]> {
  const ids = await classTermStudentIds(classId, termId);
  if (ids.length === 0) return [];
  const supa = serviceClient();
  const [{ data: students }, { data: scores }, { data: exempt }] = await Promise.all([
    supa.from("students").select("id, full_name, admission_number").in("id", ids).order("full_name"),
    supa
      .from("term_scores")
      .select("student_id, ca_score, exam_score")
      .eq("term_id", termId)
      .eq("subject_id", subjectId)
      .in("student_id", ids),
    supa.from("student_subject_exemptions").select("student_id").eq("subject_id", subjectId).in("student_id", ids),
  ]);
  const scoreFor = new Map((scores ?? []).map((r) => [r.student_id as string, r]));
  const exemptIds = new Set((exempt ?? []).map((r) => r.student_id as string));
  const mark = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return (students ?? []).map((s) => {
    const sc = scoreFor.get(s.id as string);
    return {
      studentId: s.id as string,
      fullName: s.full_name as string,
      admissionNumber: s.admission_number as string,
      ca: mark(sc?.ca_score),
      exam: mark(sc?.exam_score),
      exempt: exemptIds.has(s.id as string),
    };
  });
}

/** What a save is checked against: does the class take the subject, who is in the class that term, who is exempt. */
export async function subjectSheetRules(
  classId: string,
  termId: string,
  subjectId: string
): Promise<{ offered: boolean; members: Set<string>; exempt: Set<string> }> {
  const supa = serviceClient();
  const [{ data: offered }, members, { data: exempt }] = await Promise.all([
    supa.from("class_subjects").select("id").eq("class_id", classId).eq("subject_id", subjectId).maybeSingle(),
    classTermStudentIds(classId, termId),
    supa.from("student_subject_exemptions").select("student_id").eq("subject_id", subjectId),
  ]);
  return {
    offered: Boolean(offered),
    members: new Set(members),
    exempt: new Set((exempt ?? []).map((r) => r.student_id as string)),
  };
}

/** A mark as typed: blank, or a number from 0 to max with at most two decimals. */
export function validMark(v: unknown, max: number): v is number | null {
  if (v === null) return true;
  // 12.3 * 100 is 1230.0000000000002 in floating point: compare with a tolerance.
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
}

/** One part of a mark being changed: the new value, and the value the person saw. */
export type MarkChange = { value: number | null; was: number | null };

/** One student's marks to write. Only the parts given are written; the other is left as it is. */
export type ScoreWrite = { studentId: string; classId: string | null; ca?: MarkChange; exam?: MarkChange };

/**
 * Write some students' marks for one subject and term, all or nothing (see
 * save_term_scores in 0021). Each part is written only if it is still the
 * value the person saw; if any isn't, nothing is written and ConflictError
 * says whose marks changed, with them as they are now. A student left with
 * both marks blank has their score removed. Callers check who may write.
 */
export async function writeScores(input: { termId: string; subjectId: string; rows: ScoreWrite[] }): Promise<{ saved: number; cleared: number }> {
  if (input.rows.length === 0) return { saved: 0, cleared: 0 };
  const { data, error } = await serviceClient().rpc("save_term_scores", {
    p_term_id: input.termId,
    p_subject_id: input.subjectId,
    p_ca_max: CA_MAX,
    p_exam_max: EXAM_MAX,
    p_rows: input.rows.map((r) => ({
      student_id: r.studentId,
      class_id: r.classId,
      set_ca: r.ca !== undefined,
      ca: r.ca?.value ?? null,
      was_ca: r.ca?.was ?? null,
      set_exam: r.exam !== undefined,
      exam: r.exam?.value ?? null,
      was_exam: r.exam?.was ?? null,
    })),
  });
  if (error) throw new Error(error.message);
  const result = data as { saved?: number; cleared?: number; conflicts?: { student_id: string; ca: number | null; exam: number | null }[] };
  if (result.conflicts) {
    throw new ConflictError("Someone else has saved marks for these students since you opened them.", {
      conflicts: result.conflicts.map((c) => ({
        studentId: c.student_id,
        ca: c.ca === null ? null : Number(c.ca),
        exam: c.exam === null ? null : Number(c.exam),
      })),
    });
  }
  return { saved: result.saved ?? 0, cleared: result.cleared ?? 0 };
}
