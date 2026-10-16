import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { nextAdmissionNumber } from "@/lib/data/students";

/** GET /api/students/next-number — the admission number a new student gets if none is typed. */
export async function GET() {
  try {
    await requireStaff();
    return NextResponse.json({ admissionNumber: await nextAdmissionNumber() });
  } catch (e) {
    return errorResponse(e);
  }
}
