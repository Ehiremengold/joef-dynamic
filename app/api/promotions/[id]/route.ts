import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getClassById } from "@/lib/data/classes";
import { getPromotion, undoPromotion } from "@/lib/data/promotions";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/promotions/:id — undo a move: the student goes back to the
 * class they came from. An admin, the class teacher of that class, or
 * whoever made the move.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const promotion = await getPromotion(id);
    if (!promotion) return NextResponse.json({ error: "Already undone" }, { status: 404 });
    if (!isAdmin(staff.role) && promotion.promotedBy !== staff.id) {
      const from = promotion.fromClassId ? await getClassById(promotion.fromClassId) : null;
      if (from?.classTeacherId !== staff.id) {
        throw new AuthError("Only an admin or the class teacher can undo this", 403);
      }
    }
    await undoPromotion(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
