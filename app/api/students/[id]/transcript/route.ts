import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getStudentById } from "@/lib/data/students";
import { listAttempts } from "@/lib/data/attempts";
import { listReportSheets } from "@/lib/data/reports";
import { buildTranscriptPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/respond";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/students/:id/transcript — staff-only PDF of everything on record
 * for a student: a report sheet per term, then their computer-based tests.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const student = await getStudentById(id);
    if (!student) {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }

    const [reports, attempts] = await Promise.all([
      listReportSheets(id),
      listAttempts({ studentId: id }),
    ]);
    const tests = [...attempts].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    const buffer = await buildTranscriptPdf({ student, reports, tests });

    return pdfResponse(buffer, `Transcript - ${student.fullName}.pdf`);
  } catch (e) {
    return errorResponse(e);
  }
}
