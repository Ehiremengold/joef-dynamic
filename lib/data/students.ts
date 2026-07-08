import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { generatePin, hashPin, verifyPin } from "@/lib/auth/pin";
import type { ClassName, Student } from "@/lib/types";

type Row = Record<string, unknown>;

function mapStudent(r: Row): Student {
  return {
    id: r.id as string,
    admissionNumber: r.admission_number as string,
    fullName: r.full_name as string,
    className: r.class_name as ClassName,
    entryYear: r.entry_year as string,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

export async function listStudents(filter: {
  name?: string;
  className?: string;
  year?: string;
}): Promise<Student[]> {
  let q = serviceClient()
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });
  if (filter.name) q = q.ilike("full_name", `%${filter.name}%`);
  if (filter.className) q = q.eq("class_name", filter.className);
  if (filter.year) q = q.eq("entry_year", filter.year);
  const { data } = await q;
  return (data ?? []).map(mapStudent);
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
