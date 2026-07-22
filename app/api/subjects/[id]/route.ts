import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import { deleteSubject, updateSubject } from "@/lib/data/subjects";
import type { Department } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };
const DEPARTMENTS: Department[] = ["science", "art", "commercial"];

/** PATCH /api/subjects/:id — admin edits a subject. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const patch: { name?: string; code?: string | null; department?: Department | null } = {};
    if (body && "name" in body) patch.name = String(body.name || "").trim();
    if (body && "code" in body) patch.code = body.code ? String(body.code).trim() : null;
    if (body && "department" in body) {
      const dep = body.department ? String(body.department) : null;
      if (dep && !DEPARTMENTS.includes(dep as Department)) {
        return NextResponse.json({ error: "Invalid department" }, { status: 400 });
      }
      patch.department = dep as Department | null;
    }
    const updated = await updateSubject(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    return NextResponse.json({ subject: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/subjects/:id — admin removes a subject from the catalog. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteSubject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
