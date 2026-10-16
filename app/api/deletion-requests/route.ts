import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/staff";
import { getExam } from "@/lib/data/exams";
import { createDeletionRequest, decideDeletionRequest, listDeletionRequests } from "@/lib/data/deletionRequests";
import { examAccess, isSuperAdmin } from "@/lib/roles";

/** GET /api/deletion-requests — super admins see every request; an admin sees their own. */
export async function GET() {
  try {
    const staff = await requireAdmin();
    const requests = await listDeletionRequests(isSuperAdmin(staff.role) ? {} : { requestedBy: staff.id });
    return NextResponse.json({ requests });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/deletion-requests — an admin asks to delete someone else's exam
 * or one of its questions: { examId, questionIndex?, reason }.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const body = await req.json().catch(() => null);
    const reason = String(body?.reason ?? "").trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: "Say briefly why it should be deleted" }, { status: 400 });
    }
    const exam = await getExam(String(body?.examId || ""));
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (examAccess(staff, exam) === "manage") {
      return NextResponse.json({ error: "This is yours, so you can delete it directly" }, { status: 400 });
    }

    let question: { text: string; options: string[] } | null = null;
    if (body?.questionIndex !== undefined) {
      const q = exam.questions[Number(body.questionIndex)];
      if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });
      question = { text: q.text, options: q.options };
    }

    await createDeletionRequest({ examId: exam.id, examTitle: exam.title, question, reason, requestedBy: staff.id });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/deletion-requests — a super admin approves or rejects: { id, approve: boolean }. */
export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireSuperAdmin();
    const body = await req.json().catch(() => null);
    const status = await decideDeletionRequest(String(body?.id || ""), body?.approve === true, staff.id);
    return NextResponse.json({ status });
  } catch (e) {
    return errorResponse(e);
  }
}
