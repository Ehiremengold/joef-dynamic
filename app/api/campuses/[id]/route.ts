import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import { deleteCampus } from "@/lib/data/campuses";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/campuses/:id — admin removes a campus (cascades to its classes). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteCampus(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
