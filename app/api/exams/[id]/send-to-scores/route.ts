import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { applyCbtTransfer, planCbtTransfer, type ScorePart } from "@/lib/data/cbtTransfer";
import { listClasses } from "@/lib/data/classes";
import { getExam } from "@/lib/data/exams";
import { getTermById } from "@/lib/data/terms";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/exams/:id/send-to-scores — put a class test's CBT results on the
 * term score sheet. { termId, subjectId, part: "ca" | "exam", overwrite,
 * wholeMarks, preview } → { rows, saved }
 *
 * The same rules as entering term scores: a class teacher sends marks for
 * students in their own classes and the current term only; an admin, for
 * anyone and any term. With preview, nothing is written.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const termId = String(body?.termId || "");
    const subjectId = String(body?.subjectId || "");
    const part = body?.part as ScorePart;
    const preview = body?.preview === true;

    const [exam, term, classes] = await Promise.all([getExam(id), termId ? getTermById(termId) : null, listClasses()]);
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (exam.type !== "class") return NextResponse.json({ error: "Only class tests go on term scores" }, { status: 400 });
    if (!term) return NextResponse.json({ error: "Choose a term" }, { status: 400 });
    if (!subjectId) return NextResponse.json({ error: "Choose a subject" }, { status: 400 });
    if (part !== "ca" && part !== "exam") return NextResponse.json({ error: "Choose CA or exam" }, { status: 400 });

    const admin = isAdmin(staff.role);
    const mine = new Set(classes.filter((c) => c.classTeacherId === staff.id).map((c) => c.id));
    if (!admin && mine.size === 0) {
      throw new AuthError("Only an admin or a class teacher can put marks on term scores", 403);
    }
    if (!admin && !term.isCurrent && !preview) {
      throw new AuthError("Only an admin can change a past term's scores.", 403);
    }

    const rows = await planCbtTransfer({
      examId: id,
      termId,
      subjectId,
      part,
      overwrite: body?.overwrite === true,
      wholeMarks: body?.wholeMarks !== false,
      allowedClassIds: admin ? null : mine,
    });
    const saved = preview ? 0 : await applyCbtTransfer({ termId, subjectId, part, rows });
    return NextResponse.json({ rows, saved, canSave: admin || term.isCurrent });
  } catch (e) {
    return errorResponse(e);
  }
}
