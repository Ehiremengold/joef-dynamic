import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { changeOwnPassword } from "@/lib/data/staff";

/** POST /api/me/password — a signed-in staff member changes their own password. { currentPassword, newPassword } */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json().catch(() => null);
    const current = String(body?.currentPassword || "");
    const next = String(body?.newPassword || "");
    if (!current) return NextResponse.json({ error: "Enter your current password" }, { status: 400 });
    if (next.length < 8) return NextResponse.json({ error: "The new password must be at least 8 characters" }, { status: 400 });
    if (next === current) return NextResponse.json({ error: "Choose a password different from your current one" }, { status: 400 });
    await changeOwnPassword(staff, current, next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
