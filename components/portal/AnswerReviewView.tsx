"use client";

import { useState } from "react";
import { percent } from "@/lib/results";
import type { AnswerReview } from "@/lib/types";
import RichText from "./RichText";

type Outcome = "right" | "wrong" | "blank";

const BADGE: Record<Outcome, { label: string; className: string }> = {
  right: { label: "✓ Correct", className: "bg-brand-green/10 text-brand-green" },
  wrong: { label: "✗ Wrong", className: "bg-brand-red/10 text-brand-red" },
  blank: { label: "Not answered", className: "bg-mist text-graphite" },
};

/**
 * A result question by question: each question, the answer chosen and the
 * correct one, for a student looking back at their own test or a teacher at
 * a student's. `answerLabel` names the chosen answer for the reader ("Your answer", "Their answer").
 */
export default function AnswerReviewView({ review, answerLabel }: { review: AnswerReview; answerLabel: string }) {
  const outcomes: Outcome[] = review.items.map((q) => (q.chosen === null ? "blank" : q.chosen === q.correctIndex ? "right" : "wrong"));
  const missed = outcomes.filter((o) => o !== "right").length;
  const [onlyMissed, setOnlyMissed] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold tracking-tight">{review.examTitle}</p>
          <p className="text-[13px] text-graphite">
            {review.takerName}
            {review.className ? ` · ${review.className}` : ""} · {new Date(review.submittedAt).toLocaleDateString()}
          </p>
        </div>
        <p className="font-display text-2xl font-bold tabular-nums">
          {review.score}/{review.total} <span className="text-base font-semibold text-pewter">({percent(review.score, review.total)}%)</span>
        </p>
      </div>

      {review.source === "current" && (
        <p className="mt-3 rounded-btn bg-brand-gold/20 px-3 py-2 text-[13px] text-ink">
          This result is from before answers were kept with each test, so it is shown against the questions as they are
          now. If the questions were edited after the test, some may not match what was asked.
        </p>
      )}

      <div data-tour="review-filter" className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Which questions to show">
        {([
          [false, `All questions (${review.items.length})`],
          [true, `Wrong or not answered (${missed})`],
        ] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={onlyMissed === value}
            onClick={() => setOnlyMissed(value)}
            className={`cursor-pointer rounded-btn px-3 py-1.5 text-sm font-semibold ${
              onlyMissed === value ? "bg-brand-navy text-white" : "border border-smoke bg-white text-ink hover:border-brand-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {onlyMissed && missed === 0 ? (
        <p className="mt-4 rounded-btn bg-brand-green/10 px-4 py-3 text-sm font-semibold text-brand-green">Every question right.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {review.items.map((q, qi) =>
            onlyMissed && outcomes[qi] === "right" ? null : (
              <li key={qi} className="rounded-card border border-smoke bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-pewter">Question {qi + 1}</p>
                  <span className={`rounded-btn px-2 py-0.5 text-[13px] font-semibold ${BADGE[outcomes[qi]].className}`}>{BADGE[outcomes[qi]].label}</span>
                </div>
                <p className="mt-1 whitespace-pre-line font-semibold">
                  <RichText text={q.text} />
                </p>
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((opt, oi) => {
                    const correct = oi === q.correctIndex;
                    const chosen = oi === q.chosen;
                    return (
                      <li
                        key={oi}
                        className={`flex flex-wrap items-center gap-2 rounded-btn border px-3 py-2 text-sm ${
                          correct ? "border-brand-green bg-brand-green/10" : chosen ? "border-brand-red bg-brand-red/5" : "border-smoke"
                        }`}
                      >
                        <span className="font-bold text-graphite">{String.fromCharCode(65 + oi)}.</span>
                        <span className="min-w-0 flex-1">
                          <RichText text={opt} />
                        </span>
                        {chosen && <span className={`text-[12px] font-semibold ${correct ? "text-brand-green" : "text-brand-red"}`}>{answerLabel}</span>}
                        {correct && <span className="text-[12px] font-semibold text-brand-green">Correct answer</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            )
          )}
        </ol>
      )}
    </div>
  );
}
