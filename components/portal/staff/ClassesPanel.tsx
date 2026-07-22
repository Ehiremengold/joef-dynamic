"use client";

import { useCallback, useEffect, useState } from "react";
import { CLASSES, type Campus, type Class, type ClassSubject, type Staff, type Subject } from "@/lib/types";

const DEPARTMENTS = [
  { value: "", label: "Core / general" },
  { value: "science", label: "Science" },
  { value: "art", label: "Art" },
  { value: "commercial", label: "Commercial" },
];

export default function ClassesPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, clRes, sRes, stRes] = await Promise.all([
        fetch("/api/campuses"),
        fetch("/api/classes"),
        fetch("/api/subjects"),
        fetch("/api/staff"),
      ]);
      if ([cRes, clRes, sRes, stRes].some((r) => r.status === 401 || r.status === 403)) {
        return onUnauthorized();
      }
      const [c, cl, s, st] = await Promise.all([cRes.json(), clRes.json(), sRes.json(), stRes.json()]);
      setCampuses(c.campuses || []);
      setClasses(cl.classes || []);
      setSubjects(s.subjects || []);
      setStaff(st.staff || []);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-graphite">Loading…</p>;

  return (
    <div className="space-y-10">
      {error && (
        <p className="text-sm font-semibold text-brand-red" role="alert">{error}</p>
      )}
      <CampusesSection campuses={campuses} onChanged={load} onUnauthorized={onUnauthorized} setError={setError} />
      <SubjectsSection subjects={subjects} onChanged={load} onUnauthorized={onUnauthorized} setError={setError} />
      <ClassesSection
        campuses={campuses}
        classes={classes}
        subjects={subjects}
        staff={staff}
        onChanged={load}
        onUnauthorized={onUnauthorized}
        setError={setError}
      />
    </div>
  );
}

function CampusesSection({
  campuses,
  onChanged,
  onUnauthorized,
  setError,
}: {
  campuses: Campus[];
  onChanged: () => void;
  onUnauthorized: () => void;
  setError: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/campuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not add campus");
      setName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add campus");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Campus) {
    if (!window.confirm(`Remove ${c.name} campus? This also removes its classes.`)) return;
    const res = await fetch(`/api/campuses/${c.id}`, { method: "DELETE" });
    if (res.status === 401 || res.status === 403) return onUnauthorized();
    if (res.ok) onChanged();
  }

  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-tight">Campuses</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {campuses.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-2 rounded-btn border border-smoke bg-white px-3 py-1.5 text-sm"
          >
            {c.name}
            <button
              type="button"
              onClick={() => remove(c)}
              className="cursor-pointer text-pewter hover:text-brand-red"
              aria-label={`Remove ${c.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {campuses.length === 0 && <p className="text-sm text-graphite">No campuses yet.</p>}
      </div>
      <form onSubmit={add} className="mt-3 flex max-w-sm gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ikoyi"
          className="flex-1 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
        />
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="cursor-pointer rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function SubjectsSection({
  subjects,
  onChanged,
  onUnauthorized,
  setError,
}: {
  subjects: Subject[];
  onChanged: () => void;
  onUnauthorized: () => void;
  setError: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, department: department || null }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not add subject");
      setName("");
      setDepartment("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add subject");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Subject) {
    if (!window.confirm(`Remove ${s.name} from the subject catalog?`)) return;
    const res = await fetch(`/api/subjects/${s.id}`, { method: "DELETE" });
    if (res.status === 401 || res.status === 403) return onUnauthorized();
    if (res.ok) onChanged();
  }

  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-tight">Subject catalog</h2>
      <p className="mt-1 text-[13px] text-pewter">
        Senior secondary science, art and commercial subjects all live here — tag each with its
        department, then add the ones a class offers below.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {subjects.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-2 rounded-btn border border-smoke bg-white px-3 py-1.5 text-sm"
          >
            {s.name}
            {s.department && <span className="text-[11px] uppercase text-pewter">{s.department}</span>}
            <button
              type="button"
              onClick={() => remove(s)}
              className="cursor-pointer text-pewter hover:text-brand-red"
              aria-label={`Remove ${s.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {subjects.length === 0 && <p className="text-sm text-graphite">No subjects yet.</p>}
      </div>
      <form onSubmit={add} className="mt-3 flex max-w-lg flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Biology"
          className="flex-1 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="cursor-pointer rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function ClassesSection({
  campuses,
  classes,
  subjects,
  staff,
  onChanged,
  onUnauthorized,
  setError,
}: {
  campuses: Campus[];
  classes: Class[];
  subjects: Subject[];
  staff: Staff[];
  onChanged: () => void;
  onUnauthorized: () => void;
  setError: (s: string) => void;
}) {
  const [campusId, setCampusId] = useState("");
  const [level, setLevel] = useState<string>(CLASSES[0]);
  const [arm, setArm] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campusId, level, arm: arm || null }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not add class");
      setArm("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add class");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Class) {
    if (!window.confirm(`Remove ${c.level}${c.arm ?? ""}? Students keep their old class name but lose this assignment.`)) return;
    const res = await fetch(`/api/classes/${c.id}`, { method: "DELETE" });
    if (res.status === 401 || res.status === 403) return onUnauthorized();
    if (res.ok) onChanged();
  }

  async function setTeacher(c: Class, classTeacherId: string) {
    const res = await fetch(`/api/classes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classTeacherId: classTeacherId || null }),
    });
    if (res.status === 401 || res.status === 403) return onUnauthorized();
    if (res.ok) onChanged();
  }

  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-tight">Classes &amp; arms</h2>
      <p className="mt-1 text-[13px] text-pewter">
        Add arms freely per campus — Ikoyi can run several arms per level, Obalende can run one.
        Assign each class a class teacher and the subjects it offers.
      </p>

      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="cls-campus">Campus</label>
          <select
            id="cls-campus"
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
          >
            <option value="">Choose campus</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="cls-level">Level</label>
          <select
            id="cls-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="cls-arm">Arm (optional)</label>
          <input
            id="cls-arm"
            type="text"
            value={arm}
            onChange={(e) => setArm(e.target.value)}
            placeholder="e.g. A"
            className="mt-1 w-24 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !campusId}
          className="cursor-pointer rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add class
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {classes.length === 0 && <p className="text-sm text-graphite">No classes yet.</p>}
        {classes.map((c) => (
          <div key={c.id} className="rounded-card border border-smoke bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {c.level}
                  {c.arm ? ` ${c.arm}` : ""} <span className="font-normal text-pewter">· {c.campusName}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-[13px] text-pewter" htmlFor={`teacher-${c.id}`}>Class teacher</label>
                <select
                  id={`teacher-${c.id}`}
                  value={c.classTeacherId ?? ""}
                  onChange={(e) => setTeacher(c, e.target.value)}
                  className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1.5 text-[13px] outline-none focus:border-brand-navy"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                >
                  {expanded === c.id ? "Hide subjects" : "Subjects"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
            {expanded === c.id && (
              <ClassSubjectsEditor
                classId={c.id}
                subjects={subjects}
                onUnauthorized={onUnauthorized}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ClassSubjectsEditor({
  classId,
  subjects,
  onUnauthorized,
}: {
  classId: string;
  subjects: Subject[];
  onUnauthorized: () => void;
}) {
  const [assigned, setAssigned] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}/subjects`);
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      setAssigned(d.subjects || []);
    } finally {
      setLoading(false);
    }
  }, [classId, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedIds = new Set(assigned.map((a) => a.subjectId));
  const available = subjects.filter((s) => !assignedIds.has(s.id));

  async function addSubject(subjectId: string) {
    if (!subjectId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/classes/${classId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      if (res.ok) await load();
    } finally {
      setAdding(false);
    }
  }

  async function removeSubject(subjectId: string) {
    const res = await fetch(`/api/classes/${classId}/subjects`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId }),
    });
    if (res.status === 401 || res.status === 403) return onUnauthorized();
    if (res.ok) await load();
  }

  return (
    <div className="mt-4 border-t border-smoke pt-4">
      {loading ? (
        <p className="text-sm text-graphite">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {assigned.length === 0 && <p className="text-sm text-graphite">No subjects assigned yet.</p>}
            {assigned.map((a) => (
              <span
                key={a.subjectId}
                className="flex items-center gap-2 rounded-btn border border-smoke bg-mist px-3 py-1.5 text-[13px]"
              >
                {a.subjectName}
                <button
                  type="button"
                  onClick={() => removeSubject(a.subjectId)}
                  className="cursor-pointer text-pewter hover:text-brand-red"
                  aria-label={`Remove ${a.subjectName}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {available.length > 0 && (
            <select
              value=""
              disabled={adding}
              onChange={(e) => addSubject(e.target.value)}
              className="mt-3 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy disabled:opacity-50"
            >
              <option value="">Add a subject…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}
