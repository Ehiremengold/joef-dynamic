import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { generatePin, hashPin, verifyPin } from "@/lib/auth/pin";
import type { Page } from "@/lib/paging";
import type { ClassName, Student } from "@/lib/types";
import { readPage } from "./paging";

type Row = Record<string, unknown>;

function mapStudent(r: Row): Student {
  return {
    id: r.id as string,
    admissionNumber: r.admission_number as string,
    fullName: r.full_name as string,
    className: r.class_name as ClassName,
    classId: (r.class_id as string | null) ?? null,
    entryYear: r.entry_year as string,
    gender: (r.gender as Student["gender"]) ?? null,
    dateOfBirth: (r.date_of_birth as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

/** One page of the roster, A–Z. */
export async function listStudentsPage(
  filter: { name?: string; className?: string; year?: string },
  page: number
): Promise<Page<Student>> {
  return readPage(
    (from, to) => {
      let q = serviceClient().from("students").select("*", { count: "exact" });
      if (filter.name) q = q.ilike("full_name", `%${filter.name}%`);
      if (filter.className) q = q.eq("class_name", filter.className);
      if (filter.year) q = q.eq("entry_year", filter.year);
      return q
        .order("full_name", { ascending: true })
        // admission numbers are unique, so pages never overlap or skip anyone
        .order("admission_number", { ascending: true })
        .range(from, to);
    },
    page,
    mapStudent
  );
}

/** Create a student; returns the record plus the plaintext PIN (shown once). */
export async function createStudent(input: {
  admissionNumber: string;
  fullName: string;
  className: ClassName;
  entryYear: string;
  createdBy: string;
}): Promise<{ student: Student; pin: string }> {
  const pin = generatePin(6);
  const pin_hash = await hashPin(pin);
  const { data, error } = await serviceClient()
    .from("students")
    .insert({
      admission_number: input.admissionNumber,
      full_name: input.fullName,
      class_name: input.className,
      entry_year: input.entryYear,
      pin_hash,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That admission number is already in use");
    }
    throw new Error(error.message);
  }
  return { student: mapStudent(data), pin };
}

/** Reset a student's PIN; returns the new plaintext PIN. */
export async function resetStudentPin(id: string): Promise<string> {
  const pin = generatePin(6);
  const pin_hash = await hashPin(pin);
  const { error } = await serviceClient()
    .from("students")
    .update({ pin_hash })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return pin;
}

/** Batch lookup, used to attach admission numbers to a list of attempts. */
export async function getStudentsByIds(ids: string[]): Promise<Student[]> {
  if (ids.length === 0) return [];
  const { data } = await serviceClient().from("students").select("*").in("id", ids);
  return (data ?? []).map(mapStudent);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const { data } = await serviceClient()
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapStudent(data) : null;
}

/**
 * Assign a student to a real class (Class Management). Keeps the legacy
 * class_name in sync from the class's level so exam-eligibility matching,
 * which still keys off class_name, is unaffected.
 */
export async function assignStudentClass(
  id: string,
  classId: string,
  level: ClassName
): Promise<void> {
  const { error } = await serviceClient()
    .from("students")
    .update({ class_id: classId, class_name: level })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Remove a student's class assignment. Leaves the legacy class_name untouched
 * (it's NOT NULL and the exam system still reads it) — only the class_id link
 * to a real Class Management record is cleared.
 */
export async function unassignStudentClass(id: string): Promise<void> {
  const { error } = await serviceClient()
    .from("students")
    .update({ class_id: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setStudentActive(id: string, active: boolean): Promise<void> {
  const { error } = await serviceClient()
    .from("students")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Verify admission number + PIN for student login. */
export async function verifyStudentLogin(
  admissionNumber: string,
  pin: string
): Promise<Student | null> {
  const { data } = await serviceClient()
    .from("students")
    .select("*")
    .eq("admission_number", admissionNumber.trim())
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  const ok = await verifyPin(pin, data.pin_hash as string);
  return ok ? mapStudent(data) : null;
}
