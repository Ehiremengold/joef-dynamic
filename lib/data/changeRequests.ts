import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import {
  EDITABLE_FIELDS,
  type ChangeRequest,
  type DeletionSnapshot,
  type EditableField,
  type FieldValues,
  type RecordType,
} from "@/lib/recordChanges";
import { classLabel } from "@/lib/classes";
import type { ClassName } from "@/lib/types";
import { deleteStudent, normaliseAdmissionNumber, studentDeletionImpact } from "./students";

type Row = Record<string, unknown>;

/** Field name on screen → column in the table. */
const COLUMN: Record<EditableField, string> = {
  fullName: "full_name",
  admissionNumber: "admission_number",
  gender: "gender",
  dateOfBirth: "date_of_birth",
  phone: "phone",
  address: "address",
  entryYear: "entry_year",
  email: "email",
};
const TABLE: Record<RecordType, string> = { student: "students", staff: "staff" };

/** A record's editable fields as they stand, and its name. */
export async function currentValues(type: RecordType, id: string): Promise<{ name: string; values: FieldValues } | null> {
  const fields = EDITABLE_FIELDS[type];
  const { data } = await serviceClient()
    .from(TABLE[type])
    .select(fields.map((f) => COLUMN[f]).join(", "))
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row;
  const values: FieldValues = {};
  for (const f of fields) values[f] = row[COLUMN[f]] === null || row[COLUMN[f]] === undefined ? null : String(row[COLUMN[f]]);
  return { name: values.fullName ?? "", values };
}

/** A problem with what was asked for, to show the person asking. */
export class ChangeError extends Error {}

/**
 * Tidy and check proposed values; returns only the fields that actually
 * change. Throws ChangeError with a message fit for the screen.
 */
export async function checkChanges(type: RecordType, id: string, raw: Record<string, unknown>, current: FieldValues): Promise<FieldValues> {
  const out: FieldValues = {};
  for (const f of EDITABLE_FIELDS[type] as readonly EditableField[]) {
    if (!(f in raw)) continue;
    const text = raw[f] === null || raw[f] === undefined ? "" : String(raw[f]).trim().replace(/\s+/g, " ");
    let v: string | null = text === "" ? null : text;
    switch (f) {
      case "fullName":
        if (!v || v.length < 2) throw new ChangeError("Enter a name");
        break;
      case "admissionNumber":
        if (!v) throw new ChangeError("A student needs an admission number");
        v = normaliseAdmissionNumber(v);
        break;
      case "gender":
        if (v !== null && v !== "male" && v !== "female") throw new ChangeError("Gender must be male or female");
        break;
      case "dateOfBirth": {
        if (v === null) break;
        const t = Date.parse(`${v}T00:00:00Z`);
        const year = Number(v.slice(0, 4));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(t) || year < 1990 || t > Date.now()) {
          throw new ChangeError("Enter a real date of birth");
        }
        break;
      }
      case "entryYear":
        if (!v || !/^\d{4}$/.test(v)) throw new ChangeError("Entry year must be a year, e.g. 2026");
        break;
      case "email":
        v = v?.toLowerCase() ?? null;
        if (!v || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new ChangeError("Enter a valid email address");
        break;
    }
    if (v !== (current[f] ?? null)) out[f] = v;
  }
  if (Object.keys(out).length === 0) throw new ChangeError("Nothing has changed");

  // Numbers and emails belong to one record each.
  const supa = serviceClient();
  if (out.admissionNumber) {
    const { data } = await supa.from("students").select("full_name").eq("admission_number", out.admissionNumber).neq("id", id).maybeSingle();
    if (data) throw new ChangeError(`Admission number ${out.admissionNumber} already belongs to ${data.full_name}`);
  }
  if (out.email) {
    const { data } = await supa.from("staff").select("full_name").ilike("email", out.email).neq("id", id).maybeSingle();
    if (data) throw new ChangeError(`${out.email} is already used by ${data.full_name}`);
  }
  return out;
}

/** Write the changes to the record. A staff email is also the sign-in, so Supabase Auth changes with it. */
async function apply(type: RecordType, id: string, changes: FieldValues, previous: FieldValues): Promise<void> {
  const supa = serviceClient();
  if (type === "staff" && changes.email) {
    const { error } = await supa.auth.admin.updateUserById(id, { email: changes.email, email_confirm: true });
    if (error) throw new ChangeError(`Could not change the sign-in email: ${error.message}`);
  }
  const row: Row = {};
  for (const [f, v] of Object.entries(changes)) row[COLUMN[f as EditableField]] = v;
  const { error } = await supa.from(TABLE[type]).update(row).eq("id", id);
  if (error) {
    // Keep sign-in and profile in step if the profile write fails.
    if (type === "staff" && changes.email && previous.email) {
      await supa.auth.admin.updateUserById(id, { email: previous.email, email_confirm: true });
    }
    throw new ChangeError((error as { code?: string }).code === "23505" ? "That value is already used by another record" : error.message);
  }
}

const SELECT = "*, requester:staff!requested_by(full_name), decider:staff!decided_by(full_name)";

function map(r: Row): ChangeRequest {
  return {
    id: r.id as string,
    action: ((r.action as string | undefined) ?? "edit") as ChangeRequest["action"],
    recordType: r.record_type as RecordType,
    recordId: r.record_id as string,
    recordName: r.record_name as string,
    changes: (r.changes as FieldValues) ?? {},
    previous: r.action === "delete" ? {} : ((r.previous as FieldValues) ?? {}),
    deletion: r.action === "delete" ? ((r.previous as DeletionSnapshot | null) ?? null) : null,
    reason: r.reason as string,
    requestedBy: ((r.requester as Row | null)?.full_name as string | undefined) ?? null,
    status: r.status as ChangeRequest["status"],
    decidedBy: ((r.decider as Row | null)?.full_name as string | undefined) ?? null,
    decidedAt: (r.decided_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Pending first, then the latest decisions. `requestedBy` narrows to one person's requests. */
export async function listChangeRequests(filter: { requestedBy?: string; pendingOnly?: boolean } = {}): Promise<ChangeRequest[]> {
  let q = serviceClient().from("record_change_requests").select(SELECT).order("created_at", { ascending: false }).limit(100);
  if (filter.requestedBy) q = q.eq("requested_by", filter.requestedBy);
  if (filter.pendingOnly) q = q.eq("status", "pending");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const all = (data ?? []).map(map);
  return [...all.filter((r) => r.status === "pending"), ...all.filter((r) => r.status !== "pending")];
}

/** Write a request to the history; returns its id. */
async function recordRequest(row: Row): Promise<string> {
  const { data, error } = await serviceClient().from("record_change_requests").insert(row).select("id").single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new ChangeError("A change to this record is already waiting for approval. A super admin needs to decide on it first.");
    }
    throw new Error(error.message);
  }
  return data.id as string;
}

/**
 * A super admin's own change: recorded as approved first, then made. If
 * making it fails, the history entry is taken back out, so the history never
 * claims a change that didn't happen.
 */
async function recordThenDo(row: Row, work: () => Promise<void>): Promise<void> {
  const id = await recordRequest({ ...row, status: "approved", decided_by: row.requested_by, decided_at: new Date().toISOString() });
  try {
    await work();
  } catch (e) {
    await serviceClient().from("record_change_requests").delete().eq("id", id);
    throw e;
  }
}

/**
 * Ask for a change. A super admin's change is applied at once and recorded
 * as approved by them; anyone else's waits for a super admin.
 */
export async function requestChange(input: {
  type: RecordType;
  id: string;
  changes: Record<string, unknown>;
  reason: string;
  requestedBy: string;
  applyNow: boolean;
}): Promise<{ applied: boolean }> {
  const current = await currentValues(input.type, input.id);
  if (!current) throw new ChangeError("Record not found");
  const changes = await checkChanges(input.type, input.id, input.changes, current.values);
  const previous: FieldValues = Object.fromEntries(Object.keys(changes).map((f) => [f, current.values[f as EditableField] ?? null]));
  const row: Row = {
    record_type: input.type,
    record_id: input.id,
    record_name: current.name,
    changes,
    previous,
    reason: input.reason,
    requested_by: input.requestedBy,
  };
  if (input.applyNow) await recordThenDo(row, () => apply(input.type, input.id, changes, previous));
  else await recordRequest({ ...row, status: "pending" });
  return { applied: input.applyNow };
}

/**
 * Ask to delete a student. A super admin's deletion happens at once and is
 * recorded as approved by them; anyone else's waits for a super admin.
 * Who they were and what goes with them are kept with the request.
 */
export async function requestStudentDeletion(input: {
  id: string;
  reason: string;
  requestedBy: string;
  applyNow: boolean;
}): Promise<{ applied: boolean }> {
  const { data: s } = await serviceClient()
    .from("students")
    .select("full_name, admission_number, class_name, classes(level, arm, campuses(name))")
    .eq("id", input.id)
    .maybeSingle();
  if (!s) throw new ChangeError("Student not found");
  const cls = s.classes as unknown as Row | null;
  const snapshot: DeletionSnapshot = {
    admissionNumber: s.admission_number as string,
    className: cls
      ? classLabel({ campusName: (cls.campuses as Row | null)?.name as string | undefined, level: cls.level as ClassName, arm: (cls.arm as string | null) ?? null })
      : (s.class_name as string),
    impact: await studentDeletionImpact(input.id),
  };
  const row: Row = {
    action: "delete",
    record_type: "student",
    record_id: input.id,
    record_name: s.full_name as string,
    changes: {},
    previous: snapshot,
    reason: input.reason,
    requested_by: input.requestedBy,
  };
  if (input.applyNow) await recordThenDo(row, () => deleteStudent(input.id));
  else await recordRequest({ ...row, status: "pending" });
  return { applied: input.applyNow };
}

/**
 * A super admin's decision. The request is claimed first (pending → the
 * decision, in one conditional update), so two super admins deciding at
 * once can't both act: the second is told it's already decided. Approving an
 * edit re-checks it against the record as it is now, and marks it obsolete
 * rather than overwrite a newer value. If carrying out an approval fails, the
 * request goes back to pending.
 */
export async function decideChangeRequest(id: string, approve: boolean, deciderId: string): Promise<ChangeRequest["status"]> {
  const supa = serviceClient();
  const { data: r } = await supa.from("record_change_requests").select("*").eq("id", id).maybeSingle();
  if (!r) throw new ChangeError("Request not found");
  if (r.status !== "pending") throw new ChangeError("This request has already been decided");
  const req = map(r);

  // Work out the outcome, and everything approving would do, before claiming.
  let status: ChangeRequest["status"] = "rejected";
  let carryOut: (() => Promise<void>) | null = null;
  if (approve && req.action === "delete") {
    const { data: still } = await supa.from("students").select("id").eq("id", req.recordId).maybeSingle();
    status = still ? "approved" : "obsolete";
    if (still) carryOut = () => deleteStudent(req.recordId);
  } else if (approve) {
    const now = await currentValues(req.recordType, req.recordId);
    const moved = !now || Object.keys(req.changes).some((f) => (now.values[f as EditableField] ?? null) !== (req.previous[f as EditableField] ?? null));
    if (moved) {
      status = "obsolete";
    } else {
      // Values may have become taken since (another record got the number).
      const changes = await checkChanges(req.recordType, req.recordId, req.changes, now.values);
      status = "approved";
      carryOut = () => apply(req.recordType, req.recordId, changes, req.previous);
    }
  }

  const { data: claimed, error } = await supa
    .from("record_change_requests")
    .update({ status, decided_by: deciderId, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  if (!claimed?.length) throw new ChangeError("Another super admin has just decided this request");

  if (carryOut) {
    try {
      await carryOut();
    } catch (e) {
      await supa.from("record_change_requests").update({ status: "pending", decided_by: null, decided_at: null }).eq("id", id);
      throw e;
    }
  }
  return status;
}
