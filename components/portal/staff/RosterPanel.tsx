"use client";

import { useCallback, useEffect, useState } from "react";
import { CLASSES, type Student } from "@/lib/types";

const YEARS = ["2024", "2025", "2026", "2027"];

export default function RosterPanel({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [notice, setNotice] = useState<{ text: string; pin?: string } | null>(null);

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

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Student roster</h2>
        </div>

        {notice && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-brand-green bg-brand-green/10 px-4 py-3">
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
                    <td className="px-4 py-3">{s.className}</td>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
        student — they use it to sign in and take class tests.
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
