import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { classLabel } from "@/lib/classes";
import { subjectHasMarksMessage, type SubjectUsage } from "@/lib/subjectRemoval";
import type { ClassName, Department, Subject } from "@/lib/types";

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

/**
 * What removing a subject would touch (see SubjectUsage), or null when there
 * is no such subject. Marks keep a subject in the catalog: the database
 * refuses to remove one that has them.
 */
export async function subjectUsage(id: string): Promise<SubjectUsage | null> {
  const supa = serviceClient();
  const [subject, offered, marks, exemptions] = await Promise.all([
    supa.from("subjects").select("id").eq("id", id).maybeSingle(),
    supa.from("class_subjects").select("classes(level, arm, campuses(name))").eq("subject_id", id),
    supa.from("term_scores").select("id", { count: "exact", head: true }).eq("subject_id", id),
    supa.from("student_subject_exemptions").select("id", { count: "exact", head: true }).eq("subject_id", id),
  ]);
  for (const r of [subject, offered, marks, exemptions]) if (r.error) throw new Error(r.error.message);
  if (!subject.data) return null;

  type Offered = { classes: { level: ClassName; arm: string | null; campuses: { name: string } | null } | null };
  const classes = ((offered.data ?? []) as unknown as Offered[])
    .flatMap((r) => (r.classes ? [classLabel({ ...r.classes, campusName: r.classes.campuses?.name })] : []))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { classes, exemptions: exemptions.count ?? 0, hasMarks: (marks.count ?? 0) > 0 };
}

/** Remove a subject from the catalog. False when there was no such subject. */
export async function deleteSubject(id: string): Promise<boolean> {
  const { data, error } = await serviceClient().from("subjects").delete().eq("id", id).select("id");
  if (error) {
    // term_scores.subject_id is ON DELETE RESTRICT: marks keep the subject.
    // Checked by constraint name, so another restricting table added later
    // isn't reported as marks.
    if ((error as { code?: string }).code === "23503" && error.message.includes("term_scores_subject_id_fkey")) {
      const { data: s } = await serviceClient().from("subjects").select("name").eq("id", id).maybeSingle();
      throw new Error(subjectHasMarksMessage((s?.name as string | undefined) ?? "This subject"));
    }
    throw new Error(error.message);
  }
  return (data ?? []).length > 0;
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
