import type { AttemptQuestion } from "./types";

/** A score as a whole-number percentage of the total (0 when there is no total). */
export const percent = (score: number, total: number): number => (total ? Math.round((score / total) * 100) : 0);

/** A question as a result keeps it: what was asked, the choices, the right one. */
export const toAttemptQuestion = (q: AttemptQuestion): AttemptQuestion => ({ text: q.text, options: q.options, correctIndex: q.correctIndex });
