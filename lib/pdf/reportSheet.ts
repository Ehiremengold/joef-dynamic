import "server-only";
import { GRADE_KEY, gradeFor } from "@/lib/grades";
import type { ReportSheet, Student } from "@/lib/types";
import { BRAND } from "./brand";
import { contentBottom, drawFooter, drawLetterhead, type Box } from "./page";

/** Margin a document must be created with to hold report sheets. */
export const REPORT_MARGIN = 36;
const BOX: Box = { left: REPORT_MARGIN, width: 595.28 - 2 * REPORT_MARGIN };
const PAD = 5;

const BLANK = "—";
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
  const subjectWidth = BOX.width * 0.3;
  const otherWidth = (BOX.width - subjectWidth) / 5;
  const widths = [subjectWidth, ...Array<number>(5).fill(otherWidth)];
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
    const grade = gradeFor(row.percent);
    drawRow(
      y,
      rowHeight,
      [
        row.name,
        row.ca === null ? BLANK : mark(row.ca),
        row.exam === null ? BLANK : mark(row.exam),
        mark(row.total),
        grade.grade,
        grade.remark,
      ],
      false
    );
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

const CHART_LABELS = 60; // room under the plot for the slanted subject names
const CHART_PLOT = { ideal: 90, least: 55 };

/** One bar per subject, as a percentage, so the strong and weak ones stand out. */
function drawChart(doc: PDFKit.PDFDocument, top: number, plotHeight: number, rows: ScoreRow[]): void {
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
 * grid, the marks table with grades, the grade key and a chart of the
 * subjects. The chart shrinks to fit under a long table, and moves to a page
 * of its own only when there is no room for it at all.
 */
export function drawReportSheet(
  doc: PDFKit.PDFDocument,
  student: Pick<Student, "fullName" | "gender">,
  sheet: ReportSheet
): void {
  const obtainablePerSubject = sheet.caMax + sheet.examMax;
  const rows: ScoreRow[] = sheet.subjects.map((s) => {
    const total = (s.ca ?? 0) + (s.exam ?? 0);
    return { ...s, total, percent: (total / obtainablePerSubject) * 100 };
  });
  const obtained = rows.reduce((sum, r) => sum + r.total, 0);
  const obtainable = rows.length * obtainablePerSubject;
  const attendance = sheet.attendance;

  let y = drawLetterhead(doc, BOX, `${sheet.sessionName} ${sheet.termName} Report Sheet`);

  y = drawFacts(doc, y, [
    [
      ["Student's Name", student.fullName],
      ["Gender", student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1) : BLANK],
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
      ["Overall Performance", ((obtained / obtainable) * 100).toFixed(2)],
    ],
    [["Next Resumption Date", sheet.nextTermBegins ? shortDate(sheet.nextTermBegins) : BLANK]],
  ]);

  y = drawScores(doc, y + 8, sheet, rows);
  y = drawGradeKey(doc, y + 9);

  y += 18;
  let plotHeight = Math.min(CHART_PLOT.ideal, contentBottom(doc) - y - CHART_LABELS);
  if (plotHeight < CHART_PLOT.least) {
    drawFooter(doc, BOX);
    doc.addPage();
    y = REPORT_MARGIN + 8;
    plotHeight = CHART_PLOT.ideal;
  }
  drawChart(doc, y, plotHeight, rows);
  drawFooter(doc, BOX);
}
