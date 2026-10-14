"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_COMMENT_LENGTH, RATINGS, TRAITS, type Rating, type Ratings, type TermReportRow } from "@/lib/reportCard";
import { isAdmin } from "@/lib/roles";
import type { Class, SignedInStaff, Term } from "@/lib/types";

function classLabel(c: Class): string {
  return `${c.campusName ?? "Campus"} · ${c.level}${c.arm ? c.arm : ""}`;
}

/**
 * Where a class teacher rates each student's "Effective Areas" and writes
 * their comment for a term; both print on the student's report sheet.
 * Only the class's own class teacher can edit. Admins can read every class.
 * A term lists the students who were in the class that term.
 */
export default function ReportCardsPanel({ me, onUnauthorized }: { me: SignedInStaff; onUnauthorized: () => void }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<TermReportRow[]>([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<{ ratings: Ratings; teacherComment: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [tRes, cRes] = await Promise.all([fetch("/api/terms"), fetch("/api/classes")]);
        if (tRes.status === 401 || cRes.status === 401) return onUnauthorized();
        const [t, c] = await Promise.all([tRes.json(), cRes.json()]);
        const allTerms: Term[] = t.terms || [];
        const visible: Class[] =
          isAdmin(me.role) ? c.classes || [] : (c.classes || []).filter((cl: Class) => cl.classTeacherId === me.id);
        setTerms(allTerms);
        setClasses(visible);
        setTermId(allTerms.find((term) => term.isCurrent)?.id || allTerms[allTerms.length - 1]?.id || "");
        // A teacher who is also an admin starts on their own class.
        setClassId(visible.find((cl) => cl.classTeacherId === me.id)?.id || visible[0]?.id || "");
      } finally {
        setLoading(false);
      }
    })();
  }, [me.id, me.role, onUnauthorized]);

  const loadReports = useCallback(async () => {
    if (!termId || !classId) return;
    setError("");
    const res = await fetch(`/api/classes/${classId}/reports?termId=${termId}`);
    if (res.status === 401) return onUnauthorized();
    const d = await res.json();
    if (!res.ok) return setError(d.error || "Could not load reports");
    setRows(d.students || []);
  }, [termId, classId, onUnauthorized]);

  useEffect(() => {
    setSelected("");
    setDraft(null);
    loadReports();
  }, [loadReports]);

  const cls = classes.find((c) => c.id === classId);
  const canEdit = cls?.classTeacherId === me.id;
  const student = rows.find((r) => r.studentId === selected);

  function open(row: TermReportRow) {
    setSelected(row.studentId);
    setDraft({ ratings: { ...row.ratings }, teacherComment: row.teacherComment });
    setNotice("");
    setError("");
  }

  async function save() {
    if (!draft || !student) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/classes/${classId}/reports`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId, studentId: student.studentId, ...draft }),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save");
      setRows((prev) =>
        prev.map((r) =>
          r.studentId === student.studentId
            ? { ...r, ...draft, teacherComment: draft.teacherComment.trim(), signedBy: d.signedBy }
            : r
        )
      );
      setNotice(`Saved ${student.fullName}'s report.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-graphite">Loading…</p>;
  if (classes.length === 0) {
    return (
      <p className="text-sm text-graphite">
        {isAdmin(me.role) ? "No classes yet, add one under the Classes tab." : "You are not assigned as a class teacher for any class yet."}
      </p>
    );
  }

  const selectStyle = "mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy";
  const isComplete = (r: TermReportRow) => Object.keys(r.ratings).length === TRAITS.length && r.teacherComment.trim() !== "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Report cards</h2>
        <p className="mt-1 text-[13px] text-pewter">
          Rate each student&rsquo;s effective areas and write your comment. Both print on their report sheet for the term;
          the principal&rsquo;s comment is added automatically from their results.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="rc-term">Term</label>
          <select id="rc-term" value={termId} onChange={(e) => setTermId(e.target.value)} className={selectStyle}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.sessionName}
                {t.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="rc-class">Class</label>
          <select id="rc-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={selectStyle}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{classLabel(c)}</option>
            ))}
          </select>
        </div>
      </div>

      {!canEdit && (
        <p className="rounded-card border border-smoke bg-white px-4 py-3 text-[13px] text-graphite">
          Read only — only this class&rsquo;s class teacher
          {cls?.classTeacherName ? ` (${cls.classTeacherName})` : ""} can write its reports.
        </p>
      )}
      {error && <p className="text-sm font-semibold text-brand-red" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-graphite">No active students assigned to this class.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="max-h-[640px] overflow-y-auto rounded-card border border-smoke bg-white p-2">
            {rows.map((r) => (
              <li key={r.studentId}>
                <button
                  type="button"
                  onClick={() => open(r)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-btn px-3 py-2 text-left text-sm ${
                    r.studentId === selected ? "bg-brand-navy text-white" : "hover:bg-mist"
                  }`}
                >
                  <span className="font-semibold">{r.fullName}</span>
                  {isComplete(r) && <span className={r.studentId === selected ? "text-white" : "text-brand-green"}>✓</span>}
                </button>
              </li>
            ))}
          </ul>

          {!student || !draft ? (
            <p className="text-sm text-graphite">Pick a student to {canEdit ? "write" : "read"} their report.</p>
          ) : (
            <div className="rounded-card border border-smoke bg-white p-6">
              <h3 className="font-display text-lg font-bold tracking-tight">{student.fullName}</h3>
              <p className="text-[13px] text-pewter">{student.admissionNumber}</p>

              <h4 className="mt-5 text-sm font-semibold">Effective areas</h4>
              <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {TRAITS.map((trait) => (
                  <label key={trait} className="flex items-center justify-between gap-3 text-sm">
                    {trait}
                    <select
                      value={draft.ratings[trait] ?? ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDraft((d) =>
                          d && {
                            ...d,
                            ratings: { ...d.ratings, [trait]: (e.target.value || undefined) as Rating | undefined },
                          }
                        )
                      }
                      className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1 text-[13px] outline-none focus:border-brand-navy disabled:cursor-default disabled:bg-mist"
                    >
                      <option value="">—</option>
                      {RATINGS.map((rating) => (
                        <option key={rating} value={rating}>{rating}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <label className="mt-5 block text-sm font-semibold" htmlFor="rc-comment">Teacher&rsquo;s comment</label>
              <textarea
                id="rc-comment"
                rows={4}
                maxLength={MAX_COMMENT_LENGTH}
                value={draft.teacherComment}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => d && { ...d, teacherComment: e.target.value })}
                className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy disabled:bg-mist"
              />
              <p className="text-right text-[12px] text-pewter">
                {draft.teacherComment.length}/{MAX_COMMENT_LENGTH}
              </p>

              {notice && <p className="mt-2 text-sm font-semibold text-brand-green">{notice}</p>}
              {canEdit && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="mt-3 cursor-pointer rounded-btn bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save report"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
