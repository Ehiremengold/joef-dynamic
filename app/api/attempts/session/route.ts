import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getTakerSession } from "@/lib/auth/session";
import { getExam, isOpen } from "@/lib/data/exams";
import { listAttempts } from "@/lib/data/attempts";
import {
  isExpired,
  saveAnswers,
  secondsLeft,
  startOrResume,
} from "@/lib/data/attemptSessions";
import { canSit, finalizeAttempt, submittedResult } from "@/lib/data/submit";
import type { Exam, TakerSession } from "@/lib/types";

/** Shared front door: authorize the taker against the exam they're claiming. */
async function resolve(req: NextRequest): Promise<
  | { error: NextResponse }
  | { taker: TakerSession; exam: Exam; body: Record<string, unknown> }
> {
  const taker = await getTakerSession();
  if (!taker) {
    return {
      error: NextResponse.json(
        { error: "Your session has expired — please sign in again" },
        { status: 401 }
      ),
    };
  }
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const examId = typeof body?.examId === "string" ? body.examId : "";
  if (!examId) {
    return { error: NextResponse.json({ error: "Invalid request" }, { status: 400 }) };
  }
  const exam = await getExam(examId);
  if (!exam || !isOpen(exam) || exam.questions.length === 0) {
    return { error: NextResponse.json({ error: "Exam not available" }, { status: 404 }) };
  }
  if (!canSit(exam, taker)) {
    return { error: NextResponse.json({ error: "Exam not available" }, { status: 403 }) };
  }
  return { taker, exam, body: body ?? {} };
}

/** Has this taker already got a finished attempt on record for this exam? */
async function alreadySubmitted(
  examId: string,
  taker: TakerSession
): Promise<boolean> {
  const done = await listAttempts({
    examId,
    ...(taker.kind === "student" ? { studentId: taker.id } : {}),
  });
  return taker.kind === "student"
    ? done.length > 0
    : done.some((a) => a.candidateId === taker.id);
}

/**
 * POST /api/attempts/session — start a sitting, or resume one already running.
 * { examId } → { answers, secondsLeft }
 *
 * The clock is the server's: it started when they first opened the exam and has
 * been running ever since, so a refresh resumes where they left off with the
 * time that has actually elapsed deducted. If the deadline passed while they
 * were away, whatever they had saved is submitted for them.
 */
export async function POST(req: NextRequest) {
  try {
    const r = await resolve(req);
    if ("error" in r) return r.error;
    const { taker, exam } = r;

    if (await alreadySubmitted(exam.id, taker)) {
      return NextResponse.json(
        { error: "You have already taken this test" },
        { status: 409 }
      );
    }

    const session = await startOrResume(exam, taker);

    if (isExpired(session, exam)) {
      const attempt = await finalizeAttempt({
        exam,
        taker,
        answers: session.answers,
        sessionId: session.id,
      });
      return NextResponse.json({
        expired: true,
        attempt: submittedResult(attempt),
      });
    }

    return NextResponse.json({
      answers: session.answers,
      secondsLeft: secondsLeft(session, exam),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PATCH /api/attempts/session — autosave answers mid-test.
 * { examId, answers } → { secondsLeft }
 *
 * Also the browser's clock sync: the returned secondsLeft is authoritative, so
 * a tab that was suspended (phone locked, laptop lid shut) snaps back to the
 * real remaining time on its next save instead of drifting.
 */
export async function PATCH(req: NextRequest) {
  try {
    const r = await resolve(req);
    if ("error" in r) return r.error;
    const { taker, exam, body } = r;

    const session = await startOrResume(exam, taker);

    if (isExpired(session, exam)) {
      // Too late to record new answers — mark what was saved before the bell.
      const attempt = await finalizeAttempt({
        exam,
        taker,
        answers: session.answers,
        sessionId: session.id,
      });
      return NextResponse.json({
        expired: true,
        attempt: submittedResult(attempt),
      });
    }

    await saveAnswers(session.id, exam, body.answers);
    return NextResponse.json({ secondsLeft: secondsLeft(session, exam) });
  } catch (e) {
    return errorResponse(e);
  }
}
