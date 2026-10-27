import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getExam } from "@/lib/data/exams";
import { analyseExam } from "@/lib/data/review";

type Params = { params: Promise<{ id: string }> };

/** GET /api/exams/:id/analysis — staff: how everyone did, overall and question by question. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    return NextResponse.json({ analysis: await analyseExam(exam) });
  } catch (e) {
    return errorResponse(e);
  }
}
