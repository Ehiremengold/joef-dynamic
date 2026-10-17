import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/staff";
import {
  countActiveAdmins,
  createStaff,
  getStaffById,
  listStaff,
  updateStaff, resetStaffPassword, generatePassword } from "@/lib/data/staff";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import type { StaffRole } from "@/lib/types";

const ROLES: StaffRole[] = ["teacher", "admin", "super_admin"];

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
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    // Empty: the portal makes one (shown once in the reply).
    const typed = String(body?.password || "");
    const password = typed || generatePassword();
    const role: StaffRole = ROLES.includes(body?.role) ? body.role : "teacher";
    if (role === "super_admin" && !isSuperAdmin(admin.role)) {
      return NextResponse.json({ error: "Only a super admin can create a super admin" }, { status: 403 });
    }

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
    return NextResponse.json({ staff, password }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PATCH /api/staff — admin updates a staff account: { id, fullName?, role?, active? }.
 * Partial — only the fields present are touched. Only a super admin can
 * change a super admin's account, or make someone a super admin.
 * { id, action: "reset-password" } → { password }: a new generated password,
 * shown once (not for your own account).
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

    if (!isSuperAdmin(admin.role) && (isSuperAdmin(target.role) || body.role === "super_admin")) {
      return NextResponse.json({ error: "Only a super admin can change a super admin's account" }, { status: 403 });
    }

    if (body.action === "reset-password") {
      if (id === admin.id) {
        return NextResponse.json(
          { error: "You can't reset your own password here. Use Change my password" },
          { status: 400 }
        );
      }
      // Seeing an administrator's new password means being able to sign in as
      // them, so only a super admin may reset one. Admins reset teachers'.
      if (!isSuperAdmin(admin.role) && isAdmin(target.role)) {
        return NextResponse.json(
          { error: "Only a super admin can reset an administrator's password" },
          { status: 403 }
        );
      }
      const password = await resetStaffPassword(id);
      return NextResponse.json({ password });
    }

    const patch: { fullName?: string; role?: StaffRole; active?: boolean } = {};

    if (body.fullName !== undefined) {
      // Record details go through approval (see /api/change-requests); only
      // a super admin, whose own edits need none, may rename directly.
      if (!isSuperAdmin(admin.role)) {
        return NextResponse.json(
          { error: "Name changes need a super admin's approval. Use Edit details to send one." },
          { status: 403 }
        );
      }
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
      if (!ROLES.includes(body.role)) {
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
    if (id === admin.id && patch.role !== undefined && patch.role !== admin.role) {
      return NextResponse.json(
        { error: "You can't change your own role. Ask another admin to do it" },
        { status: 400 }
      );
    }

    // Demoting or deactivating the last remaining admin would leave nobody able
    // to manage staff, exams or the roster.
    const losesAdmin =
      isAdmin(target.role) &&
      target.active &&
      (patch.role === "teacher" || patch.active === false);
    if (losesAdmin && (await countActiveAdmins()) <= 1) {
      return NextResponse.json(
        { error: "This is the only active administrator. Promote someone else first" },
        { status: 400 }
      );
    }

    const staff = await updateStaff(id, patch);
    return NextResponse.json({ staff });
  } catch (e) {
    return errorResponse(e);
  }
}
