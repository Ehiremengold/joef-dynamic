import { NextRequest, NextResponse } from "next/server";
import { getTakerSession } from "@/lib/auth/session";
import { getExam, isOpen } from "@/lib/data/exams";
import { getSession, isExpired, saveAnswers } from "@/lib/data/attemptSessions";
import { canSit } from "@/lib/data/submit";

/**
 * POST /api/attempts/session/beacon — last-gasp autosave on page unload.
 *
 * navigator.sendBeacon can only POST, and its response is discarded, so this is
 * a save-only twin of PATCH /api/attempts/session: no clock sync, no auto-submit
 * on expiry, and it stays quiet about failures. Everything it writes is
 * re-validated on the next real resume.
 */
export async function POST(req: NextRequest) {
  try {
    const taker = await getTakerSession();
    if (!taker) return new NextResponse(null, { status: 204 });

    const body = await req.json().catch(() => null);
    if (typeof body?.examId !== "string") {
      return new NextResponse(null, { status: 204 });
    }

    const exam = await getExam(body.examId);
    if (!exam || !isOpen(exam) || !canSit(exam, taker)) {
      return new NextResponse(null, { status: 204 });
    }

    // Save only into a sitting that already exists and still has time on it —
    // a beacon must never start a clock or overwrite answers after the bell.
    const session = await getSession(exam.id, taker);
    if (session && !isExpired(session, exam)) {
      await saveAnswers(session.id, exam, body.answers);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
