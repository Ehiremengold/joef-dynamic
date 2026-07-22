import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { addClassSubject, listClassSubjects, removeClassSubject } from "@/lib/data/classes";

type Params = { params: Promise<{ id: string }> };

/** GET /api/classes/:id/subjects — any staff member may view a class's subject list. */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const subjects = await listClassSubjects(id);
    return NextResponse.json({ subjects });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/classes/:id/subjects — admin adds a subject to a class. { subjectId } */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const subjectId = String(body?.subjectId || "");
    if (!subjectId) {
      return NextResponse.json({ error: "Choose a subject" }, { status: 400 });
    }
    await addClassSubject(id, subjectId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/classes/:id/subjects — admin removes a subject from a class. { subjectId } */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const subjectId = String(body?.subjectId || "");
    if (!subjectId) {
      return NextResponse.json({ error: "Choose a subject" }, { status: 400 });
    }
    await removeClassSubject(id, subjectId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
