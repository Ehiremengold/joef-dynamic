import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getAttemptById } from "@/lib/data/attempts";
import { getStudentById } from "@/lib/data/students";
import { getCandidateById } from "@/lib/data/candidates";
import { buildResultSlipPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/respond";

type Params = { params: Promise<{ id: string }> };

/** GET /api/attempts/:id/pdf — staff-only branded result slip for one attempt. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const attempt = await getAttemptById(id);
    if (!attempt) {
      return Response.json({ error: "Result not found" }, { status: 404 });
    }

    let admissionNumber: string | null = null;
    let candidateNumber: string | null = null;
    if (attempt.takerType === "student" && attempt.studentId) {
      const student = await getStudentById(attempt.studentId);
      admissionNumber = student?.admissionNumber ?? null;
    } else if (attempt.takerType === "candidate" && attempt.candidateId) {
      const candidate = await getCandidateById(attempt.candidateId);
      candidateNumber = candidate?.candidateNumber ?? null;
    }

    const buffer = await buildResultSlipPdf({
      takerName: attempt.takerName,
      admissionNumber,
      candidateNumber,
      className: attempt.className,
      examTitle: attempt.examTitle,
      examType: attempt.examType,
      year: attempt.year,
      score: attempt.score,
      total: attempt.total,
      submittedAt: attempt.submittedAt,
    });

    return pdfResponse(buffer, `Result Slip - ${attempt.takerName} - ${attempt.examTitle}.pdf`);
  } catch (e) {
    return errorResponse(e);
  }
}
