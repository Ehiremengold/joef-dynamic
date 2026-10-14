import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import { getStudentById } from "@/lib/data/students";
import { listClassTermReports, saveTermReport } from "@/lib/data/termReports";
import { MAX_COMMENT_LENGTH, RATINGS, TRAITS, type Rating } from "@/lib/reportCard";

type Params = { params: Promise<{ id: string }> };

/** GET /api/classes/:id/reports?termId= — each student's ratings and teacher comment. Any staff may view. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const termId = new URL(req.url).searchParams.get("termId") || "";
    if (!termId) {
      return NextResponse.json({ error: "Missing termId" }, { status: 400 });
    }
    return NextResponse.json({ students: await listClassTermReports(id, termId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/classes/:id/reports — { termId, studentId, ratings, teacherComment }.
 * Only the class's assigned class teacher may write a report, and only for a
 * student in that class. Admins are not exempt: the comment is signed with
 * the writer's name on the report sheet.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const cls = await getClassById(id);
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    if (cls.classTeacherId !== staff.id) {
      throw new AuthError("Only this class's class teacher can write its reports", 403);
    }

    const body = await req.json().catch(() => null);
    const termId = String(body?.termId || "");
    const studentId = String(body?.studentId || "");
    const teacherComment = String(body?.teacherComment ?? "").trim();
    if (!termId || !studentId) {
      return NextResponse.json({ error: "Missing termId or studentId" }, { status: 400 });
    }
    const student = await getStudentById(studentId);
    if (student?.classId !== id) {
      return NextResponse.json({ error: "That student is not in this class" }, { status: 400 });
    }
    if (teacherComment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: `Keep the comment under ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
    }

    // Keep only known traits with known ratings; anything else is dropped.
    const ratings: Partial<Record<string, Rating>> = {};
    for (const trait of TRAITS) {
      const rating = body?.ratings?.[trait];
      if ((RATINGS as readonly string[]).includes(rating)) ratings[trait] = rating;
    }

    await saveTermReport({ studentId, termId, ratings, teacherComment, updatedBy: staff.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
