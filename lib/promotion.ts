import { CLASSES, type AcademicSession, type Class, type ClassName, type Term } from "./types";

/** The level after this one, or null for SS3 (whose students graduate). */
export function nextLevel(level: ClassName): ClassName | null {
  return CLASSES[CLASSES.indexOf(level) + 1] ?? null;
}

/**
 * Where a class's students most likely go next: the next level on the same
 * campus, in the same arm when that arm exists there, otherwise the arm-less
 * class, otherwise the first arm. Null when the campus has no such class yet.
 */
export function suggestNextClass(from: Class, classes: Class[]): Class | null {
  const level = nextLevel(from.level);
  if (!level) return null;
  const options = classes.filter((c) => c.campusId === from.campusId && c.level === level);
  return (
    options.find((c) => (c.arm ?? "") === (from.arm ?? "")) ??
    options.find((c) => c.arm === null) ??
    options[0] ??
    null
  );
}

/**
 * The session promotions move into by default. In Third Term the school is
 * finishing a session, so it's the next one (names like "2025/2026" sort in
 * time order). Otherwise the new session has already begun and students are
 * being placed into it: the current session.
 */
export function defaultTargetSession(sessions: AcademicSession[], currentTerm: Term | null): AcademicSession | null {
  const sorted = [...sessions].sort((a, b) => a.name.localeCompare(b.name));
  const current = sorted.findIndex((s) => s.isCurrent);
  if (current === -1) return sorted[sorted.length - 1] ?? null;
  if (currentTerm?.name === "Third Term") return sorted[current + 1] ?? sorted[current];
  return sorted[current];
}

/** "2026/2027" → "2026", to compare against a student's entry year. */
export const sessionStartYear = (name: string): string => name.slice(0, 4);

export function classLabel(c: Pick<Class, "campusName" | "level" | "arm">): string {
  return `${c.campusName ?? "Campus"} · ${c.level}${c.arm ? c.arm : ""}`;
}
