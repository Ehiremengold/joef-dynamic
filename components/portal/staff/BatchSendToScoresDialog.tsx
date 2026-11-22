"use client";

import { useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ApiError, apiKey, getJson, sendJson, useApi, useInvalidate, useOn401 } from "@/lib/client/api";
import { CA_MAX, CLASSES, EXAM_MAX, type ClassName, type Exam, type Subject, type Term } from "@/lib/types";
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
  type TransferOptions,
  type TransferPlan,
} from "./ScoreTransferFields";

/** What saving one test did. */
type Outcome = { ok: true; saved: number } | { ok: false; error: string };

/**
 * Where one ticked test stands. "blocked" stops the save until it is fixed or
 * unticked; "waiting" holds it until the preview arrives.
 */
type RowState =
  | { kind: "saved" | "failed" | "blocked" | "waiting" | "empty"; text: string }
  | { kind: "ready"; text: string; plan: TransferPlan };

const TONE: Record<RowState["kind"], string> = {
  saved: "font-semibold text-brand-green",
  failed: "font-semibold text-brand-red",
  blocked: "font-semibold text-brand-red",
  waiting: "text-graphite",
  empty: "text-graphite",
  ready: "text-graphite",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Send several class tests to Term scores at once: one class, one term, CA or
 * exam for all of them, and each test into its own subject. Each ticked test
 * shows what it would do before anything is saved, as the single dialog does.
 */
export default function BatchSendToScoresDialog({
  exams,
  levels,
  initialClass,
  onClose,
  onUnauthorized,
}: {
  /** Every class test (entrance exams can't go on term scores). */
  exams: Exam[];
  /** The classes this person may send marks for: a class teacher's own; every class for an admin. */
  levels: readonly ClassName[];
  /** The class the exam list is filtered to, if any. */
  initialClass: string;
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  const invalidate = useInvalidate();
  const terms = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized).data?.terms ?? [];
  const subjectsQ = useApi<{ subjects: Subject[] }>("/api/subjects", onUnauthorized);
  const subjects = subjectsQ.data?.subjects ?? [];
  const classesWithTests = CLASSES.filter((c) => levels.includes(c) && exams.some((e) => e.className === c));
  const [className, setClassName] = useState<string>(
    classesWithTests.find((c) => c === initialClass) ?? classesWithTests[0] ?? ""
  );
  const [chosenTerm, setTermId] = useState("");
  const [part, setPart] = useState<Part>("ca");
  const [overwrite, setOverwrite] = useState(false);
  const [wholeMarks, setWholeMarks] = useState(true);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [chosenSubject, setChosenSubject] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // What the last save did. Any change to the choices clears it, so it never
  // describes choices other than the ones on screen.
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  useCloseOnEscape(onClose);

  /** A setter that also clears the last save's results. */
  function changing<T>(set: (v: T) => void) {
    return (v: T) => {
      setOutcomes({});
      set(v);
    };
  }

  const termId = chosenTerm || terms.find((t) => t.isCurrent)?.id || "";
  const tests = exams.filter((e) => e.className === className);
  const subjectOf = (e: Exam) => chosenSubject[e.id] ?? guessSubject(e.title, subjects);
  const optionsFor = (e: Exam): TransferOptions => ({ termId, subjectId: subjectOf(e), part, overwrite, wholeMarks });
  const picked = tests.filter((e) => ticked.has(e.id));

  // A preview for every ticked test, read like the single dialog's.
  const previews = useQueries({
    queries: picked.map((e) => {
      const url = previewUrl(e.id, optionsFor(e));
      return {
        queryKey: url ? apiKey(url) : ["disabled", e.id],
        queryFn: () => getJson<TransferPlan>(url!),
        enabled: url !== null,
        staleTime: 0,
      };
    }),
  });
  useOn401(previews.map((q) => q.error), onUnauthorized);
  const previewOf = new Map(picked.map((e, i) => [e.id, previews[i]]));
  const fetching = previews.some((q) => q.isFetching);

  // Each test's last preview stays on screen (dimmed) while a changed option
  // is worked out, rather than the row blanking to "Working out…". A new key
  // starts a new query, so React Query's keepPreviousData can't do it here.
  const lastPlan = useRef(new Map<string, TransferPlan>());
  for (const e of picked) {
    const data = previewOf.get(e.id)?.data;
    if (data) lastPlan.current.set(e.id, data);
  }

  // Two tests into the same subject would overwrite each other's marks.
  const subjectCount = new Map<string, number>();
  for (const e of picked) subjectCount.set(subjectOf(e), (subjectCount.get(subjectOf(e)) ?? 0) + 1);

  function stateOf(e: Exam): RowState {
    const outcome = outcomes[e.id];
    if (outcome) return outcome.ok ? { kind: "saved", text: `${plural(outcome.saved, "mark")} saved` } : { kind: "failed", text: outcome.error };
    if (!subjectOf(e)) return subjectsQ.isPending ? { kind: "waiting", text: "Loading subjects…" } : { kind: "blocked", text: "Choose its subject" };
    if ((subjectCount.get(subjectOf(e)) ?? 0) > 1) return { kind: "blocked", text: "Another ticked test uses this subject" };
    if (!termId) return { kind: "waiting", text: "Choose a term" };
    const q = previewOf.get(e.id);
    if (q?.error) return { kind: "blocked", text: q.error.message };
    const plan = q?.data ?? lastPlan.current.get(e.id);
    if (!plan) return { kind: "waiting", text: "Working out the marks…" };
    if (plan.rows.length === 0) return { kind: "empty", text: "Nobody you can enter marks for has sat it yet" };
    return { kind: "ready", text: describePlan(plan, "kept"), plan };
  }

  const states = picked.map((e) => ({ exam: e, state: stateOf(e) }));
  const finished = Object.keys(outcomes).length > 0;
  const toSend = states.filter(({ state }) => state.kind === "ready" && marksToWrite(state.plan) > 0);
  const totalMarks = toSend.reduce((n, { state }) => n + (state.kind === "ready" ? marksToWrite(state.plan) : 0), 0);

  // What stops the save, if anything.
  const problem = !termId
    ? "Choose a term."
    : picked.length === 0
      ? "Tick the tests to send."
      : states.some(({ state }) => state.kind === "blocked")
        ? "Fix the tests marked in red, or untick them."
        : states.some(({ state }) => state.kind === "waiting")
          ? "Working out the marks…"
          : totalMarks === 0
            ? "Nothing to save: these marks are already on the sheet."
            : "";

  function toggle(id: string, on: boolean) {
    setOutcomes({});
    setTicked((t) => {
      const next = new Set(t);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setOutcomes({});
    // One test at a time, so a failure in one is reported and the rest still go.
    for (const { exam } of toSend) {
      try {
        const p = await sendJson<TransferPlan>(transferPath(exam.id), "POST", optionsFor(exam));
        setOutcomes((o) => ({ ...o, [exam.id]: { ok: true, saved: p.saved ?? 0 } }));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setSaving(false);
          return onUnauthorized();
        }
        setOutcomes((o) => ({ ...o, [exam.id]: { ok: false, error: err instanceof Error ? err.message : "Could not save" } }));
      }
    }
    // The term-score sheets under each class, and the previews of the tests sent.
    invalidate("/api/classes/*", ...toSend.map(({ exam }) => transferPath(exam.id)));
    setSaving(false);
  }

  const results = Object.values(outcomes);
  const savedTotal = results.reduce((n, o) => n + (o.ok ? o.saved : 0), 0);
  const failed = results.filter((o) => !o.ok).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={closeOnBackdrop(onClose)}>
      <div role="dialog" aria-modal="true" aria-labelledby="batch-send-title" className="flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-card border border-smoke bg-white">
        <div className="border-b border-smoke p-6">
          <h3 id="batch-send-title" className="font-display text-lg font-bold tracking-tight">Send several tests to Term scores</h3>
          <p className="mt-1 text-[13px] text-pewter">
            Tick a class&rsquo;s tests and choose each one&rsquo;s subject. They all go to the same term, as CA (out of {CA_MAX}) or exam (out of {EXAM_MAX}).
            Students who didn&rsquo;t sit a test are left as they are.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-[13px] font-semibold">
              Class
              <select
                value={className}
                onChange={(e) => {
                  setOutcomes({});
                  setTicked(new Set());
                  setClassName(e.target.value);
                }}
                className={SELECT}
              >
                {classesWithTests.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <TermSelect terms={terms} value={termId} onChange={changing(setTermId)} />
            <PartSelect value={part} onChange={changing(setPart)} />
          </div>
          <TransferChecks
            part={part}
            wholeMarks={wholeMarks}
            overwrite={overwrite}
            onWholeMarks={changing(setWholeMarks)}
            onOverwrite={changing(setOverwrite)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {tests.length === 0 ? (
            <p className="text-sm text-graphite">No tests for your classes yet.</p>
          ) : (
            <>
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
                <input
                  type="checkbox"
                  checked={picked.length === tests.length}
                  onChange={(e) => {
                    setOutcomes({});
                    setTicked(e.target.checked ? new Set(tests.map((t) => t.id)) : new Set());
                  }}
                  className="h-4 w-4 accent-brand-navy"
                />
                Tick all {plural(tests.length, "test")} for {className}
              </label>
              <ul className="divide-y divide-smoke">
                {tests.map((e) => {
                  const on = ticked.has(e.id);
                  const state = on ? stateOf(e) : null;
                  const refreshing = on && previewOf.get(e.id)?.isFetching;
                  return (
                    <li key={e.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_200px] sm:items-start">
                      <label className="flex min-w-0 cursor-pointer items-start gap-2">
                        <input type="checkbox" checked={on} onChange={(ev) => toggle(e.id, ev.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-navy" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{e.title}</span>
                          {state && (
                            <span className={`block text-[12px] ${TONE[state.kind]} ${refreshing ? "opacity-60" : ""}`}>{state.text}</span>
                          )}
                          {state?.kind === "ready" && state.plan.subjectWarning && (
                            <span className="block text-[12px] font-semibold text-ink">Check the subject: {state.plan.subjectWarning}</span>
                          )}
                        </span>
                      </label>
                      <select
                        aria-label={`Subject for ${e.title}`}
                        value={subjectOf(e)}
                        disabled={!on}
                        onChange={(ev) => {
                          setOutcomes({});
                          setChosenSubject((s) => ({ ...s, [e.id]: ev.target.value }));
                        }}
                        className={`${SELECT} mt-0 disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <option value="">Subject…</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-smoke p-6">
          <p className="mr-auto text-[13px] text-graphite" aria-live="polite">
            {finished && !saving
              ? `${plural(savedTotal, "mark")} saved to Term scores${failed ? `. ${plural(failed, "test")} could not be sent.` : "."}`
              : problem || `${plural(totalMarks, "mark")} from ${plural(toSend.length, "test")} ready to save.`}
          </p>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink">
            {finished ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || finished || !!problem || fetching}
            className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : `Save ${plural(totalMarks, "mark")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
