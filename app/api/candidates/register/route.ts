import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { registerCandidate } from "@/lib/data/candidates";
import { verifyEntranceCode } from "@/lib/data/entrance";
import { setTakerSession } from "@/lib/auth/session";

/**
 * POST /api/candidates/register — { fullName, parentPhone?, code }
 * Requires the active entrance access code (released by staff on test day).
 * Creates a candidate record and starts a taker session for the entrance test.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const fullName = String(body?.fullName || "").trim();
    const parentPhone = String(body?.parentPhone || "").trim() || null;
    const code = String(body?.code || "").trim();

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Enter the candidate's full name" },
        { status: 400 }
      );
    }

    if (!(await verifyEntranceCode(code))) {
      return NextResponse.json(
        {
          error:
            "Incorrect or inactive access code. The entrance test opens only when the school releases the code.",
        },
        { status: 403 }
      );
    }

    const candidate = await registerCandidate({ fullName, parentPhone });
    await setTakerSession({
      kind: "candidate",
      id: candidate.id,
      name: candidate.fullName,
    });
    return NextResponse.json(
      {
        candidate: {
          candidateNumber: candidate.candidateNumber,
          fullName: candidate.fullName,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
