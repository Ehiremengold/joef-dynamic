import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";
import { getAttemptById } from "@/lib/data/attempts";
import { getExam } from "@/lib/data/exams";
import { reviewOf, studentMayReview } from "@/lib/data/review";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/attempts/:id/review — a result question by question: what was
 * asked, what they chose, and what was right.
 * - Staff: any result.
 * - A student: their own, once they may (see studentMayReview). Until then
 *   the correct answers stay with staff, so nobody can pass them on to
 *   classmates still to sit the test.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const attempt = await getAttemptById(id);
    const exam = attempt?.examId ? await getExam(attempt.examId) : null;
    if (await currentStaff()) {
      if (!attempt) return NextResponse.json({ error: "Result not found" }, { status: 404 });
      return NextResponse.json({ review: reviewOf(attempt, exam) });
    }

    const taker = await getTakerSession();
    if (!taker) return NextResponse.json({ error: "Sign in to see your answers" }, { status: 401 });
    // Someone else's result reads the same as a missing one.
    if (!attempt || taker.kind !== "student" || attempt.studentId !== taker.id) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    if (!studentMayReview(attempt, exam)) {
      return NextResponse.json(
        {
          error: exam
            ? "Your teacher hasn't opened the answers for this test yet"
            : "This test has been removed, and its questions weren't kept with your result, so the answers can't be shown",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ review: reviewOf(attempt, exam) });
  } catch (e) {
    return errorResponse(e);
  }
}
