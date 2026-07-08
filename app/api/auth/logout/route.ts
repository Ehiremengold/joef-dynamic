import { NextResponse } from "next/server";
import { clearTakerSession } from "@/lib/auth/session";

/** POST /api/auth/logout — clears the taker (student/candidate) session. */
export async function POST() {
  await clearTakerSession();
  return NextResponse.json({ ok: true });
}
