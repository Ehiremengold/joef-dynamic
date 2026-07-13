"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicExam } from "@/lib/types";

export type SubmittedResult = {
  examTitle: string;
  studentName: string;
  score: number;
  total: number;
};

type SaveState = "saved" | "saving" | "retrying";

const AUTOSAVE_DEBOUNCE_MS = 700;

export default function TestRunner({
  exam,
  studentName,
  className,
  onFinished,
}: {
  exam: PublicExam;
  studentName: string;
  className?: string;
  onFinished: (result: SubmittedResult) => void;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => exam.questions.map(() => null)
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinishedRef = useRef(onFinished);

  answersRef.current = answers;
  onFinishedRef.current = onFinished;

  const answered = useMemo(
    () => answers.filter((a) => a !== null).length,
    [answers]
  );

  /** Finish for good — used by both the expiry path and a normal submit. */
  const finish = useCallback((result: SubmittedResult) => {
    submittedRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    onFinishedRef.current(result);
  }, []);

  // Start the sitting (or resume one already in flight). The server owns both
  // the saved answers and the clock, so a refresh mid-test lands right back
  // where the student left off with the elapsed time already deducted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/attempts/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId: exam.id }),
        });
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error || "Could not open this test");
        if (d.expired) {
          finish(d.attempt);
          return;
        }
        setAnswers(
          exam.questions.map((_, i) =>
            Number.isInteger(d.answers?.[i]) ? d.answers[i] : null
          )
        );
        setSecondsLeft(d.secondsLeft);
      } catch (e) {
        if (!cancelled) {
          setStartError(e instanceof Error ? e.message : "Could not open this test");
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exam.id, exam.questions, finish]);

  /**
   * Push the current answers and re-sync the clock. The server's secondsLeft is
   * authoritative: a tab that was suspended (lid shut, phone locked) snaps back
   * to the real remaining time here rather than drifting.
   */
  const save = useCallback(async () => {
    if (submittedRef.current) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/attempts/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, answers: answersRef.current }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "save failed");
      if (d.expired) {
        finish(d.attempt);
        return;
      }
      setSecondsLeft(d.secondsLeft);
      setSaveState("saved");
    } catch {
      // The answer is still on screen and still in answersRef — the next change,
      // or the submit itself, will carry it. Nothing is lost by a failed save.
      setSaveState("retrying");
    }
  }, [exam.id, finish]);

  function choose(qi: number, oi: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = oi;
      answersRef.current = next;
      return next;
    });
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
  }

  async function submit(auto = false) {
    if (submittedRef.current) return;
    if (!auto && answered < exam.questions.length) {
      const ok = window.confirm(
        `You have answered ${answered} of ${exam.questions.length} questions. Submit anyway?`
      );
      if (!ok) return;
    }
    submittedRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Identity comes from the server-side taker session, not the body.
        body: JSON.stringify({ examId: exam.id, answers: answersRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit test");
      onFinishedRef.current(data.attempt);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Could not submit test");
    }
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Countdown; auto-submit at zero. Seeded from the server, so this only has to
  // tick between syncs.
  useEffect(() => {
    if (secondsLeft === null) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return s;
        if (s <= 1) {
          clearInterval(t);
          submitRef.current(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back to the tab: flush anything pending and re-sync the clock, which
  // may have run out while the student was away.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && !submittedRef.current) save();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [save]);

  // Leaving the page: get the last answer down before the tab dies. sendBeacon
  // survives unload where fetch does not.
  useEffect(() => {
    function onHide() {
      if (submittedRef.current) return;
      const body = JSON.stringify({
        examId: exam.id,
        answers: answersRef.current,
      });
      navigator.sendBeacon?.(
        "/api/attempts/session/beacon",
        new Blob([body], { type: "application/json" })
      );
    }
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [exam.id]);

  if (starting) {
    return (
      <p className="mx-auto max-w-[760px] text-sm text-graphite">Opening your test…</p>
    );
  }
  if (startError) {
    return (
      <p
        className="mx-auto max-w-[760px] rounded-btn border border-brand-red bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red"
        role="alert"
      >
        {startError}
      </p>
    );
  }

  const total = secondsLeft ?? 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const low = total <= 60;

  return (
    <div>
      {/* Sticky status bar */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-smoke bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">{exam.title}</p>
            <p className="text-[13px] text-graphite">
              {answered}/{exam.questions.length} answered · {studentName}
              {className ? ` · ${className}` : ""}
            </p>
            <p
              className={`text-[13px] ${
                saveState === "retrying" ? "font-semibold text-brand-red" : "text-pewter"
              }`}
              aria-live="polite"
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "retrying"
                  ? "Can't reach the server — your answers are safe, still trying"
                  : "Answers saved — you can close this and come back"}
            </p>
          </div>
          <div
            className={`rounded-btn px-3 py-1.5 font-display text-lg font-bold tabular-nums tracking-tight ${
              low ? "bg-brand-red text-white" : "bg-mist text-ink"
            }`}
            aria-live={low ? "assertive" : "off"}
            aria-label={`Time left ${mins} minutes ${secs} seconds`}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        </div>
      </div>

      <ol className="mx-auto max-w-[760px] space-y-6">
        {exam.questions.map((q, qi) => (
          <li key={q.id} className="rounded-card border border-smoke bg-white p-5">
            <p className="font-semibold">
              <span className="mr-2 text-pewter">{qi + 1}.</span>
              {q.text}
            </p>
            <div className="mt-4 grid gap-2">
              {q.options.map((opt, oi) => {
                const chosen = answers[qi] === oi;
                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-btn border px-4 py-3 transition-colors duration-150 ${
                      chosen
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-smoke bg-white hover:bg-mist"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={chosen}
                      onChange={() => choose(qi, oi)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-btn border text-xs font-bold ${
                        chosen ? "border-white bg-white text-brand-navy" : "border-smoke text-graphite"
                      }`}
                      aria-hidden="true"
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="text-sm font-medium">{opt}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-8 max-w-[760px]">
        {error && (
          <p className="mb-3 rounded-btn border border-brand-red bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit(false)}
          className="w-full cursor-pointer rounded-btn bg-brand-red px-6 py-4 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit test"}
        </button>
      </div>
    </div>
  );
}
