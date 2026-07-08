import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/staff";

/** Convert thrown errors into JSON responses with sensible status codes. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const msg = e instanceof Error ? e.message : "Something went wrong";
  return NextResponse.json({ error: msg }, { status: 400 });
}
