import type { AttemptQuestion } from "./types";

/** A score as a whole-number percentage of the total (0 when there is no total). */
export const percent = (score: number, total: number): number => (total ? Math.round((score / total) * 100) : 0);

/** A question as a result keeps it: what was asked, the choices, the right one. */
export const toAttemptQuestion = (q: AttemptQuestion): AttemptQuestion => ({ text: q.text, options: q.options, correctIndex: q.correctIndex });

/** Whether two questions ask the same thing the same way (same words, choices and answer). */
export const sameQuestion = (a: AttemptQuestion, b: AttemptQuestion): boolean =>
  a.text === b.text && a.correctIndex === b.correctIndex && a.options.length === b.options.length && a.options.every((o, i) => o === b.options[i]);
