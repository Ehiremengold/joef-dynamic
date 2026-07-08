import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import {
  createStudent,
  listStudents,
  resetStudentPin,
  setStudentActive,
} from "@/lib/data/students";
import { CLASSES } from "@/lib/types";

/** GET /api/students — staff list/search the roster. */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const { searchParams } = new URL(req.url);
    const students = await listStudents({
      name: searchParams.get("name")?.trim() || undefined,
      className: searchParams.get("className") || undefined,
      year: searchParams.get("year")?.trim() || undefined,
    });
    return NextResponse.json({ students });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/students — staff add a student. Returns the one-time PIN. */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json().catch(() => null);
    const admissionNumber = String(body?.admissionNumber || "").trim();
    const fullName = String(body?.fullName || "").trim();
    const className = body?.className;
    const entryYear = String(body?.entryYear || new Date().getFullYear()).trim();

    if (admissionNumber.length < 2) {
      return NextResponse.json({ error: "Enter an admission number" }, { status: 400 });
    }
    if (fullName.length < 2) {
      return NextResponse.json({ error: "Enter the student's name" }, { status: 400 });
    }
    if (!CLASSES.includes(className)) {
      return NextResponse.json({ error: "Choose a valid class" }, { status: 400 });
    }

    const { student, pin } = await createStudent({
      admissionNumber,
      fullName,
      className,
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
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
