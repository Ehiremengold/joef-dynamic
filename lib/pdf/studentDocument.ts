import "server-only";
import type { NextRequest } from "next/server";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { getStudentById } from "@/lib/data/students";
import { listReportSheets } from "@/lib/data/reports";
import type { ReportSheet, Student } from "@/lib/types";
import { documentUnavailable, pdfResponse } from "./respond";

/** What a student document route makes: a PDF, or why there is none. */
export type StudentDocument = { pdf: Buffer; filename: string } | { unavailable: string };

/**
 * The shared shape of the staff routes that print one student's report
 * sheets (/report-sheet, /session-report): any signed-in staff member, as
 * with the transcript. The link opens in a new tab, so anything that goes
 * wrong comes back as a short page saying so, never JSON or a bare error.
 * `?view=1` opens the PDF in the browser to print or save; otherwise it
 * downloads.
 */
export async function respondWithStudentDocument(
  req: NextRequest,
  studentId: Promise<{ id: string }>,
  make: (student: Student, sheets: ReportSheet[], query: URLSearchParams) => Promise<StudentDocument>
): Promise<Response> {
  try {
    await requireStaff();
    const { id } = await studentId;
    const student = await getStudentById(id);
    if (!student) return documentUnavailable("That student wasn't found.");
    const made = await make(student, await listReportSheets(id), req.nextUrl.searchParams);
    if ("unavailable" in made) return documentUnavailable(made.unavailable);
    return pdfResponse(made.pdf, made.filename, { inline: req.nextUrl.searchParams.get("view") === "1" });
  } catch (e) {
    if (e instanceof AuthError) return documentUnavailable("Please sign in to the Staff Section first, then try again.", e.status);
    console.error(e);
    return documentUnavailable("Something went wrong making this document. Please try again in a moment.", 500);
  }
}
