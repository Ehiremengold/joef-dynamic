import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";
import { getExam, isOpen } from "@/lib/data/exams";
import {
  DuplicateAttemptError,
  insertAttempt,
  listAttempts,
} from "@/lib/data/attempts";
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

    // The taker must be allowed to sit this exam.
    const allowed =
      (taker.kind === "candidate" && exam.type === "entrance") ||
      (taker.kind === "student" &&
        exam.type === "class" &&
        exam.className === taker.className);
    if (!allowed) {
      return NextResponse.json({ error: "Exam not available" }, { status: 403 });
    }

    const answers: (number | null)[] = exam.questions.map((_, i) => {
      const a = Array.isArray(body.answers) ? body.answers[i] : null;
      return Number.isInteger(a) ? (a as number) : null;
    });
    const score = exam.questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
      0
    );

    try {
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
        answers,
        score,
        total: exam.questions.length,
      });
      return NextResponse.json(
        {
          attempt: {
            id: attempt.id,
            examTitle: attempt.examTitle,
            studentName: attempt.takerName,
            score: attempt.score,
            total: attempt.total,
            submittedAt: attempt.submittedAt,
          },
        },
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
