"use client";

import { useState } from "react";
import { ApiError, sendJson, useApi } from "@/lib/client/api";
import { describeDeletion, type DeletionImpact } from "@/lib/recordChanges";
import type { Student } from "@/lib/types";
import { closeOnBackdrop, useCloseOnEscape } from "./useCloseOnEscape";

const INPUT = "mt-1 w-full rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy";

/**
 * Delete a student, after showing what goes with them. An admin's deletion
 * goes to a super admin for approval; a super admin deletes straight away,
 * typing the admission number first when there's history to lose.
 */
export default function DeleteStudentDialog({
  student,
  classLabel,
  superAdmin,
  onClose,
  onDone,
  onUnauthorized,
}: {
  student: Student;
  classLabel: string;
  superAdmin: boolean;
  onClose: () => void;
  onDone: (applied: boolean) => void;
  onUnauthorized: () => void;
}) {
  const q = useApi<{ impact: DeletionImpact }>(`/api/students/${student.id}/deletion-impact`, onUnauthorized, { staleTime: 0 });
  const impact = q.data?.impact;
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useCloseOnEscape(onClose);

  const history = impact ? impact.marks + impact.attendance + impact.reports : 0;
  const { lost, kept } = impact ? describeDeletion(impact) : { lost: [], kept: null };
  // Irreversible and immediate: ask a super admin to type the number when there's history to lose.
  const mustType = superAdmin && history > 0;
  const ready = reason.trim().length >= 3 && (!mustType || typed.trim().toUpperCase() === student.admissionNumber.toUpperCase());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await sendJson<{ applied: boolean }>("/api/change-requests", "POST", {
        action: "delete",
        recordType: "student",
        recordId: student.id,
        reason,
      });
      onDone(d.applied);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not delete the student");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={closeOnBackdrop(onClose)}>
      <form onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="del-title" className="w-full max-w-[480px] rounded-card border border-smoke bg-white p-6">
        <h3 id="del-title" className="font-display text-lg font-bold tracking-tight">Delete {student.fullName}?</h3>
        <p className="mt-1 text-[13px] text-pewter">
          {student.admissionNumber} · {classLabel}
        </p>
        {!impact ? (
          <p className="mt-4 text-sm text-graphite">Checking what they have on record…</p>
        ) : (
          <>
            <div className="mt-4 rounded-btn bg-mist p-3 text-sm">
              {lost.length === 0 ? (
                <p className="text-graphite">Nothing else is on record for this student.</p>
              ) : (
                <>
                  <p className="font-semibold text-ink">Deleted with them, and can&rsquo;t be brought back:</p>
                  <ul className="mt-1 list-disc pl-5 text-graphite">
                    {lost.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </>
              )}
              {kept && <p className="mt-2 text-[13px] text-graphite">{kept}</p>}
            </div>
            {history > 0 && (
              <p className="mt-3 text-[13px] text-ink">
                If they&rsquo;ve left the school, <strong>Deactivate</strong> instead keeps their history and their transcript. Delete is
                for a record that shouldn&rsquo;t exist, such as a duplicate.
              </p>
            )}
            <label className="mt-4 block text-[13px] font-semibold" htmlFor="del-reason">Why should this student be deleted?</label>
            <textarea
              id="del-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate of JDCL-00705, the same boy"
              className={INPUT}
            />
            {mustType && (
              <>
                <label className="mt-3 block text-[13px] font-semibold" htmlFor="del-confirm">
                  Type <span className="font-mono">{student.admissionNumber}</span> to confirm
                </label>
                <input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={INPUT} />
              </>
            )}
            {!superAdmin && <p className="mt-3 text-[13px] text-pewter">A super admin will review this before anything is deleted.</p>}
          </>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !impact || !ready}
            className="cursor-pointer rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working…" : superAdmin ? "Delete permanently" : "Request deletion"}
          </button>
        </div>
      </form>
    </div>
  );
}
