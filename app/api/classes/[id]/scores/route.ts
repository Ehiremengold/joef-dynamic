import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import { getTermById } from "@/lib/data/terms";
import { listSubjectProgress, listSubjectSheet, saveSubjectScores, subjectSheetRules, validMark } from "@/lib/data/termScores";
import { isAdmin } from "@/lib/roles";
import { CA_MAX, EXAM_MAX, type Staff, type Term } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Who may see and change a class's term scores: its class teacher and admins.
 * A class teacher can change the current term only; a past term's results
 * are an admin's to correct, so history isn't rewritten by accident.
 */
async function access(classId: string, termId: string) {
  const [staff, cls, term] = await Promise.all([requireStaff(), getClassById(classId), termId ? getTermById(termId) : null]);
  if (!cls) throw new AuthError("Class not found", 404);
  if (!isAdmin(staff.role) && cls.classTeacherId !== staff.id) {
    throw new AuthError("Only an admin or this class's teacher can see its scores", 403);
  }
  if (!term) throw new AuthError("Choose a valid term", 400);
  return { staff, term, canEdit: canEdit(staff, term) };
}

const canEdit = (staff: Staff, term: Term) => isAdmin(staff.role) || term.isCurrent;
const READ_ONLY_REASON = "Only an admin can change a past term's scores.";

/**
 * GET /api/classes/:id/scores?termId=            → the class's subjects, with progress
 * GET /api/classes/:id/scores?termId=&subjectId= → one subject's score sheet
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const sp = new URL(req.url).searchParams;
    const termId = sp.get("termId") || "";
    const subjectId = sp.get("subjectId") || "";
    const { canEdit } = await access(id, termId);
    const meta = { canEdit, readOnlyReason: canEdit ? null : READ_ONLY_REASON, caMax: CA_MAX, examMax: EXAM_MAX };
    if (!subjectId) return NextResponse.json({ ...meta, ...(await listSubjectProgress(id, termId)) });
    return NextResponse.json({ ...meta, rows: await listSubjectSheet(id, termId, subjectId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/classes/:id/scores — save one subject's marks for the term.
 * { termId, subjectId, scores: [{ studentId, ca: number | null, exam: number | null }] }
 * Blank both marks to remove a student's score.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const termId = String(body?.termId || "");
    const subjectId = String(body?.subjectId || "");
    const scores: unknown[] = Array.isArray(body?.scores) ? body.scores : [];
    const { canEdit } = await access(id, termId);
    if (!canEdit) throw new AuthError(READ_ONLY_REASON, 403);
    if (!subjectId) return NextResponse.json({ error: "Choose a subject" }, { status: 400 });
    if (scores.length === 0) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

    const { offered, members, exempt: exemptIds } = await subjectSheetRules(id, termId, subjectId);
    if (!offered) return NextResponse.json({ error: "This class doesn't take that subject" }, { status: 400 });

    const rows = [];
    for (const raw of scores) {
      const r = raw as Record<string, unknown>;
      const studentId = String(r?.studentId || "");
      const ca = r?.ca ?? null;
      const exam = r?.exam ?? null;
      if (!members.has(studentId)) {
        return NextResponse.json({ error: "A student on this sheet isn't in this class for the term. Reload and try again." }, { status: 400 });
      }
      if (!validMark(ca, CA_MAX) || !validMark(exam, EXAM_MAX)) {
        return NextResponse.json(
          { error: `Marks must be numbers from 0 to ${CA_MAX} (CA) and 0 to ${EXAM_MAX} (exam), with at most two decimals` },
          { status: 400 }
        );
      }
      if (exemptIds.has(studentId) && (ca !== null || exam !== null)) {
        return NextResponse.json({ error: "A student on this sheet doesn't take this subject" }, { status: 400 });
      }
      rows.push({ studentId, ca, exam });
    }
    return NextResponse.json(await saveSubjectScores({ classId: id, termId, subjectId, rows }));
  } catch (e) {
    return errorResponse(e);
  }
}
