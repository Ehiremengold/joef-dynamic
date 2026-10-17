"use client";

import { classLabel } from "@/lib/classes";
import { useEffect, useState } from "react";
import { ApiError, EDITABLE, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import type { ChangeRequest } from "@/lib/recordChanges";
import { CLASSES, type AcademicSession, type Campus, type Class, type SignedInStaff, type Student, type Subject, type Term } from "@/lib/types";
import EditRecordDialog from "./EditRecordDialog";
import DeleteStudentDialog from "./DeleteStudentDialog";
import Pagination from "./Pagination";
import { usePagedList } from "./usePagedList";
import { useConfirm } from "./useConfirm";


// Tighter than the other staff tables, because this one has the most columns.
// The outer cells keep a 16px inset from the card's rounded corners.
const HEAD = "px-3 py-3 font-semibold first:pl-4 last:pr-4";
const CELL = "px-3 py-2.5 first:pl-4 last:pr-4";

type RosterFilters = {
  campusId: string;
  /** "level:JS1" (that level on every campus) or "class:<id>" (one class). */
  classKey: string;
  status: "" | "active" | "inactive";
  year: string;
  sessionId: string;
  termId: string;
};
const NO_FILTERS: RosterFilters = { campusId: "", classKey: "", status: "", year: "", sessionId: "", termId: "" };

/** The roster filters as /api/students query parameters. */
function toQuery(f: RosterFilters): Record<string, string> {
  return {
    campusId: f.campusId,
    className: f.classKey.startsWith("level:") ? f.classKey.slice(6) : "",
    classId: f.classKey.startsWith("class:") ? f.classKey.slice(6) : "",
    status: f.status,
    year: f.year,
    sessionId: f.sessionId,
    termId: f.termId,
  };
}

/** Years students can have joined in: each session's first year, newest first. */
const entryYears = (sessions: AcademicSession[]) =>
  [...new Set(sessions.map((x) => x.name.slice(0, 4)))].sort().reverse();

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[13px] font-semibold text-graphite">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:bg-mist disabled:text-pewter"
      >
        {children}
      </select>
    </label>
  );
}


export default function RosterPanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const admin = isAdmin(me.role);
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const labelForClass = (s: Student) => {
    const cls = classes.find((c) => c.id === s.classId);
    return cls ? classLabel(cls) : s.className;
  };
  // Students with an edit waiting for a super admin, so it isn't asked for twice.
  const pending = useApi<{ requests: ChangeRequest[] }>(admin ? "/api/change-requests?pending=1" : null, onUnauthorized);
  const pendingFor = new Set(
    (pending.data?.requests ?? []).filter((r) => r.recordType === "student" && r.status === "pending").map((r) => r.recordId)
  );
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const setFilter = (patch: Partial<RosterFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const [notice, setNotice] = useState<{ text: string; pin?: string } | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<Student | null>(null);
  const { rows: students, total, page, setPage, loading, reload, response } = usePagedList<Student>({
    url: "/api/students",
    rowsKey: "students",
    filters: { name: name.trim(), ...toQuery(filters) },
    onUnauthorized,
  });

  const classes = useApi<{ classes: Class[] }>("/api/classes", onUnauthorized).data?.classes ?? [];
  const campuses = useApi<{ campuses: Campus[] }>("/api/campuses", onUnauthorized).data?.campuses ?? [];
  const sessions = useApi<{ sessions: AcademicSession[] }>("/api/sessions", onUnauthorized).data?.sessions ?? [];
  const terms = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized).data?.terms ?? [];
  const filtered = name.trim() !== "" || JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  /** Assign to a class (classId set) or clear the assignment (classId ""). */
  async function assignClass(s: Student, classId: string) {
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, action: "set-class", classId }),
    });
    if (res.status === 401) return onUnauthorized();
    if (res.ok) reload();
  }

  async function resetPin(s: Student) {
    const ok = await confirm({
      title: `Reset ${s.fullName}'s PIN?`,
      message: "Their old PIN stops working straight away, and you'll be shown the new one once.",
      confirmLabel: "Reset PIN",
    });
    if (!ok) return;
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
    if (res.ok) reload();
  }

  // Side by side only where every roster column fits beside the form (about
  // 1290px wide); below that the form goes on top and the table takes the row.
  return (
    <div className="grid gap-8 min-[1340px]:grid-cols-[300px_1fr]">
      {dialog}
      {/* The roster is A–Z, so a new student rarely lands on the page in view:
          search for them, which puts them on screen under their PIN. */}
      <AddStudent
        campuses={campuses}
        classes={classes}
        sessions={sessions}
        onAdded={(fullName) => {
          setName(fullName);
          reload();
        }}
        onUnauthorized={onUnauthorized}
        onPin={setNotice}
      />

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
              {notice.pin && <span className="ml-2 font-normal text-graphite">Write this down. It won&rsquo;t be shown again.</span>}
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

        <div data-tour="students-search" className="mt-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FilterSelect
              label="Campus"
              value={filters.campusId}
              // A class from another campus no longer applies.
              onChange={(campusId) => setFilter({ campusId, classKey: filters.classKey.startsWith("class:") ? "" : filters.classKey })}
            >
              <option value="">All campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Class" value={filters.classKey} onChange={(classKey) => setFilter({ classKey })}>
              <option value="">All classes</option>
              {filters.campusId
                ? classes
                    .filter((c) => c.campusId === filters.campusId)
                    .map((c) => (
                      <option key={c.id} value={`class:${c.id}`}>{classLabel(c)}</option>
                    ))
                : CLASSES.map((c) => (
                    <option key={c} value={`level:${c}`}>{c}, every campus</option>
                  ))}
            </FilterSelect>
            <FilterSelect label="Status" value={filters.status} onChange={(status) => setFilter({ status })}>
              <option value="">Active and inactive</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive (left)</option>
            </FilterSelect>
            <FilterSelect label="Entry year" value={filters.year} onChange={(year) => setFilter({ year })}>
              <option value="">Any year</option>
              {entryYears(sessions).map((y) => (
                <option key={y} value={y}>Joined in {y}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="In school during"
              value={filters.sessionId}
              onChange={(sessionId) => setFilter({ sessionId, termId: "" })}
            >
              <option value="">Any session</option>
              {[...sessions]
                .sort((a, b) => b.name.localeCompare(a.name))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.isCurrent ? " (current)" : ""}
                  </option>
                ))}
            </FilterSelect>
            <FilterSelect
              label="Term"
              value={filters.termId}
              disabled={!filters.sessionId}
              onChange={(termId) => setFilter({ termId })}
            >
              <option value="">{filters.sessionId ? "Any term of the session" : "Choose a session first"}</option>
              {terms
                .filter((t) => t.sessionId === filters.sessionId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isCurrent ? " (current)" : ""}
                  </option>
                ))}
            </FilterSelect>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-pewter">
            <span aria-live="polite">
              {loading ? "Searching…" : `${total} student${total === 1 ? "" : "s"}`}
              {response?.periodMatch === "at-school-now"
                ? " at school now (every active student)"
                : response?.periodMatch === "had-results"
                  ? ` with results recorded then${filters.campusId || filters.classKey ? ", in that class at the time" : ""}`
                  : ""}
              {response?.periodMatch === "at-school-now" && filters.status === "inactive" && (
                <span className="ml-1 text-ink">
                  The current session only lists students at school now, so nobody inactive appears. Choose &ldquo;Any session&rdquo; to see students who have left.
                </span>
              )}
            </span>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setName("");
                  setFilters(NO_FILTERS);
                }}
                className="cursor-pointer font-semibold text-brand-navy hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div data-tour="students-table" className="mt-4 overflow-x-auto rounded-card border border-smoke bg-white">
          {loading && students.length === 0 ? (
            <p className="p-6 text-sm text-graphite">Loading…</p>
          ) : students.length === 0 ? (
            <p className="p-6 text-sm text-graphite">
              {filtered ? "No students match these filters." : "No students yet."}
            </p>
          ) : (
            <table className={`w-full min-w-[640px] text-left text-sm transition-opacity duration-150 ${loading ? "opacity-60" : ""}`}>
              <thead>
                <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                  <th className={`whitespace-nowrap ${HEAD}`}>Admission no.</th>
                  <th className={HEAD}>Name</th>
                  <th className={HEAD}>Class</th>
                  <th className={HEAD}>Year</th>
                  <th className={HEAD}>Status</th>
                  <th className={HEAD}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-smoke last:border-0">
                    <td className={`whitespace-nowrap font-mono text-[13px] ${CELL}`}>{s.admissionNumber}</td>
                    <td className={`font-semibold ${CELL}`}>{s.fullName}</td>
                    <td className={CELL}>
                      <select
                        value={s.classId ?? ""}
                        onChange={(e) => assignClass(s, e.target.value)}
                        aria-label={`Class for ${s.fullName}`}
                        data-tour="student-class"
                        className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1.5 text-[13px] outline-none focus:border-brand-navy"
                      >
                        <option value="">Unassigned · {s.className}</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{classLabel(c)}</option>
                        ))}
                      </select>
                    </td>
                    <td className={CELL}>{s.entryYear}</td>
                    <td className={CELL}>
                      {s.active ? (
                        <span className="text-brand-green">Active</span>
                      ) : (
                        <span className="text-pewter">Inactive</span>
                      )}
                    </td>
                    <td className={CELL}>
                      <div className="flex gap-3 whitespace-nowrap">
                        {admin &&
                          (pendingFor.has(s.id) ? (
                            <span className="rounded-btn bg-brand-gold/30 px-1.5 py-0.5 text-[12px] font-semibold text-ink" title="Waiting for a super admin">
                              Change pending
                            </span>
                          ) : (
                            <button
                              type="button"
                              data-tour="student-edit"
                              onClick={() => setEditing(s)}
                              className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                            >
                              Edit
                            </button>
                          ))}
                        <button
                          type="button"
                          data-tour="student-pin"
                          onClick={() => resetPin(s)}
                          className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                        >
                          Reset PIN
                        </button>
                        <button
                          type="button"
                          data-tour="student-active"
                          onClick={() => toggleActive(s)}
                          className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline"
                        >
                          {s.active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          data-tour="student-subjects"
                          onClick={() => setSubjectsFor(s)}
                          disabled={!s.classId}
                          className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                          title={s.classId ? undefined : "Assign a class first"}
                        >
                          Subjects
                        </button>
                        {admin && !pendingFor.has(s.id) && (
                          <button
                            type="button"
                            data-tour="student-delete"
                            onClick={() => setDeleting(s)}
                            className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline"
                          >
                            Delete
                          </button>
                        )}
                        <a
                          data-tour="student-transcript"
                          href={`/api/students/${s.id}/transcript`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                        >
                          Transcript
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={total} onPage={setPage} />
      </div>

      {deleting && (
        <DeleteStudentDialog
          student={deleting}
          classLabel={labelForClass(deleting)}
          superAdmin={isSuperAdmin(me.role)}
          onClose={() => setDeleting(null)}
          onUnauthorized={onUnauthorized}
          onDone={(applied) => {
            setNotice({
              text: applied
                ? `${deleting.fullName} (${deleting.admissionNumber}) has been deleted.`
                : `Deletion of ${deleting.fullName} sent to a super admin for approval.`,
            });
            setDeleting(null);
            invalidate("/api/students", "/api/change-requests", "/api/classes/*");
          }}
        />
      )}
      {editing && (
        <EditRecordDialog
          recordType="student"
          recordId={editing.id}
          title={`Edit ${editing.fullName}`}
          initial={{
            fullName: editing.fullName,
            admissionNumber: editing.admissionNumber,
            gender: editing.gender,
            dateOfBirth: editing.dateOfBirth,
            phone: editing.phone,
            address: editing.address,
            entryYear: editing.entryYear,
          }}
          superAdmin={isSuperAdmin(me.role)}
          onClose={() => setEditing(null)}
          onUnauthorized={onUnauthorized}
          onDone={(applied) => {
            setNotice({
              text: applied
                ? `${editing.fullName}'s details are saved.`
                : `Change to ${editing.fullName} sent to a super admin for approval.`,
            });
            setEditing(null);
            invalidate("/api/students", "/api/change-requests");
          }}
        />
      )}
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
  const invalidate = useInvalidate();
  const exemptionsUrl = `/api/students/${student.id}/subject-exemptions`;
  const subjectsQ = useApi<{ subjects: { subjectId: string; subjectName: string }[] }>(
    student.classId ? `/api/classes/${student.classId}/subjects` : null,
    onUnauthorized
  );
  const exemptionsQ = useApi<{ subjectIds: string[] }>(exemptionsUrl, onUnauthorized, EDITABLE);
  const subjects: Pick<Subject, "id" | "name">[] = (subjectsQ.data?.subjects ?? []).map((cs) => ({
    id: cs.subjectId,
    name: cs.subjectName,
  }));
  const loading = (Boolean(student.classId) && subjectsQ.isPending) || exemptionsQ.isPending;
  const [exemptIds, setExemptIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exemptionsQ.data) setExemptIds(new Set(exemptionsQ.data.subjectIds || []));
  }, [exemptionsQ.data]);

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
      if (res.ok) {
        await invalidate(exemptionsUrl);
        onClose();
      }
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

type Similar = { admissionNumber: string; fullName: string; className: string; active: boolean };

function AddStudent({
  campuses,
  classes,
  sessions,
  onAdded,
  onUnauthorized,
  onPin,
}: {
  campuses: Campus[];
  classes: Class[];
  sessions: AcademicSession[];
  onAdded: (fullName: string) => void;
  onUnauthorized: () => void;
  onPin: (n: { text: string; pin: string }) => void;
}) {
  const { confirm, dialog } = useConfirm();
  const invalidate = useInvalidate();
  const next = useApi<{ admissionNumber: string }>("/api/students/next-number", onUnauthorized).data?.admissionNumber;
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [campusId, setCampusId] = useState("");
  const [classId, setClassId] = useState("");
  const [chosenYear, setEntryYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // New students join the current session: its first year, unless changed.
  const currentYear = sessions.find((x) => x.isCurrent)?.name.slice(0, 4) ?? String(new Date().getFullYear());
  const entryYear = chosenYear || currentYear;
  const years = [...new Set([...entryYears(sessions), currentYear])].sort().reverse();
  const campusClasses = classes.filter((c) => c.campusId === campusId);

  async function add(confirmDuplicate: boolean): Promise<void> {
    let d: { student: Student; pin: string };
    try {
      d = await sendJson("/api/students", "POST", { admissionNumber, fullName, classId, entryYear, confirmDuplicate });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      if (!(e instanceof ApiError && e.status === 409 && Array.isArray(e.body?.similar))) throw e;
      const list = e.body.similar as Similar[];
      const ok = await confirm({
        title: "Is this student already in the portal?",
        message: (
          <>
            <p>These students have a similar name:</p>
            <ul className="mt-2 list-disc pl-5">
              {list.map((x) => (
                <li key={x.admissionNumber}>
                  {x.fullName} ({x.admissionNumber}, {x.className}
                  {x.active ? "" : ", inactive"})
                </li>
              ))}
            </ul>
            <p className="mt-2">
              If it&rsquo;s the same child, don&rsquo;t add them again: put them in their new class from the roster, or
              promote them from the Promotion tab.
            </p>
          </>
        ),
        confirmLabel: "Add as a new student",
      });
      if (ok) return add(true);
      return;
    }
    onPin({ text: `${d.student.fullName} added. Admission ${d.student.admissionNumber}, PIN:`, pin: d.pin });
    setAdmissionNumber("");
    setFullName("");
    invalidate("/api/students/next-number");
    onAdded(d.student.fullName);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await add(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add student");
    } finally {
      setBusy(false);
    }
  }

  const FIELD = "mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy";

  return (
    <form data-tour="students-add" onSubmit={submit} className="h-fit rounded-card border border-smoke bg-white p-6">
      {dialog}
      <h2 className="font-display text-xl font-bold tracking-tight">Add student</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-pewter">
        A 6-digit PIN is generated. Give the admission number + PIN to the
        student, they use it to sign in and take class tests.
      </p>

      <label className="mt-5 block text-sm font-semibold" htmlFor="s-name">Full name</label>
      <input
        id="s-name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="e.g. Chidera Okafor"
        className={FIELD}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold" htmlFor="s-campus">Campus</label>
          <select
            id="s-campus"
            value={campusId}
            onChange={(e) => {
              setCampusId(e.target.value);
              setClassId("");
            }}
            className={`${FIELD} cursor-pointer bg-white`}
          >
            <option value="">Choose…</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="s-class">Class</label>
          <select
            id="s-class"
            value={classId}
            disabled={!campusId}
            onChange={(e) => setClassId(e.target.value)}
            className={`${FIELD} cursor-pointer bg-white disabled:cursor-not-allowed disabled:bg-mist`}
          >
            <option value="">{campusId ? "Choose…" : "Campus first"}</option>
            {campusClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.level}
                {c.arm ? ` ${c.arm}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold" htmlFor="s-adm">
            Admission no. <span className="font-normal text-pewter">(optional)</span>
          </label>
          <input
            id="s-adm"
            type="text"
            value={admissionNumber}
            onChange={(e) => setAdmissionNumber(e.target.value)}
            placeholder={next ?? "Next number"}
            className={FIELD}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="s-year">Entry year</label>
          <select
            id="s-year"
            value={entryYear}
            onChange={(e) => setEntryYear(e.target.value)}
            className={`${FIELD} cursor-pointer bg-white`}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-1.5 text-[12px] text-pewter">
        {admissionNumber.trim() ? "Typed numbers are tidied, e.g. “jdcl - 1070” becomes JDCL-01070." : `Leave empty to use the next number${next ? `, ${next}` : ""}.`}
      </p>

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={busy || !fullName.trim() || !classId}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add student"}
      </button>
    </form>
  );
}
