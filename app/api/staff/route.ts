import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import {
  countActiveAdmins,
  createStaff,
  getStaffById,
  listStaff,
  updateStaff,
} from "@/lib/data/staff";
import type { StaffRole } from "@/lib/types";

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

/**
 * PATCH /api/staff — admin updates a staff account: { id, fullName?, role?, active? }.
 * Partial — only the fields present are touched.
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ error: "Missing staff id" }, { status: 400 });
    }

    const target = await getStaffById(id);
    if (!target) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const patch: { fullName?: string; role?: StaffRole; active?: boolean } = {};

    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim();
      if (fullName.length < 2) {
        return NextResponse.json(
          { error: "Enter the staff member's name" },
          { status: 400 }
        );
      }
      patch.fullName = fullName;
    }

    if (body.role !== undefined) {
      if (body.role !== "admin" && body.role !== "teacher") {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      patch.role = body.role;
    }

    if (body.active !== undefined) {
      patch.active = Boolean(body.active);
    }

    // Guard the ways an admin can lock themselves — or everyone — out.
    if (id === admin.id && patch.active === false) {
      return NextResponse.json(
        { error: "You can't deactivate your own account" },
        { status: 400 }
      );
    }
    if (id === admin.id && patch.role === "teacher") {
      return NextResponse.json(
        { error: "You can't remove your own admin rights — ask another admin to do it" },
        { status: 400 }
      );
    }

    // Demoting or deactivating the last remaining admin would leave nobody able
    // to manage staff, exams or the roster.
    const losesAdmin =
      target.role === "admin" &&
      target.active &&
      (patch.role === "teacher" || patch.active === false);
    if (losesAdmin && (await countActiveAdmins()) <= 1) {
      return NextResponse.json(
        { error: "This is the only active administrator — promote someone else first" },
        { status: 400 }
      );
    }

    const staff = await updateStaff(id, patch);
    return NextResponse.json({ staff });
  } catch (e) {
    return errorResponse(e);
  }
}
