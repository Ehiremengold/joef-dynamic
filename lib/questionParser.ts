import { dropLeading, MARK_TAG, plainText, tidy } from "./richText";

/**
 * Turns a block of pasted questions — typed as plain text or copied out of a
 * Word document — into exam questions:
 *
 *   1. Which apparatus measures a definite volume of liquid?
 *   A. Mortar and pestle
 *   B. Measuring cylinder
 *   Answer: B
 *   Explanation: …        (optional; never shown to students)
 *
 * The "Answer:" line closes each question, so numbering is optional (Word's
 * automatic numbering is often lost when copying) and blank lines don't
 * matter. Options may be written A. / A) / (a) / a., one per line or
 * several on a line set apart by a tab or spaces, and answers as
 * "Answer: B", "Ans - b", "Correct answer: (B)".
 *
 * Text may carry bold/underline/italic/superscript/subscript marks
 * (lib/richText), as pasted from Word. Lines are recognised by their words
 * alone; the marks are kept on the question and option text.
 */

export type ParsedQuestion = {
  /** 1-based position in the pasted text, for messages. */
  number: number;
  text: string;
  options: string[];
  correctIndex: number;
  /** Why this question can't be saved yet. Empty when it's fine. */
  problems: string[];
};

const MAX_OPTIONS = 6;
const NUMBER = /^(?:q(?:uestion)?\s*)?\d+\s*[.):\-]\s*/i;
const OPTION = /^\(?([a-h])\s*[.):]\s*(.*)$/i;
const ANSWER = /^(?:correct\s+)?(?:answer|ans)\s*[:.\-–)]?\s*\(?([a-h])\b/i;
const EXPLANATION = /^(?:explanation|reason|note|solution)\s*[:\-–]/i;

type Draft = { text: string[]; options: { letter: string; text: string }[]; answer: string | null; stray: string[] };
const blank = (): Draft => ({ text: [], options: [], answer: null, stray: [] });
const hasContent = (d: Draft) => d.text.length > 0 || d.options.length > 0;

function finish(d: Draft, number: number): ParsedQuestion {
  const problems: string[] = [];
  const joined = d.text.join(" ");
  const numbered = NUMBER.exec(plainText(joined));
  const text = tidy(numbered ? dropLeading(joined, numbered[0].length) : joined);
  const letters = d.options.map((o) => o.letter);
  const options = d.options.map((o) => o.text);

  if (!plainText(text).trim()) problems.push("no question text");
  if (options.length < 2) problems.push(`only ${options.length} option${options.length === 1 ? "" : "s"}, needs at least 2`);
  if (options.length > MAX_OPTIONS) problems.push(`${options.length} options, at most ${MAX_OPTIONS}`);
  if (letters.some((l, i) => l !== String.fromCharCode(65 + i))) {
    problems.push(`options are lettered ${letters.join(", ")}, expected ${letters.map((_, i) => String.fromCharCode(65 + i)).join(", ")}`);
  }
  if (options.some((o) => !plainText(o).trim())) problems.push("an option is empty");
  if (d.stray.length) problems.push(`"${plainText(d.stray[0])}" sits among the options but isn't one. Put it in the question, or on an "Explanation:" line`);

  let correctIndex = -1;
  if (!d.answer) problems.push('no "Answer:" line');
  else {
    correctIndex = letters.indexOf(d.answer);
    if (correctIndex < 0) problems.push(`the answer is ${d.answer}, but there is no option ${d.answer}`);
  }
  return { number, text, options, correctIndex, problems };
}

// Where the next option starts on a line of several: a tab or two spaces, then "b." (marks allowed between).
const NEXT_OPTION = new RegExp(`(?:\\t|[ ]{2,})(?=(?:${MARK_TAG})*\\(?[b-h]\\s*[.):]\\s)`, "i");

export function parseQuestions(input: string): ParsedQuestion[] {
  const lines = input
    .normalize("NFC")
    .replace(/[ ​]/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-–*]+(?=\S)/, (m) => (/[•*]/.test(m) ? "" : m)).trim())
    // "a. mẹ́rin    b. méjì    c. mẹ́ta": one option each.
    .flatMap((l) => (OPTION.test(plainText(l)) ? l.split(NEXT_OPTION) : [l]))
    .map((l) => l.trim())
    .filter((l) => plainText(l).trim());

  const questions: ParsedQuestion[] = [];
  let d = blank();
  let inExplanation = false; // an explanation can wrap onto following lines
  const close = () => {
    if (hasContent(d)) questions.push(finish(d, questions.length + 1));
    d = blank();
  };

  for (const line of lines) {
    const plain = plainText(line);
    const answer = ANSWER.exec(plain);
    if (answer && hasContent(d)) {
      d.answer = answer[1].toUpperCase();
      close();
      inExplanation = false;
      continue;
    }
    if (EXPLANATION.test(plain)) {
      inExplanation = true; // kept out of the question, whichever side of the answer
      continue;
    }
    const option = OPTION.exec(plain);
    if (option && (d.text.length > 0 || d.options.length > 0)) {
      d.options.push({ letter: option[1].toUpperCase(), text: dropLeading(line, plain.length - option[2].length) });
      inExplanation = false;
      continue;
    }
    // A new numbered question while the last one never got its answer.
    if (NUMBER.test(plain) && d.options.length > 0) close();
    if (inExplanation && !NUMBER.test(plain)) continue; // the explanation wrapped onto this line
    inExplanation = false;
    if (d.options.length > 0) d.stray.push(line);
    else d.text.push(line);
  }
  close();
  return questions;
}
