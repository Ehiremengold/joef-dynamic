"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicExam } from "@/lib/types";
import RichText from "./RichText";
import GuideTour from "./GuideTour";
import { TEST_TOUR } from "@/lib/tours";

export type SubmittedResult = {
  examTitle: string;
  studentName: string;
  score: number;
  total: number;
};

type SaveState = "saved" | "saving" | "retrying";

const AUTOSAVE_DEBOUNCE_MS = 700;

// Which question was on screen, so a refresh mid-test comes back to it. Kept
// per sitting: a retake, or the next candidate at this computer, starts afresh.
const placeKey = (sittingId: string) => `jdc-test-place:${sittingId}`;
function readPlace(sittingId: string): number | null {
  try {
    const v = window.sessionStorage.getItem(placeKey(sittingId));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function keepPlace(sittingId: string, index: number) {
  try {
    window.sessionStorage.setItem(placeKey(sittingId), String(index));
  } catch {
    // Storage blocked: a refresh opens on the first unanswered question instead.
  }
}

/** "4, 7 and 12"; a long list stops after ten: "1, 2, … 10 and 25 more". */
function listNumbers(ns: number[]): string {
  const shown = ns.length > 10 ? [...ns.slice(0, 10).map(String), `${ns.length - 10} more`] : ns.map(String);
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
}

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
  // One question on screen at a time.
  const [current, setCurrent] = useState(0);
  const sittingId = useRef(exam.id);
  // Set when the student moves to another question, so focus follows (not on first load).
  const [moved, setMoved] = useState(false);
  // The time bar is pinned under the site menu; the same space is kept free for it here.
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinishedRef = useRef(onFinished);
  const questionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);

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
        const restored: (number | null)[] = exam.questions.map((_, i) =>
          Number.isInteger(d.answers?.[i]) ? d.answers[i] : null
        );
        setAnswers(restored);
        sittingId.current = d.sittingId ?? exam.id;
        // Back where they were after a refresh; otherwise the first question still to answer.
        const place = readPlace(sittingId.current);
        const firstOpen = restored.findIndex((a) => a === null);
        setCurrent(
          place !== null && place >= 0 && place < exam.questions.length ? place : Math.max(firstOpen, 0)
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

  function goTo(index: number) {
    const i = Math.min(Math.max(index, 0), exam.questions.length - 1);
    setCurrent(i);
    setMoved(true);
    keepPlace(sittingId.current, i);
    // Pressing a number at the bottom of a phone screen brings the question back into view.
    questionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // Keyboard and screen-reader users land on the new question, which is read out.
  useEffect(() => {
    if (moved) headingRef.current?.focus({ preventScroll: true });
  }, [current, moved]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const fit = () => setBarHeight(bar.offsetHeight);
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(bar);
    return () => watch.disconnect();
  }, [starting, startError]);

  async function submit(auto = false) {
    if (submittedRef.current) return;
    if (!auto && answered < exam.questions.length) {
      const open = answers.flatMap((a, i) => (a === null ? [i + 1] : []));
      const ok = window.confirm(
        `You have answered ${answered} of ${exam.questions.length} questions. ` +
          `Question${open.length === 1 ? "" : "s"} ${listNumbers(open)} ${open.length === 1 ? "has" : "have"} no answer. Submit anyway?`
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
  const lastMinute = total <= 60;
  const underFiveMinutes = total <= 5 * 60;
  const count = exam.questions.length;
  const q = exam.questions[current];
  const last = current === count - 1;

  return (
    <div>
      {/*
        Pinned just under the site menu (h-14), so the time is never out of
        sight however far they scroll; the menu's own dropdown still opens
        over it. The spacer below keeps the question clear of it.
      */}
      <div ref={barRef} className="fixed inset-x-0 top-14 z-30 border-b border-smoke bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">{exam.title}</p>
            <p className="text-[13px] text-graphite">
              {studentName}
              {className ? ` · ${className}` : ""} · {answered} of {count} answered
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
                  ? "Can't reach the server. Your answers are safe, still trying"
                  : "Answers saved. You can close this and come back"}
            </p>
          </div>
          <div
            data-tour="test-timer"
            className={`shrink-0 rounded-btn px-4 py-2 text-center ${
              lastMinute ? "animate-pulse bg-brand-red text-white" : underFiveMinutes ? "bg-brand-gold text-ink" : "bg-brand-navy text-white"
            }`}
            role="timer"
            aria-live={lastMinute ? "assertive" : "off"}
            aria-label={`Time left ${mins} minutes ${secs} seconds`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-80">Time left</span>
            <span className="block font-display text-2xl font-bold tabular-nums tracking-tight">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: barHeight }} aria-hidden="true" />

      <div className="mx-auto max-w-[760px]">
        <div className="mb-3 flex justify-end">
          {/* Only when asked: a tour starting by itself would eat into the timer. */}
          <GuideTour id="test-runner-v1" steps={TEST_TOUR} label="How this test works" autoStart={false} tone="light" />
        </div>
        <section data-tour="test-question" ref={questionRef} aria-labelledby="question-title" className="scroll-mt-32 rounded-card border border-smoke bg-white p-5 md:p-6">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-pewter">
            Question {current + 1} of {count}
          </p>
          <p
            id="question-title"
            ref={headingRef}
            tabIndex={-1}
            // A question typed over several lines keeps its line breaks.
            className="mt-2 whitespace-pre-line text-lg font-semibold leading-snug outline-none"
          >
            <span className="sr-only">Question {current + 1} of {count}. </span>
            <RichText text={q.text} />
          </p>
          <div className="mt-5 grid gap-2" role="radiogroup" aria-labelledby="question-title">
            {q.options.map((opt, oi) => {
              const chosen = answers[current] === oi;
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
                    onChange={() => choose(current, oi)}
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
                  <span className="text-sm font-medium">
                    <RichText text={opt} />
                  </span>
                </label>
              );
            })}
          </div>

          <div data-tour="test-move" className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="cursor-pointer rounded-btn border border-ink px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
            >
              Previous
            </button>
            {last ? (
              <p className="text-right text-[13px] text-graphite">
                That&rsquo;s the last question. Check the numbers below, then press Submit test.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                className="cursor-pointer rounded-btn bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink"
              >
                Next
              </button>
            )}
          </div>
        </section>

        {/* Every question by number: answered ones filled in; press one to go to it. */}
        <nav data-tour="test-grid" aria-label="Questions" className="mt-6 rounded-card border border-smoke bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm font-bold tracking-tight">Questions</p>
            <p className="flex flex-wrap items-center gap-3 text-[12px] text-graphite">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px] bg-brand-navy" aria-hidden="true" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px] border border-pewter bg-white" aria-hidden="true" /> Not answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px] bg-white ring-2 ring-brand-gold" aria-hidden="true" /> On screen
              </span>
            </p>
          </div>
          <ol className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
            {exam.questions.map((question, qi) => {
              const done = answers[qi] !== null;
              const here = qi === current;
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => goTo(qi)}
                    aria-current={here ? "step" : undefined}
                    aria-label={`Question ${qi + 1}, ${done ? "answered" : "not answered"}`}
                    className={`h-11 w-full cursor-pointer rounded-btn text-sm font-bold tabular-nums transition-colors duration-150 ${
                      done ? "bg-brand-navy text-white hover:bg-ink" : "border border-pewter bg-white text-ink hover:bg-mist"
                    } ${here ? "ring-2 ring-brand-gold ring-offset-2" : ""}`}
                  >
                    {qi + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-6">
          {error && (
            <p className="mb-3 rounded-btn border border-brand-red bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            data-tour="test-submit"
            disabled={submitting}
            onClick={() => submit(false)}
            className="w-full cursor-pointer rounded-btn bg-brand-red px-6 py-4 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit test"}
          </button>
        </div>
      </div>
    </div>
  );
}
