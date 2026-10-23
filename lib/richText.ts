/**
 * Question text can carry bold, underline and italic, e.g. "Which word is
 * <u>underlined</u>?". It is stored as plain text with these three marks
 * and nothing else: <b>…</b>, <u>…</u>, <i>…</i>. Anything else that looks
 * like a tag is just text, so "x < 3" and "<script>" show exactly as typed.
 * Screens turn the marks into React elements (see RichText), never HTML.
 */

export type Mark = "b" | "u" | "i";
export type Run = { text: string } & Record<Mark, boolean>;

const MARK = /<(\/?)([bui])>/gi;

/** The text as runs of one style each. A mark left open runs to the end; a stray close is ignored. */
export function toRuns(text: string): Run[] {
  const open: Record<Mark, number> = { b: 0, u: 0, i: 0 };
  const runs: Run[] = [];
  const push = (t: string) => {
    if (t) runs.push({ text: t, b: open.b > 0, u: open.u > 0, i: open.i > 0 });
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
export const plainText = (text: string): string => text.replace(MARK, "");

/** Whether the text carries any styling at all. */
export const hasMarks = (text: string): boolean => new RegExp(MARK.source, "i").test(text);

/**
 * Remove the first `count` visible characters, keeping the marks around the
 * rest: "<b>9.</b> <u>Bàbá</u>" without its first 3 characters is "<u>Bàbá</u>".
 */
export function dropLeading(text: string, count: number): string {
  let left = count;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    const chunk = text.slice(last, m.index);
    out += chunk.slice(Math.min(left, chunk.length));
    left = Math.max(0, left - chunk.length);
    out += m[0];
    last = m.index! + m[0].length;
  }
  out += text.slice(last).slice(left);
  return tidy(out);
}

/** Drop marks around nothing ("<b></b>") and spaces left at either end. */
export function tidy(text: string): string {
  let t = text;
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(/<([bui])>(\s*)<\/\1>/gi, "$2");
  }
  return t.replace(/^((?:<[bui]>)*)\s+/i, "$1").replace(/\s+((?:<\/[bui]>)*)$/i, "$1");
}
