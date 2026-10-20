import type { Exam } from "@/lib/types";

/**
 * When a test is open to students: one set of rules for the server (who may
 * start it) and the staff screens (what its card says). Pure, so both sides
 * can import it; pass `now` to judge at a given moment.
 */
type Schedule = Pick<Exam, "active" | "opensAt" | "closesAt">;

/** Has a date and time still to come. */
export function opensLater(exam: Pick<Exam, "opensAt">, now = Date.now()): boolean {
  return exam.opensAt !== null && now < Date.parse(exam.opensAt);
}

/** Past its closing time. */
export function hasClosed(exam: Pick<Exam, "closesAt">, now = Date.now()): boolean {
  return exam.closesAt !== null && now > Date.parse(exam.closesAt);
}

/**
 * Where a test stands for students: hidden (switched off), scheduled (on,
 * opening later), open (they can start it) or closed (past its closing time).
 */
export type ExamStatus = "hidden" | "scheduled" | "open" | "closed";

export function examStatus(exam: Schedule, now = Date.now()): ExamStatus {
  if (!exam.active) return "hidden";
  if (opensLater(exam, now)) return "scheduled";
  if (hasClosed(exam, now)) return "closed";
  return "open";
}

/**
 * Setting a date and time is what opens a test: saving one switches the exam
 * on, so it shows under "Coming up" and opens by itself at that time.
 * Removing the date of a test that hasn't opened yet hides it again, so it
 * doesn't open straight away. Removing it from one that has already opened
 * leaves it open: students may be sitting it.
 *
 * `opensAt` is the new date (null removes it, undefined isn't changing it).
 * Returns the exam's new on/off state, or undefined to leave it as it is.
 */
export function activeAfterScheduleChange(
  exam: Pick<Exam, "opensAt">,
  opensAt: string | null | undefined,
  now = Date.now()
): boolean | undefined {
  if (opensAt) return true;
  if (opensAt === null && opensLater(exam, now)) return false;
  return undefined;
}

/**
 * The next moment any of these tests changes status by the clock alone (one
 * opens or closes), or null when none will. Screens re-check then.
 */
export function nextStatusChange(exams: Pick<Exam, "opensAt" | "closesAt">[], now = Date.now()): number | null {
  const times = exams
    .flatMap((e) => [e.opensAt, e.closesAt])
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter((t) => t > now);
  return times.length ? Math.min(...times) : null;
}
