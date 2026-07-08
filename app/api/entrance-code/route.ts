import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getEntranceAccess, setEntranceAccess } from "@/lib/data/entrance";

/** GET /api/entrance-code — staff view the current entrance code + status. */
export async function GET() {
  try {
    await requireStaff();
    const access = await getEntranceAccess();
    return NextResponse.json({ access });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PUT /api/entrance-code — staff set the code and/or its active state.
 * { code?: string, active?: boolean }
 * Activating requires a non-empty code.
 */
export async function PUT(req: NextRequest) {
  try {
    await requireStaff();
    const body = await req.json().catch(() => null);
    const patch: { code?: string | null; active?: boolean } = {};

    if (typeof body?.code === "string") patch.code = body.code.trim() || null;
    if (typeof body?.active === "boolean") patch.active = body.active;

    // Can't switch on without a code present (either incoming or already stored).
    if (patch.active === true) {
      const incoming = patch.code ?? (await getEntranceAccess()).code;
      if (!incoming) {
        return NextResponse.json(
          { error: "Set a code before activating it" },
          { status: 400 }
        );
      }
    }

    const access = await setEntranceAccess(patch);
    return NextResponse.json({ access });
  } catch (e) {
    return errorResponse(e);
  }
}
