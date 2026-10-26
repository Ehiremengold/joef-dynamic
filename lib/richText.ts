/**
 * Question text can carry bold, underline, italic, superscript and
 * subscript, e.g. "Which word is <u>underlined</u>?", "x<sup>2</sup>",
 * "H<sub>2</sub>O". It is stored as plain text with these five marks and
 * nothing else: <b>, <u>, <i>, <sup>, <sub>. Anything else that looks like a
 * tag is just text, so "x < 3" and "<script>" show exactly as typed.
 * Screens turn the marks into React elements (see RichText), never HTML.
 *
 * A teacher who types one of the marks themselves ("the <b> tag") keeps it
 * as text: such a "<" is stored as "&lt;" (and an "&" that would read as one
 * of these as "&amp;"), and turned back when shown.
 */

export const MARKS = ["b", "u", "i", "sup", "sub"] as const;
export type Mark = (typeof MARKS)[number];
export type Style = Record<Mark, boolean>;
export type Run = { text: string } & Style;

export const PLAIN: Style = { b: false, u: false, i: false, sup: false, sub: false };

const NAMES = MARKS.join("|");
/** One mark, open or close; for building other patterns that allow marks in between. */
export const MARK_TAG = `<\\/?(?:${NAMES})>`;
const MARK = new RegExp(`<(\\/?)(${NAMES})>`, "gi");

/** Typed text that would read as a mark or an escape, kept as text. */
const escapeText = (t: string) => t.replace(/&(?=(?:lt|amp);)/g, "&amp;").replace(new RegExp(`<(?=\\/?(?:${NAMES})>)`, "gi"), "&lt;");
const unescapeText = (t: string) => t.replace(/&lt;/g, "<").replace(/&amp;/g, "&");

/** Apply `step` until the text stops changing (for clean-ups that can cascade). */
function untilStable(text: string, step: (t: string) => string): string {
  for (let prev = "", t = text; ; prev = t, t = step(t)) if (t === prev) return t;
}

/** The text as runs of one style each. A mark left open runs to the end; a stray close is ignored. */
export function toRuns(text: string): Run[] {
  const open: Record<Mark, number> = { b: 0, u: 0, i: 0, sup: 0, sub: 0 };
  const runs: Run[] = [];
  const push = (t: string) => {
    if (t) runs.push({ text: unescapeText(t), b: open.b > 0, u: open.u > 0, i: open.i > 0, sup: open.sup > 0, sub: open.sub > 0 });
  };
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    push(text.slice(last, m.index));
    const mark = m[2].toLowerCase() as Mark;
    open[mark] = Math.max(0, open[mark] + (m[1] ? -1 : 1));
    last = m.index! + m[0].length;
  }
  push(text.slice(last));
  return runs;
}

/** The words alone, for anything that can't show styling (a confirm box, a PDF, matching). */
export const plainText = (text: string): string => unescapeText(text.replace(MARK, ""));

/** Whether the text carries any styling at all. */
export const hasMarks = (text: string): boolean => new RegExp(MARK.source, "i").test(text);

/**
 * How a run's marks nest, innermost first: superscript or subscript (never
 * both), then italic, underline, bold. One order for every screen, so the
 * box a teacher types in and the students' screen build the same thing.
 */
export function nestMarks<T>(run: Run, wrap: (mark: Mark, inner: T) => T, inner: T): T {
  let node = inner;
  if (run.sup) node = wrap("sup", node);
  else if (run.sub) node = wrap("sub", node);
  for (const m of ["i", "u", "b"] as const) if (run[m]) node = wrap(m, node);
  return node;
}

/** Drop marks around nothing at all ("<b></b>"). A styled space is kept: the next word may follow it. */
export const dropEmptyMarks = (text: string): string =>
  untilStable(text, (t) => t.replace(new RegExp(`<(${NAMES})><\\/\\1>`, "gi"), ""));

/** Drop marks around nothing or only spaces ("<b> </b>"), and spaces left at either end: for saving. */
export function tidy(text: string): string {
  const t = untilStable(text, (s) => s.replace(new RegExp(`<(${NAMES})>(\\s*)<\\/\\1>`, "gi"), "$2"));
  return t.replace(new RegExp(`^((?:<(?:${NAMES})>)*)\\s+`, "i"), "$1").replace(new RegExp(`\\s+((?:<\\/(?:${NAMES})>)*)$`, "i"), "$1");
}

const sameStyle = (a: Style, b: Style) => MARKS.every((m) => a[m] === b[m]);

/** Runs of styled text back to text with marks: the inverse of toRuns. Marks open in MARKS order. */
export function fromRuns(runs: Run[]): string {
  const out = runs
    .map((r) => {
      const on = MARKS.filter((m) => r[m]);
      return on.map((m) => `<${m}>`).join("") + escapeText(r.text) + [...on].reverse().map((m) => `</${m}>`).join("");
    })
    .join("");
  // "<b>x</b><b><sup>2</sup></b>" is "<b>x<sup>2</sup></b>": drop a close straight followed by the same open.
  const join = new RegExp(`<\\/(${NAMES})>((?:<\\/(?:${NAMES})>)*)((?:<(?:${NAMES})>)*)<\\1>`, "gi");
  return dropEmptyMarks(untilStable(out, (t) => t.replace(join, "$2$3")));
}

/**
 * Remove the first `count` visible characters, keeping the marks around the
 * rest: "<b>9.</b> <u>Bàbá</u>" without its first 3 characters is "<u>Bàbá</u>".
 */
export function dropLeading(text: string, count: number): string {
  let left = count;
  const runs = toRuns(text).map((r) => {
    const cut = Math.min(left, r.text.length);
    left -= cut;
    return { ...r, text: r.text.slice(cut) };
  });
  return tidy(fromRuns(runs.filter((r) => r.text)));
}

/**
 * The text one character at a time, each with its style: what a formatted
 * text box edits. Positions count UTF-16 units, as the browser's do.
 */
export type Styled = { text: string; styles: Style[] };

export function toStyled(marked: string): Styled {
  const styles: Style[] = [];
  let text = "";
  for (const r of toRuns(marked)) {
    text += r.text;
    const { text: _t, ...style } = r;
    for (let i = 0; i < r.text.length; i++) styles.push(style);
  }
  return { text, styles };
}

export function fromStyled({ text, styles }: Styled): string {
  const runs: Run[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = runs[runs.length - 1];
    if (last && sameStyle(last, styles[i])) last.text += text[i];
    else runs.push({ text: text[i], ...styles[i] });
  }
  return fromRuns(runs);
}

const ESCAPE_HTML: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/**
 * The text as HTML for a formatted text box (RichField) to show while it is
 * being edited: every character escaped, the marks as real tags, line
 * breaks as <br>. Only the five marks ever become tags, so what a teacher
 * types can't inject anything.
 */
export function toEditorHtml(text: string): string {
  const html = toRuns(text)
    .map((r) => nestMarks(r, (m, inner) => `<${m}>${inner}</${m}>`, r.text.replace(/[&<>"]/g, (c) => ESCAPE_HTML[c]).replace(/\n/g, "<br>")))
    .join("");
  // A line break at the very end needs a second <br> before the browser shows the empty line.
  return html.endsWith("<br>") ? `${html}<br>` : html;
}
