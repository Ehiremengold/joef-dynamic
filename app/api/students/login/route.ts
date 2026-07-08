import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { verifyStudentLogin } from "@/lib/data/students";
import { setTakerSession } from "@/lib/auth/session";

/** POST /api/students/login — { admissionNumber, pin } → sets taker session. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const admissionNumber = String(body?.admissionNumber || "").trim();
    const pin = String(body?.pin || "").trim();
    if (!admissionNumber || !pin) {
      return NextResponse.json(
        { error: "Enter your admission number and PIN" },
        { status: 400 }
      );
    }

    const student = await verifyStudentLogin(admissionNumber, pin);
    if (!student) {
      return NextResponse.json(
        { error: "Incorrect admission number or PIN" },
        { status: 401 }
      );
    }

    await setTakerSession({
      kind: "student",
      id: student.id,
      name: student.fullName,
      className: student.className,
    });
    return NextResponse.json({
      student: {
        fullName: student.fullName,
        className: student.className,
        admissionNumber: student.admissionNumber,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
