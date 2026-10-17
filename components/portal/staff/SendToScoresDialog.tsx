"use client";

import { useEffect, useState } from "react";
import { ApiError, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import { CA_MAX, EXAM_MAX, type Exam, type Subject, type Term } from "@/lib/types";

type Part = "ca" | "exam";
type Row = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  classLabel: string;
  score: number;
  total: number;
  mark: number | null;
  current: number | null;
  action: "add" | "replace" | "keep" | "skip";
  note: string | null;
};
type Plan = { rows: Row[]; saved: number; canSave: boolean };

const SELECT = "mt-1 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy";
const ACTION: Record<Row["action"], { label: string; className: string }> = {
  add: { label: "Add", className: "text-brand-green" },
  replace: { label: "Replace", className: "text-brand-red" },
  keep: { label: "Keep", className: "text-pewter" },
  skip: { label: "Skip", className: "text-pewter" },
};

/** A subject whose name appears in the exam title ("First Term Mathematics" → Mathematics). */
function guessSubject(title: string, subjects: Subject[]): string {
  const t = title.toLowerCase();
  return [...subjects].sort((a, b) => b.name.length - a.name.length).find((s) => t.includes(s.name.toLowerCase()))?.id ?? "";
}

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
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const termId = chosenTerm || terms.find((t) => t.isCurrent)?.id || "";
  const subjectId = chosenSubject || guessSubject(exam.title, subjects);
  const max = part === "ca" ? CA_MAX : EXAM_MAX;
  const options = { termId, subjectId, part, overwrite, wholeMarks };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Preview again whenever an option changes; only the newest answer is shown.
  useEffect(() => {
    if (!termId || !subjectId) return;
    let stale = false;
    setLoading(true);
    setError("");
    setDone("");
    sendJson<Plan>(`/api/exams/${exam.id}/send-to-scores`, "POST", { ...options, preview: true })
      .then((p) => !stale && setPlan(p))
      .catch((e) => {
        if (stale) return;
        if (e instanceof ApiError && e.status === 401) return onUnauthorized();
        setPlan(null);
        setError(e instanceof Error ? e.message : "Could not prepare the marks");
      })
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, termId, subjectId, part, overwrite, wholeMarks]);

  const rows = plan?.rows ?? [];
  const count = (a: Row["action"]) => rows.filter((r) => r.action === a).length;
  const writing = count("add") + count("replace");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const p = await sendJson<Plan>(`/api/exams/${exam.id}/send-to-scores`, "POST", options);
      setPlan(p);
      setDone(`${p.saved} mark${p.saved === 1 ? "" : "s"} saved to Term scores.`);
      // Term-score sheets and their progress counts live under each class.
      invalidate("/api/classes/*");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not save the marks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="send-title" className="flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-card border border-smoke bg-white">
        <div className="border-b border-smoke p-6">
          <h3 id="send-title" className="font-display text-lg font-bold tracking-tight">Send &ldquo;{exam.title}&rdquo; to Term scores</h3>
          <p className="mt-1 text-[13px] text-pewter">
            Each student&rsquo;s CBT score is scaled to the mark you choose, e.g. 32/40 as CA (out of {CA_MAX}) is 32, as exam (out of {EXAM_MAX}) is 48.
            Students who didn&rsquo;t sit it are left as they are.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-[13px] font-semibold">
              Term
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className={SELECT}>
                <option value="">Choose…</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}, {t.sessionName}
                    {t.isCurrent ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-semibold">
              Subject
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={SELECT}>
                <option value="">Choose…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-semibold">
              Counts as
              <select value={part} onChange={(e) => setPart(e.target.value as Part)} className={SELECT}>
                <option value="ca">CA (out of {CA_MAX})</option>
                <option value="exam">Exam (out of {EXAM_MAX})</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={wholeMarks} onChange={(e) => setWholeMarks(e.target.checked)} className="h-4 w-4 accent-brand-navy" />
              Round to whole marks
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4 accent-brand-navy" />
              Replace {part === "ca" ? "CA" : "exam"} marks already entered
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {!termId || !subjectId ? (
            <p className="text-sm text-graphite">Choose the term and subject to see the marks.</p>
          ) : loading && !plan ? (
            <p className="text-sm text-graphite">Working out the marks…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-graphite">
              {error ? "" : "No results to send: nobody you can enter marks for has sat this test yet."}
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
            {rows.length > 0 &&
              [
                count("add") && `${count("add")} to add`,
                count("replace") && `${count("replace")} to replace`,
                count("keep") && `${count("keep")} kept as they are`,
                count("skip") && `${count("skip")} skipped`,
              ]
                .filter(Boolean)
                .join(", ")}
          </p>
          {error && <p className="w-full text-sm font-semibold text-brand-red" role="alert">{error}</p>}
          {done && <p className="w-full text-sm font-semibold text-brand-green">{done}</p>}
          {plan && !plan.canSave && <p className="w-full text-[13px] text-ink">Only an admin can change a past term&rsquo;s scores.</p>}
          <button type="button" onClick={onClose} className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink">
            {done ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || writing === 0 || !plan?.canSave}
            className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : `Save ${writing} mark${writing === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
