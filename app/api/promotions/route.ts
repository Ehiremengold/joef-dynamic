import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/data/classes";
import { promotionProgress } from "@/lib/data/promotions";
import { getSessionById } from "@/lib/data/terms";
import { sessionStartYear } from "@/lib/promotion";
import { isAdmin } from "@/lib/roles";

/**
 * GET /api/promotions?sessionId= — for each class the caller may promote,
 * how many students still wait to be moved (or, in SS3, graduated) into the
 * session: { waiting: { [classId]: count } }. Classes with nobody left are
 * left out.
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const sessionId = new URL(req.url).searchParams.get("sessionId") || "";
    const session = sessionId ? await getSessionById(sessionId) : null;
    if (!session) {
      return NextResponse.json({ error: "Choose a valid session" }, { status: 400 });
    }
    const [waiting, classes] = await Promise.all([
      promotionProgress(session.id, sessionStartYear(session.name)),
      isAdmin(staff.role) ? null : listClasses({}),
    ]);
    // A teacher only promotes the classes they are class teacher of.
    const mine = classes ? new Set(classes.filter((c) => c.classTeacherId === staff.id).map((c) => c.id)) : null;
    return NextResponse.json({
      waiting: Object.fromEntries([...waiting].filter(([classId]) => !mine || mine.has(classId))),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
