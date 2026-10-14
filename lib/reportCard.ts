import { gradeFor, type Grade } from "./grades";

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
export type Trait = (typeof TRAITS)[number];

/** The school's rating scale, as on its existing report sheets. */
export const RATINGS = ["Excellent", "Very Good", "Good"] as const;
export type Rating = (typeof RATINGS)[number];

export type Ratings = Partial<Record<Trait, Rating>>;

export const MAX_COMMENT_LENGTH = 600;

/** What a class teacher has written on one student's report for one term. */
export type TermReport = {
  ratings: Ratings;
  teacherComment: string;
  /** The teacher who wrote the comment, as they were named when they wrote it. */
  signedBy: string | null;
};

/** A student on the Report cards screen, with what has been written for them so far. */
export type TermReportRow = TermReport & { studentId: string; fullName: string; admissionNumber: string };

/** Keep only known traits with known ratings; anything else is dropped. */
export function sanitizeRatings(raw: unknown): Ratings {
  const ratings: Ratings = {};
  if (!raw || typeof raw !== "object") return ratings;
  for (const trait of TRAITS) {
    const rating = (raw as Record<string, unknown>)[trait];
    if ((RATINGS as readonly unknown[]).includes(rating)) ratings[trait] = rating as Rating;
  }
  return ratings;
}

const COMMENT_FOR_GRADE: Record<Grade["grade"], string> = {
  A: "Excellent result, keep it up!",
  B: "A very good result. Keep working hard.",
  C: "A fair result; there is room for improvement next term.",
  D: "A weak result. More effort and support are needed next term.",
};

/**
 * The principal's comment, written from the student's overall percentage for
 * the term with the same bands as the grade key. At the end of the session
 * (Third Term) it also gives the promotion verdict: promoted on a pass
 * (grade C or better), otherwise referred to the principal.
 */
export function principalComment(overallPercent: number, termName: string): string {
  const grade = gradeFor(overallPercent).grade;
  const comment = COMMENT_FOR_GRADE[grade];
  if (termName !== "Third Term") return comment;
  return `${comment} ${grade === "D" ? "Not promoted; please see the principal." : "Promoted."}`;
}
