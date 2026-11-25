import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import { subjectUsage } from "@/lib/data/subjects";

type Params = { params: Promise<{ id: string }> };

/** GET /api/subjects/:id/usage: what removing a subject would touch, shown before the admin confirms. */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const usage = await subjectUsage(id);
    if (!usage) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    return NextResponse.json(usage);
  } catch (e) {
    return errorResponse(e);
  }
}
