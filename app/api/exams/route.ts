import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { currentStaff, requireStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";
import { CLASSES, type ExamType } from "@/lib/types";
import {
  createExam,
  isOpen,
  isUpcoming,
  listExams,
  toPublicExam,
} from "@/lib/data/exams";

/**
 * GET /api/exams?type=&className=
 * - Staff: full exams (incl. answers, inactive) for management.
 * - Taker (student/candidate session): OPEN exams, answers stripped, scoped
 *   to what they're allowed to sit; plus `upcoming`, scheduled ones that
 *   haven't opened yet (title and times only, no questions), and
 *   `serverNow`, the server's clock.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") as ExamType) || undefined;
    const className = searchParams.get("className") || undefined;

    const staff = await currentStaff();
    if (staff) {
      const exams = await listExams({ type, className });
      return NextResponse.json({ exams });
    }

    const taker = await getTakerSession();
    if (!taker) {
      return NextResponse.json({ error: "Sign in to view tests" }, { status: 401 });
    }

    // Takers only ever see exams appropriate to who they are.
    let exams;
    if (taker.kind === "candidate") {
      exams = await listExams({ type: "entrance", activeOnly: true });
    } else {
      exams = await listExams({ type: "class", className: taker.className, activeOnly: true });
    }
    const ready = exams.filter((e) => e.questions.length > 0);
    const open = ready.filter(isOpen);
    // Scheduled tests they'll sit later: when, and how long. Never the questions.
    const upcoming = ready
      .filter(isUpcoming)
      .sort((a, b) => Date.parse(a.opensAt!) - Date.parse(b.opensAt!))
      .map((e) => ({
        id: e.id,
        title: e.title,
        durationMins: e.durationMins,
        opensAt: e.opensAt,
        closesAt: e.closesAt,
        questionCount: e.questions.length,
      }));
    // The server's clock, so a device whose clock is off still knows when the next test opens.
    return NextResponse.json({ exams: open.map(toPublicExam), upcoming, serverNow: new Date().toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/exams — staff create an exam (starts hidden, no questions). */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json().catch(() => null);
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: "A title is required" }, { status: 400 });
    }
    const type: ExamType = body.type === "entrance" ? "entrance" : "class";
    if (type === "class" && !CLASSES.includes(body.className)) {
      return NextResponse.json(
        { error: "A valid class is required for class tests" },
        { status: 400 }
      );
    }
    const exam = await createExam({
      type,
      className: type === "class" ? body.className : null,
      title: body.title.trim(),
      durationMins: Math.max(1, Math.min(180, Number(body.durationMins) || 30)),
      createdBy: staff.id,
    });
    return NextResponse.json({ exam }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
