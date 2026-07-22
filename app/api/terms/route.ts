import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { createTerm, listTerms, setCurrentTerm } from "@/lib/data/terms";
import type { Term } from "@/lib/types";

const TERM_NAMES: Term["name"][] = ["First Term", "Second Term", "Third Term"];

/** GET /api/terms — any staff member may list terms (optionally by session). */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const { searchParams } = new URL(req.url);
    const terms = await listTerms({ sessionId: searchParams.get("sessionId") || undefined });
    return NextResponse.json({ terms });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/terms — admin adds a term to a session. { sessionId, name } */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const sessionId = String(body?.sessionId || "");
    const name = body?.name;
    if (!sessionId) {
      return NextResponse.json({ error: "Choose a session" }, { status: 400 });
    }
    if (!TERM_NAMES.includes(name)) {
      return NextResponse.json({ error: "Choose a valid term" }, { status: 400 });
    }
    const term = await createTerm({ sessionId, name });
    return NextResponse.json({ term }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/terms — admin marks a term current. { id, action: "set-current" } */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "");
    if (!id || body?.action !== "set-current") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    await setCurrentTerm(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
