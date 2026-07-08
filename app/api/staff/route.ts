import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import { createStaff, listStaff, setStaffActive } from "@/lib/data/staff";

/** GET /api/staff — admin lists all staff accounts. */
export async function GET() {
  try {
    await requireAdmin();
    const staff = await listStaff();
    return NextResponse.json({ staff });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/staff — admin creates a staff account. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const role = body?.role === "admin" ? "admin" : "teacher";

    if (fullName.length < 2) {
      return NextResponse.json({ error: "Enter the staff member's name" }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const staff = await createStaff({ fullName, email, password, role });
    return NextResponse.json({ staff }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/staff — admin activates/deactivates a staff account. */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "");
    const active = Boolean(body?.active);
    if (!id) {
      return NextResponse.json({ error: "Missing staff id" }, { status: 400 });
    }
    if (id === admin.id && !active) {
      return NextResponse.json(
        { error: "You can't deactivate your own account" },
        { status: 400 }
      );
    }
    await setStaffActive(id, active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
