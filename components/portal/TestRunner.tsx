"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicExam } from "@/lib/types";

export type SubmittedResult = {
  examTitle: string;
  studentName: string;
  score: number;
  total: number;
};

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
  const [secondsLeft, setSecondsLeft] = useState(exam.durationMins * 60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submittedRef = useRef(false);

  const answered = useMemo(
    () => answers.filter((a) => a !== null).length,
    [answers]
  );

  async function submit(auto = false) {
    if (submittedRef.current) return;
    if (!auto && answered < exam.questions.length) {
      const ok = window.confirm(
        `You have answered ${answered} of ${exam.questions.length} questions. Submit anyway?`
      );
      if (!ok) return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Identity comes from the server-side taker session, not the body.
        body: JSON.stringify({ examId: exam.id, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit test");
      onFinished(data.attempt);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Could not submit test");
    }
  }

  // Countdown; auto-submit at zero.
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const low = secondsLeft <= 60;

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
                      onChange={() =>
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[qi] = oi;
                          return next;
                        })
                      }
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
