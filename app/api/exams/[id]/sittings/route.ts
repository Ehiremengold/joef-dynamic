import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getExam } from "@/lib/data/exams";
import {
  grantExtraSeconds,
  listSessionsForExam,
  secondsLeft,
} from "@/lib/data/attemptSessions";
import { deleteAttempt, listAttempts } from "@/lib/data/attempts";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/exams/:id/sittings — staff view of who is mid-test right now, and who
 * has finished. This is the recovery desk: when a student is knocked offline by
 * a power cut, staff grant them the lost minutes here rather than the clock
 * pausing on its own (which would let anyone close the tab and go and read up).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const [sessions, submitted] = await Promise.all([
      listSessionsForExam(id),
      listAttempts({ examId: id }),
    ]);

    return NextResponse.json({
      inProgress: sessions.map((s) => ({
        id: s.id,
        takerName: s.takerName,
        answered: s.answers.filter((a) => a !== null).length,
        total: exam.questions.length,
        secondsLeft: secondsLeft(s, exam),
        extraMins: Math.round(s.extraSeconds / 60),
        lastSeenAt: s.lastSeenAt,
      })),
      submitted: submitted.map((a) => ({
        id: a.id,
        takerName: a.takerName,
        score: a.score,
        total: a.total,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/exams/:id/sittings — { sessionId, extraMins } give back lost time. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    await params;
    const body = await req.json().catch(() => null);
    const extraMins = Number(body?.extraMins);
    if (typeof body?.sessionId !== "string" || !Number.isFinite(extraMins)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    // Cap a single grant at the length of a long exam, so a fat finger can't
    // hand out a sitting that never ends.
    const clamped = Math.max(-180, Math.min(180, Math.round(extraMins)));
    await grantExtraSeconds(body.sessionId, clamped * 60);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * DELETE /api/exams/:id/sittings?attemptId= — clear a finished attempt so the
 * student can retake. Destructive: the recorded score is discarded.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    await params;
    const attemptId = new URL(req.url).searchParams.get("attemptId");
    if (!attemptId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    await deleteAttempt(attemptId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
