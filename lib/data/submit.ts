import "server-only";
import type { Attempt, Exam, TakerSession } from "@/lib/types";
import { insertAttempt } from "@/lib/data/attempts";
import { deleteSession } from "@/lib/data/attemptSessions";

/** May this taker sit this exam at all? */
export function canSit(exam: Exam, taker: TakerSession): boolean {
  if (taker.kind === "candidate") return exam.type === "entrance";
  return exam.type === "class" && exam.className === taker.className;
}

/**
 * Grade and record a finished sitting, then retire its in-progress session.
 * Marking always happens here, server-side, against the stored correct answers.
 */
export async function finalizeAttempt(input: {
  exam: Exam;
  taker: TakerSession;
  answers: unknown;
  sessionId?: string;
}): Promise<Attempt> {
  const { exam, taker, answers, sessionId } = input;

  const marked: (number | null)[] = exam.questions.map((_, i) => {
    const a = Array.isArray(answers) ? answers[i] : null;
    return Number.isInteger(a) ? (a as number) : null;
  });
  const score = exam.questions.reduce(
    (acc, q, i) => acc + (marked[i] === q.correctIndex ? 1 : 0),
    0
  );

  const attempt = await insertAttempt({
    examId: exam.id,
    examTitle: exam.title,
    examType: exam.type,
    takerType: taker.kind,
    studentId: taker.kind === "student" ? taker.id : null,
    candidateId: taker.kind === "candidate" ? taker.id : null,
    takerName: taker.name,
    className: taker.kind === "student" ? taker.className : null,
    year: String(new Date().getFullYear()),
    answers: marked,
    score,
    total: exam.questions.length,
  });

  if (sessionId) await deleteSession(sessionId);
  return attempt;
}

/** The shape the taker's browser gets back after a submit. */
export function submittedResult(attempt: Attempt) {
  return {
    id: attempt.id,
    examTitle: attempt.examTitle,
    studentName: attempt.takerName,
    score: attempt.score,
    total: attempt.total,
    submittedAt: attempt.submittedAt,
  };
}
