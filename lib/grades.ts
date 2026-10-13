/**
 * The school's grade key, best first: a subject percentage at or above `from`
 * earns the grade. Printed under the scores on every report sheet.
 */
export const GRADE_KEY = [
  { grade: "A", from: 80, remark: "Excellent" },
  { grade: "B", from: 65, remark: "Very Good" },
  { grade: "C", from: 45, remark: "Good" },
  { grade: "D", from: 0, remark: "Poor" },
] as const;

export type Grade = (typeof GRADE_KEY)[number];

export function gradeFor(percent: number): Grade {
  return GRADE_KEY.find((g) => percent >= g.from) ?? GRADE_KEY[GRADE_KEY.length - 1];
}
