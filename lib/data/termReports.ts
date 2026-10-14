import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Rating } from "@/lib/reportCard";

export type TermReportRow = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  ratings: Partial<Record<string, Rating>>;
  teacherComment: string;
};

/** A class's active students, each with their ratings and comment for a term (blank if none yet). */
export async function listClassTermReports(classId: string, termId: string): Promise<TermReportRow[]> {
  const supa = serviceClient();
  const { data: students } = await supa
    .from("students")
    .select("id, full_name, admission_number")
    .eq("class_id", classId)
    .eq("active", true)
    .order("full_name", { ascending: true });
  const roster = students ?? [];
  if (roster.length === 0) return [];

  const { data: reports } = await supa
    .from("term_reports")
    .select("student_id, ratings, teacher_comment")
    .eq("term_id", termId)
    .in("student_id", roster.map((s) => s.id as string));
  const byStudent = new Map((reports ?? []).map((r) => [r.student_id as string, r]));

  return roster.map((s) => {
    const report = byStudent.get(s.id as string);
    return {
      studentId: s.id as string,
      fullName: s.full_name as string,
      admissionNumber: s.admission_number as string,
      ratings: (report?.ratings as TermReportRow["ratings"]) ?? {},
      teacherComment: (report?.teacher_comment as string | null) ?? "",
    };
  });
}

export async function saveTermReport(input: {
  studentId: string;
  termId: string;
  ratings: Partial<Record<string, Rating>>;
  teacherComment: string;
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
        updated_by: input.updatedBy,
      },
      { onConflict: "student_id,term_id" }
    );
  if (error) throw new Error(error.message);
}
