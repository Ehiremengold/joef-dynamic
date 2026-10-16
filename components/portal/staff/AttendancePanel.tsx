"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiKey, EDITABLE, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import { isAdmin } from "@/lib/roles";
import type { Class, SignedInStaff, Term } from "@/lib/types";

type AttendanceRow = { studentId: string; fullName: string; admissionNumber: string; daysPresent: number };

function classLabel(c: Class): string {
  return `${c.campusName ?? "Campus"} · ${c.level}${c.arm ? c.arm : ""}`;
}

export default function AttendancePanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  const termsQ = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized);
  const classesQ = useApi<{ classes: Class[] }>("/api/classes", onUnauthorized);
  const [chosenTerm, setTermId] = useState("");
  const [chosenClass, setClassId] = useState("");
  // Unsaved typing for the sheet on screen; until there is some, the saved
  // sheet from the cache is shown as it is — no blank frame on the way in.
  const [edits, setEdits] = useState<{ url: string; totalDays: number; rows: AttendanceRow[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const terms = termsQ.data?.terms ?? [];
  const classes = (classesQ.data?.classes ?? []).filter((c) => isAdmin(me.role) || c.classTeacherId === me.id);
  const termId = chosenTerm || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || "";
  const classId = chosenClass || classes[0]?.id || "";

  const sheetUrl = termId && classId ? `/api/classes/${classId}/attendance?termId=${termId}` : null;
  const sheet = useApi<{ totalDays: number; students: AttendanceRow[] }>(sheetUrl, onUnauthorized, EDITABLE);

  const editing = edits && edits.url === sheetUrl ? edits : null;
  const totalDays = editing?.totalDays ?? sheet.data?.totalDays ?? 0;
  const rows = editing?.rows ?? sheet.data?.students ?? [];
  const edit = (patch: Partial<{ totalDays: number; rows: AttendanceRow[] }>) =>
    sheetUrl && setEdits({ url: sheetUrl, totalDays, rows, ...patch });
  const setTotalDays = (n: number) => edit({ totalDays: n });

  useEffect(() => {
    setNotice("");
  }, [sheetUrl]);

  function setDaysPresent(studentId: string, value: number) {
    // Never negative; and never above the total school days once that's been set
    // (totalDays 0 = not entered yet, so don't cap to zero and block typing).
    let next = Math.max(0, value);
    if (totalDays > 0) next = Math.min(next, totalDays);
    edit({ rows: rows.map((r) => (r.studentId === studentId ? { ...r, daysPresent: next } : r)) });
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await sendJson(`/api/classes/${classId}/attendance`, "PUT", {
        termId,
        totalDays,
        students: rows.map((r) => ({ studentId: r.studentId, daysPresent: r.daysPresent })),
      });
      // What was typed is now what is saved: put it in the cache and drop the edits.
      if (sheetUrl) client.setQueryData(apiKey(sheetUrl), { totalDays, students: rows });
      setEdits(null);
      invalidate(`/api/classes/${classId}/attendance`);
      setNotice("Attendance saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (termsQ.isPending || classesQ.isPending) return <p className="text-sm text-graphite">Loading…</p>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Attendance</h2>

      {classes.length === 0 ? (
        <p className="text-sm text-graphite">
          {isAdmin(me.role)
            ? "No classes yet, add one under the Classes tab."
            : "You are not assigned as a class teacher for any class yet."}
        </p>
      ) : terms.length === 0 ? (
        <p className="text-sm text-graphite">
          No terms set up yet.{" "}
          {isAdmin(me.role) ? "Add one under the Sessions & terms tab." : "Ask an admin to add one under Sessions & terms."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="att-term">Term</label>
              <select
                id="att-term"
                data-tour="att-term"
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
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
              <label className="block text-[13px] font-semibold" htmlFor="att-class">Class</label>
              <select
                id="att-class"
                data-tour="att-class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="att-total">Total school days</label>
              <input
                id="att-total"
                data-tour="att-total"
                type="number"
                min={0}
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
                className="mt-1 w-32 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
              />
            </div>
          </div>

          {(error || sheet.error) && (
            <p className="text-sm font-semibold text-brand-red" role="alert">{error || sheet.error?.message}</p>
          )}
          {notice && <p className="text-sm font-semibold text-brand-green">{notice}</p>}

          <div data-tour="att-table" className="min-w-0 overflow-x-auto rounded-card border border-smoke bg-white">
            {sheet.isPending ? (
              <p className="p-6 text-sm text-graphite">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-graphite">No active students assigned to this class.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                    <th className="px-4 py-3 font-semibold">Admission no.</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Days present</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId} className="border-b border-smoke last:border-0">
                      <td className="px-4 py-3 font-mono text-[13px]">{r.admissionNumber}</td>
                      <td className="px-4 py-3 font-semibold">{r.fullName}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={totalDays || undefined}
                          value={r.daysPresent}
                          onChange={(e) => setDaysPresent(r.studentId, Number(e.target.value))}
                          className="w-24 rounded-btn border border-smoke px-2 py-1.5 text-sm outline-none focus:border-brand-navy"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {rows.length > 0 && (
            <button
              type="button"
              data-tour="att-save"
              onClick={save}
              disabled={saving || sheet.isPending}
              className="cursor-pointer rounded-btn bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save attendance"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
