import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { deleteAttempt, getAttemptById } from "@/lib/data/attempts";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/attempts/:id — staff remove a result whose exam has been deleted.
 * A result that still has its exam is cleared from that exam's sittings
 * instead (which is what lets the student sit it again), so it is refused here.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const attempt = await getAttemptById(id);
    if (!attempt) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    if (attempt.examId) {
      return NextResponse.json(
        { error: "Clear this result from its exam's sittings instead" },
        { status: 400 }
      );
    }
    await deleteAttempt(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
