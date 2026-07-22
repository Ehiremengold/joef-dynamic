"use client";

import { useCallback, useEffect, useState } from "react";
import { CLASSES, type Class, type Student, type Subject } from "@/lib/types";

const YEARS = ["2024", "2025", "2026", "2027"];

function classLabel(c: Class): string {
  return `${c.campusName ?? "Campus"} · ${c.level}${c.arm ? c.arm : ""}`;
}

export default function RosterPanel({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [notice, setNotice] = useState<{ text: string; pin?: string } | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<Student | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      if (classFilter) params.set("className", classFilter);
      const res = await fetch(`/api/students?${params}`);
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      setStudents(d.students || []);
    } finally {
      setLoading(false);
    }
  }, [name, classFilter, onUnauthorized]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => (r.ok ? r.json() : { classes: [] }))
      .then((d) => setClasses(d.classes || []))
      .catch(() => {});
  }, []);

  /** Assign to a class (classId set) or clear the assignment (classId ""). */
  async function assignClass(s: Student, classId: string) {
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, action: "set-class", classId }),
    });
    if (res.status === 401) return onUnauthorized();
    if (res.ok) load();
  }

  async function resetPin(s: Student) {
    if (!window.confirm(`Reset ${s.fullName}'s PIN? Their old PIN stops working.`)) return;
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, action: "reset-pin" }),
    });
    const d = await res.json();
    if (res.ok) {
      setNotice({ text: `New PIN for ${s.fullName} (${s.admissionNumber}):`, pin: d.pin });
    }
  }

  async function toggleActive(s: Student) {
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, action: "set-active", active: !s.active }),
    });
    if (res.status === 401) return onUnauthorized();
    if (res.ok) load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <AddStudent onAdded={load} onUnauthorized={onUnauthorized} onPin={setNotice} />

      {/* min-w-0 lets the table's overflow-x-auto actually scroll instead of
          stretching the grid column past the viewport on mobile. */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Student roster</h2>
        </div>

        {notice && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-green bg-brand-green/10 px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {notice.text}{" "}
              {notice.pin && <span className="font-display text-lg text-brand-green">{notice.pin}</span>}
              <span className="ml-2 font-normal text-graphite">Write this down — it won&rsquo;t be shown again.</span>
            </p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="cursor-pointer text-sm font-semibold text-graphite hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          >
            <option value="">All classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-card border border-smoke bg-white">
          {loading ? (
            <p className="p-6 text-sm text-graphite">Loading…</p>
          ) : students.length === 0 ? (
            <p className="p-6 text-sm text-graphite">No students yet — add one on the left.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                  <th className="px-4 py-3 font-semibold">Admission no.</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-smoke last:border-0">
                    <td className="px-4 py-3 font-mono text-[13px]">{s.admissionNumber}</td>
                    <td className="px-4 py-3 font-semibold">{s.fullName}</td>
                    <td className="px-4 py-3">
                      <select
                        value={s.classId ?? ""}
                        onChange={(e) => assignClass(s, e.target.value)}
                        aria-label={`Class for ${s.fullName}`}
                        className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1.5 text-[13px] outline-none focus:border-brand-navy"
                      >
                        <option value="">Unassigned · {s.className}</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{classLabel(c)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">{s.entryYear}</td>
                    <td className="px-4 py-3">
                      {s.active ? (
                        <span className="text-brand-green">Active</span>
                      ) : (
                        <span className="text-pewter">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => resetPin(s)}
                          className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                        >
                          Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(s)}
                          className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline"
                        >
                          {s.active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubjectsFor(s)}
                          disabled={!s.classId}
                          className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                          title={s.classId ? undefined : "Assign a class first"}
                        >
                          Subjects
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {subjectsFor && (
        <SubjectExemptions
          student={subjectsFor}
          onClose={() => setSubjectsFor(null)}
          onUnauthorized={onUnauthorized}
        />
      )}
    </div>
  );
}

/** Lets staff mark which of the student's class subjects they are NOT taking. */
function SubjectExemptions({
  student,
  onClose,
  onUnauthorized,
}: {
  student: Student;
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exemptIds, setExemptIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [subjRes, exRes] = await Promise.all([
          fetch(`/api/classes/${student.classId}/subjects`),
          fetch(`/api/students/${student.id}/subject-exemptions`),
        ]);
        if (subjRes.status === 401 || exRes.status === 401) return onUnauthorized();
        const subjData = await subjRes.json();
        const exData = await exRes.json();
        if (cancelled) return;
        setSubjects(
          (subjData.subjects || []).map((cs: { subjectId: string; subjectName: string }) => ({
            id: cs.subjectId,
            name: cs.subjectName,
          }))
        );
        setExemptIds(new Set(exData.subjectIds || []));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [student.classId, student.id, onUnauthorized]);

  function toggle(id: string) {
    setExemptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${student.id}/subject-exemptions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: Array.from(exemptIds) }),
      });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-[420px] rounded-card border border-smoke bg-white p-6">
        <h3 className="font-display text-lg font-bold tracking-tight">
          {student.fullName}&rsquo;s subjects
        </h3>
        <p className="mt-1 text-[13px] text-pewter">
          Untick any subject this student isn&rsquo;t offering, it will be left off their report card.
        </p>

        <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-graphite">Loading…</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-graphite">This class has no subjects assigned yet.</p>
          ) : (
            subjects.map((subj) => (
              <label key={subj.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!exemptIds.has(subj.id)}
                  onChange={() => toggle(subj.id)}
                  className="cursor-pointer"
                />
                {subj.name}
              </label>
            ))
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="cursor-pointer rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddStudent({
  onAdded,
  onUnauthorized,
  onPin,
}: {
  onAdded: () => void;
  onUnauthorized: () => void;
  onPin: (n: { text: string; pin: string }) => void;
}) {
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("JS1");
  const [entryYear, setEntryYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admissionNumber, fullName, className, entryYear }),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not add student");
      onPin({
        text: `${fullName} added. Admission ${admissionNumber}, PIN:`,
        pin: d.pin,
      });
      setAdmissionNumber("");
      setFullName("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="h-fit rounded-card border border-smoke bg-white p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Add student</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-pewter">
        A 6-digit PIN is generated. Give the admission number + PIN to the
        student, they use it to sign in and take class tests.
      </p>

      <label className="mt-5 block text-sm font-semibold" htmlFor="s-adm">Admission number</label>
      <input
        id="s-adm"
        type="text"
        value={admissionNumber}
        onChange={(e) => setAdmissionNumber(e.target.value)}
        placeholder="e.g. JDC/2026/041"
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="s-name">Full name</label>
      <input
        id="s-name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="e.g. Chidera Okafor"
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold" htmlFor="s-class">Class</label>
          <select
            id="s-class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="s-year">Entry year</label>
          <select
            id="s-year"
            value={entryYear}
            onChange={(e) => setEntryYear(e.target.value)}
            className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={busy || !admissionNumber.trim() || !fullName.trim()}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add student"}
      </button>
    </form>
  );
}
