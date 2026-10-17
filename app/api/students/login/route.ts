import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { normaliseAdmissionNumber, verifyStudentLogin } from "@/lib/data/students";
import { claimAttempt, releaseAttempt, type Lock } from "@/lib/data/loginThrottle";
import { setTakerSession } from "@/lib/auth/session";

/** The visitor's address as Vercel reports it (the first hop is the client). */
function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

function locked(lock: Lock): NextResponse {
  const minutes = Math.max(1, Math.ceil((lock.until.getTime() - Date.now()) / 60_000));
  const wait = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return NextResponse.json(
    {
      error:
        lock.scope === "student"
          ? `Too many wrong PINs for this admission number. Try again in ${wait}, or ask your teacher to reset your PIN.`
          : `Too many wrong sign-ins from this network. Try again in ${wait}.`,
    },
    { status: 429, headers: { "Retry-After": String(minutes * 60) } }
  );
}

/**
 * POST /api/students/login — { admissionNumber, pin } → sets taker session.
 * Attempts are counted (see lib/data/loginThrottle.ts): too many without the
 * right PIN locks the admission number, or the network, for a while.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const admissionNumber = normaliseAdmissionNumber(String(body?.admissionNumber || ""));
    const pin = String(body?.pin || "").trim();
    if (!admissionNumber || !pin) {
      return NextResponse.json(
        { error: "Enter your admission number and PIN" },
        { status: 400 }
      );
    }

    // Counted before the PIN is checked, so simultaneous guesses can't all slip
    // through; a wrong admission number counts the same as a wrong PIN.
    const ip = clientIp(req);
    const lock = await claimAttempt(admissionNumber, ip);
    if (lock) return locked(lock);

    const student = await verifyStudentLogin(admissionNumber, pin);
    if (!student) {
      return NextResponse.json(
        { error: "Incorrect admission number or PIN" },
        { status: 401 }
      );
    }

    await releaseAttempt(admissionNumber, ip);
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
