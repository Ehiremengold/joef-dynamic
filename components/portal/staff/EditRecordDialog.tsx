"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, sendJson } from "@/lib/client/api";
import { EDITABLE_FIELDS, FIELD_LABELS, type EditableField, type FieldValues, type RecordType } from "@/lib/recordChanges";

const INPUT = "mt-1 w-full rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy";

/**
 * Edit a student's or staff member's details. A super admin's change is
 * saved at once; an admin's goes to a super admin for approval, with a reason.
 */
export default function EditRecordDialog({
  recordType,
  recordId,
  title,
  initial,
  superAdmin,
  onClose,
  onDone,
  onUnauthorized,
}: {
  recordType: RecordType;
  recordId: string;
  title: string;
  initial: FieldValues;
  superAdmin: boolean;
  onClose: () => void;
  /** applied: true when saved now, false when sent for approval. */
  onDone: (applied: boolean) => void;
  onUnauthorized: () => void;
}) {
  const fields = EDITABLE_FIELDS[recordType] as readonly EditableField[];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, initial[f] ?? ""]))
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changed = fields.filter((f) => (values[f] ?? "").trim() !== (initial[f] ?? ""));
  const needsReason = !superAdmin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const changes = Object.fromEntries(changed.map((f) => [f, values[f].trim() || null]));
      const d = await sendJson<{ applied: boolean }>("/api/change-requests", "POST", { recordType, recordId, changes, reason });
      onDone(d.applied);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not save the change");
    } finally {
      setBusy(false);
    }
  }

  const field = (f: EditableField, i: number) => {
    const common = {
      id: `edit-${f}`,
      value: values[f] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setValues((v) => ({ ...v, [f]: e.target.value })),
      className: `${INPUT} ${changed.includes(f) ? "border-brand-navy bg-brand-gold/10" : ""}`,
    };
    return (
      <div key={f} className={f === "address" ? "sm:col-span-2" : ""}>
        <label className="block text-[13px] font-semibold" htmlFor={`edit-${f}`}>{FIELD_LABELS[f]}</label>
        {f === "gender" ? (
          <select {...common} className={`${common.className} cursor-pointer bg-white`}>
            <option value="">Not recorded</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        ) : f === "address" ? (
          <textarea {...common} rows={2} />
        ) : (
          <input
            {...common}
            ref={i === 0 ? first : undefined}
            type={f === "dateOfBirth" ? "date" : f === "email" ? "email" : "text"}
            inputMode={f === "entryYear" || f === "phone" ? "numeric" : undefined}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="edit-title" className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-card border border-smoke bg-white p-6">
        <h3 id="edit-title" className="font-display text-lg font-bold tracking-tight">{title}</h3>
        <p className="mt-1 text-[13px] text-pewter">
          {superAdmin
            ? "As a super admin, your change is saved straight away and kept in the approvals history."
            : "Your change goes to a super admin for approval. It's applied once they approve it."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{fields.map(field)}</div>
        {recordType === "staff" && changed.includes("email") && (
          <p className="mt-2 text-[12px] text-ink">The email is also how they sign in, so their sign-in email changes too.</p>
        )}
        {needsReason && (
          <>
            <label className="mt-4 block text-[13px] font-semibold" htmlFor="edit-reason">Why is this change needed?</label>
            <textarea
              id="edit-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Name misspelt on admission; parent sent the birth certificate"
              className={INPUT}
            />
          </>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-[12px] text-pewter">
            {changed.length ? `${changed.length} field${changed.length === 1 ? "" : "s"} changed` : "Nothing changed yet"}
          </span>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || changed.length === 0 || (needsReason && reason.trim().length < 3)}
            className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : superAdmin ? "Save changes" : "Send for approval"}
          </button>
        </div>
      </form>
    </div>
  );
}
