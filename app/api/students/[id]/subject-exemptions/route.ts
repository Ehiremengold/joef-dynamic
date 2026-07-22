import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import { getStudentById } from "@/lib/data/students";
import { listStudentExemptions, setStudentExemptions } from "@/lib/data/subjects";

type Params = { params: Promise<{ id: string }> };

/** Admins may edit any student; a teacher may only edit their own class's students. */
async function assertCanEditStudent(studentClassId: string | null) {
  const staff = await requireStaff();
  if (staff.role === "admin") return staff;
  if (studentClassId) {
    const cls = await getClassById(studentClassId);
    if (cls?.classTeacherId === staff.id) return staff;
  }
  throw new AuthError("Only an admin or this student's class teacher may do that", 403);
}

/** GET /api/students/:id/subject-exemptions — subjects this student isn't taking. */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const subjectIds = await listStudentExemptions(id);
    return NextResponse.json({ subjectIds });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT /api/students/:id/subject-exemptions — replace the exemption set. { subjectIds: string[] } */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const student = await getStudentById(id);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    await assertCanEditStudent(student.classId);

    const body = await req.json().catch(() => null);
    const subjectIds = Array.isArray(body?.subjectIds) ? body.subjectIds.map(String) : null;
    if (!subjectIds) {
      return NextResponse.json({ error: "subjectIds must be an array" }, { status: 400 });
    }
    await setStudentExemptions(id, subjectIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
