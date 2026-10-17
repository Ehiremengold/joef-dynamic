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

/** What deleting a student takes with it, shown before anyone confirms. */
export type DeletionImpact = {
  marks: number;
  attendance: number;
  reports: number;
  parents: number;
  exemptions: number;
  promotions: number;
  /** Tests they have open right now. */
  sittings: number;
  /** CBT results stay (under the student's name) but are no longer linked. */
  testResults: number;
};

/** A deletion request's record of the student, kept even after they are gone. */
export type DeletionSnapshot = { admissionNumber: string; className: string; impact: DeletionImpact };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What a deletion removes, as short phrases ("4 subject marks"), and what it
 * leaves. One wording for the delete form and the approval list.
 */
export function describeDeletion(i: DeletionImpact): { lost: string[]; kept: string | null } {
  const lost = [
    i.marks && plural(i.marks, "subject mark", "subject marks"),
    i.attendance && plural(i.attendance, "term of attendance", "terms of attendance"),
    i.reports && plural(i.reports, "report-card comment", "report-card comments"),
    i.parents && plural(i.parents, "parent link", "parent links"),
    i.exemptions && plural(i.exemptions, "subject exemption", "subject exemptions"),
    i.promotions && plural(i.promotions, "promotion record", "promotion records"),
    i.sittings && plural(i.sittings, "test in progress", "tests in progress"),
  ].filter(Boolean) as string[];
  const kept = i.testResults
    ? `Their ${plural(i.testResults, "CBT result stays", "CBT results stay")} under Results with their name.`
    : null;
  return { lost, kept };
}

export type ChangeRequest = {
  id: string;
  /** An edit changes fields; a delete removes the record. */
  action: "edit" | "delete";
  /** For a delete: who it was and what went with them. */
  deletion: DeletionSnapshot | null;
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
