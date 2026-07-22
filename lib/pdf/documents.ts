import "server-only";
import PDFDocument from "pdfkit";
import { BRAND } from "./brand";
import { LOGO_PNG_BASE64 } from "./logo-base64";

const PAGE_WIDTH = 495; // usable width on A4 with 50pt margins each side (595.28 - 50 - 50)
const LOGO_BUFFER = Buffer.from(LOGO_PNG_BASE64, "base64");

function pct(score: number, total: number): number {
  return total ? Math.round((score / total) * 100) : 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** Draws the branded letterhead. Returns the y-coordinate to start content at. */
function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string
): number {
  doc.image(LOGO_BUFFER, 50, 42, { width: 46 });

  doc
    .fillColor(BRAND.navy)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(BRAND.schoolName, 106, 46);

  doc
    .fillColor(BRAND.graphite)
    .font("Helvetica")
    .fontSize(9)
    .text(`Motto: ${BRAND.motto}`, 106, 66);

  doc
    .moveTo(50, 98)
    .lineTo(50 + PAGE_WIDTH, 98)
    .lineWidth(2)
    .strokeColor(BRAND.red)
    .stroke();

  doc.fillColor(BRAND.navy).font("Helvetica-Bold").fontSize(18).text(title, 50, 114);

  let y = 138;
  if (subtitle) {
    doc.fillColor(BRAND.graphite).font("Helvetica").fontSize(11).text(subtitle, 50, y);
    y += 22;
  }
  return y + 8;
}

/**
 * Draws the footer on the current page. Both the rule and the text must sit
 * strictly above the page's bottom margin boundary (page.height - margin) —
 * pdfkit silently starts a new page if a .text() call lands past it, which
 * is why this uses -70/-56 rather than -56/-46 (which used to poke through).
 */
function drawFooter(doc: PDFKit.PDFDocument): void {
  const bottom = doc.page.height - 70;
  doc
    .moveTo(50, bottom)
    .lineTo(50 + PAGE_WIDTH, bottom)
    .lineWidth(0.5)
    .strokeColor(BRAND.smoke)
    .stroke();
  doc
    .fillColor(BRAND.graphite)
    .font("Helvetica")
    .fontSize(8)
    .text(
      `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${BRAND.schoolName} Portal`,
      50,
      bottom + 10,
      { width: PAGE_WIDTH, align: "center" }
    );
}

type Column = { header: string; width: number; align?: "left" | "right" | "center" };

/** Hand-rolled table with a navy header row, zebra striping, and page-break handling. */
function drawTable(
  doc: PDFKit.PDFDocument,
  startY: number,
  columns: Column[],
  rows: string[][]
): number {
  const startX = 50;
  const rowHeight = 22;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);

  const drawHeaderRow = (y: number) => {
    doc.rect(startX, y, tableWidth, rowHeight).fill(BRAND.navy);
    let x = startX;
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
    for (const col of columns) {
      doc.text(col.header, x + 6, y + 7, {
        width: col.width - 12,
        align: col.align ?? "left",
      });
      x += col.width;
    }
    return y + rowHeight;
  };

  let y = drawHeaderRow(startY);
  doc.font("Helvetica").fontSize(9);

  rows.forEach((row, i) => {
    if (y + rowHeight > doc.page.height - 90) {
      doc.addPage();
      y = drawHeaderRow(50);
      doc.font("Helvetica").fontSize(9);
    }

    if (i % 2 === 1) {
      doc.rect(startX, y, tableWidth, rowHeight).fill("#F5F5F7");
    }
    doc.fillColor(BRAND.graphite);
    let x = startX;
    row.forEach((cellText, ci) => {
      doc.text(cellText, x + 6, y + 7, {
        width: columns[ci].width - 12,
        align: columns[ci].align ?? "left",
      });
      x += columns[ci].width;
    });
    y += rowHeight;
  });

  doc
    .rect(startX, startY, tableWidth, y - startY)
    .lineWidth(0.5)
    .strokeColor(BRAND.smoke)
    .stroke();

  return y;
}

/* ------------------------------------------------------------------ */
/* 1. Single result slip                                               */
/* ------------------------------------------------------------------ */

export type ResultSlipInput = {
  takerName: string;
  admissionNumber?: string | null;
  candidateNumber?: string | null;
  className?: string | null;
  examTitle: string;
  examType: "entrance" | "class";
  year: string;
  score: number;
  total: number;
  submittedAt: string;
  /** Cumulative attendance for the student's current term, if recorded. */
  attendance?: { totalDays: number; daysPresent: number; termLabel: string } | null;
};

export async function buildResultSlipPdf(input: ResultSlipInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const done = collect(doc);

  let y = drawHeader(doc, "Result Slip", input.examTitle);

  const percentage = pct(input.score, input.total);

  // Detail rows on the left
  const details: [string, string][] = [
    ["Name", input.takerName],
    ...(input.admissionNumber ? ([["Admission No.", input.admissionNumber]] as [string, string][]) : []),
    ...(input.candidateNumber ? ([["Candidate No.", input.candidateNumber]] as [string, string][]) : []),
    ...(input.className ? ([["Class", input.className]] as [string, string][]) : []),
    ["Test type", input.examType === "entrance" ? "Common Entrance" : "Class Test"],
    ["Year", input.year],
    ["Submitted", fmtDate(input.submittedAt)],
    ...(input.attendance
      ? ([
          [
            "Attendance",
            `${input.attendance.daysPresent}/${input.attendance.totalDays} days (${pct(
              input.attendance.daysPresent,
              input.attendance.totalDays
            )}%) — ${input.attendance.termLabel}`,
          ],
        ] as [string, string][])
      : []),
  ];

  const detailWidth = 320;
  let dy = y;
  for (const [label, value] of details) {
    doc.fillColor(BRAND.graphite).font("Helvetica-Bold").fontSize(10).text(label, 50, dy, { width: 110 });
    doc.fillColor("#1D1D1F").font("Helvetica").fontSize(10).text(value, 165, dy, { width: detailWidth - 165 });
    dy += 20;
  }

  // Score panel on the right
  const boxX = 50 + detailWidth + 20;
  const boxW = PAGE_WIDTH - detailWidth - 20;
  const boxY = y;
  const boxH = 130;
  doc.rect(boxX, boxY, boxW, boxH).fill("#F5F5F7");
  doc
    .fillColor(BRAND.graphite)
    .font("Helvetica")
    .fontSize(10)
    .text("Score", boxX, boxY + 16, { width: boxW, align: "center" });
  doc
    .fillColor(BRAND.navy)
    .font("Helvetica-Bold")
    .fontSize(36)
    .text(`${input.score}/${input.total}`, boxX, boxY + 36, { width: boxW, align: "center" });
  doc
    .fillColor(BRAND.red)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(`${percentage}%`, boxX, boxY + 84, { width: boxW, align: "center" });

  drawFooter(doc);
  doc.end();
  return done;
}

/* ------------------------------------------------------------------ */
/* 2. Student transcript (all of one student's results)                */
/* ------------------------------------------------------------------ */

export type TranscriptRow = {
  examTitle: string;
  examType: "entrance" | "class";
  score: number;
  total: number;
  submittedAt: string;
};

export type TranscriptInput = {
  fullName: string;
  admissionNumber: string;
  className: string;
  rows: TranscriptRow[];
};

export async function buildTranscriptPdf(input: TranscriptInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const done = collect(doc);

  const subtitle = `${input.fullName} · ${input.className} · Admission ${input.admissionNumber}`;
  let y = drawHeader(doc, "Student Result Transcript", subtitle);

  if (input.rows.length === 0) {
    doc
      .fillColor(BRAND.graphite)
      .font("Helvetica")
      .fontSize(11)
      .text("This student has not taken any tests yet.", 50, y);
    drawFooter(doc);
    doc.end();
    return done;
  }

  const columns: Column[] = [
    { header: "#", width: 28 },
    { header: "Test", width: 185 },
    { header: "Type", width: 92 },
    { header: "Score", width: 60, align: "right" },
    { header: "%", width: 40, align: "right" },
    { header: "Date", width: 90, align: "right" },
  ];

  const rows = input.rows.map((r, i) => [
    String(i + 1),
    r.examTitle,
    r.examType === "entrance" ? "Entrance" : "Class Test",
    `${r.score}/${r.total}`,
    `${pct(r.score, r.total)}%`,
    new Date(r.submittedAt).toLocaleDateString("en-GB"),
  ]);

  y = drawTable(doc, y, columns, rows);

  const avg = Math.round(
    input.rows.reduce((sum, r) => sum + pct(r.score, r.total), 0) / input.rows.length
  );
  doc
    .fillColor(BRAND.navy)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`Average score across ${input.rows.length} test${input.rows.length === 1 ? "" : "s"}: ${avg}%`, 50, y + 14);

  drawFooter(doc);
  doc.end();
  return done;
}

/* ------------------------------------------------------------------ */
/* 3. Class result sheet (all takers of one exam)                      */
/* ------------------------------------------------------------------ */

export type ClassSheetRow = {
  takerName: string;
  identifier: string; // admission number or candidate number
  score: number;
  total: number;
  submittedAt: string;
};

export type ClassSheetInput = {
  examTitle: string;
  examType: "entrance" | "class";
  className?: string | null;
  rows: ClassSheetRow[];
};

export async function buildClassSheetPdf(input: ClassSheetInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const done = collect(doc);

  const subtitle = [
    input.examTitle,
    input.className || (input.examType === "entrance" ? "Common Entrance" : null),
  ]
    .filter(Boolean)
    .join(" · ");
  let y = drawHeader(doc, "Class Result Sheet", subtitle);

  if (input.rows.length === 0) {
    doc
      .fillColor(BRAND.graphite)
      .font("Helvetica")
      .fontSize(11)
      .text("No one has taken this test yet.", 50, y);
    drawFooter(doc);
    doc.end();
    return done;
  }

  const columns: Column[] = [
    { header: "#", width: 28 },
    { header: "Name", width: 140 },
    { header: input.examType === "entrance" ? "Candidate No." : "Admission No.", width: 130 },
    { header: "Score", width: 60, align: "right" },
    { header: "%", width: 40, align: "right" },
    { header: "Date", width: 97, align: "right" },
  ];

  const sorted = [...input.rows].sort((a, b) => b.score - a.score);
  const rows = sorted.map((r, i) => [
    String(i + 1),
    r.takerName,
    r.identifier,
    `${r.score}/${r.total}`,
    `${pct(r.score, r.total)}%`,
    new Date(r.submittedAt).toLocaleDateString("en-GB"),
  ]);

  y = drawTable(doc, y, columns, rows);

  const avg = Math.round(
    input.rows.reduce((sum, r) => sum + pct(r.score, r.total), 0) / input.rows.length
  );
  doc
    .fillColor(BRAND.navy)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`${input.rows.length} result${input.rows.length === 1 ? "" : "s"} · class average: ${avg}%`, 50, y + 14);

  drawFooter(doc);
  doc.end();
  return done;
}
