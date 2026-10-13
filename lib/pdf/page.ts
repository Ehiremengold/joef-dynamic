import "server-only";
import PDFDocument from "pdfkit";
import { BRAND } from "./brand";
import { LOGO_PNG_BASE64 } from "./logo-base64";

/** The horizontal band a document lays its content out in. */
export type Box = { left: number; width: number };

// As a data URI, not a Buffer: pdfkit remembers images it was given by string,
// so the crest (drawn twice a page, letterhead and watermark) is embedded once
// per document however many pages there are.
const LOGO = `data:image/png;base64,${LOGO_PNG_BASE64}`;

/** The faint crest behind every page of a school document. */
function drawWatermark(doc: PDFKit.PDFDocument): void {
  const size = 380;
  doc.save();
  doc.opacity(0.07);
  doc.image(LOGO, (doc.page.width - size) / 2, (doc.page.height - size) / 2, { width: size });
  doc.restore();
}

/**
 * A new A4 school document, crest watermarked on every page. Call `doc.end()`
 * when finished; `done` then resolves to the PDF.
 */
export function createDocument(margin: number): { doc: PDFKit.PDFDocument; done: Promise<Buffer> } {
  const doc = new PDFDocument({ size: "A4", margin });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  drawWatermark(doc);
  doc.on("pageAdded", () => drawWatermark(doc));
  return { doc, done };
}

/** Where content must stop so it clears the footer. */
export function contentBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom - 26;
}

/**
 * Draws the school letterhead at the top of the current page: crest, name,
 * addresses and contacts, then the document's title on a yellow band.
 * Returns the y-coordinate to start content at.
 */
export function drawLetterhead(
  doc: PDFKit.PDFDocument,
  box: Box,
  title: string,
  subtitle?: string
): number {
  const top = 30;
  const centred = { width: box.width, align: "center" as const };
  doc.image(LOGO, box.left, top, { width: 52 });

  doc
    .fillColor(BRAND.navy)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(BRAND.schoolName.toUpperCase(), box.left, top + 2, { ...centred, characterSpacing: 0.6 });
  doc
    .fillColor(BRAND.graphite)
    .font("Helvetica")
    .fontSize(9)
    .text(BRAND.addressLines.join("  /  "), box.left, top + 23, centred);
  doc.fontSize(8.5).text(`${BRAND.phone}   ·   ${BRAND.email}`, box.left, top + 37, centred);

  const bandY = top + 58;
  const bandHeight = 20;
  doc.font("Helvetica-Bold").fontSize(11);
  const bandWidth = Math.min(box.width, doc.widthOfString(title) + 48);
  doc.rect(box.left + (box.width - bandWidth) / 2, bandY, bandWidth, bandHeight).fill(BRAND.band);
  doc.fillColor(BRAND.ink).text(title, box.left, bandY + 5.5, centred);

  let y = bandY + bandHeight + 10;
  if (subtitle) {
    doc.fillColor(BRAND.graphite).font("Helvetica").fontSize(10).text(subtitle, box.left, y, centred);
    y += 20;
  }
  return y;
}

/**
 * Draws the footer on the current page. Both the rule and the text must sit
 * strictly above the page's bottom margin boundary (page.height - margin) —
 * pdfkit silently starts a new page if a .text() call lands past it.
 */
export function drawFooter(doc: PDFKit.PDFDocument, box: Box): void {
  const bottom = doc.page.height - doc.page.margins.bottom - 20;
  doc
    .moveTo(box.left, bottom)
    .lineTo(box.left + box.width, bottom)
    .lineWidth(0.5)
    .strokeColor(BRAND.smoke)
    .stroke();
  doc
    .fillColor(BRAND.graphite)
    .font("Helvetica")
    .fontSize(8)
    .text(
      `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${BRAND.schoolName} Portal`,
      box.left,
      bottom + 6,
      { width: box.width, align: "center", lineBreak: false }
    );
}
