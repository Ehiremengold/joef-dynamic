import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import { getStudentById } from "@/lib/data/students";
import { getTermById } from "@/lib/data/terms";
import { classForTerm, listClassTermReports, saveTermReport } from "@/lib/data/termReports";
import { MAX_COMMENT_LENGTH, sanitizeRatings } from "@/lib/reportCard";

type Params = { params: Promise<{ id: string }> };

/** GET /api/classes/:id/reports?termId= — the class teacher's reports for a term. The class teacher or an admin. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const cls = await getClassById(id);
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    if (staff.role !== "admin" && cls.classTeacherId !== staff.id) {
      throw new AuthError("Only this class's class teacher or an admin can see its reports", 403);
    }
    const termId = new URL(req.url).searchParams.get("termId") || "";
    if (!(termId && (await getTermById(termId)))) {
      return NextResponse.json({ error: "Choose a valid term" }, { status: 400 });
    }
    return NextResponse.json({ students: await listClassTermReports(id, termId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/classes/:id/reports — { termId, studentId, ratings, teacherComment }.
 * Only the class's assigned class teacher may write a report — admins are not
 * exempt, since the comment is signed with the writer's name — and only for a
 * student who was in the class that term.
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
    const teacherComment = String(body?.teacherComment ?? "").trim();
    const [term, student] = await Promise.all([
      getTermById(String(body?.termId || "")),
      getStudentById(String(body?.studentId || "")),
    ]);
    if (!term) return NextResponse.json({ error: "Choose a valid term" }, { status: 400 });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if ((await classForTerm(student.id, term.id, student.classId)) !== id) {
      return NextResponse.json({ error: "That student was not in this class that term" }, { status: 400 });
    }
    if (teacherComment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: `Keep the comment under ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
    }

    await saveTermReport({
      studentId: student.id,
      termId: term.id,
      ratings: sanitizeRatings(body?.ratings),
      teacherComment,
      signedBy: staff.fullName,
      updatedBy: staff.id,
    });
    return NextResponse.json({ ok: true, signedBy: staff.fullName });
  } catch (e) {
    return errorResponse(e);
  }
}
