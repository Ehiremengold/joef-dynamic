import "server-only";
import { listAttempts } from "./attempts";
import { percent, toAttemptQuestion } from "@/lib/results";
import type { AnswerReview, Attempt, Exam, ExamAnalysis } from "@/lib/types";

/**
 * A result question by question. It is marked against the copy of the
 * questions kept with it, or for an older result (before 0020) against
 * `exam`'s questions as they are now; with neither, it has no questions.
 */
export function reviewOf(attempt: Attempt, exam: Exam | null): AnswerReview {
  const questions = attempt.questions ?? (exam?.questions ?? []).map(toAttemptQuestion);
  return {
    attemptId: attempt.id,
    examTitle: attempt.examTitle,
    takerName: attempt.takerName,
    className: attempt.className,
    score: attempt.score,
    total: attempt.total,
    submittedAt: attempt.submittedAt,
    // A question it has no answer for (the exam grew since) counts as unanswered.
    items: questions.map((q, i) => ({ ...q, chosen: Number.isInteger(attempt.answers[i]) ? attempt.answers[i] : null })),
    source: attempt.questions ? "snapshot" : "current",
  };
}

/**
 * Whether a student may look through their own result. While the exam
 * exists, only once the teacher has opened its answers (reviewOpen), so the
 * first to finish can't pass them on. Once the exam has been deleted there
 * is nothing left to protect: yes, if the result kept its questions.
 */
export const studentMayReview = (attempt: Pick<Attempt, "questions" | "examId">, exam: Pick<Exam, "reviewOpen"> | null): boolean =>
  exam ? exam.reviewOpen : attempt.questions !== null;

/** How everyone did on an exam: the spread of scores, and each student's result, best first. */
export async function analyseExam(exam: Exam): Promise<ExamAnalysis> {
  const attempts = await listAttempts({ examId: exam.id });
  const scores = attempts.map((a) => percent(a.score, a.total));
  return {
    sat: attempts.length,
    average: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
    results: attempts
      .map(({ id, takerName, className, score, total, submittedAt }) => ({ id, takerName, className, score, total, submittedAt }))
      .sort((x, y) => percent(y.score, y.total) - percent(x.score, x.total) || x.takerName.localeCompare(y.takerName)),
  };
}
