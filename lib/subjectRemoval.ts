/**
 * Removing a subject from the catalog: what it would touch, and why it can be
 * refused. Shared by the API (lib/data/subjects.ts) and the Classes tab, so
 * both say the same thing.
 */

/** What removing a subject would touch, shown to the admin before they confirm. */
export type SubjectUsage = {
  /** The classes that offer it, named as on staff screens ("Obalende · BS4"), sorted. */
  classes: string[];
  /** How many pupils are marked as not taking it. That note goes with the subject. */
  exemptions: number;
  /** Whether any term marks use it. Marks keep a subject in the catalog. */
  hasMarks: boolean;
};

/** Why a subject with term marks can't be removed, and what to do instead. */
export function subjectHasMarksMessage(name: string): string {
  return `${name} has term marks, so it can't be removed. Take it off the classes that no longer offer it instead (press Subjects beside the class below).`;
}
