import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";
import { getExam, isOpen } from "@/lib/data/exams";
import { DuplicateAttemptError, listAttempts } from "@/lib/data/attempts";
import { getSession, isExpired } from "@/lib/data/attemptSessions";
import { canSit, finalizeAttempt, submittedResult } from "@/lib/data/submit";
import type { ExamType } from "@/lib/types";

/**
 * GET /api/attempts
 * - Staff: all attempts, filter by ?name=&className=&year=&type=
 * - Student session: only their OWN attempts (privacy).
 * - Otherwise: 401.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staff = await currentStaff();
    if (staff) {
      const attempts = await listAttempts({
        name: searchParams.get("name")?.trim() || undefined,
        className: searchParams.get("className") || undefined,
        year: searchParams.get("year")?.trim() || undefined,
        type: (searchParams.get("type") as ExamType) || undefined,
      });
      return NextResponse.json({ attempts });
    }

    const taker = await getTakerSession();
    if (taker?.kind === "student") {
      const attempts = await listAttempts({ studentId: taker.id });
      return NextResponse.json({ attempts });
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
        { error: "Your session has expired — please sign in again" },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => null);
    if (!body?.examId) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const exam = await getExam(body.examId);
    if (!exam || !isOpen(exam)) {
      return NextResponse.json({ error: "Exam not available" }, { status: 404 });
    }

    if (!canSit(exam, taker)) {
      return NextResponse.json({ error: "Exam not available" }, { status: 403 });
    }

    // Past the deadline (plus grace), the answers on the wire are worthless —
    // only what was autosaved before time ran out counts. Otherwise a taker
    // could sit on an open tab, take as long as they liked, and submit late.
    const session = await getSession(exam.id, taker);
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
