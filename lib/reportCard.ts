/** The "Effective Areas" a class teacher rates each student on, in print order. */
export const TRAITS = [
  "Punctuality",
  "Attendance In Class",
  "Reliability",
  "Neatness",
  "Politeness",
  "Honesty",
  "Relationship With Staff",
  "Relationship With Other Students",
  "Self - Control",
  "Spirit Of Co-operation",
  "Spirit Of Responsibility",
  "Willingness To Learn",
  "Leadership Ability",
  "Initiative",
] as const;

export const RATINGS = ["Excellent", "Very Good", "Good", "Fair", "Poor"] as const;
export type Rating = (typeof RATINGS)[number];

export const MAX_COMMENT_LENGTH = 600;

/**
 * The principal's comment, written from the student's overall percentage for
 * the term. Bands follow the grade key on the sheet (A from 80, B from 65, C from 45).
 */
export function principalComment(overallPercent: number): string {
  if (overallPercent >= 80) return "Excellent result, keep it up!";
  if (overallPercent >= 65) return "A very good result. Keep working hard.";
  if (overallPercent >= 45) return "A fair result; there is room for improvement next term.";
  return "A weak result. More effort and support are needed next term.";
}
