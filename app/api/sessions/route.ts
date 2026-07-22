import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { createSession, listSessions, setCurrentSession } from "@/lib/data/terms";

/** GET /api/sessions — any staff member may list academic sessions. */
export async function GET() {
  try {
    await requireStaff();
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/sessions — admin adds an academic session, e.g. "2025/2026". */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    if (name.length < 4) {
      return NextResponse.json({ error: "Enter a session name, e.g. 2025/2026" }, { status: 400 });
    }
    const session = await createSession(name);
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/sessions — admin marks a session current. { id, action: "set-current" } */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "");
    if (!id || body?.action !== "set-current") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    await setCurrentSession(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
