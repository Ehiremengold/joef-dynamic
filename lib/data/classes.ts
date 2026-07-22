import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Class, ClassName, ClassSubject } from "@/lib/types";

type Row = Record<string, unknown>;

function mapClass(r: Row): Class {
  const campus = r.campuses as Row | null;
  const teacher = r.staff as Row | null;
  return {
    id: r.id as string,
    campusId: r.campus_id as string,
    campusName: campus?.name as string | undefined,
    level: r.level as ClassName,
    arm: (r.arm as string | null) ?? null,
    classTeacherId: (r.class_teacher_id as string | null) ?? null,
    classTeacherName: (teacher?.full_name as string | undefined) ?? null,
    createdAt: r.created_at as string,
  };
}

const CLASS_SELECT = "*, campuses(name), staff(full_name)";

export async function listClasses(filter?: { campusId?: string }): Promise<Class[]> {
  let q = serviceClient()
    .from("classes")
    .select(CLASS_SELECT)
    .order("level", { ascending: true })
    .order("arm", { ascending: true });
  if (filter?.campusId) q = q.eq("campus_id", filter.campusId);
  const { data } = await q;
  return (data ?? []).map(mapClass);
}

export async function getClassById(id: string): Promise<Class | null> {
  const { data } = await serviceClient()
    .from("classes")
    .select(CLASS_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapClass(data) : null;
}

export async function createClass(input: {
  campusId: string;
  level: ClassName;
  arm: string | null;
  classTeacherId: string | null;
}): Promise<Class> {
  const { data, error } = await serviceClient()
    .from("classes")
    .insert({
      campus_id: input.campusId,
      level: input.level,
      arm: input.arm,
      class_teacher_id: input.classTeacherId,
    })
    .select(CLASS_SELECT)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That class/arm already exists on this campus");
    }
    throw new Error(error.message);
  }
  return mapClass(data);
}

export async function updateClass(
  id: string,
  patch: { arm?: string | null; classTeacherId?: string | null }
): Promise<Class | null> {
  const row: Row = {};
  if (patch.arm !== undefined) row.arm = patch.arm;
  if (patch.classTeacherId !== undefined) row.class_teacher_id = patch.classTeacherId;
  if (Object.keys(row).length === 0) return getClassById(id);

  const { data, error } = await serviceClient()
    .from("classes")
    .update(row)
    .eq("id", id)
    .select(CLASS_SELECT)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That class/arm already exists on this campus");
    }
    throw new Error(error.message);
  }
  return data ? mapClass(data) : null;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await serviceClient().from("classes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function mapClassSubject(r: Row): ClassSubject {
  const subject = r.subjects as Row | null;
  return {
    id: r.id as string,
    classId: r.class_id as string,
    subjectId: r.subject_id as string,
    subjectName: subject?.name as string | undefined,
    department: (subject?.department as ClassSubject["department"]) ?? null,
  };
}

export async function listClassSubjects(classId: string): Promise<ClassSubject[]> {
  const { data } = await serviceClient()
    .from("class_subjects")
    .select("*, subjects(name, department)")
    .eq("class_id", classId);
  return (data ?? []).map(mapClassSubject);
}

export async function addClassSubject(classId: string, subjectId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("class_subjects")
    .insert({ class_id: classId, subject_id: subjectId });
  if (error && (error as { code?: string }).code !== "23505") {
    throw new Error(error.message);
  }
}

export async function removeClassSubject(classId: string, subjectId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("class_subjects")
    .delete()
    .eq("class_id", classId)
    .eq("subject_id", subjectId);
  if (error) throw new Error(error.message);
}
