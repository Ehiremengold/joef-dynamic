import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { examAccess } from "@/lib/roles";
import { getExam } from "@/lib/data/exams";
import {
  grantExtraSeconds,
  listSessionsForExam,
  secondsLeft,
} from "@/lib/data/attemptSessions";
import { deleteAttempt, getAttemptById, listAttempts } from "@/lib/data/attempts";

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

/** PATCH /api/exams/:id/sittings — { sessionId, extraMins } give back lost time. Not for view-only staff. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (examAccess(staff, exam) === "view") {
      throw new AuthError("This exam belongs to another teacher. You can view it but not change it", 403);
    }
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
 * student can retake. Destructive: the recorded score is discarded, so only
 * the exam's creator or a super admin may do it.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (examAccess(staff, exam) !== "manage") {
      throw new AuthError("Only the exam's creator or a super admin can clear a result", 403);
    }
    const attemptId = new URL(req.url).searchParams.get("attemptId");
    const attempt = attemptId ? await getAttemptById(attemptId) : null;
    if (!attempt || attempt.examId !== id) {
      return NextResponse.json({ error: "That result isn't for this exam" }, { status: 400 });
    }
    await deleteAttempt(attempt.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
