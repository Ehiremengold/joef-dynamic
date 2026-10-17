// What can be edited on a student's or staff member's record, shared by the
// edit forms, the approval list and the server that checks and applies it.

export type RecordType = "student" | "staff";

export const EDITABLE_FIELDS = {
  student: ["fullName", "admissionNumber", "gender", "dateOfBirth", "phone", "address", "entryYear"],
  staff: ["fullName", "email"],
} as const satisfies Record<RecordType, readonly string[]>;

export type StudentField = (typeof EDITABLE_FIELDS.student)[number];
export type StaffField = (typeof EDITABLE_FIELDS.staff)[number];
export type EditableField = StudentField | StaffField;

/** A field's value: text, or null for "not recorded". */
export type FieldValues = Partial<Record<EditableField, string | null>>;

export const FIELD_LABELS: Record<EditableField, string> = {
  fullName: "Full name",
  admissionNumber: "Admission number",
  gender: "Gender",
  dateOfBirth: "Date of birth",
  phone: "Phone",
  address: "Address",
  entryYear: "Entry year",
  email: "Email",
};

export type ChangeRequest = {
  id: string;
  recordType: RecordType;
  recordId: string;
  recordName: string;
  changes: FieldValues;
  previous: FieldValues;
  reason: string;
  requestedBy: string | null;
  status: "pending" | "approved" | "rejected" | "obsolete";
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

/** How a value reads in the approval list. */
export function showValue(field: EditableField, v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "(blank)";
  if (field === "gender") return v === "male" ? "Male" : v === "female" ? "Female" : v;
  return v;
}
