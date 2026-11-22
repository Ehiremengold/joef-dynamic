"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ApiError, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import { CA_MAX, EXAM_MAX, type Exam, type Subject, type Term } from "@/lib/types";
import { closeOnBackdrop, useCloseOnEscape } from "./useCloseOnEscape";
import {
  describePlan,
  guessSubject,
  marksToWrite,
  PartSelect,
  previewUrl,
  SELECT,
  TermSelect,
  TransferChecks,
  transferPath,
  type Part,
  type TransferAction,
  type TransferOptions,
  type TransferPlan,
} from "./ScoreTransferFields";

type Row = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  classLabel: string;
  score: number;
  total: number;
  mark: number | null;
  current: number | null;
  action: TransferAction;
  note: string | null;
};
type Plan = TransferPlan<Row>;

const ACTION: Record<TransferAction, { label: string; className: string }> = {
  add: { label: "Add", className: "text-brand-green" },
  replace: { label: "Replace", className: "text-brand-red" },
  keep: { label: "Keep", className: "text-pewter" },
  skip: { label: "Skip", className: "text-pewter" },
};

/**
 * Put a class test's CBT results on the term score sheet as a subject's CA or
 * exam mark, scaled to that mark's maximum. Shows exactly what will change
 * before anything is saved.
 */
export default function SendToScoresDialog({ exam, onClose, onUnauthorized }: { exam: Exam; onClose: () => void; onUnauthorized: () => void }) {
  const invalidate = useInvalidate();
  const terms = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized).data?.terms ?? [];
  const subjects = useApi<{ subjects: Subject[] }>("/api/subjects", onUnauthorized).data?.subjects ?? [];
  const [chosenTerm, setTermId] = useState("");
  const [chosenSubject, setSubjectId] = useState("");
  const [part, setPart] = useState<Part>("ca");
  const [overwrite, setOverwrite] = useState(false);
  const [wholeMarks, setWholeMarks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const termId = chosenTerm || terms.find((t) => t.isCurrent)?.id || "";
  const subjectId = chosenSubject || guessSubject(exam.title, subjects);
  const max = part === "ca" ? CA_MAX : EXAM_MAX;
  const options: TransferOptions = { termId, subjectId, part, overwrite, wholeMarks };

  useCloseOnEscape(onClose);

  // The preview: read like any other list, and read again after a save.
  const previewPath = transferPath(exam.id);
  const previewQ = useApi<Plan>(previewUrl(exam.id, options), onUnauthorized, { staleTime: 0, placeholderData: keepPreviousData });
  const plan = previewQ.data ?? null;
  const loading = previewQ.isFetching;
  const shownError = error || previewQ.error?.message || "";

  const rows = plan?.rows ?? [];
  const writing = marksToWrite(plan);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const p = await sendJson<Plan>(previewPath, "POST", options);
      setDone(`${p.saved} mark${p.saved === 1 ? "" : "s"} saved to Term scores.`);
      // Term-score sheets and their progress counts live under each class; the preview changes too.
      invalidate("/api/classes/*", previewPath);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not save the marks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={closeOnBackdrop(onClose)}>
      <div role="dialog" aria-modal="true" aria-labelledby="send-title" className="flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-card border border-smoke bg-white">
        <div className="border-b border-smoke p-6">
          <h3 id="send-title" className="font-display text-lg font-bold tracking-tight">Send &ldquo;{exam.title}&rdquo; to Term scores</h3>
          <p className="mt-1 text-[13px] text-pewter">
            Each student&rsquo;s CBT score is scaled to the mark you choose, e.g. 32/40 as CA (out of {CA_MAX}) is 32, as exam (out of {EXAM_MAX}) is 48.
            Students who didn&rsquo;t sit it are left as they are.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <TermSelect terms={terms} value={termId} onChange={setTermId} />
            <label className="text-[13px] font-semibold">
              Subject
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={SELECT}>
                <option value="">Choose…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <PartSelect value={part} onChange={setPart} />
          </div>
          <TransferChecks part={part} wholeMarks={wholeMarks} overwrite={overwrite} onWholeMarks={setWholeMarks} onOverwrite={setOverwrite} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {!termId || !subjectId ? (
            <p className="text-sm text-graphite">Choose the term and subject to see the marks.</p>
          ) : previewQ.isPending ? (
            <p className="text-sm text-graphite">Working out the marks…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-graphite">
              {shownError ? "" : "No results to send: nobody you can enter marks for has sat this test yet."}
            </p>
          ) : (
            <table className={`w-full text-left text-sm ${loading ? "opacity-60" : ""}`}>
              <thead>
                <tr className="border-b border-smoke text-[12px] uppercase tracking-wide text-pewter">
                  <th className="py-2 pr-3 font-semibold">Student</th>
                  <th className="py-2 pr-3 font-semibold">Class</th>
                  <th className="py-2 pr-3 font-semibold">CBT</th>
                  <th className="py-2 pr-3 font-semibold">{part === "ca" ? "CA" : "Exam"} ({max})</th>
                  <th className="py-2 pr-3 font-semibold">Now</th>
                  <th className="py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId} className="border-b border-smoke last:border-0">
                    <td className="py-1.5 pr-3 font-semibold">{r.fullName}</td>
                    <td className="py-1.5 pr-3 text-graphite">{r.classLabel}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{r.score}/{r.total}</td>
                    <td className="py-1.5 pr-3 font-display font-bold tabular-nums">{r.mark ?? ""}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-graphite">{r.current ?? ""}</td>
                    <td className={`py-1.5 text-[13px] font-semibold ${ACTION[r.action].className}`}>
                      {ACTION[r.action].label}
                      {r.note && <span className="ml-1 font-normal text-pewter">({r.note})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-smoke p-6">
          <p className="mr-auto text-[13px] text-graphite">
            {plan && rows.length > 0 && describePlan(plan)}
          </p>
          {shownError && <p className="w-full text-sm font-semibold text-brand-red" role="alert">{shownError}</p>}
          {plan?.subjectWarning && <p className="w-full text-[13px] font-semibold text-ink">Check the subject: {plan.subjectWarning}</p>}
          {done && <p className="w-full text-sm font-semibold text-brand-green">{done}</p>}
          <button type="button" onClick={onClose} className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink">
            {done ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || writing === 0}
            className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : `Save ${writing} mark${writing === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
