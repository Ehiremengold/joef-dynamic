import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import { studentDeletionImpact } from "@/lib/data/students";

type Params = { params: Promise<{ id: string }> };

/** GET /api/students/:id/deletion-impact — what deleting this student would remove, before anyone confirms. */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    return NextResponse.json({ impact: await studentDeletionImpact(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
