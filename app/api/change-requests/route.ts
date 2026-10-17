import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/staff";
import { decideChangeRequest, listChangeRequests, requestChange, requestStudentDeletion } from "@/lib/data/changeRequests";
import { getStaffById } from "@/lib/data/staff";
import { isSuperAdmin } from "@/lib/roles";
import type { RecordType } from "@/lib/recordChanges";

/**
 * GET /api/change-requests[?pending=1] — super admins see every request; an
 * admin sees their own. `pending=1` returns only those waiting.
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const pendingOnly = new URL(req.url).searchParams.get("pending") === "1";
    const requests = await listChangeRequests({
      ...(isSuperAdmin(staff.role) ? {} : { requestedBy: staff.id }),
      pendingOnly,
    });
    return NextResponse.json({ requests });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/change-requests — an admin edits a record:
 * { recordType: "student" | "staff", recordId, changes: { field: value }, reason }
 * or deletes a student: { action: "delete", recordType: "student", recordId, reason }.
 * A super admin's edit is applied straight away (and recorded); anyone
 * else's waits for a super admin. → { applied }
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const body = await req.json().catch(() => null);
    const recordType = body?.recordType as RecordType;
    const recordId = String(body?.recordId || "");
    const reason = String(body?.reason ?? "").trim();
    if (recordType !== "student" && recordType !== "staff") {
      return NextResponse.json({ error: "Unknown record" }, { status: 400 });
    }
    const applyNow = isSuperAdmin(staff.role);

    // Deleting: students only (staff accounts are deactivated instead).
    if (body?.action === "delete") {
      if (recordType !== "student") {
        return NextResponse.json({ error: "Staff accounts are deactivated, not deleted" }, { status: 400 });
      }
      if (reason.length < 3) {
        return NextResponse.json({ error: "Say briefly why the student should be deleted" }, { status: 400 });
      }
      const result = await requestStudentDeletion({ id: recordId, reason, requestedBy: staff.id, applyNow });
      return NextResponse.json(result, { status: 201 });
    }

    if (!recordId || typeof body?.changes !== "object" || body.changes === null) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }
    if (!applyNow && reason.length < 3) {
      return NextResponse.json({ error: "Say briefly why the change is needed" }, { status: 400 });
    }
    // Only a super admin may touch a super admin's account.
    if (recordType === "staff" && !isSuperAdmin(staff.role)) {
      const target = await getStaffById(recordId);
      if (target && isSuperAdmin(target.role)) {
        return NextResponse.json({ error: "Only a super admin can change a super admin's account" }, { status: 403 });
      }
    }
    const result = await requestChange({
      type: recordType,
      id: recordId,
      changes: body.changes,
      reason: reason || "Edited by a super admin",
      requestedBy: staff.id,
      applyNow,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/change-requests — a super admin approves or rejects: { id, approve: boolean } → { status }. */
export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireSuperAdmin();
    const body = await req.json().catch(() => null);
    const status = await decideChangeRequest(String(body?.id || ""), body?.approve === true, staff.id);
    return NextResponse.json({ status });
  } catch (e) {
    return errorResponse(e);
  }
}
