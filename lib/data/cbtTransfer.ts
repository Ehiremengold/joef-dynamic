import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { classLabel } from "@/lib/classes";
import { CA_MAX, EXAM_MAX, type ClassName } from "@/lib/types";
import { classesForTerm } from "./termReports";
import { writeScores, type ScoreWrite } from "./termScores";

type Row = Record<string, unknown>;

/** Which half of the term mark a CBT test fills. */
export type ScorePart = "ca" | "exam";

export type TransferRow = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  /** The class they sat in for that term; the mark is recorded under it. */
  classId: string | null;
  classLabel: string;
  /** The CBT result, e.g. 32 of 40. */
  score: number;
  total: number;
  /** What would go on the term sheet; null when skipped. */
  mark: number | null;
  /** The mark already on the sheet for this part, if any. */
  current: number | null;
  action: "add" | "replace" | "keep" | "skip";
  /** Why a row is kept or skipped. */
  note: string | null;
};

/**
 * Turn an exam's CBT results into term marks for one subject and term: a
 * score of 32/40 sent as CA (out of 40) is 32, sent as exam (out of 60) is 48.
 * Returns a row per student who sat the test. Only rows marked add/replace
 * are written; students the caller may not enter marks for are left out.
 */
export async function planCbtTransfer(input: {
  examId: string;
  termId: string;
  subjectId: string;
  part: ScorePart;
  overwrite: boolean;
  wholeMarks: boolean;
  /** Classes the caller may enter marks for; null = every class (an admin). */
  allowedClassIds: Set<string> | null;
}): Promise<TransferRow[]> {
  const supa = serviceClient();
  const max = input.part === "ca" ? CA_MAX : EXAM_MAX;
  const { data: attempts, error } = await supa
    .from("attempts")
    .select("student_id, score, total")
    .eq("exam_id", input.examId)
    .not("student_id", "is", null);
  if (error) throw new Error(error.message);
  const ids = (attempts ?? []).map((a) => a.student_id as string);
  if (ids.length === 0) return [];

  const [{ data: students }, { data: existing }, { data: exempt }] = await Promise.all([
    supa.from("students").select("id, full_name, admission_number, class_id").in("id", ids),
    supa
      .from("term_scores")
      .select("student_id, ca_score, exam_score, class_id")
      .eq("term_id", input.termId)
      .eq("subject_id", input.subjectId)
      .in("student_id", ids),
    supa.from("student_subject_exemptions").select("student_id").eq("subject_id", input.subjectId).in("student_id", ids),
  ]);
  // The class each student sat in for *that* term, not today's: for a past
  // term a promoted student's mark belongs with last year's class.
  const termClass = await classesForTerm(
    (students ?? []).map((s) => ({ id: s.id as string, classId: (s.class_id as string | null) ?? null })),
    input.termId
  );
  const classIds = [...new Set([...termClass.values()].filter(Boolean))] as string[];
  const [{ data: offered }, { data: classes }] = classIds.length
    ? await Promise.all([
        supa.from("class_subjects").select("class_id").eq("subject_id", input.subjectId).in("class_id", classIds),
        supa.from("classes").select("id, level, arm, campuses(name)").in("id", classIds),
      ])
    : [{ data: [] }, { data: [] }];
  const takesSubject = new Set((offered ?? []).map((r) => r.class_id as string));
  const labelFor = new Map(
    ((classes ?? []) as Row[]).map((c) => [
      c.id as string,
      classLabel({ campusName: (c.campuses as Row | null)?.name as string | undefined, level: c.level as ClassName, arm: (c.arm as string | null) ?? null }),
    ])
  );
  const exemptIds = new Set((exempt ?? []).map((r) => r.student_id as string));
  const studentById = new Map((students ?? []).map((s) => [s.id as string, s as Row]));
  const existingFor = new Map((existing ?? []).map((r) => [r.student_id as string, r as Row]));

  const rows: TransferRow[] = [];
  for (const a of attempts ?? []) {
    const s = studentById.get(a.student_id as string);
    if (!s) continue;
    const prev = existingFor.get(s.id as string);
    // A mark already on the sheet keeps the class it was recorded under.
    const classId = ((prev?.class_id as string | null) ?? termClass.get(s.id as string)) ?? null;
    if (input.allowedClassIds && !(classId && input.allowedClassIds.has(classId))) continue;
    const score = Number(a.score);
    const total = Number(a.total);
    const raw = total > 0 ? (score / total) * max : 0;
    const mark = input.wholeMarks ? Math.round(raw) : Math.round(raw * 100) / 100;
    const currentRaw = prev?.[input.part === "ca" ? "ca_score" : "exam_score"];
    const current = currentRaw === null || currentRaw === undefined ? null : Number(currentRaw);
    const base = {
      studentId: s.id as string,
      fullName: s.full_name as string,
      admissionNumber: s.admission_number as string,
      classId,
      classLabel: classId ? labelFor.get(classId) ?? "Class" : "No class",
      score,
      total,
    };
    if (!classId) rows.push({ ...base, mark: null, current, action: "skip", note: "Not in a class" });
    else if (!takesSubject.has(classId)) rows.push({ ...base, mark: null, current, action: "skip", note: "Their class doesn't take this subject" });
    else if (exemptIds.has(s.id as string)) rows.push({ ...base, mark: null, current, action: "skip", note: "Doesn't take this subject" });
    else if (current === null) rows.push({ ...base, mark, current, action: "add", note: null });
    else if (current === mark) rows.push({ ...base, mark, current, action: "keep", note: "Already this mark" });
    else if (input.overwrite) rows.push({ ...base, mark, current, action: "replace", note: null });
    else rows.push({ ...base, mark, current, action: "keep", note: "Has a mark already" });
  }
  return rows.sort((x, y) => x.classLabel.localeCompare(y.classLabel) || x.fullName.localeCompare(y.fullName));
}

/**
 * Write a plan's add/replace rows: only the chosen part (CA or exam), and
 * only where that mark is still what the plan saw (see writeScores). The
 * other part of each mark is left as it is.
 */
export async function applyCbtTransfer(input: {
  termId: string;
  subjectId: string;
  part: ScorePart;
  rows: TransferRow[];
}): Promise<number> {
  const rows: ScoreWrite[] = input.rows
    .filter((r) => r.action === "add" || r.action === "replace")
    .map((r) => ({ studentId: r.studentId, classId: r.classId, [input.part]: { value: r.mark, was: r.current } }));
  const { saved } = await writeScores({ termId: input.termId, subjectId: input.subjectId, rows });
  return saved;
}
