import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import { getTermById } from "@/lib/data/terms";
import { listSubjectProgress, listSubjectSheet, subjectSheetRules, validMark, writeScores, type MarkChange, type ScoreWrite } from "@/lib/data/termScores";
import { isAdmin } from "@/lib/roles";
import { CA_MAX, EXAM_MAX } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** Who may see and change a class's term scores, for any term: its class teacher and admins. */
async function access(classId: string, termId: string) {
  const [staff, cls, term] = await Promise.all([requireStaff(), getClassById(classId), termId ? getTermById(termId) : null]);
  if (!cls) throw new AuthError("Class not found", 404);
  if (!isAdmin(staff.role) && cls.classTeacherId !== staff.id) {
    throw new AuthError("Only an admin or this class's teacher can see its scores", 403);
  }
  if (!term) throw new AuthError("Choose a valid term", 400);
  return { staff, term };
}

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
    await access(id, termId);
    const meta = { caMax: CA_MAX, examMax: EXAM_MAX };
    if (!subjectId) return NextResponse.json({ ...meta, ...(await listSubjectProgress(id, termId)) });
    return NextResponse.json({ ...meta, rows: await listSubjectSheet(id, termId, subjectId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/classes/:id/scores — save one subject's marks for the term.
 * { termId, subjectId, scores: [{ studentId, ca?: { value, was }, exam?: { value, was } }] }
 * Only the parts given are written, each only if it is still `was` (the
 * mark the sheet showed); otherwise nothing is saved and the answer is 409
 * with { conflicts: [{ studentId, ca, exam }] }, the marks as they are now.
 * A student left with both marks blank has their score removed.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const termId = String(body?.termId || "");
    const subjectId = String(body?.subjectId || "");
    const scores: unknown[] = Array.isArray(body?.scores) ? body.scores : [];
    await access(id, termId);
    if (!subjectId) return NextResponse.json({ error: "Choose a subject" }, { status: 400 });
    if (scores.length === 0) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

    const { offered, members, exempt: exemptIds } = await subjectSheetRules(id, termId, subjectId);
    if (!offered) return NextResponse.json({ error: "This class doesn't take that subject" }, { status: 400 });

    const rows: ScoreWrite[] = [];
    for (const raw of scores) {
      const r = raw as Record<string, unknown>;
      const studentId = String(r?.studentId || "");
      const ca = markChange(r?.ca, CA_MAX);
      const exam = markChange(r?.exam, EXAM_MAX);
      if (!members.has(studentId)) {
        return NextResponse.json({ error: "A student on this sheet isn't in this class for the term. Reload and try again." }, { status: 400 });
      }
      if (!ca && !exam) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
      if (ca === "bad" || exam === "bad") {
        return NextResponse.json(
          { error: `Marks must be numbers from 0 to ${CA_MAX} (CA) and 0 to ${EXAM_MAX} (exam), with at most two decimals` },
          { status: 400 }
        );
      }
      if (exemptIds.has(studentId) && (ca?.value != null || exam?.value != null)) {
        return NextResponse.json({ error: "A student on this sheet doesn't take this subject" }, { status: 400 });
      }
      rows.push({ studentId, classId: id, ca, exam });
    }
    return NextResponse.json(await writeScores({ termId, subjectId, rows }));
  } catch (e) {
    return errorResponse(e);
  }
}

/** One part of a mark from the request: absent (undefined), a valid change, or "bad". */
function markChange(raw: unknown, max: number): MarkChange | undefined | "bad" {
  if (raw === undefined) return undefined;
  const c = raw as { value?: unknown; was?: unknown } | null;
  const value = c?.value ?? null;
  const was = c?.was ?? null;
  return validMark(value, max) && (was === null || typeof was === "number") ? { value, was } : "bad";
}
