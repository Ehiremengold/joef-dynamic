import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import {
  listClassPromotions,
  listPromotionCandidates,
  promoteStudents,
  type Move,
} from "@/lib/data/promotions";
import { getSessionById } from "@/lib/data/terms";
import { isAdmin } from "@/lib/roles";
import { PROMOTION_OUTCOMES, type PromotionOutcome } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** Only an admin, or the class's own class teacher, may promote its students. */
async function classForPromotion(id: string) {
  // Neither lookup needs the other: run them together.
  const [staff, cls] = await Promise.all([requireStaff(), getClassById(id)]);
  if (!cls) throw new AuthError("Class not found", 404);
  if (!isAdmin(staff.role) && cls.classTeacherId !== staff.id) {
    throw new AuthError("Only an admin or this class's teacher may promote its students", 403);
  }
  return { staff, cls };
}

/**
 * GET /api/classes/:id/promotion?sessionId= — who in the class still needs
 * moving into the session, and the moves already made out of it.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const sessionId = new URL(req.url).searchParams.get("sessionId") || "";
    if (!sessionId) {
      return NextResponse.json({ error: "Choose a valid session" }, { status: 400 });
    }
    // The permission check, the session check and the reads are independent,
    // so they share one round trip; nothing is returned unless all pass.
    const [, session, students, done] = await Promise.all([
      classForPromotion(id),
      getSessionById(sessionId),
      listPromotionCandidates(id, sessionId),
      listClassPromotions(id, sessionId),
    ]);
    if (!session) {
      return NextResponse.json({ error: "Choose a valid session" }, { status: 400 });
    }
    return NextResponse.json({ students, done });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/classes/:id/promotion — move students out of this class into a session.
 * { sessionId, moves: [{ studentId, outcome: "promoted"|"repeated"|"graduated", toClassId? }] }
 * Students not listed are left for later.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { staff, cls } = await classForPromotion(id);
    const body = await req.json().catch(() => null);
    const sessionId = String(body?.sessionId || "");
    const rawMoves: unknown[] = Array.isArray(body?.moves) ? body.moves : [];

    if (!sessionId) {
      return NextResponse.json({ error: "Choose a valid session" }, { status: 400 });
    }
    if (rawMoves.length === 0) {
      return NextResponse.json({ error: "Choose at least one student" }, { status: 400 });
    }
    const [session, candidates] = await Promise.all([
      getSessionById(sessionId),
      listPromotionCandidates(id, sessionId),
    ]);
    if (!session) {
      return NextResponse.json({ error: "Choose a valid session" }, { status: 400 });
    }
    const waiting = new Set(candidates.map((s) => s.id));
    const moves: Move[] = [];
    for (const raw of rawMoves) {
      const m = raw as Record<string, unknown>;
      const studentId = String(m?.studentId || "");
      const outcome = m?.outcome as PromotionOutcome;
      const toClassId = m?.toClassId ? String(m.toClassId) : null;
      if (!waiting.has(studentId)) {
        return NextResponse.json(
          { error: "A student in this list is no longer waiting in this class. Reload and try again." },
          { status: 400 }
        );
      }
      if (!PROMOTION_OUTCOMES.includes(outcome)) {
        return NextResponse.json({ error: "Unknown promotion choice" }, { status: 400 });
      }
      if (outcome === "graduated" && cls.level !== "SS3") {
        return NextResponse.json({ error: "Only SS3 students can graduate" }, { status: 400 });
      }
      if (outcome === "promoted") {
        if (!toClassId) {
          return NextResponse.json({ error: "Choose the class each promoted student moves to" }, { status: 400 });
        }
        if (toClassId === id) {
          return NextResponse.json({ error: "To keep a student in this class, choose “Repeat”" }, { status: 400 });
        }
      }
      moves.push({ studentId, outcome, toClassId: outcome === "promoted" ? toClassId : null });
    }

    const moved = await promoteStudents(sessionId, staff.id, moves);
    return NextResponse.json({ moved });
  } catch (e) {
    return errorResponse(e);
  }
}
