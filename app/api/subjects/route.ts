import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { createSubject, listSubjects } from "@/lib/data/subjects";
import type { Department } from "@/lib/types";

const DEPARTMENTS: Department[] = ["science", "art", "commercial"];

/** GET /api/subjects — any staff member may list the subject catalog. */
export async function GET() {
  try {
    await requireStaff();
    const subjects = await listSubjects();
    return NextResponse.json({ subjects });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/subjects — admin adds a subject to the catalog. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const code = body?.code ? String(body.code).trim() : null;
    const department = body?.department ? String(body.department) : null;

    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a subject name" }, { status: 400 });
    }
    if (department && !DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    const subject = await createSubject({
      name,
      code,
      department: department as Department | null,
    });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
