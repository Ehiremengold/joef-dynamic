import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { getExam } from "@/lib/data/exams";
import { listAttempts } from "@/lib/data/attempts";
import { getStudentsByIds } from "@/lib/data/students";
import { getCandidatesByIds } from "@/lib/data/candidates";
import { buildClassSheetPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/respond";

type Params = { params: Promise<{ id: string }> };

/** GET /api/exams/:id/results-pdf — staff-only branded mark sheet for everyone who sat one exam. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const { id } = await params;
    const exam = await getExam(id);
    if (!exam) {
      return Response.json({ error: "Exam not found" }, { status: 404 });
    }

    const attempts = await listAttempts({ examId: id });

    const studentIds = attempts
      .filter((a) => a.takerType === "student" && a.studentId)
      .map((a) => a.studentId as string);
    const candidateIds = attempts
      .filter((a) => a.takerType === "candidate" && a.candidateId)
      .map((a) => a.candidateId as string);

    const [students, candidates] = await Promise.all([
      getStudentsByIds([...new Set(studentIds)]),
      getCandidatesByIds([...new Set(candidateIds)]),
    ]);
    const admissionById = new Map(students.map((s) => [s.id, s.admissionNumber]));
    const candidateNoById = new Map(candidates.map((c) => [c.id, c.candidateNumber]));

    const buffer = await buildClassSheetPdf({
      examTitle: exam.title,
      examType: exam.type,
      className: exam.className,
      rows: attempts.map((a) => ({
        takerName: a.takerName,
        identifier:
          (a.studentId && admissionById.get(a.studentId)) ||
          (a.candidateId && candidateNoById.get(a.candidateId)) ||
          "—",
        score: a.score,
        total: a.total,
        submittedAt: a.submittedAt,
      })),
    });

    return pdfResponse(buffer, `Class Sheet - ${exam.title}.pdf`);
  } catch (e) {
    return errorResponse(e);
  }
}
