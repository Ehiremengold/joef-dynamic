import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getStudentById } from "@/lib/data/students";
import { listAttempts } from "@/lib/data/attempts";
import { buildTranscriptPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/respond";

type Params = { params: Promise<{ id: string }> };

/** GET /api/students/:id/transcript — staff-only branded PDF of every result a student has. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const student = await getStudentById(id);
    if (!student) {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }

    const attempts = await listAttempts({ studentId: id });
    const sorted = [...attempts].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    const buffer = await buildTranscriptPdf({
      fullName: student.fullName,
      admissionNumber: student.admissionNumber,
      className: student.className,
      rows: sorted.map((a) => ({
        examTitle: a.examTitle,
        examType: a.examType,
        score: a.score,
        total: a.total,
        submittedAt: a.submittedAt,
      })),
    });

    return pdfResponse(buffer, `Transcript - ${student.fullName}.pdf`);
  } catch (e) {
    return errorResponse(e);
  }
}
