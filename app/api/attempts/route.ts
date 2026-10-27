import { NextRequest, NextResponse } from "next/server";
import { errorResponse, pageParam } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";
import { getExam, isOpen, listExamsByIds } from "@/lib/data/exams";
import { studentMayReview } from "@/lib/data/review";
import { DuplicateAttemptError, listAttempts, listAttemptsPage } from "@/lib/data/attempts";
import { getSession, isExpired } from "@/lib/data/attemptSessions";
import { canSit, finalizeAttempt, submittedResult } from "@/lib/data/submit";
import type { ExamType } from "@/lib/types";

/**
 * GET /api/attempts
 * - Staff: all attempts, a page at a time; filter by ?name=&className=&year=&type=&page=
 * - Student session: only their OWN attempts (privacy), each saying whether
 *   its answers may be looked through yet (reviewOpen).
 * - Otherwise: 401.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staff = await currentStaff();
    if (staff) {
      const { rows, total } = await listAttemptsPage(
        {
          name: searchParams.get("name")?.trim() || undefined,
          className: searchParams.get("className") || undefined,
          year: searchParams.get("year")?.trim() || undefined,
          type: (searchParams.get("type") as ExamType) || undefined,
        },
        pageParam(searchParams)
      );
      return NextResponse.json({ attempts: rows, total });
    }

    const taker = await getTakerSession();
    if (taker?.kind === "student") {
      // With the question copies, only to tell which they may look through yet: never sent.
      const attempts = await listAttempts({ studentId: taker.id }, { withQuestions: true });
      const exams = await listExamsByIds(attempts.map((a) => a.examId).filter((x): x is string => !!x));
      return NextResponse.json({
        attempts: attempts.map(({ questions, ...a }) => ({
          ...a,
          questions: null,
          reviewOpen: studentMayReview({ questions, examId: a.examId }, a.examId ? exams.get(a.examId) ?? null : null),
        })),
      });
    }

    return NextResponse.json(
      { error: "Sign in to view results" },
      { status: 401 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/attempts — submit a finished test. Requires a taker session; the
 * server marks against the stored answers and enforces one attempt per taker.
 * { examId, answers }
 */
export async function POST(req: NextRequest) {
  try {
    const taker = await getTakerSession();
    if (!taker) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again" },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => null);
    if (!body?.examId) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const exam = await getExam(body.examId);
    if (!exam || !exam.active) {
      return NextResponse.json({ error: "Exam not available" }, { status: 404 });
    }

    if (!canSit(exam, taker)) {
      return NextResponse.json({ error: "Exam not available" }, { status: 403 });
    }

    // Past the deadline (plus grace), the answers on the wire are worthless —
    // only what was autosaved before time ran out counts. Otherwise a taker
    // could sit on an open tab, take as long as they liked, and submit late.
    const session = await getSession(exam.id, taker);
    // Outside the exam's window, only a sitting that was already under way
    // may hand in (a test started before the close, finishing at the bell).
    if (!isOpen(exam) && !session) {
      return NextResponse.json({ error: "Exam not available" }, { status: 404 });
    }
    const answers =
      session && isExpired(session, exam) ? session.answers : body.answers;

    try {
      const attempt = await finalizeAttempt({
        exam,
        taker,
        answers,
        sessionId: session?.id,
      });
      return NextResponse.json(
        { attempt: submittedResult(attempt) },
        { status: 201 }
      );
    } catch (e) {
      if (e instanceof DuplicateAttemptError) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
