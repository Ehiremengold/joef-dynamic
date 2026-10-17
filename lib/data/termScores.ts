import "server-only";
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

/**
 * Save one subject's marks for a class and term. A student with both marks
 * blank has their score removed (a score row needs at least one mark).
 * Callers must have checked every student belongs to the class that term.
 */
export async function saveSubjectScores(input: {
  classId: string;
  termId: string;
  subjectId: string;
  rows: { studentId: string; ca: number | null; exam: number | null }[];
}): Promise<{ saved: number; cleared: number }> {
  const supa = serviceClient();
  const keep = input.rows.filter((r) => r.ca !== null || r.exam !== null);
  const clear = input.rows.filter((r) => r.ca === null && r.exam === null).map((r) => r.studentId);
  if (keep.length) {
    const { error } = await supa.from("term_scores").upsert(
      keep.map((r) => ({
        student_id: r.studentId,
        subject_id: input.subjectId,
        term_id: input.termId,
        class_id: input.classId,
        ca_score: r.ca,
        exam_score: r.exam,
        ca_max: CA_MAX,
        exam_max: EXAM_MAX,
      })),
      { onConflict: "student_id,subject_id,term_id" }
    );
    if (error) throw new Error(error.message);
  }
  if (clear.length) {
    const { error } = await supa
      .from("term_scores")
      .delete()
      .eq("term_id", input.termId)
      .eq("subject_id", input.subjectId)
      .in("student_id", clear);
    if (error) throw new Error(error.message);
  }
  return { saved: keep.length, cleared: clear.length };
}
