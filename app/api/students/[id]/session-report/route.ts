import type { NextRequest } from "next/server";
import { buildSessionReportPdf } from "@/lib/pdf/documents";
import { respondWithStudentDocument } from "@/lib/pdf/studentDocument";

/**
 * GET /api/students/:id/session-report?sessionId=…[&view=1]: staff-only PDF of
 * a student's report for a whole session (see drawSessionReport), with view
 * and errors as respondWithStudentDocument.
 */
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return respondWithStudentDocument(req, params, async (student, sheets, query) => {
    const session = sheets.filter((s) => s.sessionId === query.get("sessionId"));
    if (session.length === 0) {
      return {
        unavailable: `No marks have been entered for ${student.fullName} in that session yet, so there is no session report. Enter them under Term scores first.`,
      };
    }
    return {
      pdf: await buildSessionReportPdf(student, session),
      filename: `Session report - ${student.fullName} - ${session[0].sessionName}.pdf`,
    };
  });
}
