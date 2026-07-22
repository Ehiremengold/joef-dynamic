import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { ClassAttendance, StudentAttendance } from "@/lib/types";

type Row = Record<string, unknown>;

function mapClassAttendance(r: Row): ClassAttendance {
  return {
    id: r.id as string,
    classId: r.class_id as string,
    termId: r.term_id as string,
    totalDays: r.total_days as number,
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: r.updated_at as string,
  };
}

function mapStudentAttendance(r: Row): StudentAttendance {
  return {
    id: r.id as string,
    studentId: r.student_id as string,
    termId: r.term_id as string,
    daysPresent: r.days_present as number,
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: r.updated_at as string,
  };
}

export async function getClassAttendance(
  classId: string,
  termId: string
): Promise<ClassAttendance | null> {
  const { data } = await serviceClient()
    .from("class_term_attendance")
    .select("*")
    .eq("class_id", classId)
    .eq("term_id", termId)
    .maybeSingle();
  return data ? mapClassAttendance(data) : null;
}

export async function upsertClassAttendance(input: {
  classId: string;
  termId: string;
  totalDays: number;
  updatedBy: string;
}): Promise<ClassAttendance> {
  const { data, error } = await serviceClient()
    .from("class_term_attendance")
    .upsert(
      {
        class_id: input.classId,
        term_id: input.termId,
        total_days: input.totalDays,
        updated_by: input.updatedBy,
      },
      { onConflict: "class_id,term_id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapClassAttendance(data);
}

/** A class roster joined with each student's days-present for a term (0 if not yet entered). */
export async function listStudentAttendance(
  classId: string,
  termId: string
): Promise<
  { studentId: string; fullName: string; admissionNumber: string; daysPresent: number }[]
> {
  const supa = serviceClient();
  const { data: students } = await supa
    .from("students")
    .select("id, full_name, admission_number")
    .eq("class_id", classId)
    .eq("active", true)
    .order("full_name", { ascending: true });
  const roster = students ?? [];
  if (roster.length === 0) return [];

  const ids = roster.map((s) => s.id as string);
  const { data: attendance } = await supa
    .from("student_attendance")
    .select("student_id, days_present")
    .eq("term_id", termId)
    .in("student_id", ids);
  const byStudent = new Map((attendance ?? []).map((a) => [a.student_id as string, a.days_present as number]));

  return roster.map((s) => ({
    studentId: s.id as string,
    fullName: s.full_name as string,
    admissionNumber: s.admission_number as string,
    daysPresent: byStudent.get(s.id as string) ?? 0,
  }));
}

export async function upsertStudentAttendance(
  entries: { studentId: string; termId: string; daysPresent: number }[],
  updatedBy: string
): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await serviceClient()
    .from("student_attendance")
    .upsert(
      entries.map((e) => ({
        student_id: e.studentId,
        term_id: e.termId,
        days_present: e.daysPresent,
        updated_by: updatedBy,
      })),
      { onConflict: "student_id,term_id" }
    );
  if (error) throw new Error(error.message);
}

/**
 * Attendance summary for one student in one term, for the result-slip PDF.
 * The caller passes the student's classId (they've already loaded the student),
 * so this does no student lookup of its own. Null if nothing is recorded yet.
 */
export async function getStudentAttendanceForTerm(
  studentId: string,
  classId: string,
  termId: string
): Promise<{ totalDays: number; daysPresent: number } | null> {
  const supa = serviceClient();
  const [{ data: classAttendance }, { data: studentAttendance }] = await Promise.all([
    supa
      .from("class_term_attendance")
      .select("total_days")
      .eq("class_id", classId)
      .eq("term_id", termId)
      .maybeSingle(),
    supa
      .from("student_attendance")
      .select("days_present")
      .eq("student_id", studentId)
      .eq("term_id", termId)
      .maybeSingle(),
  ]);
  if (!classAttendance && !studentAttendance) return null;

  return {
    totalDays: (classAttendance?.total_days as number | undefined) ?? 0,
    daysPresent: (studentAttendance?.days_present as number | undefined) ?? 0,
  };
}
