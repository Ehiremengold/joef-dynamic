import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { LEVEL_NAMES, type ClassName, type ReportSheet, type Term } from "@/lib/types";
import { getStudentAttendanceForTerm } from "./attendance";
import { mapTermReport, TERM_REPORT_SELECT } from "./termReports";

type Row = Record<string, unknown>;

const TERMS_IN_ORDER: Term["name"][] = ["First Term", "Second Term", "Third Term"];

const SCORE_SELECT =
  "ca_score, exam_score, ca_max, exam_max, term_id, class_id, subject_id, subjects(name), " +
  "terms(name, next_term_begins, academic_sessions(name)), classes(level, arm, campuses(name))";

/** "Basic 1 (Ikoyi)", "JSS 2A (Obalende)", "Nursery 2 Silver (Obalende)". */
function classLabel(cls: Row): string {
  const arm = (cls.arm as string | null) ?? "";
  const campus = (cls.campuses as Row | null)?.name as string | undefined;
  const name = `${LEVEL_NAMES[cls.level as ClassName]}${arm.length > 1 ? " " : ""}${arm}`;
  return campus ? `${name} (${campus})` : name;
}

const mark = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * Every term a student has scores for, as a report sheet each, newest first.
 *
 * The class on a sheet is the one the student sat in that term (kept on each
 * score), not their class today; class size, class average and attendance
 * are that class's for that term.
 */
export async function listReportSheets(studentId: string): Promise<ReportSheet[]> {
  const supa = serviceClient();
  const { data } = await supa.from("term_scores").select(SCORE_SELECT).eq("student_id", studentId);
  const scores = (data ?? []) as unknown as Row[];
  if (scores.length === 0) return [];

  const byTerm = new Map<string, Row[]>();
  for (const s of scores) {
    const termId = s.term_id as string;
    byTerm.set(termId, [...(byTerm.get(termId) ?? []), s]);
  }
  const classIds = [...new Set(scores.map((s) => s.class_id as string | null).filter(Boolean))] as string[];

  const [{ data: summaries }, { data: order }, { data: reports }] = await Promise.all([
    supa
      .from("term_class_summary")
      .select("term_id, class_id, students, average_percent")
      .in("term_id", [...byTerm.keys()]),
    supa.from("class_subjects").select("class_id, subject_id, position").in("class_id", classIds),
    supa
      .from("term_reports")
      .select(TERM_REPORT_SELECT)
      .eq("student_id", studentId),
  ]);
  const reportFor = new Map((reports ?? []).map((r) => [r.term_id as string, r as Row]));
  const summaryFor = new Map((summaries ?? []).map((r) => [`${r.term_id}|${r.class_id}`, r]));
  const positionFor = new Map(
    (order ?? []).map((r) => [`${r.class_id}|${r.subject_id}`, r.position as number | null])
  );

  const sheets = await Promise.all(
    [...byTerm].map(async ([termId, rows]) => {
      const first = rows[0];
      const term = first.terms as Row;
      const classId = first.class_id as string | null;
      const summary = summaryFor.get(`${termId}|${classId}`);
      const report = reportFor.get(termId);
      const attendance = classId ? await getStudentAttendanceForTerm(studentId, classId, termId) : null;

      const subjects = rows
        .map((r) => ({
          name: (r.subjects as Row).name as string,
          ca: mark(r.ca_score),
          exam: mark(r.exam_score),
          // Subjects without a place in the class's order go last, A–Z.
          position: positionFor.get(`${classId}|${r.subject_id}`) ?? Infinity,
        }))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
        .map(({ name, ca, exam }) => ({ name, ca, exam }));

      const sheet: ReportSheet = {
        sessionName: (term.academic_sessions as Row).name as string,
        termName: term.name as Term["name"],
        classLabel: first.classes ? classLabel(first.classes as Row) : null,
        studentsInClass: summary ? (summary.students as number) : null,
        classAverage: summary ? Number(summary.average_percent) : null,
        attendance,
        nextTermBegins: (term.next_term_begins as string | null) ?? null,
        caMax: first.ca_max as number,
        examMax: first.exam_max as number,
        subjects,
        report: mapTermReport(report),
      };
      return sheet;
    })
  );

  return sheets.sort(
    (a, b) =>
      b.sessionName.localeCompare(a.sessionName) ||
      TERMS_IN_ORDER.indexOf(b.termName) - TERMS_IN_ORDER.indexOf(a.termName)
  );
}
