import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth/staff";
import { getTakerSession } from "@/lib/auth/session";

/** GET /api/me — who is signed in on this request (staff or taker). */
export async function GET() {
  try {
    const staff = await currentStaff();
    if (staff) {
      return NextResponse.json({
        kind: "staff",
        staff: { fullName: staff.fullName, role: staff.role, email: staff.email },
      });
    }
    const taker = await getTakerSession();
    if (taker) return NextResponse.json({ kind: "taker", taker });
    return NextResponse.json({ kind: null });
  } catch {
    // Treat any auth/backend hiccup as "signed out" rather than erroring the page.
    return NextResponse.json({ kind: null });
  }
}
