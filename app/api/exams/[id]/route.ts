import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { currentStaff, requireStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";
import {
  deleteExam,
  getExam,
  isOpen,
  replaceQuestions,
  toPublicExam,
  updateExamMeta,
} from "@/lib/data/exams";

type Params = { params: Promise<{ id: string }> };

/** GET one exam — staff get full, takers get an open exam with answers stripped. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const staff = await currentStaff();
    if (staff) return NextResponse.json({ exam });

    const taker = await getTakerSession();
    const allowed =
      taker &&
      ((taker.kind === "candidate" && exam.type === "entrance") ||
        (taker.kind === "student" &&
          exam.type === "class" &&
          exam.className === taker.className));
    if (!allowed || !isOpen(exam)) {
      return NextResponse.json({ error: "Exam not available" }, { status: 403 });
    }
    return NextResponse.json({ exam: toPublicExam(exam) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/exams/:id — staff only. Partial: { title?, durationMins?, active?, questions? }.
 * Questions are validated and replaced wholesale.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (Array.isArray(body.questions)) {
      const cleaned = [];
      for (const q of body.questions) {
        const options = Array.isArray(q.options)
          ? q.options.map((o: unknown) => String(o ?? "").trim()).filter(Boolean)
          : [];
        const correctIndex = Number(q.correctIndex);
        if (
          typeof q.text !== "string" ||
          !q.text.trim() ||
          options.length < 2 ||
          !Number.isInteger(correctIndex) ||
          correctIndex < 0 ||
          correctIndex >= options.length
        ) {
          return NextResponse.json(
            {
              error:
                "Each question needs text, at least 2 options and a valid correct answer",
            },
            { status: 400 }
          );
        }
        cleaned.push({ text: q.text.trim(), options, correctIndex });
      }
      await replaceQuestions(id, cleaned);
    }

    await updateExamMeta(id, {
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined,
      durationMins:
        body.durationMins !== undefined
          ? Math.max(1, Math.min(180, Number(body.durationMins) || exam.durationMins))
          : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });

    const updated = await getExam(id);
    return NextResponse.json({ exam: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    await deleteExam(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
