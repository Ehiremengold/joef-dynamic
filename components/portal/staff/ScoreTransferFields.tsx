"use client";

import { CA_MAX, EXAM_MAX, type Subject, type Term } from "@/lib/types";

/**
 * What the two "Send to Term scores" dialogs (one test, several tests) share:
 * the options, the preview's shape and URL, and the controls for them.
 */

export type Part = "ca" | "exam";
export type TransferAction = "add" | "replace" | "keep" | "skip";

/** The preview (and, after a save, the result) of sending one test. */
export type TransferPlan<Row extends { action: TransferAction } = { action: TransferAction }> = {
  rows: Row[];
  saved?: number;
  subjectWarning: string | null;
};

/** Everything that decides what a send writes, as the API takes it. */
export type TransferOptions = { termId: string; subjectId: string; part: Part; overwrite: boolean; wholeMarks: boolean };

export const transferPath = (examId: string) => `/api/exams/${examId}/send-to-scores`;

/** The preview's URL, or null until a term and subject are chosen. */
export function previewUrl(examId: string, o: TransferOptions): string | null {
  if (!o.termId || !o.subjectId) return null;
  const q = new URLSearchParams({
    termId: o.termId,
    subjectId: o.subjectId,
    part: o.part,
    overwrite: o.overwrite ? "1" : "0",
    wholeMarks: o.wholeMarks ? "1" : "0",
  });
  return `${transferPath(examId)}?${q}`;
}

/** How many of a preview's rows would be added, replaced, kept or skipped. */
export const countAction = (plan: TransferPlan | null | undefined, a: TransferAction) =>
  plan?.rows.filter((r) => r.action === a).length ?? 0;

/** How many marks a preview would write. */
export const marksToWrite = (plan: TransferPlan | null | undefined) => countAction(plan, "add") + countAction(plan, "replace");

/** "3 to add, 2 kept as they are", from a preview. */
export function describePlan(plan: TransferPlan, keptLabel = "kept as they are"): string {
  return [
    countAction(plan, "add") && `${countAction(plan, "add")} to add`,
    countAction(plan, "replace") && `${countAction(plan, "replace")} to replace`,
    countAction(plan, "keep") && `${countAction(plan, "keep")} ${keptLabel}`,
    countAction(plan, "skip") && `${countAction(plan, "skip")} skipped`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** A subject whose name appears in the exam title ("First Term Mathematics" → Mathematics). */
export function guessSubject(title: string, subjects: Subject[]): string {
  const t = title.toLowerCase();
  return [...subjects].sort((a, b) => b.name.length - a.name.length).find((s) => t.includes(s.name.toLowerCase()))?.id ?? "";
}

export const SELECT = "mt-1 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy";

/** The term to send to, with the current one marked. */
export function TermSelect({ terms, value, onChange }: { terms: Term[]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="text-[13px] font-semibold">
      Term
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        <option value="">Choose…</option>
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}, {t.sessionName}
            {t.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Whether the marks count as CA or exam. */
export function PartSelect({ value, onChange }: { value: Part; onChange: (p: Part) => void }) {
  return (
    <label className="text-[13px] font-semibold">
      Counts as
      <select value={value} onChange={(e) => onChange(e.target.value as Part)} className={SELECT}>
        <option value="ca">CA (out of {CA_MAX})</option>
        <option value="exam">Exam (out of {EXAM_MAX})</option>
      </select>
    </label>
  );
}

/** "Round to whole marks" and "Replace marks already entered". */
export function TransferChecks({
  part,
  wholeMarks,
  overwrite,
  onWholeMarks,
  onOverwrite,
}: {
  part: Part;
  wholeMarks: boolean;
  overwrite: boolean;
  onWholeMarks: (v: boolean) => void;
  onOverwrite: (v: boolean) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={wholeMarks} onChange={(e) => onWholeMarks(e.target.checked)} className="h-4 w-4 accent-brand-navy" />
        Round to whole marks
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={overwrite} onChange={(e) => onOverwrite(e.target.checked)} className="h-4 w-4 accent-brand-navy" />
        Replace {part === "ca" ? "CA" : "exam"} marks already entered
      </label>
    </div>
  );
}
