import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import {
  getClassAttendance,
  listStudentAttendance,
  upsertClassAttendance,
  upsertStudentAttendance,
} from "@/lib/data/attendance";
import { getClassById } from "@/lib/data/classes";

type Params = { params: Promise<{ id: string }> };

/** Only an admin, or the class's own class teacher, may enter its attendance. */
async function assertCanEditAttendance(classId: string) {
  const staff = await requireStaff();
  if (staff.role === "admin") return staff;
  const cls = await getClassById(classId);
  if (cls?.classTeacherId === staff.id) return staff;
  throw new AuthError("Only an admin or this class's teacher may edit its attendance", 403);
}

/** GET /api/classes/:id/attendance?termId= — the class's total days + each student's days present. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const termId = searchParams.get("termId") || "";
    if (!termId) {
      return NextResponse.json({ error: "Missing termId" }, { status: 400 });
    }
    const [classAttendance, students] = await Promise.all([
      getClassAttendance(id, termId),
      listStudentAttendance(id, termId),
    ]);
    return NextResponse.json({
      totalDays: classAttendance?.totalDays ?? 0,
      students,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/classes/:id/attendance — save the class's total days and each
 * student's days present in one call. { termId, totalDays, students: [{ studentId, daysPresent }] }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const staff = await assertCanEditAttendance(id);

    const body = await req.json().catch(() => null);
    const termId = String(body?.termId || "");
    const totalDays = Number(body?.totalDays);
    const students = Array.isArray(body?.students) ? body.students : [];

    if (!termId) {
      return NextResponse.json({ error: "Missing termId" }, { status: 400 });
    }
    if (!Number.isFinite(totalDays) || totalDays < 0) {
      return NextResponse.json({ error: "Total days must be a non-negative number" }, { status: 400 });
    }
    for (const s of students) {
      const days = Number(s?.daysPresent);
      if (!s?.studentId || !Number.isFinite(days) || days < 0) {
        return NextResponse.json({ error: "Each student needs a valid days-present value" }, { status: 400 });
      }
    }

    await upsertClassAttendance({ classId: id, termId, totalDays, updatedBy: staff.id });
    await upsertStudentAttendance(
      // Days present can never exceed the class's total school days — clamp so
      // a typo can't push a report card past 100% attendance.
      students.map((s: { studentId: string; daysPresent: number }) => ({
        studentId: s.studentId,
        termId,
        daysPresent: Math.min(Number(s.daysPresent), totalDays),
      })),
      staff.id
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
