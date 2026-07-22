import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { createClass, listClasses } from "@/lib/data/classes";
import { CLASSES } from "@/lib/types";

/** GET /api/classes — any staff member may list classes (optionally by campus). */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const { searchParams } = new URL(req.url);
    const classes = await listClasses({
      campusId: searchParams.get("campusId") || undefined,
    });
    return NextResponse.json({ classes });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/classes — admin adds a class (level + optional arm) to a campus. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const campusId = String(body?.campusId || "");
    const level = body?.level;
    const arm = body?.arm ? String(body.arm).trim() : null;
    const classTeacherId = body?.classTeacherId ? String(body.classTeacherId) : null;

    if (!campusId) {
      return NextResponse.json({ error: "Choose a campus" }, { status: 400 });
    }
    if (!CLASSES.includes(level)) {
      return NextResponse.json({ error: "Choose a valid class level" }, { status: 400 });
    }

    const created = await createClass({ campusId, level, arm, classTeacherId });
    return NextResponse.json({ class: created }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
