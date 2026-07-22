"use client";

import { useCallback, useEffect, useState } from "react";
import type { AcademicSession, Class, StaffRole, Term } from "@/lib/types";

type Me = { id: string; fullName: string; role: StaffRole; email: string };

type AttendanceRow = { studentId: string; fullName: string; admissionNumber: string; daysPresent: number };

function classLabel(c: Class): string {
  return `${c.campusName ?? "Campus"} · ${c.level}${c.arm ? c.arm : ""}`;
}

export default function AttendancePanel({
  me,
  onUnauthorized,
}: {
  me: Me;
  onUnauthorized: () => void;
}) {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [totalDays, setTotalDays] = useState(0);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showTermAdmin, setShowTermAdmin] = useState(false);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [sRes, tRes, cRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/terms"),
        fetch("/api/classes"),
      ]);
      if ([sRes, tRes, cRes].some((r) => r.status === 401)) return onUnauthorized();
      const [s, t, c] = await Promise.all([sRes.json(), tRes.json(), cRes.json()]);
      setSessions(s.sessions || []);
      const allTerms: Term[] = t.terms || [];
      setTerms(allTerms);
      const myClasses: Class[] =
        me.role === "admin" ? c.classes || [] : (c.classes || []).filter((cl: Class) => cl.classTeacherId === me.id);
      setClasses(myClasses);

      setTermId((prev) => prev || allTerms.find((term) => term.isCurrent)?.id || allTerms[0]?.id || "");
      setClassId((prev) => prev || myClasses[0]?.id || "");
    } finally {
      setLoadingLists(false);
    }
  }, [me.id, me.role, onUnauthorized]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const loadSheet = useCallback(async () => {
    if (!termId || !classId) return;
    setLoadingSheet(true);
    setError("");
    try {
      const res = await fetch(`/api/classes/${classId}/attendance?termId=${termId}`);
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load attendance");
      setTotalDays(d.totalDays ?? 0);
      setRows(d.students || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load attendance");
    } finally {
      setLoadingSheet(false);
    }
  }, [termId, classId, onUnauthorized]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  function setDaysPresent(studentId: string, value: number) {
    // Never negative; and never above the total school days once that's been set
    // (totalDays 0 = not entered yet, so don't cap to zero and block typing).
    let next = Math.max(0, value);
    if (totalDays > 0) next = Math.min(next, totalDays);
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, daysPresent: next } : r)));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/classes/${classId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId,
          totalDays,
          students: rows.map((r) => ({ studentId: r.studentId, daysPresent: r.daysPresent })),
        }),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save attendance");
      setNotice("Attendance saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loadingLists) return <p className="text-sm text-graphite">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight">Attendance</h2>
        {me.role === "admin" && (
          <button
            type="button"
            onClick={() => setShowTermAdmin((v) => !v)}
            className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
          >
            {showTermAdmin ? "Hide session/term setup" : "Manage sessions & terms"}
          </button>
        )}
      </div>

      {showTermAdmin && me.role === "admin" && (
        <TermAdmin
          sessions={sessions}
          terms={terms}
          onChanged={loadLists}
          onUnauthorized={onUnauthorized}
        />
      )}

      {classes.length === 0 ? (
        <p className="text-sm text-graphite">
          {me.role === "admin"
            ? "No classes yet, add one under the Classes tab."
            : "You are not assigned as a class teacher for any class yet."}
        </p>
      ) : terms.length === 0 ? (
        <p className="text-sm text-graphite">No terms set up yet. Ask an admin to add one above.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="att-term">Term</label>
              <select
                id="att-term"
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.sessionName}
                    {t.isCurrent ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="att-class">Class</label>
              <select
                id="att-class"
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
                type="number"
                min={0}
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
                className="mt-1 w-32 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
              />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-brand-red" role="alert">{error}</p>}
          {notice && <p className="text-sm font-semibold text-brand-green">{notice}</p>}

          <div className="min-w-0 overflow-x-auto rounded-card border border-smoke bg-white">
            {loadingSheet ? (
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
              onClick={save}
              disabled={saving || loadingSheet}
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

const TERM_NAMES: Term["name"][] = ["First Term", "Second Term", "Third Term"];

function TermAdmin({
  sessions,
  terms,
  onChanged,
  onUnauthorized,
}: {
  sessions: AcademicSession[];
  terms: Term[];
  onChanged: () => void;
  onUnauthorized: () => void;
}) {
  const [sessionName, setSessionName] = useState("");
  const [termSessionId, setTermSessionId] = useState("");
  const [termName, setTermName] = useState<Term["name"]>("First Term");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sessionName }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not add session");
      setSessionName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add session");
    } finally {
      setBusy(false);
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: termSessionId, name: termName }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not add term");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add term");
    } finally {
      setBusy(false);
    }
  }

  async function makeCurrent(term: Term) {
    const res = await fetch("/api/terms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: term.id, action: "set-current" }),
    });
    if (res.status === 401 || res.status === 403) return onUnauthorized();
    if (res.ok) onChanged();
  }

  return (
    <div className="rounded-card border border-smoke bg-white p-4">
      {error && <p className="mb-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}

      <form onSubmit={addSession} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="sess-name">New session</label>
          <input
            id="sess-name"
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="e.g. 2025/2026"
            className="mt-1 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
          />
        </div>
        <button
          type="submit"
          disabled={busy || sessionName.trim().length < 4}
          className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add session
        </button>
      </form>

      <form onSubmit={addTerm} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="term-session">Session</label>
          <select
            id="term-session"
            value={termSessionId}
            onChange={(e) => setTermSessionId(e.target.value)}
            className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
          >
            <option value="">Choose session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="term-name">Term</label>
          <select
            id="term-name"
            value={termName}
            onChange={(e) => setTermName(e.target.value as Term["name"])}
            className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
          >
            {TERM_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !termSessionId}
          className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add term
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {terms.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => makeCurrent(t)}
            disabled={t.isCurrent}
            className={`cursor-pointer rounded-btn border px-3 py-1.5 text-[13px] font-semibold disabled:cursor-default ${
              t.isCurrent
                ? "border-brand-gold bg-brand-gold/20 text-ink"
                : "border-smoke text-graphite hover:border-brand-navy"
            }`}
          >
            {t.name} · {t.sessionName}
            {t.isCurrent ? " (current)" : " — make current"}
          </button>
        ))}
      </div>
    </div>
  );
}
