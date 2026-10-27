"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/client/api";
import { percent } from "@/lib/results";
import { EXAM_RESULTS_TOUR } from "@/lib/tours";
import type { Exam, ExamAnalysis } from "@/lib/types";
import GuideTour from "@/components/portal/GuideTour";
import RichText from "@/components/portal/RichText";
import AnswerReviewDialog from "./AnswerReviewDialog";

const letter = (i: number) => String.fromCharCode(65 + i);

/**
 * How the class did on an exam: the spread of scores, each question with how
 * many got it right and the wrong answer most chose, and every student's
 * result with their answers. Also where the teacher lets students see their
 * own answers, once everyone has sat it.
 */
export default function ExamResults({
  exam,
  canEdit,
  busy,
  onSave,
  onUnauthorized,
}: {
  exam: Exam;
  canEdit: boolean;
  busy: boolean;
  /** Resolves to the exam as saved, or null if it wasn't. */
  onSave: (patch: Record<string, unknown>) => Promise<Exam | null>;
  onUnauthorized: () => void;
}) {
  const q = useApi<{ analysis: ExamAnalysis }>(`/api/exams/${exam.id}/analysis`, onUnauthorized);
  const a = q.data?.analysis;
  const [viewing, setViewing] = useState<string | null>(null);
  // The switch shows its new position at once; the exam list catches up after the save.
  const [reviewChoice, setReviewChoice] = useState<boolean | null>(null);
  const reviewOpen = reviewChoice ?? exam.reviewOpen;
  // Once the list shows the saved position, follow it again.
  useEffect(() => {
    if (reviewChoice !== null && exam.reviewOpen === reviewChoice) setReviewChoice(null);
  }, [exam.reviewOpen, reviewChoice]);
  const counted = a ? a.sat - a.notCounted : 0;

  async function setReview(on: boolean) {
    setReviewChoice(on);
    const saved = await onSave({ reviewOpen: on });
    setReviewChoice(saved ? saved.reviewOpen : null);
  }

  return (
    <div className="border-t border-smoke p-5">
      {viewing && <AnswerReviewDialog attemptId={viewing} onClose={() => setViewing(null)} onUnauthorized={onUnauthorized} />}

      <div className="mb-3 flex justify-end">
        <GuideTour id="exam-results-v1" steps={EXAM_RESULTS_TOUR} label="How this works" autoStart={false} tone="light" />
      </div>

      {exam.type === "entrance" ? (
        <p className="rounded-btn bg-mist px-3 py-2 text-[13px] text-graphite">
          Entrance candidates don&rsquo;t have accounts to come back to, so they can&rsquo;t look through their answers. You can, below.
        </p>
      ) : (
        <label data-tour="exam-review-switch" className={`flex items-start gap-3 rounded-btn border border-smoke p-3 ${canEdit ? "cursor-pointer" : ""}`}>
          <input
            type="checkbox"
            checked={reviewOpen}
            disabled={!canEdit || busy}
            onChange={(e) => setReview(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-green"
          />
          <span className="text-sm">
            <span className="font-semibold">Let students see their answers and the correct ones</span>
            <span className="mt-0.5 block text-[13px] text-graphite">
              {reviewOpen
                ? "On: each student can look through this test under My results, question by question."
                : "Off: students see only their score. Turn it on once everyone has sat the test, so the answers can't be passed on to those still to sit it."}
            </span>
          </span>
        </label>
      )}

      {q.error ? (
        <p className="mt-4 text-sm font-semibold text-brand-red">{q.error.message}</p>
      ) : !a ? (
        <p className="mt-4 text-sm text-graphite">Working out the results…</p>
      ) : a.sat === 0 ? (
        <p className="mt-4 text-sm text-graphite">Nobody has sat this test yet.</p>
      ) : (
        <>
          <dl data-tour="exam-score-summary" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ["Sat it", String(a.sat)],
              ["Average", `${a.average}%`],
              ["Highest", `${a.highest}%`],
              ["Lowest", `${a.lowest}%`],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-btn bg-mist px-3 py-2">
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-pewter">{label}</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <h4 className="mt-6 font-display text-sm font-bold tracking-tight">Question by question</h4>
          {a.notCounted > 0 && (
            <p className="mt-1 text-[13px] text-pewter">
              {a.notCounted} result{a.notCounted === 1 ? " was" : "s were"} taken before the questions were last edited, so{" "}
              {a.notCounted === 1 ? "it isn't" : "they aren't"} counted here.
            </p>
          )}
          {a.olderCounted > 0 && (
            <p className="mt-1 text-[13px] text-pewter">
              {a.olderCounted} result{a.olderCounted === 1 ? " is" : "s are"} from before answers were kept with each test, so{" "}
              {a.olderCounted === 1 ? "it is" : "they are"} counted against the questions as they are now. If a question was edited
              after {a.olderCounted === 1 ? "it was" : "they were"} taken, its figures may mix answers to both versions.
            </p>
          )}
          {counted === 0 ? (
            <p className="mt-2 text-sm text-graphite">No results match the questions as they are now, so there is nothing to count yet.</p>
          ) : (
            <ol data-tour="exam-question-stats" className="mt-2 space-y-2">
              {a.questions.map((s, i) => {
                const right = s.chose[s.correctIndex] ?? 0;
                const wrong = s.chose.map((n, oi) => ({ n, oi })).filter(({ oi }) => oi !== s.correctIndex).sort((x, y) => y.n - x.n)[0];
                const share = percent(right, counted);
                return (
                  <li key={i} className="rounded-btn border border-smoke p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm">
                        <span className="mr-1.5 font-semibold text-pewter">{i + 1}.</span>
                        <RichText text={s.text} />
                      </p>
                      <p className={`shrink-0 font-display font-bold tabular-nums ${share >= 70 ? "text-brand-green" : share < 40 ? "text-brand-red" : "text-ink"}`}>
                        {share}%
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                      <div className="h-full rounded-full bg-brand-green" style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-1.5 text-[12px] text-graphite">
                      {right} of {counted} right (answer {letter(s.correctIndex)})
                      {wrong && wrong.n > 0 ? ` · most chosen wrong answer: ${letter(wrong.oi)} (${wrong.n})` : ""}
                      {s.unanswered ? ` · ${s.unanswered} left it blank` : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}

          <h4 className="mt-6 font-display text-sm font-bold tracking-tight">Each student</h4>
          <ul data-tour="exam-student-results" className="mt-2 divide-y divide-smoke rounded-btn border border-smoke">
            {a.results.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{r.takerName}</span>
                  {r.className && <span className="text-pewter"> · {r.className}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display font-bold tabular-nums">
                    {r.score}/{r.total} <span className="font-sans text-[13px] font-normal text-pewter">({percent(r.score, r.total)}%)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewing(r.id)}
                    className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                  >
                    Answers
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
