"use client";

import { useCallback, useEffect, useState } from "react";
import { isSuperAdmin } from "@/lib/roles";
import type { SignedInStaff } from "@/lib/types";

type DeletionRequest = {
  id: string;
  examTitle: string;
  questionText: string | null;
  reason: string;
  requestedBy: string | null;
  status: "pending" | "approved" | "rejected" | "obsolete";
  decidedBy: string | null;
  createdAt: string;
};

const STATUS: Record<DeletionRequest["status"], { label: string; className: string }> = {
  pending: { label: "Waiting for approval", className: "bg-brand-gold text-ink" },
  approved: { label: "Approved — deleted", className: "bg-brand-green/15 text-brand-green" },
  rejected: { label: "Rejected", className: "bg-mist text-graphite" },
  obsolete: { label: "Already gone or changed", className: "bg-mist text-graphite" },
};

/**
 * Deletions of someone else's exam or question, waiting for a super admin.
 * Super admins approve or reject them here; an admin sees their own requests.
 * Hidden when there are none.
 */
export default function ApprovalsPanel({
  me,
  onDecided,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onDecided: () => void;
  onUnauthorized: () => void;
}) {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const canDecide = isSuperAdmin(me.role);

  const load = useCallback(async () => {
    const res = await fetch("/api/deletion-requests");
    if (res.status === 401) return onUnauthorized();
    if (res.ok) setRequests((await res.json()).requests || []);
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(r: DeletionRequest, approve: boolean) {
    const what = r.questionText ? `this question from "${r.examTitle}"` : `the exam "${r.examTitle}" and all its questions`;
    if (approve && !window.confirm(`Delete ${what}? This cannot be undone.`)) return;
    setBusyId(r.id);
    setError("");
    try {
      const res = await fetch("/api/deletion-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, approve }),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not record the decision");
      await load();
      if (approve) onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the decision");
    } finally {
      setBusyId("");
    }
  }

  if (requests.length === 0) return null;
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <section className="rounded-card border border-smoke bg-white p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">
        {canDecide ? "Deletion requests" : "Your deletion requests"}
        {pending > 0 && (
          <span className="ml-2 rounded-btn bg-brand-gold px-2 py-0.5 align-middle text-xs font-bold text-ink">
            {pending} waiting
          </span>
        )}
      </h2>
      {error && <p className="mt-2 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
      <ul className="mt-4 space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-3 rounded-btn bg-mist px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {r.questionText ? (
                  <>
                    Remove a question from <span className="italic">{r.examTitle}</span>: “{r.questionText}”
                  </>
                ) : (
                  <>
                    Delete the exam <span className="italic">{r.examTitle}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[13px] text-graphite">
                {r.requestedBy ?? "Someone"}: “{r.reason}” · {new Date(r.createdAt).toLocaleDateString("en-GB")}
                {r.decidedBy && r.status !== "pending" ? ` · decided by ${r.decidedBy}` : ""}
              </p>
            </div>
            {canDecide && r.status === "pending" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r, true)}
                  className="cursor-pointer rounded-btn bg-brand-red px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r, false)}
                  className="cursor-pointer rounded-btn border border-ink px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : (
              <span className={`rounded-btn px-2 py-0.5 text-xs font-semibold ${STATUS[r.status].className}`}>
                {STATUS[r.status].label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
