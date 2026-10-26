"use client";

import { fromRuns, hasMarks, PLAIN, type Run, type Style } from "@/lib/richText";

/**
 * Reading formatted text out of HTML: what Word puts on the clipboard, and
 * what a formatted text box (RichField) holds while being edited. Both end
 * up as text with marks (lib/richText).
 */

const BLOCK = new Set(["P", "DIV", "LI", "TR", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "UL", "OL", "BLOCKQUOTE"]);
const SKIP = new Set(["STYLE", "SCRIPT", "HEAD", "TITLE", "META", "XML"]);

/** The element's own bold/underline/italic/superscript/subscript, on top of what it sits inside. */
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
  // x² and H₂O: Word writes <sup>/<sub>, or vertical-align on a span.
  const align = /vertical-align\s*:\s*([a-z]+)/.exec(css)?.[1];
  if (tag === "SUP" || align === "super") [s.sup, s.sub] = [true, false];
  if (tag === "SUB" || align === "sub") [s.sup, s.sub] = [false, true];
  if (align === "baseline") [s.sup, s.sub] = [false, false];
  return s;
}

// ---------------------------------------------------------------- clipboard

type Piece = { text: string; style: Style } | "\n";

/** What Word (or a web page) put on the clipboard: its spacing is HTML's, so runs of space collapse. */
function collectCopied(node: Node, style: Style, out: Piece[]) {
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
  for (const child of Array.from(node.childNodes)) collectCopied(child, own, out);
  if (block) out.push("\n");
}

/**
 * What was copied, as text with bold/underline/italic/superscript/subscript
 * marks, with Word's spacing tidied. Null when it has no styling worth
 * keeping: then the plain text is pasted instead.
 */
export function clipboardToMarked(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pieces: Piece[] = [];
  collectCopied(doc.body, PLAIN, pieces);
  const runs: Run[] = pieces.map((p) =>
    p === "\n"
      ? { text: "\n", ...PLAIN }
      : // An underlined gap in Word is a fill-in blank: show it as a line students can see.
        !p.text.trim() && p.style.u
        ? { text: "_____", ...PLAIN }
        : // Spaces on their own carry no style worth keeping.
          { text: p.text, ...(p.text.trim() ? p.style : PLAIN) }
  );
  const text = fromRuns(runs)
    .split("\n")
    .map((l) => l.replace(/[ ]+/g, " ").replace(/^[ \t]+|[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .normalize("NFC");
  return hasMarks(text) || text.includes("_____") ? text : null;
}

// ---------------------------------------------------------------- the box

/**
 * What a formatted text box holds, in order: its text, and its line breaks
 * (a <br>, or the start of a <div> the browser made for a new line). The
 * one walk behind reading the box, finding a position in it and putting
 * the cursor back, so the three always agree.
 */
type Item = { kind: "text"; node: Text; text: string; style: Style } | { kind: "break"; node: HTMLElement; block: boolean };

function itemsOf(root: HTMLElement): Item[] {
  const items: Item[] = [];
  const visit = (n: Node, style: Style) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = (n.textContent ?? "").replace(/ /g, " ");
      if (text) items.push({ kind: "text", node: n as Text, text, style });
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName === "BR") return void items.push({ kind: "break", node: n, block: false });
    // A new block starts a new line, unless the text is already at the start of one.
    const last = items[items.length - 1];
    if (n !== root && BLOCK.has(n.tagName) && last && last.kind !== "break") items.push({ kind: "break", node: n, block: true });
    const own = n === root ? style : styleOf(n, style);
    n.childNodes.forEach((c) => visit(c, own));
  };
  visit(root, PLAIN);
  return items;
}

const lengthOf = (item: Item) => (item.kind === "text" ? item.text.length : 1);

/** Whether the browser has started a new line with a <div> (or similar) rather than a <br>. */
export const hasBlocks = (root: HTMLElement) => itemsOf(root).some((i) => i.kind === "break" && i.block);

/**
 * What the box holds, as text with marks: what gets saved. Character for
 * character what the box shows (no trimming), so positions in the text are
 * positions in the box; the form tidies on save.
 */
export function editorToMarked(root: HTMLElement): string {
  const items = itemsOf(root);
  // The browser often leaves a <br> at the very end so the last line has height.
  if (items[items.length - 1]?.kind === "break") items.pop();
  return fromRuns(items.map((i) => (i.kind === "text" ? { text: i.text, ...i.style } : { text: "\n", ...PLAIN })));
}

/** Where a point in the box (a node and offset, as a selection gives) falls in its text. */
export function positionIn(root: HTMLElement, node: Node, offset: number): number {
  const at = document.createRange();
  at.setStart(node, offset);
  let count = 0;
  for (const item of itemsOf(root)) {
    if (item.node === node) return count + Math.min(offset, lengthOf(item));
    // Everything that ends at or before the point comes before it.
    const end: [Node, number] =
      item.kind === "text" ? [item.node, item.node.length] : item.block ? [item.node, 0] : [item.node.parentNode!, Array.from(item.node.parentNode!.childNodes).indexOf(item.node) + 1];
    if (at.comparePoint(...end) > 0) break;
    count += lengthOf(item);
  }
  return count;
}

/** Where a position in the text is in the box: the inverse of positionIn. */
export function pointAt(root: HTMLElement, at: number): [Node, number] {
  let count = 0;
  let afterBreak = true;
  for (const item of itemsOf(root)) {
    if (item.kind === "text") {
      const len = item.node.length;
      // At a boundary, stay at the end of the text before: typing carries on in its style.
      if (at < count + len || (at === count + len && len > 0) || (at === count && afterBreak)) return [item.node, at - count];
      count += len;
      afterBreak = false;
    } else {
      if (at === count) {
        if (item.block) return [item.node, 0];
        return [item.node.parentNode!, Array.from(item.node.parentNode!.childNodes).indexOf(item.node)];
      }
      count += 1;
      afterBreak = true;
    }
  }
  return [root, root.childNodes.length];
}
