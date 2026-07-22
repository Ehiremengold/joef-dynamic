import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import { deleteClass, updateClass } from "@/lib/data/classes";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/classes/:id — admin renames an arm and/or reassigns the class teacher.
 * { arm?: string | null, classTeacherId?: string | null }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const patch: { arm?: string | null; classTeacherId?: string | null } = {};
    if (body && "arm" in body) {
      patch.arm = body.arm ? String(body.arm).trim() : null;
    }
    if (body && "classTeacherId" in body) {
      patch.classTeacherId = body.classTeacherId ? String(body.classTeacherId) : null;
    }
    const updated = await updateClass(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    return NextResponse.json({ class: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/classes/:id — admin removes a class. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteClass(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
