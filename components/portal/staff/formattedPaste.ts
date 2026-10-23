"use client";

import { hasMarks, type Mark } from "@/lib/richText";

type Style = Record<Mark, boolean>;
type Piece = { text: string; style: Style } | "\n";

const BLOCK = new Set(["P", "DIV", "LI", "TR", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "UL", "OL", "BLOCKQUOTE"]);
const SKIP = new Set(["STYLE", "SCRIPT", "HEAD", "TITLE", "META", "XML"]);

/** The element's own bold/underline/italic, on top of what it sits inside. */
function styleOf(el: HTMLElement, inherited: Style): Style {
  const s = { ...inherited };
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG") s.b = true;
  if (tag === "U" || tag === "INS") s.u = true;
  if (tag === "I" || tag === "EM") s.i = true;
  const css = (el.getAttribute("style") ?? "").toLowerCase();
  // Word writes styles inline; Google Docs wraps everything in <b style="font-weight:normal">.
  const weight = /font-weight\s*:\s*([a-z0-9]+)/.exec(css)?.[1];
  if (weight) s.b = weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  if (/text-decoration[a-z-]*\s*:[^;]*underline|text-underline\s*:\s*(?!none)/.test(css)) s.u = true;
  else if (/text-decoration[a-z-]*\s*:\s*none/.test(css)) s.u = false;
  const fontStyle = /font-style\s*:\s*([a-z]+)/.exec(css)?.[1];
  if (fontStyle) s.i = fontStyle === "italic" || fontStyle === "oblique";
  return s;
}

function collect(node: Node, style: Style, out: Piece[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent ?? "";
    // Runs of non-breaking spaces are how Word lays out tabs: keep them as a gap.
    const text = raw.replace(/[\r\n\t ]+/g, " ").replace(/ {2,}/g, "\t").replace(/ /g, " ");
    if (text) out.push({ text, style });
    return;
  }
  if (!(node instanceof HTMLElement) || SKIP.has(node.tagName)) return;
  if (node.tagName === "BR") return void out.push("\n");
  // Word's tab stops, and table cells (options set out in a table), become a gap.
  if (/mso-tab-count/i.test(node.getAttribute("style") ?? "") || node.tagName === "TD" || node.tagName === "TH") {
    out.push({ text: "\t", style });
  }
  const own = styleOf(node, style);
  const block = BLOCK.has(node.tagName);
  if (block) out.push("\n");
  for (const child of Array.from(node.childNodes)) collect(child, own, out);
  if (block) out.push("\n");
}

const open = (s: Style) => (s.b ? "<b>" : "") + (s.u ? "<u>" : "") + (s.i ? "<i>" : "");
const close = (s: Style) => (s.i ? "</i>" : "") + (s.u ? "</u>" : "") + (s.b ? "</b>" : "");

/**
 * What was copied, as text with bold/underline/italic marks (lib/richText),
 * or null when the clipboard has no styling worth keeping (a plain paste does).
 */
export function clipboardToMarked(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pieces: Piece[] = [];
  collect(doc.body, { b: false, u: false, i: false }, pieces);

  let out = "";
  for (const p of pieces) {
    if (p === "\n") {
      out += "\n";
      continue;
    }
    const blankLine = !p.text.trim();
    if (blankLine && p.style.u) {
      // An underlined gap is a fill-in blank: show it as a line students can see.
      out += "_____";
      continue;
    }
    out += blankLine || !(p.style.b || p.style.u || p.style.i) ? p.text : open(p.style) + p.text + close(p.style);
  }
  // "<b>Mo</b><b> je</b>" reads better as one run: drop a close straight followed by the same open.
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(/<\/([bui])>((?:<\/[bui]>)*)((?:<[bui]>)*)<\1>/gi, "$2$3");
  }
  const text = out
    .split("\n")
    .map((l) => l.replace(/[ ]+/g, " ").replace(/^[ \t]+|[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .normalize("NFC");
  return hasMarks(text) || text.includes("_____") ? text : null;
}

/**
 * Paste into a question box keeping Word's bold, underline and italic as
 * marks. A paste with no styling is left to the browser.
 */
export function pasteFormatted(
  e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  setValue: (value: string) => void
) {
  const html = e.clipboardData.getData("text/html");
  if (!html) return;
  let marked = clipboardToMarked(html);
  if (marked === null) return;
  const field = e.currentTarget;
  // A one-line box (an option) can't hold line breaks.
  if (field instanceof HTMLInputElement) marked = marked.replace(/\s*\n\s*/g, " ");
  e.preventDefault();
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  setValue(field.value.slice(0, start) + marked + field.value.slice(end));
  const caret = start + marked.length;
  requestAnimationFrame(() => field.setSelectionRange(caret, caret));
}

/** Wrap the selected words in a field with a mark (the B / U / I buttons). */
export function wrapSelection(field: HTMLTextAreaElement | HTMLInputElement, mark: Mark, setValue: (value: string) => void) {
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? start;
  const v = field.value;
  const picked = v.slice(start, end) || "text";
  setValue(`${v.slice(0, start)}<${mark}>${picked}</${mark}>${v.slice(end)}`);
  requestAnimationFrame(() => {
    field.focus();
    field.setSelectionRange(start + 3, start + 3 + picked.length);
  });
}
