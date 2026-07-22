import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { createCampus, listCampuses } from "@/lib/data/campuses";

/** GET /api/campuses — any staff member may list campuses. */
export async function GET() {
  try {
    await requireStaff();
    const campuses = await listCampuses();
    return NextResponse.json({ campuses });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/campuses — admin adds a campus. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a campus name" }, { status: 400 });
    }
    const campus = await createCampus(name);
    return NextResponse.json({ campus }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
