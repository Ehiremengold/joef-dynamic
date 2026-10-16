"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { classLabel } from "@/lib/classes";
import { ApiError, apiKey, EDITABLE, sendJson, useApi } from "@/lib/client/api";
import { gradeFor } from "@/lib/grades";
import { isAdmin } from "@/lib/roles";
import type { Class, ScoreRow, SignedInStaff, SubjectProgress, Term } from "@/lib/types";
import { useConfirm } from "./useConfirm";

type Meta = { canEdit: boolean; readOnlyReason: string | null; caMax: number; examMax: number };
type Progress = Meta & { subjects: SubjectProgress[]; students: number };
type Sheet = Meta & { rows: ScoreRow[] };
type Field = "ca" | "exam";
/** What's typed, as typed ("12." is fine mid-typing), by student. */
type Edits = Record<string, Partial<Record<Field, string>>>;

const SELECT =
  "mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy";

const shown = (v: number | null) => (v === null ? "" : String(v));
/** "" → blank; a number → that number; anything else → NaN (invalid). */
const parse = (s: string): number | null => (s.trim() === "" ? null : Number(s.trim()));
const valid = (v: number | null, max: number) =>
  v === null || (Number.isFinite(v) && v >= 0 && v <= max && Math.abs(Math.round(v * 100) - v * 100) < 1e-6);

/**
 * Where a class's CA and exam marks are entered for each subject and term.
 * They print on report sheets and transcripts, and make up the class average.
 */
export default function TermScoresPanel({ me, onUnauthorized }: { me: SignedInStaff; onUnauthorized: () => void }) {
  const client = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const termsQ = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized);
  const classesQ = useApi<{ classes: Class[] }>("/api/classes", onUnauthorized);
  const [chosenTerm, setTermId] = useState("");
  const [chosenClass, setClassId] = useState("");
  const [chosenSubject, setSubjectId] = useState("");
  const [edits, setEdits] = useState<{ url: string; values: Edits } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const terms = termsQ.data?.terms ?? [];
  const classes = (classesQ.data?.classes ?? []).filter((c) => isAdmin(me.role) || c.classTeacherId === me.id);
  const termId = chosenTerm || terms.find((t) => t.isCurrent)?.id || terms[terms.length - 1]?.id || "";
  // A teacher who is also an admin starts on their own class.
  const classId = chosenClass || classes.find((c) => c.classTeacherId === me.id)?.id || classes[0]?.id || "";

  const progressUrl = termId && classId ? `/api/classes/${classId}/scores?termId=${termId}` : null;
  const progressQ = useApi<Progress>(progressUrl, onUnauthorized, EDITABLE);
  const subjects = progressQ.data?.subjects ?? [];
  const subjectId = subjects.some((s) => s.subjectId === chosenSubject) ? chosenSubject : subjects[0]?.subjectId ?? "";
  const subject = subjects.find((s) => s.subjectId === subjectId);

  const sheetUrl = progressUrl && subjectId ? `${progressUrl}&subjectId=${subjectId}` : null;
  const sheetQ = useApi<Sheet>(sheetUrl, onUnauthorized, EDITABLE);
  const rows = sheetQ.data?.rows ?? [];
  const meta = sheetQ.data ?? progressQ.data;
  const caMax = meta?.caMax ?? 40;
  const examMax = meta?.examMax ?? 60;
  const canEdit = meta?.canEdit ?? false;

  // Typing for the sheet on screen only; the saved marks show until there is some.
  const typed = edits && edits.url === sheetUrl ? edits.values : {};
  const text = (r: ScoreRow, f: Field) => typed[r.studentId]?.[f] ?? shown(r[f]);
  const value = (r: ScoreRow, f: Field) => parse(text(r, f));
  const changed = rows.filter((r) => !r.exempt && (["ca", "exam"] as Field[]).some((f) => value(r, f) !== r[f]));
  const invalid = rows.some((r) => !valid(value(r, "ca"), caMax) || !valid(value(r, "exam"), examMax));
  const entered = rows.filter((r) => !r.exempt && (value(r, "ca") !== null || value(r, "exam") !== null)).length;
  const taking = rows.filter((r) => !r.exempt).length;

  useEffect(() => {
    setNotice("");
    setError("");
  }, [sheetUrl]);

  function setText(studentId: string, f: Field, v: string) {
    if (!sheetUrl) return;
    setEdits({ url: sheetUrl, values: { ...typed, [studentId]: { ...typed[studentId], [f]: v } } });
  }

  /** Ask before throwing away typed marks when moving to another sheet. */
  async function leave(go: () => void) {
    if (changed.length > 0) {
      const ok = await confirm({
        title: "Discard unsaved marks?",
        message: `${changed.length} student${changed.length === 1 ? " has" : "s have"} marks that aren't saved yet.`,
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) return;
    }
    setEdits(null);
    go();
  }

  const cellKey = (studentId: string, f: Field) => `${studentId}:${f}`;
  const editable = rows.filter((r) => !r.exempt);

  /** Enter moves down the column, like a spreadsheet. */
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: ScoreRow, f: Field) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = editable.findIndex((x) => x.studentId === r.studentId);
    const next = editable[i + (e.shiftKey ? -1 : 1)];
    if (next) inputs.current.get(cellKey(next.studentId, f))?.focus();
  }

  /**
   * Pasting a column copied from Excel or Word fills this cell and the ones
   * below it. Two columns (CA then exam) fill both.
   */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, r: ScoreRow, f: Field) {
    const raw = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(raw.trim())) return; // one value: let it paste normally
    e.preventDefault();
    const lines = raw.replace(/\r/g, "").replace(/\n+$/, "").split("\n");
    const start = editable.findIndex((x) => x.studentId === r.studentId);
    const next: Edits = { ...typed };
    lines.forEach((line, i) => {
      const target = editable[start + i];
      if (!target) return;
      const [first, second] = line.split("\t").map((c) => c.trim());
      next[target.studentId] = { ...next[target.studentId], [f]: first ?? "" };
      if (f === "ca" && second !== undefined) next[target.studentId].exam = second;
    });
    if (sheetUrl) setEdits({ url: sheetUrl, values: next });
    const filled = Math.min(lines.length, editable.length - start);
    setNotice(`Pasted ${filled} row${filled === 1 ? "" : "s"}. Check them, then save.`);
  }

  async function save() {
    if (!sheetUrl || !progressUrl || !subject) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const scores = changed.map((r) => ({ studentId: r.studentId, ca: value(r, "ca"), exam: value(r, "exam") }));
      await sendJson(`/api/classes/${classId}/scores`, "PUT", { termId, subjectId, scores });
      // What was typed is now what is saved: put it in the cache and drop the edits.
      client.setQueryData<Sheet>(apiKey(sheetUrl), (old) =>
        old && { ...old, rows: old.rows.map((r) => ({ ...r, ca: value(r, "ca"), exam: value(r, "exam") })) }
      );
      setEdits(null);
      client.invalidateQueries({ queryKey: apiKey(progressUrl), exact: true });
      setNotice(`${subject.name}: ${scores.length} student${scores.length === 1 ? "" : "s"} saved.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not save the marks");
    } finally {
      setSaving(false);
    }
  }

  if (termsQ.isPending || classesQ.isPending) return <p className="text-sm text-graphite">Loading…</p>;

  return (
    <div className="space-y-6">
      {dialog}
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Term scores</h2>
        <p className="mt-1 max-w-[680px] text-sm leading-relaxed text-graphite">
          Enter each subject&rsquo;s CA (out of {caMax}) and exam (out of {examMax}) marks for the term. They print on
          report sheets and transcripts, and make up the class average.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="text-sm text-graphite">
          {isAdmin(me.role)
            ? "No classes yet, add one under the Classes tab."
            : "You are not the class teacher of any class yet. Ask an admin to assign you under Classes."}
        </p>
      ) : terms.length === 0 ? (
        <p className="text-sm text-graphite">No terms set up yet. An admin can add one under Sessions &amp; terms.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="ts-term">Term</label>
              <select
                id="ts-term"
                data-tour="scores-term"
                value={termId}
                onChange={(e) => leave(() => setTermId(e.target.value))}
                className={SELECT}
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}, {t.sessionName}
                    {t.isCurrent ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="ts-class">Class</label>
              <select
                id="ts-class"
                data-tour="scores-class"
                value={classId}
                onChange={(e) => leave(() => setClassId(e.target.value))}
                className={SELECT}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
            </div>
          </div>

          {progressQ.isPending ? (
            <p className="text-sm text-graphite">Loading…</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-graphite">
              This class has no subjects yet. {isAdmin(me.role) ? "Add them under Classes → Subjects." : "Ask an admin to add them under Classes."}
            </p>
          ) : (
            <>
              <div data-tour="scores-subjects" className="flex flex-wrap gap-2">
                {subjects.map((s) => {
                  const done = s.taking > 0 && s.entered >= s.taking;
                  return (
                    <button
                      key={s.subjectId}
                      type="button"
                      onClick={() => s.subjectId !== subjectId && leave(() => setSubjectId(s.subjectId))}
                      className={`cursor-pointer rounded-btn border px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
                        s.subjectId === subjectId
                          ? "border-brand-navy bg-brand-navy text-white"
                          : "border-smoke bg-white text-ink hover:border-brand-navy"
                      }`}
                    >
                      {s.name}{" "}
                      <span className={s.subjectId === subjectId ? "text-white/75" : done ? "text-brand-green" : "text-pewter"}>
                        {s.entered}/{s.taking}
                      </span>
                    </button>
                  );
                })}
              </div>

              {meta?.readOnlyReason && (
                <p data-tour="scores-readonly" className="rounded-card border border-smoke bg-white px-4 py-3 text-[13px] text-graphite">
                  Read only. {meta.readOnlyReason}
                </p>
              )}
              {(error || sheetQ.error) && (
                <p className="text-sm font-semibold text-brand-red" role="alert">{error || sheetQ.error?.message}</p>
              )}
              {notice && <p className="text-sm font-semibold text-brand-green">{notice}</p>}

              <div data-tour="scores-table" className="min-w-0 overflow-x-auto rounded-card border border-smoke bg-white">
                {sheetQ.isPending ? (
                  <p className="p-6 text-sm text-graphite">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="p-6 text-sm text-graphite">No students in this class for the term.</p>
                ) : (
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                        <th className="px-4 py-3 font-semibold">Admission no.</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">CA ({caMax})</th>
                        <th className="px-4 py-3 font-semibold">Exam ({examMax})</th>
                        <th className="px-4 py-3 font-semibold">Total</th>
                        <th className="px-4 py-3 font-semibold">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const ca = value(r, "ca");
                        const exam = value(r, "exam");
                        const ok = valid(ca, caMax) && valid(exam, examMax);
                        const total = ok && (ca !== null || exam !== null) ? (ca ?? 0) + (exam ?? 0) : null;
                        const pct = total === null ? null : (total / (caMax + examMax)) * 100;
                        return (
                          <tr key={r.studentId} className={`border-b border-smoke last:border-0 ${r.exempt ? "bg-mist text-pewter" : ""}`}>
                            <td className="px-4 py-2 font-mono text-[13px]">{r.admissionNumber}</td>
                            <td className="px-4 py-2 font-semibold">
                              {r.fullName}
                              {r.exempt && <span className="ml-2 text-[12px] font-normal">Doesn&rsquo;t take this subject</span>}
                            </td>
                            {(["ca", "exam"] as Field[]).map((f) => {
                              const max = f === "ca" ? caMax : examMax;
                              const bad = !valid(value(r, f), max);
                              return (
                                <td key={f} className="px-4 py-2">
                                  <input
                                    ref={(el) => {
                                      if (el) inputs.current.set(cellKey(r.studentId, f), el);
                                      else inputs.current.delete(cellKey(r.studentId, f));
                                    }}
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={`${f === "ca" ? "CA" : "Exam"} for ${r.fullName}`}
                                    aria-invalid={bad}
                                    disabled={!canEdit || r.exempt}
                                    value={r.exempt ? "" : text(r, f)}
                                    onChange={(e) => setText(r.studentId, f, e.target.value)}
                                    onKeyDown={(e) => onKeyDown(e, r, f)}
                                    onPaste={(e) => onPaste(e, r, f)}
                                    className={`w-20 rounded-btn border px-2 py-1.5 text-sm tabular-nums outline-none disabled:bg-mist ${
                                      bad ? "border-brand-red bg-brand-red/5 focus:border-brand-red" : "border-smoke focus:border-brand-navy"
                                    }`}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 font-display font-bold tabular-nums">{total === null ? "" : total}</td>
                            <td className="px-4 py-2">{pct === null ? "" : gradeFor(pct).grade}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      data-tour="scores-save"
                      onClick={save}
                      disabled={saving || changed.length === 0 || invalid}
                      className="cursor-pointer rounded-btn bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Saving…" : `Save ${subject?.name ?? ""} marks`}
                    </button>
                  )}
                  <span className="text-[13px] text-pewter">
                    {entered} of {taking} entered
                    {changed.length > 0 ? `, ${changed.length} not saved yet` : ""}
                    {invalid ? `. Fix the marks in red: CA 0 to ${caMax}, exam 0 to ${examMax}.` : ""}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
