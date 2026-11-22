import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/staff";

/**
 * Someone else changed what this request meant to change, since the person
 * saw it. Answered 409, with `details` (e.g. which marks) beside the message.
 */
export class ConflictError extends Error {
  details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.details = details;
  }
}

/** Convert thrown errors into JSON responses with sensible status codes. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ConflictError) {
    return NextResponse.json({ error: e.message, ...e.details }, { status: 409 });
  }
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const msg = e instanceof Error ? e.message : "Something went wrong";
  return NextResponse.json({ error: msg }, { status: 400 });
}

/** The 1-based ?page= of a list request; anything missing or silly is page 1. */
export function pageParam(searchParams: URLSearchParams): number {
  const page = Number(searchParams.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}
