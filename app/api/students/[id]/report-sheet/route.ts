import type { NextRequest } from "next/server";
import { buildReportSheetPdf } from "@/lib/pdf/documents";
import { respondWithStudentDocument } from "@/lib/pdf/studentDocument";

/**
 * GET /api/students/:id/report-sheet?termId=…[&view=1]: staff-only PDF of one
 * term's report sheet (see respondWithStudentDocument for view and errors).
 */
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return respondWithStudentDocument(req, params, async (student, sheets, query) => {
    const sheet = sheets.find((s) => s.termId === query.get("termId"));
    if (!sheet) {
      return {
        unavailable: `No marks have been entered for ${student.fullName} for that term yet, so there is no report sheet. Enter them under Term scores first.`,
      };
    }
    return {
      pdf: await buildReportSheetPdf(student, sheet),
      filename: `Report sheet - ${student.fullName} - ${sheet.termName} ${sheet.sessionName}.pdf`,
    };
  });
}
