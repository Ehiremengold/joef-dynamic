"use client";

import { useState } from "react";
import { ApiError, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import { FIELD_LABELS, showValue, type ChangeRequest, type EditableField } from "@/lib/recordChanges";
import { isSuperAdmin } from "@/lib/roles";
import type { SignedInStaff } from "@/lib/types";
import ApprovalsPanel from "./ApprovalsPanel";
import { useConfirm } from "./useConfirm";

const STATUS: Record<ChangeRequest["status"], { label: string; className: string }> = {
  pending: { label: "Waiting for approval", className: "bg-brand-gold text-ink" },
  approved: { label: "Approved and saved", className: "bg-brand-green/15 text-brand-green" },
  rejected: { label: "Rejected", className: "bg-mist text-graphite" },
  obsolete: { label: "Out of date: record changed since", className: "bg-mist text-graphite" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/**
 * Everything waiting for a super admin: changes to student and staff records,
 * and deletions of someone else's exams. Super admins decide; an admin sees
 * where their own requests stand.
 */
export default function ApprovalsTab({ me, onUnauthorized }: { me: SignedInStaff; onUnauthorized: () => void }) {
  const canDecide = isSuperAdmin(me.role);
  const invalidate = useInvalidate();
  const { confirm, dialog } = useConfirm();
  const q = useApi<{ requests: ChangeRequest[] }>("/api/change-requests", onUnauthorized);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const requests = q.data?.requests ?? [];

  async function decide(r: ChangeRequest, approve: boolean) {
    if (approve) {
      const ok = await confirm({
        title: `Approve the change to ${r.recordName}?`,
        message: "It's saved to their record straight away.",
        confirmLabel: "Approve and save",
      });
      if (!ok) return;
    }
    setBusyId(r.id);
    setError("");
    try {
      const d = await sendJson<{ status: ChangeRequest["status"] }>("/api/change-requests", "PATCH", { id: r.id, approve });
      if (d.status === "obsolete") setError(`${r.recordName}'s record was changed after this request was made, so it wasn't applied.`);
      await invalidate("/api/change-requests", "/api/students", "/api/staff", "/api/classes");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not record the decision");
    } finally {
      setBusyId("");
    }
  }

  const waiting = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-8">
      {dialog}
      <section data-tour="approvals-records" className="rounded-card border border-smoke bg-white p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Record changes</h2>
        <p className="mt-1 max-w-[680px] text-[13px] leading-relaxed text-pewter">
          {canDecide
            ? "Edits admins have made to student and staff records, waiting for your approval. Your own edits are saved at once and listed here for the record."
            : "Your edits to student and staff records, and what a super admin decided."}
        </p>
        {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
        {q.isPending ? (
          <p className="mt-4 text-sm text-graphite">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="mt-4 text-sm text-graphite">No record changes yet.</p>
        ) : (
          <>
            {canDecide && (
              <p className="mt-3 text-sm font-semibold text-ink">
                {waiting ? `${waiting} waiting for you` : "Nothing waiting for you"}
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-btn border border-smoke p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {r.recordName} <span className="font-normal text-pewter">· {r.recordType === "student" ? "Student" : "Staff"}</span>
                    </p>
                    <span className={`rounded-btn px-2 py-0.5 text-xs font-bold ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                  </div>
                  <table className="mt-2 text-sm">
                    <tbody>
                      {Object.keys(r.changes).map((f) => (
                        <tr key={f}>
                          <td className="py-0.5 pr-4 text-pewter">{FIELD_LABELS[f as EditableField] ?? f}</td>
                          <td className="py-0.5 text-graphite line-through decoration-pewter/60">{showValue(f as EditableField, r.previous[f as EditableField])}</td>
                          <td className="px-2 text-pewter">→</td>
                          <td className="py-0.5 font-semibold">{showValue(f as EditableField, r.changes[f as EditableField])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[13px] text-graphite">&ldquo;{r.reason}&rdquo;</p>
                  <p className="mt-1 text-[12px] text-pewter">
                    {r.requestedBy ?? "Someone"}, {when(r.createdAt)}
                    {r.decidedBy && r.status !== "pending" && r.decidedBy !== r.requestedBy ? `. Decided by ${r.decidedBy}, ${when(r.decidedAt!)}` : ""}
                  </p>
                  {canDecide && r.status === "pending" && (
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => decide(r, true)}
                        className="cursor-pointer rounded-btn bg-brand-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => decide(r, false)}
                        className="cursor-pointer rounded-btn border border-smoke px-4 py-1.5 text-sm font-semibold text-graphite hover:border-ink disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <ApprovalsPanel me={me} onDecided={() => invalidate("/api/exams", "/api/attempts")} onUnauthorized={onUnauthorized} />
    </div>
  );
}
