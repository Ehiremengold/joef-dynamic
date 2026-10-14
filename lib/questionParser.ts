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
 * matter. Options may be written A. / A) / (a) / a. and answers as
 * "Answer: B", "Ans - b", "Correct answer: (B)".
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
  const text = d.text.join(" ").replace(NUMBER, "").trim();
  const letters = d.options.map((o) => o.letter);
  const options = d.options.map((o) => o.text);

  if (!text) problems.push("no question text");
  if (options.length < 2) problems.push(`only ${options.length} option${options.length === 1 ? "" : "s"} — needs at least 2`);
  if (options.length > MAX_OPTIONS) problems.push(`${options.length} options — at most ${MAX_OPTIONS}`);
  if (letters.some((l, i) => l !== String.fromCharCode(65 + i))) {
    problems.push(`options are lettered ${letters.join(", ")} — expected ${letters.map((_, i) => String.fromCharCode(65 + i)).join(", ")}`);
  }
  if (options.some((o) => !o)) problems.push("an option is empty");
  if (d.stray.length) problems.push(`"${d.stray[0]}" sits among the options but isn't one — put it in the question, or on an "Explanation:" line`);

  let correctIndex = -1;
  if (!d.answer) problems.push('no "Answer:" line');
  else {
    correctIndex = letters.indexOf(d.answer);
    if (correctIndex < 0) problems.push(`the answer is ${d.answer}, but there is no option ${d.answer}`);
  }
  return { number, text, options, correctIndex, problems };
}

export function parseQuestions(input: string): ParsedQuestion[] {
  const lines = input
    .replace(/[ ​]/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-–*]+(?=\S)/, (m) => (/[•*]/.test(m) ? "" : m)).trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  let d = blank();
  let inExplanation = false; // an explanation can wrap onto following lines
  const close = () => {
    if (hasContent(d)) questions.push(finish(d, questions.length + 1));
    d = blank();
  };

  for (const line of lines) {
    const answer = ANSWER.exec(line);
    if (answer && hasContent(d)) {
      d.answer = answer[1].toUpperCase();
      close();
      inExplanation = false;
      continue;
    }
    if (EXPLANATION.test(line)) {
      inExplanation = true; // kept out of the question, whichever side of the answer
      continue;
    }
    const option = OPTION.exec(line);
    if (option && (d.text.length > 0 || d.options.length > 0)) {
      d.options.push({ letter: option[1].toUpperCase(), text: option[2].trim() });
      inExplanation = false;
      continue;
    }
    // A new numbered question while the last one never got its answer.
    if (NUMBER.test(line) && d.options.length > 0) close();
    if (inExplanation && !NUMBER.test(line)) continue; // the explanation wrapped onto this line
    inExplanation = false;
    if (d.options.length > 0) d.stray.push(line);
    else d.text.push(line);
  }
  close();
  return questions;
}
