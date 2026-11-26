import "server-only";
import { GRADE_KEY, gradeFor } from "@/lib/grades";
import { principalComment, TRAITS, type Rating, type Ratings } from "@/lib/reportCard";
import { TERMS_IN_ORDER, type ReportSheet, type Student, type Term } from "@/lib/types";
import { BRAND } from "./brand";
import { contentBottom, drawFooter, drawLetterhead, type Box } from "./page";
import { SIGNATURE_PNG_BASE64 } from "./signature-base64";

/** Margin a document must be created with to hold report sheets. */
export const REPORT_MARGIN = 36;
const BOX: Box = { left: REPORT_MARGIN, width: 595.28 - 2 * REPORT_MARGIN };
const PAD = 5;

const BLANK = "-";
/** A mark or total, without trailing zeros: 60, 46.5. */
const mark = (n: number): string => String(Math.round(n * 100) / 100);
const shortDate = (iso: string): string => iso.split("-").reverse().join("/");

function cellBorder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
  doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(BRAND.smoke).stroke();
}

/** The three-across grid of "Label: value" facts under the letterhead. */
function drawFacts(doc: PDFKit.PDFDocument, y: number, rows: [string, string][][]): number {
  const cellWidth = BOX.width / 3;
  const textWidth = cellWidth - 2 * PAD;
  for (const row of rows) {
    doc.font("Helvetica-Bold").fontSize(9.5);
    const height =
      Math.max(...row.map(([label, value]) => doc.heightOfString(`${label}: ${value}`, { width: textWidth }))) + 2 * PAD;
    for (let i = 0; i < 3; i++) {
      const x = BOX.left + i * cellWidth;
      cellBorder(doc, x, y, cellWidth, height);
      if (!row[i]) continue;
      const [label, value] = row[i];
      doc
        .fillColor(BRAND.ink)
        .font("Helvetica-Bold")
        .text(`${label}: `, x + PAD, y + PAD, { width: textWidth, continued: true })
        .font("Helvetica")
        .text(value);
    }
    y += height;
  }
  return y;
}

type ScoreRow = { name: string; ca: number | null; exam: number | null; total: number; percent: number };

/** Subject-by-subject marks with grade and remark. Returns the y below the table. */
function drawScores(doc: PDFKit.PDFDocument, startY: number, sheet: ReportSheet, rows: ScoreRow[]): number {
  const headers = ["Subject", `CA (${sheet.caMax})`, `EXAM (${sheet.examMax})`, "Total", "Grade", "Remark"];
  return drawSubjectGrid(
    doc,
    startY,
    headers,
    0.3,
    rows.map((row) => {
      const grade = gradeFor(row.percent);
      return [
        row.name,
        row.ca === null ? BLANK : mark(row.ca),
        row.exam === null ? BLANK : mark(row.exam),
        mark(row.total),
        grade.grade,
        grade.remark,
      ];
    })
  );
}

/**
 * A table with a subject column (`subjectShare` of the width) and equal
 * columns after it, starting again under its header on a new page when it
 * runs over. Returns the y below it.
 */
function drawSubjectGrid(
  doc: PDFKit.PDFDocument,
  startY: number,
  headers: string[],
  subjectShare: number,
  rows: string[][]
): number {
  const subjectWidth = BOX.width * subjectShare;
  const otherWidth = (BOX.width - subjectWidth) / (headers.length - 1);
  const widths = [subjectWidth, ...Array<number>(headers.length - 1).fill(otherWidth)];
  const headerHeight = 18;
  const rowHeight = 15.5;

  const drawRow = (y: number, height: number, cells: string[], bold: boolean) => {
    doc.fillColor(BRAND.ink).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9.5 : 9);
    let x = BOX.left;
    cells.forEach((cell, i) => {
      cellBorder(doc, x, y, widths[i], height);
      doc.text(cell, x + PAD, y + (height - 9) / 2 + 0.5, {
        width: widths[i] - 2 * PAD,
        align: i === 0 && !bold ? "left" : "center",
        lineBreak: false,
      });
      x += widths[i];
    });
  };
  const drawHeaderRow = (y: number) => {
    doc.rect(BOX.left, y, BOX.width, headerHeight).fill(BRAND.band);
    drawRow(y, headerHeight, headers, true);
    return y + headerHeight;
  };

  let y = drawHeaderRow(startY);
  for (const row of rows) {
    if (y + rowHeight > contentBottom(doc)) {
      drawFooter(doc, BOX);
      doc.addPage();
      y = drawHeaderRow(REPORT_MARGIN);
    }
    drawRow(y, rowHeight, row, false);
    y += rowHeight;
  }
  return y;
}

/** "Keys: 100 - 80 [A]  80 - 65 [B] …", centred, the letters in colour. */
function drawGradeKey(doc: PDFKit.PDFDocument, y: number): number {
  const parts: { text: string; color: string }[] = [{ text: "Keys:     ", color: BRAND.graphite }];
  GRADE_KEY.forEach((g, i) => {
    const upper = i === 0 ? 100 : GRADE_KEY[i - 1].from;
    parts.push({ text: `${upper} - ${g.from} `, color: BRAND.graphite });
    parts.push({ text: `[${g.grade}]     `, color: i < 2 ? BRAND.green : BRAND.amber });
  });

  doc.font("Helvetica").fontSize(8.5);
  let x = BOX.left + (BOX.width - parts.reduce((w, p) => w + doc.widthOfString(p.text), 0)) / 2;
  for (const part of parts) {
    doc.fillColor(part.color).text(part.text, x, y, { lineBreak: false });
    x += doc.widthOfString(part.text);
  }
  return y + 12;
}

/** "Male", "Female", or a dash when not recorded. */
const genderLabel = (student: Pick<Student, "gender">): string =>
  student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1) : BLANK;

/**
 * A term's marks as its report sheet counts them: every subject on the
 * sheet, a mark not entered counting as 0, out of CA + exam each; and the
 * term's overall percentage. The session report counts terms the same way,
 * so the two always agree.
 */
function termMarks(sheet: ReportSheet): { rows: ScoreRow[]; obtained: number; obtainable: number; overall: number } {
  const outOf = sheet.caMax + sheet.examMax;
  const rows: ScoreRow[] = sheet.subjects.map((s) => {
    const total = (s.ca ?? 0) + (s.exam ?? 0);
    return { ...s, total, percent: (total / outOf) * 100 };
  });
  const obtained = rows.reduce((sum, r) => sum + r.total, 0);
  const obtainable = rows.length * outOf;
  return { rows, obtained, obtainable, overall: obtainable ? (obtained / obtainable) * 100 : 0 };
}

const SIGNATURE = SIGNATURE_PNG_BASE64 ? `data:image/png;base64,${SIGNATURE_PNG_BASE64}` : null;

/** The y a block of `height` starts at: `y` if it fits on this page, else the top of a fresh one. */
function startYFor(doc: PDFKit.PDFDocument, y: number, height: number): number {
  if (y + height <= contentBottom(doc)) return y;
  drawFooter(doc, BOX);
  doc.addPage();
  return REPORT_MARGIN;
}

const SECTION_HEIGHT = 16;
function sectionBar(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.rect(BOX.left, y, BOX.width, SECTION_HEIGHT).fill("#D9DBE3");
  doc.fillColor(BRAND.ink).font("Helvetica-Bold").fontSize(9.5).text(title, BOX.left + PAD, y + 4, { lineBreak: false });
  return y + SECTION_HEIGHT;
}

const RATING_COLOURS: Record<Rating, string> = {
  Excellent: BRAND.green,
  "Very Good": "#2563EB",
  Good: BRAND.amber,
};

/** The class teacher's ratings, one trait a row, each rating marked with a coloured tick bar. */
function drawEffectiveAreas(doc: PDFKit.PDFDocument, y: number, ratings: Ratings): number {
  const rowHeight = 14;
  const half = BOX.width / 2;
  y = sectionBar(doc, startYFor(doc, y, SECTION_HEIGHT + TRAITS.length * rowHeight), "Effective Areas");
  for (const trait of TRAITS) {
    cellBorder(doc, BOX.left, y, BOX.width, rowHeight);
    doc.fillColor(BRAND.ink).font("Helvetica").fontSize(8.5).text(trait, BOX.left + PAD, y + 3.5, { width: half - 2 * PAD, lineBreak: false });
    const rating = ratings[trait];
    if (rating) {
      doc.rect(BOX.left + half, y + 1.5, 2, rowHeight - 3).fill(RATING_COLOURS[rating]);
      doc.fillColor(BRAND.ink).text(rating, BOX.left + half + 8, y + 3.5, { lineBreak: false });
    }
    y += rowHeight;
  }
  return y;
}

/** A titled comment box, signed bottom right — with a signature image above the name if there is one. */
function drawComment(
  doc: PDFKit.PDFDocument,
  y: number,
  title: string,
  text: string,
  signedBy: string | null,
  signature: string | null = null
): number {
  const textWidth = BOX.width - 2 * PAD - (signature ? 100 : 0);
  doc.font("Helvetica").fontSize(9);
  const height = Math.max(doc.heightOfString(text, { width: textWidth }) + 2 * PAD + 14, signature ? 50 : 0);
  y = sectionBar(doc, startYFor(doc, y, SECTION_HEIGHT + height), title);
  cellBorder(doc, BOX.left, y, BOX.width, height);
  doc.fillColor(BRAND.ink).font("Helvetica").fontSize(9).text(text, BOX.left + PAD, y + PAD, { width: textWidth });
  if (signature) doc.image(signature, BOX.left + BOX.width - PAD - 90, y + 4, { fit: [90, 28], align: "right" });
  if (signedBy) {
    doc
      .fillColor(BRAND.graphite)
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .text(`-- ${signedBy}`, BOX.left + PAD, y + height - PAD - 9, { width: BOX.width - 2 * PAD, align: "right", lineBreak: false });
  }
  return y + height;
}

/** A subject's bar on the chart: its percentage. */
type ChartBar = { name: string; percent: number };

const CHART_LABELS = 60; // room under the plot for the slanted subject names
const CHART_PLOT = { ideal: 90, least: 55 };

/** One bar per subject, as a percentage, so the strong and weak ones stand out. */
function drawChart(doc: PDFKit.PDFDocument, top: number, plotHeight: number, rows: ChartBar[]): void {
  const axisWidth = 22;
  const plotLeft = BOX.left + axisWidth;
  const plotWidth = BOX.width - axisWidth;
  const base = top + plotHeight;
  const slot = plotWidth / rows.length;

  doc.font("Helvetica").fontSize(7.5);
  for (const tick of [0, 40, 80]) {
    const y = base - (tick / 100) * plotHeight;
    doc.moveTo(plotLeft, y).lineTo(plotLeft + plotWidth, y).lineWidth(0.5).strokeColor(BRAND.smoke).stroke();
    doc.fillColor(BRAND.graphite).text(String(tick), BOX.left, y - 3.5, { width: axisWidth - 5, align: "right", lineBreak: false });
  }

  rows.forEach((row, i) => {
    const height = (Math.min(row.percent, 100) / 100) * plotHeight;
    const centre = plotLeft + (i + 0.5) * slot;
    doc.rect(centre - slot * 0.36, base - height, slot * 0.72, height).fill(BRAND.green);

    // Name slanted up to end under its bar.
    doc.save();
    doc.translate(centre + 3, base + 5).rotate(-22);
    doc.fillColor(BRAND.graphite).text(row.name, -160, 0, { width: 160, align: "right", lineBreak: false });
    doc.restore();
  });
}

/**
 * Draws one term's report sheet on the current page: letterhead, the facts
 * grid, the marks table with grades, the grade key, the class teacher's
 * ratings and comment (once written), the principal's comment and a chart of
 * the subjects. The chart shrinks to fit under a long table, and moves to a page
 * of its own only when there is no room for it at all.
 */
export function drawReportSheet(
  doc: PDFKit.PDFDocument,
  student: Pick<Student, "fullName" | "gender">,
  sheet: ReportSheet
): void {
  const { rows, obtained, obtainable, overall } = termMarks(sheet);
  const attendance = sheet.attendance;

  let y = drawLetterhead(doc, BOX, `${sheet.sessionName} ${sheet.termName} Report Sheet`);

  y = drawFacts(doc, y, [
    [
      ["Student's Name", student.fullName],
      ["Gender", genderLabel(student)],
      ["Class", sheet.classLabel ?? BLANK],
    ],
    [
      ["Number of students in class", sheet.studentsInClass === null ? BLANK : String(sheet.studentsInClass)],
      ["Class Average Score", sheet.classAverage === null ? BLANK : sheet.classAverage.toFixed(2)],
      ["Term", sheet.termName],
    ],
    [
      ["No of times School opened", attendance ? String(attendance.totalDays) : BLANK],
      ["Times Present", attendance ? String(attendance.daysPresent) : BLANK],
      ["Times Absent", attendance ? String(Math.max(0, attendance.totalDays - attendance.daysPresent)) : BLANK],
    ],
    [
      ["Total Marks Obtainable", String(obtainable)],
      ["Total Marks Obtained", mark(obtained)],
      ["Overall Performance", overall.toFixed(2)],
    ],
    [["Next Resumption Date", sheet.nextTermBegins ? shortDate(sheet.nextTermBegins) : BLANK]],
  ]);

  y = drawScores(doc, y + 8, sheet, rows);
  y = drawGradeKey(doc, y + 9);

  const { ratings, teacherComment, signedBy } = sheet.report;
  if (Object.keys(ratings).length > 0) y = drawEffectiveAreas(doc, y + 4, ratings);
  if (teacherComment) y = drawComment(doc, y + 8, "Teacher Comment", teacherComment, signedBy);
  y = drawComment(doc, y + 8, "Principal's Comments", principalComment(overall, sheet.termName), BRAND.principalName, SIGNATURE);

  drawChartBelow(doc, y, rows);
  drawFooter(doc, BOX);
}

/** The chart under what's drawn so far: shrunk to fit, or on a page of its own when there's no room at all. */
function drawChartBelow(doc: PDFKit.PDFDocument, y: number, bars: ChartBar[]): void {
  if (bars.length === 0) return;
  y += 18;
  let plotHeight = Math.min(CHART_PLOT.ideal, contentBottom(doc) - y - CHART_LABELS);
  if (plotHeight < CHART_PLOT.least) {
    drawFooter(doc, BOX);
    doc.addPage();
    y = REPORT_MARGIN + 8;
    plotHeight = CHART_PLOT.ideal;
  }
  drawChart(doc, y, plotHeight, bars);
}

/** "1st", "2nd", "3rd": for the session report's column headings. */
const TERM_ORDINAL: Record<Term["name"], string> = { "First Term": "1st", "Second Term": "2nd", "Third Term": "3rd" };

/** "First, Second and Third Term". */
function termsList(names: Term["name"][]): string {
  const words = names.map((n) => n.split(" ")[0]);
  return `${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]} Term`;
}

/** One subject's mark for one term of the session, as that term's sheet counts it. */
type TermMark = { total: number; outOf: number };

/**
 * Draws a student's report for a whole session on the current page, from
 * that session's term report sheets (one, two or all three terms):
 *
 *  - each subject's mark for each term (counted as on that term's sheet),
 *    its total for the session, its session average (marks obtained over
 *    marks obtainable across its terms) and that average's grade and remark;
 *  - the session average the same way over every subject, the class's
 *    average and size, the year's attendance added up (saying so when a
 *    term has none recorded), and the latest term's next resumption date;
 *  - the latest term's class teacher comment and principal's comment, the
 *    principal's exactly as on that term's own sheet, so the two agree on
 *    promotion once the Third Term is in;
 *  - a chart of the subjects' session averages.
 *
 * A subject not on a term's sheet shows "-" for that term and doesn't count
 * towards it. No class positions, as on the term sheets.
 */
export function drawSessionReport(
  doc: PDFKit.PDFDocument,
  student: Pick<Student, "fullName" | "gender">,
  sheets: ReportSheet[]
): void {
  const terms = TERMS_IN_ORDER.flatMap((name) => sheets.filter((s) => s.termName === name).slice(0, 1));
  const latest = terms[terms.length - 1];

  // Subjects in the latest term's report order, then any taken only earlier.
  const subjectNames: string[] = [];
  for (const sheet of [...terms].reverse()) {
    for (const s of sheet.subjects) if (!subjectNames.includes(s.name)) subjectNames.push(s.name);
  }

  const subjectRows = subjectNames.map((name) => {
    const byTerm: (TermMark | null)[] = TERMS_IN_ORDER.map((termName) => {
      const sheet = terms.find((t) => t.termName === termName);
      const row = sheet && termMarks(sheet).rows.find((r) => r.name === name);
      return sheet && row ? { total: row.total, outOf: sheet.caMax + sheet.examMax } : null;
    });
    const taken = byTerm.filter((m): m is TermMark => m !== null);
    const total = taken.reduce((sum, m) => sum + m.total, 0);
    const outOf = taken.reduce((sum, m) => sum + m.outOf, 0);
    return { name, byTerm, total, outOf, percent: outOf ? (total / outOf) * 100 : 0 };
  });

  const obtained = subjectRows.reduce((sum, r) => sum + r.total, 0);
  const obtainable = subjectRows.reduce((sum, r) => sum + r.outOf, 0);
  const overall = obtainable ? (obtained / obtainable) * 100 : 0;
  const classAverages = terms.map((t) => t.classAverage).filter((a): a is number => a !== null);
  const classAverage = classAverages.length ? classAverages.reduce((a, b) => a + b, 0) / classAverages.length : null;

  const attendanceRecords = terms.map((t) => t.attendance).filter((a): a is NonNullable<ReportSheet["attendance"]> => a !== null);
  const opened = attendanceRecords.reduce((sum, a) => sum + a.totalDays, 0);
  const present = attendanceRecords.reduce((sum, a) => sum + a.daysPresent, 0);
  // "175 (2 of 3 terms)" when a term has no attendance recorded, so it doesn't read as the whole year.
  const ofTerms = attendanceRecords.length < terms.length ? ` (${attendanceRecords.length} of ${terms.length} terms)` : "";
  const days = (n: number, note = "") => (attendanceRecords.length ? `${n}${note}` : BLANK);

  let y = drawLetterhead(doc, BOX, `${latest.sessionName} Session Report`);

  y = drawFacts(doc, y, [
    [
      ["Student's Name", student.fullName],
      ["Gender", genderLabel(student)],
      ["Class", latest.classLabel ?? BLANK],
    ],
    [
      ["Session", latest.sessionName],
      ["Terms", termsList(terms.map((t) => t.termName))],
      ["Number of subjects", String(subjectRows.length)],
    ],
    [
      ["Number of students in class", latest.studentsInClass === null ? BLANK : String(latest.studentsInClass)],
      ["Class Average Score", classAverage === null ? BLANK : classAverage.toFixed(2)],
      ["Session Average", overall.toFixed(2)],
    ],
    [
      ["No of times School opened", days(opened, ofTerms)],
      ["Times Present", days(present)],
      ["Times Absent", days(Math.max(0, opened - present))],
    ],
    [
      ["Total Marks Obtainable", mark(obtainable)],
      ["Total Marks Obtained", mark(obtained)],
      ["Next Resumption Date", latest.nextTermBegins ? shortDate(latest.nextTermBegins) : BLANK],
    ],
  ]);

  // "1st Term"; a term marked out of other than 100 says so ("1st (/60)"), in a width that fits.
  const termHeader = (name: Term["name"]) => {
    const sheet = terms.find((t) => t.termName === name);
    const outOf = sheet ? sheet.caMax + sheet.examMax : 100;
    return outOf === 100 ? `${TERM_ORDINAL[name]} Term` : `${TERM_ORDINAL[name]} (/${outOf})`;
  };
  y = drawSubjectGrid(
    doc,
    y + 8,
    ["Subject", ...TERMS_IN_ORDER.map(termHeader), "Total", "Average", "Grade", "Remark"],
    0.24,
    subjectRows.map((r) => {
      const grade = gradeFor(r.percent);
      return [
        r.name,
        ...r.byTerm.map((m) => (m ? mark(m.total) : BLANK)),
        mark(r.total),
        r.percent.toFixed(2),
        grade.grade,
        grade.remark,
      ];
    })
  );
  y = drawGradeKey(doc, y + 9);

  const { teacherComment, signedBy } = latest.report;
  if (teacherComment) y = drawComment(doc, y + 8, `Teacher Comment (${latest.termName})`, teacherComment, signedBy);
  y = drawComment(
    doc,
    y + 8,
    `Principal's Comments (${latest.termName})`,
    principalComment(termMarks(latest).overall, latest.termName),
    BRAND.principalName,
    SIGNATURE
  );

  drawChartBelow(doc, y, subjectRows);
  drawFooter(doc, BOX);
}
