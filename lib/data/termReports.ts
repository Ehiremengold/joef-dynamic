import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Ratings, TermReport, TermReportRow } from "@/lib/reportCard";

type Row = Record<string, unknown>;

export const TERM_REPORT_SELECT = "student_id, term_id, ratings, teacher_comment, signed_by";

/** A term_reports row (or none) as the report a teacher has written. */
export function mapTermReport(r: Row | undefined): TermReport {
  return {
    ratings: (r?.ratings as Ratings | undefined) ?? {},
    teacherComment: (r?.teacher_comment as string | null | undefined) ?? "",
    signedBy: (r?.signed_by as string | null | undefined) ?? null,
  };
}

/** Every term_scores row matching `filter` — a class's scores can pass Supabase's 1000-row cap. */
async function allScoreRows(filter: { termId: string; classId?: string; studentIds?: string[] }): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = serviceClient().from("term_scores").select("student_id, class_id").eq("term_id", filter.termId);
    if (filter.classId) q = q.eq("class_id", filter.classId);
    if (filter.studentIds) q = q.in("student_id", filter.studentIds);
    const { data } = await q.order("id").range(from, from + 999);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

/**
 * The class a student sat in for a term: the class on their scores for that
 * term, or — before any are entered — the class they are in today.
 */
export async function classForTerm(
  studentId: string,
  termId: string,
  currentClassId: string | null
): Promise<string | null> {
  const { data } = await serviceClient()
    .from("term_scores")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .not("class_id", "is", null)
    .limit(1)
    .maybeSingle();
  return (data?.class_id as string | undefined) ?? currentClassId;
}

/** The students who were in a class for a term, each with what has been written for them. */
/**
 * The students who were in a class for a term: everyone with scores in the
 * class for the term (whether active today or not), plus active students in
 * the class today who have no scores anywhere for the term yet. Shared by
 * report cards and term-score entry so both list the same children.
 */
export async function classTermStudentIds(classId: string, termId: string): Promise<string[]> {
  const supa = serviceClient();
  const [scoredRows, { data: current }] = await Promise.all([
    allScoreRows({ termId, classId }),
    supa.from("students").select("id").eq("class_id", classId).eq("active", true),
  ]);
  const scored = new Set(scoredRows.map((r) => r.student_id as string));
  const currentIds = (current ?? []).map((s) => s.id as string).filter((id) => !scored.has(id));
  const scoredElsewhere = new Set(
    currentIds.length ? (await allScoreRows({ termId, studentIds: currentIds })).map((r) => r.student_id as string) : []
  );
  return [...scored, ...currentIds.filter((id) => !scoredElsewhere.has(id))];
}

export async function listClassTermReports(classId: string, termId: string): Promise<TermReportRow[]> {
  const supa = serviceClient();
  const ids = await classTermStudentIds(classId, termId);
  if (ids.length === 0) return [];

  const [{ data: students }, { data: reports }] = await Promise.all([
    supa.from("students").select("id, full_name, admission_number").in("id", ids).order("full_name"),
    supa.from("term_reports").select(TERM_REPORT_SELECT).eq("term_id", termId).in("student_id", ids),
  ]);
  const byStudent = new Map((reports ?? []).map((r) => [r.student_id as string, r as Row]));

  return (students ?? []).map((s) => ({
    studentId: s.id as string,
    fullName: s.full_name as string,
    admissionNumber: s.admission_number as string,
    ...mapTermReport(byStudent.get(s.id as string)),
  }));
}

export async function saveTermReport(input: {
  studentId: string;
  termId: string;
  ratings: Ratings;
  teacherComment: string;
  signedBy: string;
  updatedBy: string;
}): Promise<void> {
  const { error } = await serviceClient()
    .from("term_reports")
    .upsert(
      {
        student_id: input.studentId,
        term_id: input.termId,
        ratings: input.ratings,
        teacher_comment: input.teacherComment || null,
        signed_by: input.signedBy,
        updated_by: input.updatedBy,
      },
      { onConflict: "student_id,term_id" }
    );
  if (error) throw new Error(error.message);
}
