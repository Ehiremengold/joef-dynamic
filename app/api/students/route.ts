import { NextRequest, NextResponse } from "next/server";
import { errorResponse, pageParam } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import {
  assignStudentClass,
  createStudent,
  findSimilarStudents,
  getStudentByAdmissionNumber,
  normaliseAdmissionNumber,
  listStudentsPage,
  resetStudentPin,
  setStudentActive,
  unassignStudentClass,
} from "@/lib/data/students";
import { getClassById } from "@/lib/data/classes";

/**
 * GET /api/students — staff list/search the roster, a page at a time (?page=).
 * Filters: name, className (level), classId, campusId, year (entry year),
 * status (active|inactive), sessionId / termId (in school then: every active
 * student for the current period, students with results for a past one).
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const { searchParams } = new URL(req.url);
    const param = (key: string) => searchParams.get(key)?.trim() || undefined;
    const status = param("status");
    const { rows, total, periodMatch } = await listStudentsPage(
      {
        name: param("name"),
        className: param("className"),
        classId: param("classId"),
        campusId: param("campusId"),
        year: param("year"),
        status: status === "active" || status === "inactive" ? status : undefined,
        sessionId: param("sessionId"),
        termId: param("termId"),
      },
      pageParam(searchParams)
    );
    return NextResponse.json({ students: rows, total, periodMatch });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/students — staff add a student. Returns the one-time PIN.
 * { fullName, classId, entryYear, admissionNumber?, confirmDuplicate? }
 * No admission number → the next JDCL number. A name like an existing
 * student's answers 409 with { similar } unless confirmDuplicate is true.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json().catch(() => null);
    const typedNumber = normaliseAdmissionNumber(String(body?.admissionNumber || ""));
    const fullName = String(body?.fullName || "").trim().replace(/\s+/g, " ");
    const classId = String(body?.classId || "");
    const entryYear = String(body?.entryYear || new Date().getFullYear()).trim();

    if (fullName.length < 2) {
      return NextResponse.json({ error: "Enter the student's name" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(entryYear)) {
      return NextResponse.json({ error: "Choose an entry year" }, { status: 400 });
    }
    const [cls, taken, similar] = await Promise.all([
      classId ? getClassById(classId) : null,
      typedNumber ? getStudentByAdmissionNumber(typedNumber) : null,
      body?.confirmDuplicate ? [] : findSimilarStudents(fullName),
    ]);
    if (!cls) {
      return NextResponse.json({ error: "Choose the student's campus and class" }, { status: 400 });
    }
    if (typedNumber && typedNumber.length < 2) {
      return NextResponse.json({ error: "Enter a full admission number, or leave it empty" }, { status: 400 });
    }
    if (taken) {
      return NextResponse.json(
        { error: `Admission number ${typedNumber} already belongs to ${taken.fullName}` },
        { status: 400 }
      );
    }
    if (similar.length > 0) {
      return NextResponse.json(
        {
          error: "A student with a similar name is already in the portal",
          similar: similar.map((s) => ({ admissionNumber: s.admissionNumber, fullName: s.fullName, className: s.className, active: s.active })),
        },
        { status: 409 }
      );
    }

    const { student, pin } = await createStudent({
      admissionNumber: typedNumber || null,
      fullName,
      classId: cls.id,
      className: cls.level,
      entryYear,
      createdBy: staff.id,
    });
    return NextResponse.json({ student, pin }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PATCH /api/students — staff reset a PIN or toggle active.
 * { id, action: "reset-pin" } → { pin }
 * { id, action: "set-active", active }
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireStaff();
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ error: "Missing student id" }, { status: 400 });
    }
    if (body?.action === "reset-pin") {
      const pin = await resetStudentPin(id);
      return NextResponse.json({ pin });
    }
    if (body?.action === "set-active") {
      await setStudentActive(id, Boolean(body.active));
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "set-class") {
      const classId = String(body?.classId || "");
      if (!classId) {
        await unassignStudentClass(id);
        return NextResponse.json({ ok: true });
      }
      const cls = await getClassById(classId);
      if (!cls) {
        return NextResponse.json({ error: "Class not found" }, { status: 400 });
      }
      await assignStudentClass(id, cls.id, cls.level);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
