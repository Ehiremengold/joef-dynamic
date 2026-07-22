import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Department, Subject } from "@/lib/types";

type Row = Record<string, unknown>;

function mapSubject(r: Row): Subject {
  return {
    id: r.id as string,
    name: r.name as string,
    code: (r.code as string | null) ?? null,
    department: (r.department as Department | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function listSubjects(): Promise<Subject[]> {
  const { data } = await serviceClient()
    .from("subjects")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []).map(mapSubject);
}

export async function createSubject(input: {
  name: string;
  code: string | null;
  department: Department | null;
}): Promise<Subject> {
  const { data, error } = await serviceClient()
    .from("subjects")
    .insert({ name: input.name, code: input.code, department: input.department })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("A subject with that name already exists");
    }
    throw new Error(error.message);
  }
  return mapSubject(data);
}

export async function updateSubject(
  id: string,
  patch: { name?: string; code?: string | null; department?: Department | null }
): Promise<Subject | null> {
  const row: Row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.code !== undefined) row.code = patch.code;
  if (patch.department !== undefined) row.department = patch.department;
  if (Object.keys(row).length === 0) {
    const { data } = await serviceClient().from("subjects").select("*").eq("id", id).maybeSingle();
    return data ? mapSubject(data) : null;
  }

  const { data, error } = await serviceClient()
    .from("subjects")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSubject(data) : null;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await serviceClient().from("subjects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** The full set of subject ids a student is exempt from (not taking). */
export async function listStudentExemptions(studentId: string): Promise<string[]> {
  const { data } = await serviceClient()
    .from("student_subject_exemptions")
    .select("subject_id")
    .eq("student_id", studentId);
  return (data ?? []).map((r) => r.subject_id as string);
}

/** Replace a student's full set of subject exemptions with `subjectIds`. */
export async function setStudentExemptions(
  studentId: string,
  subjectIds: string[]
): Promise<void> {
  const supa = serviceClient();
  const { error: delErr } = await supa
    .from("student_subject_exemptions")
    .delete()
    .eq("student_id", studentId);
  if (delErr) throw new Error(delErr.message);

  if (subjectIds.length === 0) return;
  const { error: insErr } = await supa
    .from("student_subject_exemptions")
    .insert(subjectIds.map((subjectId) => ({ student_id: studentId, subject_id: subjectId })));
  if (insErr) throw new Error(insErr.message);
}
