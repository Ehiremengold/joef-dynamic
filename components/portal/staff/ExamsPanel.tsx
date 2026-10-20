"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useApi, useInvalidate } from "@/lib/client/api";
import { formatExamTime, isoToLagosInput, lagosInputToIso } from "@/lib/lagosTime";
import { examStatus, nextStatusChange, opensLater, type ExamStatus } from "@/lib/examSchedule";
import { pageCount, pageRange } from "@/lib/paging";
import { parseQuestions } from "@/lib/questionParser";
import { examAccess, type ExamAccess } from "@/lib/roles";
import { CLASSES, type Exam, type SignedInStaff } from "@/lib/types";
import { useConfirm } from "./useConfirm";
import EntranceAccess from "./EntranceAccess";
import SendToScoresDialog from "./SendToScoresDialog";
import Pagination from "./Pagination";
import FilterSelect from "./FilterSelect";

/** Cookie-authenticated fetch; calls onUnauthorized on a 401 so the shell re-checks. */
type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What the card's switch says for each status. */
const SWITCH_LABEL: Record<ExamStatus, { label: string; className: string }> = {
  hidden: { label: "Hidden", className: "text-pewter" },
  scheduled: { label: "Scheduled", className: "text-brand-navy" },
  open: { label: "Open", className: "text-brand-green" },
  closed: { label: "Closed", className: "text-pewter" },
};

/**
 * The time to judge the exams' status by. A test's status changes by the
 * clock alone (a scheduled one opens), so the panel re-renders at the next
 * such moment rather than showing "Scheduled" until the list reloads.
 */
function useStatusClock(exams: Exam[]): number {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const now = Date.now();
  const next = nextStatusChange(exams, now);
  useEffect(() => {
    if (next === null) return;
    const wait = next - Date.now() + 500;
    // setTimeout can't wait longer than ~24 days; the page won't be open that long anyway.
    if (wait > 24 * 60 * 60_000) return;
    const t = setTimeout(rerender, Math.max(wait, 0));
    return () => clearTimeout(t);
  }, [next]);
  return now;
}

export default function ExamsPanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const invalidate = useInvalidate();
  const examsQ = useApi<{ exams: Exam[] }>("/api/exams", onUnauthorized);
  const exams = examsQ.data?.exams ?? [];
  const loading = examsQ.isPending;
  const error = examsQ.error?.message ?? "";

  const authFetch: AuthFetch = useCallback(
    async (url, init) => {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      });
      if (res.status === 401) {
        onUnauthorized();
        throw new Error("Your session has expired. Please sign in again");
      }
      return res;
    },
    [onUnauthorized]
  );

  const now = useStatusClock(exams);
  // "" means any; group is a class or "entrance", as the Students tab's class filter does.
  const [filters, setFilters] = useState<{ query: string; group: string; status: ExamStatus | "" }>({ query: "", group: "", status: "" });
  const [chosenPage, setPage] = useState(1);
  // A new filter starts again from page one.
  const setFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  // Filtered and paged here, not on the server like the Students tab: every
  // exam is already loaded (and cached), and there are tens, not thousands.
  const words = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = exams.filter(
    (e) =>
      words.every((w) => e.title.toLowerCase().includes(w)) &&
      (!filters.group || (filters.group === "entrance" ? e.type === "entrance" : e.type === "class" && e.className === filters.group)) &&
      (!filters.status || examStatus(e, now) === filters.status)
  );
  // An exam deleted from the last page leaves it empty: show the one before.
  const page = Math.min(chosenPage, pageCount(shown.length));
  const { from, to } = pageRange(page);

  // An exam change can change results too (a deleted exam, a cleared score).
  const reload = useCallback(() => {
    invalidate("/api/exams", "/api/attempts");
  }, [invalidate]);

  return (
    <div className="space-y-8">
      <EntranceAccess onUnauthorized={onUnauthorized} />
      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <CreateExam authFetch={authFetch} onCreated={reload} />
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight">All exams</h2>
        {error && <p className="mt-3 text-sm font-semibold text-brand-red">{error}</p>}
        {loading ? (
          <p className="mt-4 text-sm text-graphite">Loading…</p>
        ) : exams.length === 0 ? (
          <p className="mt-4 rounded-card border border-smoke bg-white p-6 text-sm text-graphite">
            No exams yet. Create your first one on the left.
          </p>
        ) : (
          <>
            <div data-tour="exams-filter" className="mt-4 space-y-3">
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilter({ query: e.target.value })}
                placeholder="Search by title"
                aria-label="Search exams by title"
                className="w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FilterSelect label="Class" value={filters.group} onChange={(group) => setFilter({ group })}>
                  <option value="">All classes</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="entrance">Common entrance</option>
                </FilterSelect>
                <FilterSelect label="Status" value={filters.status} onChange={(status) => setFilter({ status })}>
                  <option value="">Any status</option>
                  <option value="open">Open to students now</option>
                  <option value="scheduled">Scheduled (opens later)</option>
                  <option value="hidden">Hidden</option>
                  <option value="closed">Closed (past its closing time)</option>
                </FilterSelect>
              </div>
              <p className="text-[13px] text-pewter">
                {shown.length === exams.length
                  ? `${exams.length} exam${exams.length === 1 ? "" : "s"}`
                  : `${shown.length} of ${exams.length} exams match`}
              </p>
            </div>
            {shown.length === 0 ? (
              <p className="mt-4 rounded-card border border-smoke bg-white p-6 text-sm text-graphite">
                No exams match. Try another class, status or title.
              </p>
            ) : (
              <div data-tour="exams-list" className="mt-4 space-y-4">
                {shown.slice(from, to + 1).map((exam) => (
                  <ExamCard key={exam.id} exam={exam} now={now} authFetch={authFetch} onChanged={reload}
                  access={examAccess(me, exam)}
                  onRequested={() => invalidate("/api/deletion-requests")}
                  onUnauthorized={onUnauthorized}
                />
                ))}
              </div>
            )}
            <Pagination page={page} total={shown.length} onPage={setPage} />
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function CreateExam({
  authFetch,
  onCreated,
}: {
  authFetch: AuthFetch;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"entrance" | "class">("class");
  const [className, setClassName] = useState("JS1");
  const [durationMins, setDurationMins] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await authFetch("/api/exams", {
        method: "POST",
        body: JSON.stringify({ title, type, className, durationMins }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not create exam");
      setTitle("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create exam");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form data-tour="exams-new" onSubmit={submit} className="h-fit rounded-card border border-smoke bg-white p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">New exam</h2>

      <label className="mt-5 block text-sm font-semibold" htmlFor="exam-title">Title</label>
      <input
        id="exam-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. First Term Mathematics"
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="exam-type">Type</label>
      <select
        id="exam-type"
        value={type}
        onChange={(e) => setType(e.target.value as "entrance" | "class")}
        className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      >
        <option value="class">Class test (CBT)</option>
        <option value="entrance">Common entrance</option>
      </select>

      {type === "class" && (
        <>
          <label className="mt-4 block text-sm font-semibold" htmlFor="exam-class">Class</label>
          <select
            id="exam-class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </>
      )}

      <label className="mt-4 block text-sm font-semibold" htmlFor="exam-duration">
        Duration (minutes)
      </label>
      <input
        id="exam-duration"
        type="number"
        min={1}
        max={180}
        value={durationMins}
        onChange={(e) => setDurationMins(Number(e.target.value))}
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create exam"}
      </button>
      <p className="mt-3 text-[13px] leading-relaxed text-pewter">
        New exams start hidden. Add questions, then switch them on for students.
      </p>
    </form>
  );
}

function ExamCard({
  exam,
  now,
  authFetch,
  onChanged,
  access,
  onRequested,
  onUnauthorized,
}: {
  exam: Exam;
  /** The moment to judge its status by (see useStatusClock). */
  now: number;
  authFetch: AuthFetch;
  onChanged: () => void;
  access: ExamAccess;
  onRequested: () => void;
  onUnauthorized: () => void;
}) {
  const [panel, setPanel] = useState<"none" | "questions" | "sittings" | "schedule">("none");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialog } = useConfirm();

  /** Ask a super admin to delete this exam (no question) or one of its questions. */
  async function requestDeletion(questionIndex?: number) {
    const what = questionIndex === undefined ? `the exam "${exam.title}"` : `question ${questionIndex + 1}`;
    const answer = await confirm({
      title: questionIndex === undefined ? "Request deletion of this exam?" : `Request removal of question ${questionIndex + 1}?`,
      message: `It isn't yours, so a super admin will review your request before ${what} is deleted.`,
      confirmLabel: "Send request",
      reason: { label: "Why should it be deleted?", placeholder: "e.g. duplicate of question 3" },
    });
    if (!answer) return;
    const reason = answer.reason;
    setError("");
    setNotice("");
    const res = await authFetch("/api/deletion-requests", {
      method: "POST",
      body: JSON.stringify({ examId: exam.id, questionIndex, reason }),
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error || "Could not send the request");
    setNotice(`Request to delete ${what} sent to a super admin for approval.`);
    onRequested();
  }
  const open = panel === "questions";
  const status = examStatus(exam, now);

  /** Save a change to the exam; resolves to the exam as saved, or null if it wasn't. */
  async function update(patch: Record<string, unknown>): Promise<Exam | null> {
    setBusy(true);
    setError("");
    try {
      const res = await authFetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Update failed");
      onChanged();
      return d.exam as Exam;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete “${exam.title}”?`,
      message: `Its ${exam.questions.length} question${exam.questions.length === 1 ? "" : "s"} go with it. Results students have already got are kept.`,
      confirmLabel: "Delete exam",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await authFetch(`/api/exams/${exam.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-smoke bg-white">
      {dialog}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            className={`rounded-btn px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
              exam.type === "entrance" ? "bg-brand-gold text-ink" : "bg-brand-navy text-white"
            }`}
          >
            {exam.type === "entrance" ? "Entrance" : exam.className}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-bold tracking-tight">{exam.title}</p>
            <p className="text-[13px] text-graphite">
              {exam.questions.length} question{exam.questions.length === 1 ? "" : "s"} · {exam.durationMins} mins
            </p>
            <ScheduleStatus exam={exam} now={now} />
            {exam.active && exam.questions.length === 0 && (
              <p className="text-[13px] font-semibold text-brand-red">No questions yet, so students can&rsquo;t see it.</p>
            )}
          </div>
          {access === "view" && (
            <span data-tour="exam-viewonly" className="rounded-btn bg-mist px-2 py-0.5 text-xs font-semibold text-graphite">View only</span>
          )}
          <label data-tour="exam-open" className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={exam.active}
              disabled={busy || access === "view"}
              onChange={(e) => update({ active: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-brand-green"
            />
            <span className={SWITCH_LABEL[status].className}>{SWITCH_LABEL[status].label}</span>
          </label>
        </div>
        {/* The buttons get a row of their own, so the title keeps the card's full width. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-tour="exam-questions"
            onClick={() => setPanel(open ? "none" : "questions")}
            className="cursor-pointer rounded-btn border border-ink px-3 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white"
          >
            {open ? "Close" : "Questions"}
          </button>
          <button
            type="button"
            data-tour="exam-schedule"
            onClick={() => setPanel(panel === "schedule" ? "none" : "schedule")}
            className="cursor-pointer rounded-btn border border-ink px-3 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white"
          >
            {panel === "schedule" ? "Close" : "Date & time"}
          </button>
          <button
            type="button"
            data-tour="exam-sittings"
            onClick={() => setPanel(panel === "sittings" ? "none" : "sittings")}
            className="cursor-pointer rounded-btn border border-ink px-3 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white"
          >
            {panel === "sittings" ? "Close" : "Sittings"}
          </button>
          {exam.type === "class" && (
            <button
              type="button"
              data-tour="exam-send"
              onClick={() => setSending(true)}
              className="cursor-pointer rounded-btn border border-brand-navy px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors duration-200 hover:bg-brand-navy hover:text-white"
            >
              Send to Term scores
            </button>
          )}
          <a
            data-tour="exam-download"
            href={`/api/exams/${exam.id}/results-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-btn border border-brand-navy px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors duration-200 hover:bg-brand-navy hover:text-white"
          >
            Download results
          </a>
          {access !== "view" && (
            <button
              type="button"
              data-tour="exam-delete"
              onClick={() => (access === "manage" ? remove() : requestDeletion())}
              disabled={busy}
              aria-label={`${access === "manage" ? "Delete" : "Request deletion of"} ${exam.title}`}
              className="cursor-pointer rounded-btn border border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition-colors duration-200 hover:bg-brand-red hover:text-white"
            >
              {access === "manage" ? "Delete" : "Request deletion"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="px-5 pb-3 text-sm font-semibold text-brand-red">{error}</p>}
      {notice && <p className="px-5 pb-3 text-sm font-semibold text-brand-green">{notice}</p>}
      {open && (
        <QuestionEditor
          exam={exam}
          busy={busy}
          access={access}
          onSave={async (questions) => (await update({ questions })) !== null}
          onRequestRemoval={(i) => requestDeletion(i)}
        />
      )}
      {panel === "sittings" && <SittingsPanel exam={exam} authFetch={authFetch} access={access} />}
      {sending && <SendToScoresDialog exam={exam} onClose={() => setSending(false)} onUnauthorized={onUnauthorized} />}
      {panel === "schedule" && (
        <ScheduleEditor exam={exam} busy={busy} canEdit={access !== "view"} onSave={update} />
      )}
    </div>
  );
}

type Sitting = {
  id: string;
  takerName: string;
  answered: number;
  total: number;
  secondsLeft: number;
  extraMins: number;
  lastSeenAt: string;
};
type Submitted = {
  id: string;
  takerName: string;
  score: number;
  total: number;
  submittedAt: string;
};

function mmss(secs: number) {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** The exam's date and time, and where that leaves it for students. */
function ScheduleStatus({ exam, now }: { exam: Exam; now: number }) {
  if (!exam.opensAt) return null;
  const when = formatExamTime(exam.opensAt);
  const status = examStatus(exam, now);
  const [label, tone] =
    status === "hidden"
      ? ["Hidden, so it won't open:", "text-pewter"]
      : status === "scheduled"
        ? ["Coming up:", "text-brand-navy"]
        : ["Opened", "text-brand-green"];
  return (
    <p className={`text-[13px] font-semibold ${tone}`}>
      {label} {when} <span className="font-normal text-pewter">(Lagos time)</span>
    </p>
  );
}

/**
 * The date and time of the exam. Saving one switches the exam on (see the
 * PUT route): students see it under "Coming up" and can start it from that
 * moment. With no date and time, the Open switch alone decides.
 */
function ScheduleEditor({
  exam,
  busy,
  canEdit,
  onSave,
}: {
  exam: Exam;
  busy: boolean;
  canEdit: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<Exam | null>;
}) {
  const [value, setValue] = useState(isoToLagosInput(exam.opensAt));
  const [notice, setNotice] = useState("");
  const iso = lagosInputToIso(value);
  const unchanged = iso === exam.opensAt;
  // Saving switches the test on, so a time already gone would open it this
  // minute. The server refuses one more than a couple of minutes past too.
  const passed = iso !== null && !unchanged && !opensLater({ opensAt: iso }, Date.now() - 2 * 60_000);

  async function save(opensAt: string | null) {
    setNotice("");
    const saved = await onSave({ opensAt });
    if (!saved) return;
    // Worded from what the server did, which decides whether removing a date hides the test.
    setNotice(
      saved.opensAt
        ? `Saved. It opens by itself on ${formatExamTime(saved.opensAt)}.`
        : saved.active
          ? "Date and time removed. The test stays open."
          : "Date and time removed, and the test is hidden again."
    );
  }

  return (
    <div className="border-t border-smoke p-5">
      <p className="font-display text-sm font-bold tracking-tight">Date &amp; time</p>
      <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-pewter">
        Lagos time. Saving a date and time is all you need: students see the test under &ldquo;Coming up&rdquo;
        straight away, and it opens by itself at that time. Untick the switch to hide it and call it off.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[13px] font-semibold">
          Date and time of the exam
          <input
            type="datetime-local"
            value={value}
            disabled={!canEdit}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 block rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy disabled:bg-mist"
          />
        </label>
        {canEdit && (
          <>
            <button
              type="button"
              disabled={busy || unchanged || !iso || passed}
              onClick={() => save(iso)}
              className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save date &amp; time
            </button>
            {exam.opensAt && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setValue("");
                  save(null);
                }}
                className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline disabled:opacity-50"
              >
                Remove date &amp; time
              </button>
            )}
          </>
        )}
      </div>
      {passed ? (
        <p className="mt-2 text-[13px] font-semibold text-brand-red">
          That time has already passed. Pick one still to come, or tick the switch to open the test now.
        </p>
      ) : (
        iso && !unchanged && <p className="mt-2 text-[13px] text-ink">Students will see: {formatExamTime(iso)}</p>
      )}
      {canEdit && !exam.active && iso && !unchanged && !passed && (
        <p className="mt-1 text-[13px] text-ink">This test is hidden now. Saving the date switches it back on.</p>
      )}
      {notice && <p className="mt-2 text-sm font-semibold text-brand-green">{notice}</p>}
    </div>
  );
}

/**
 * Who is mid-test, and who has finished. The clock never pauses on its own, so
 * this is where a student who lost time to a power cut or a dead network gets
 * it back.
 */
function SittingsPanel({ exam, authFetch, access }: { exam: Exam; authFetch: AuthFetch; access: ExamAccess }) {
  const invalidate = useInvalidate();
  const sittingsUrl = `/api/exams/${exam.id}/sittings`;
  // Live-ish: a teacher watching a test in progress wants the clocks to move.
  const sittingsQ = useApi<{ inProgress: Sitting[]; submitted: Submitted[] }>(sittingsUrl, undefined, {
    refetchInterval: 15_000,
  });
  const inProgress = sittingsQ.data?.inProgress ?? [];
  const submitted = sittingsQ.data?.submitted ?? [];
  const loading = sittingsQ.isPending;
  const [busyId, setBusyId] = useState("");
  const [actionError, setError] = useState("");
  const error = actionError || sittingsQ.error?.message || "";
  const { confirm, dialog } = useConfirm();

  const reload = useCallback(() => invalidate(sittingsUrl, "/api/attempts"), [invalidate, sittingsUrl]);

  async function grant(sessionId: string, extraMins: number) {
    setBusyId(sessionId);
    setError("");
    try {
      const res = await authFetch(`/api/exams/${exam.id}/sittings`, {
        method: "PATCH",
        body: JSON.stringify({ sessionId, extraMins }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not grant extra time");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant extra time");
    } finally {
      setBusyId("");
    }
  }

  async function allowRetake(attempt: Submitted) {
    const ok = await confirm({
      title: `Allow ${attempt.takerName} a retake?`,
      message: `Their score of ${attempt.score}/${attempt.total} on “${exam.title}” is deleted so they can sit it again. This can’t be undone.`,
      confirmLabel: "Delete score and allow retake",
      danger: true,
    });
    if (!ok) return;
    setBusyId(attempt.id);
    setError("");
    try {
      const res = await authFetch(
        `/api/exams/${exam.id}/sittings?attemptId=${attempt.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Could not clear that attempt");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear that attempt");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="border-t border-smoke p-5">
      {dialog}
      {error && <p className="mb-3 text-sm font-semibold text-brand-red">{error}</p>}

      <p className="font-display text-sm font-bold tracking-tight">Taking it now</p>
      {loading ? (
        <p className="mt-2 text-sm text-graphite">Loading…</p>
      ) : inProgress.length === 0 ? (
        <p className="mt-2 text-sm text-graphite">Nobody is sitting this test right now.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {inProgress.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-btn bg-mist px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.takerName}</p>
                <p className="text-[13px] text-graphite">
                  {s.answered}/{s.total} answered
                  {s.extraMins > 0 ? ` · +${s.extraMins} min granted` : ""}
                </p>
              </div>
              <span
                className={`rounded-btn px-2.5 py-1 font-display text-sm font-bold tabular-nums ${
                  s.secondsLeft === 0 ? "bg-brand-red text-white" : "bg-white text-ink"
                }`}
              >
                {s.secondsLeft === 0 ? "Time up" : mmss(s.secondsLeft)}
              </span>
              {access !== "view" && [5, 10].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => grant(s.id, mins)}
                  className="cursor-pointer rounded-btn border border-brand-green px-3 py-1.5 text-sm font-semibold text-brand-green transition-colors duration-200 hover:bg-brand-green hover:text-white disabled:opacity-50"
                >
                  +{mins} min
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-pewter">
        The clock keeps running even if a student closes the tab. Their answers
        are saved as they go, so they can sign back in and carry on. If someone
        genuinely lost time to a power cut or a network drop, hand it back here.
      </p>

      {submitted.length > 0 && (
        <>
          <p className="mt-6 font-display text-sm font-bold tracking-tight">Finished</p>
          <ul className="mt-2 space-y-2">
            {submitted.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-btn bg-mist px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.takerName}</p>
                  <p className="text-[13px] text-graphite">
                    {new Date(a.submittedAt).toLocaleString()}
                  </p>
                </div>
                <span className="font-display text-sm font-bold tabular-nums">
                  {a.score}/{a.total}
                </span>
                {access === "manage" && <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => allowRetake(a)}
                  className="cursor-pointer rounded-btn border border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition-colors duration-200 hover:bg-brand-red hover:text-white disabled:opacity-50"
                >
                  Allow retake
                </button>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type QuestionDraft = Omit<Exam["questions"][number], "id" | "position">;

/** The question form, for adding a question or editing one. Empty options are dropped on save. */
function QuestionForm({
  name,
  initial,
  title,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  name: string;
  initial?: QuestionDraft;
  title: string;
  submitLabel: string;
  busy: boolean;
  /** Resolves to whether it was saved; the form clears itself after a saved add. */
  onSubmit: (q: QuestionDraft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const blankOptions = () => {
    const opts = [...(initial?.options ?? [])];
    while (opts.length < 4) opts.push("");
    return opts;
  };
  const [text, setText] = useState(initial?.text ?? "");
  const [options, setOptions] = useState(blankOptions);
  const [correctIndex, setCorrectIndex] = useState(initial?.correctIndex ?? 0);
  const [formError, setFormError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (!text.trim() || filled.length < 2) return setFormError("Enter the question and at least two options");
    if (!options[correctIndex]?.trim()) return setFormError("The correct answer can't be an empty option");
    const kept = options.map((o, i) => ({ o: o.trim(), i })).filter(({ o }) => o);
    setFormError("");
    const saved = await onSubmit({
      text: text.trim(),
      options: kept.map(({ o }) => o),
      correctIndex: kept.findIndex(({ i }) => i === correctIndex),
    });
    if (saved && !initial) {
      setText("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-btn border border-dashed border-pewter/50 bg-white p-4">
      <p className="font-display text-sm font-bold tracking-tight">{title}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Question text…"
        rows={2}
        className="mt-3 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${name}`}
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              aria-label={`Mark option ${String.fromCharCode(65 + i)} as correct`}
              className="h-4 w-4 shrink-0 cursor-pointer accent-brand-green"
            />
            <input
              type="text"
              value={opt}
              onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="w-full rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-pewter">Tick the radio next to the correct answer.</p>
      {formError && <p className="mt-2 text-sm font-semibold text-brand-red" role="alert">{formError}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-btn bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="cursor-pointer rounded-btn px-4 py-2.5 text-sm font-semibold text-graphite hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function QuestionEditor({
  exam,
  busy,
  access,
  onSave,
  onRequestRemoval,
}: {
  exam: Exam;
  busy: boolean;
  access: ExamAccess;
  onSave: (questions: Exam["questions"]) => Promise<boolean>;
  onRequestRemoval: (questionIndex: number) => void;
}) {
  const [mode, setMode] = useState<"paste" | "one">("paste");
  const [editing, setEditing] = useState<number | null>(null);
  const { confirm, dialog } = useConfirm();

  async function removeQuestion(qi: number) {
    const ok = await confirm({
      title: `Remove question ${qi + 1}?`,
      message: <>“{exam.questions[qi].text}” will be removed from {exam.title}. This can’t be undone.</>,
      confirmLabel: "Remove question",
      danger: true,
    });
    if (ok) await onSave(exam.questions.filter((_, x) => x !== qi));
  }

  async function saveEdit(qi: number, q: QuestionDraft): Promise<boolean> {
    const ok = await confirm({
      title: `Save changes to question ${qi + 1}?`,
      message: "Students who have already sat this test keep the score they got.",
      confirmLabel: "Save changes",
    });
    if (!ok) return false;
    const saved = await onSave(exam.questions.map((old, x) => (x === qi ? { ...old, ...q } : old)));
    if (saved) setEditing(null);
    return saved;
  }

  return (
    <div className="border-t border-smoke p-5">
      {dialog}
      {exam.questions.length > 0 && (
        <ol className="space-y-3">
          {exam.questions.map((q, qi) =>
            editing === qi ? (
              <li key={q.id || qi}>
                <QuestionForm
                  name={`${exam.id}-${qi}`}
                  initial={q}
                  title={`Edit question ${qi + 1}`}
                  submitLabel="Save changes"
                  busy={busy}
                  onSubmit={(draft) => saveEdit(qi, draft)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={q.id || qi} className="rounded-btn bg-mist p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">
                    <span className="mr-2 text-pewter">{qi + 1}.</span>
                    {q.text}
                  </p>
                  {access !== "view" && (
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditing(qi)}
                        aria-label={`Edit question ${qi + 1}`}
                        className="cursor-pointer text-sm font-semibold text-brand-navy hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => (access === "manage" ? removeQuestion(qi) : onRequestRemoval(qi))}
                        aria-label={`${access === "manage" ? "Remove" : "Request removal of"} question ${qi + 1}`}
                        className="cursor-pointer text-sm font-semibold text-brand-red hover:underline"
                      >
                        {access === "manage" ? "Remove" : "Request removal"}
                      </button>
                    </div>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-graphite">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={oi === q.correctIndex ? "font-bold text-brand-green" : ""}>
                      {String.fromCharCode(65 + oi)}. {opt}
                      {oi === q.correctIndex ? " (correct)" : ""}
                    </li>
                  ))}
                </ul>
              </li>
            )
          )}
        </ol>
      )}

      {access === "view" ? (
        <p className="mt-4 text-[13px] text-pewter">
          {exam.questions.length === 0 ? "No questions yet. " : ""}This exam belongs to another teacher, so you can view it but not change it.
        </p>
      ) : (
        <>
          <div className="mt-5 flex gap-2">
            {(
              [
                ["paste", "Paste questions"],
                ["one", "Add one question"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold ${
                  mode === key ? "bg-brand-navy text-white" : "border border-smoke bg-white text-ink hover:border-brand-navy"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "paste" ? (
            <PasteQuestions exam={exam} busy={busy} onSave={onSave} />
          ) : (
            <QuestionForm
              name={`${exam.id}-new`}
              title={`Add question ${exam.questions.length + 1}`}
              submitLabel="Add question"
              busy={busy}
              onSubmit={(q) => onSave([...exam.questions, { ...q, id: "", position: exam.questions.length }])}
            />
          )}
        </>
      )}
    </div>
  );
}

const PASTE_EXAMPLE = `1. Which apparatus is most suitable for measuring a definite volume of liquid?
A. Mortar and pestle
B. Measuring cylinder
C. Evaporating dish
D. Filter funnel
Answer: B

2. …`;

/**
 * Paste a whole set of questions at once (typed, or copied from Word), check
 * them in a preview, and add them all. Nothing is saved while any question
 * still has a problem.
 */
function PasteQuestions({
  exam,
  busy,
  onSave,
}: {
  exam: Exam;
  busy: boolean;
  onSave: (questions: Exam["questions"]) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuestions(text), [text]);
  // Pasted questions go after the ones already there, so number them on from those.
  const numberOf = (q: { number: number }) => exam.questions.length + q.number;
  const needFixing = parsed.filter((q) => q.problems.length > 0).length;

  async function addAll() {
    const saved = await onSave([
      ...exam.questions,
      ...parsed.map((q, i) => ({
        id: "",
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        position: exam.questions.length + i,
      })),
    ]);
    if (saved) setText("");
  }

  return (
    <div className="mt-3 rounded-btn border border-dashed border-pewter/50 p-4">
      <p className="font-display text-sm font-bold tracking-tight">Paste questions</p>
      <p className="mt-1 text-[13px] text-pewter">
        Paste from Word or type them in. End every question with an <strong>Answer:</strong> line; numbering and blank
        lines are optional. An <strong>Explanation:</strong> line is allowed and is never shown to students.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PASTE_EXAMPLE}
        rows={10}
        className="mt-3 w-full rounded-btn border border-smoke px-3 py-2.5 font-mono text-[13px] outline-none focus:border-brand-navy"
      />

      {parsed.length > 0 && (
        <>
          <p className={`mt-3 text-sm font-semibold ${needFixing ? "text-brand-red" : "text-brand-green"}`}>
            {needFixing
              ? `${parsed.length} question${parsed.length === 1 ? "" : "s"} found, ${needFixing} need${needFixing === 1 ? "s" : ""} fixing before they can be added`
              : `${parsed.length} question${parsed.length === 1 ? "" : "s"} ready to add`}
          </p>
          <ol className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
            {parsed.map((q) => (
              <li
                key={q.number}
                className={`rounded-btn p-3 text-sm ${q.problems.length ? "border border-brand-red bg-brand-red/5" : "bg-mist"}`}
              >
                <p className="font-semibold">
                  <span className="mr-2 text-pewter">{numberOf(q)}.</span>
                  {q.text || <em className="text-pewter">(no question text)</em>}
                </p>
                <ul className="mt-1 space-y-0.5 text-graphite">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={oi === q.correctIndex ? "font-bold text-brand-green" : ""}>
                      {String.fromCharCode(65 + oi)}. {opt}
                      {oi === q.correctIndex ? " (correct)" : ""}
                    </li>
                  ))}
                </ul>
                {q.problems.map((p) => (
                  <p key={p} className="mt-1 text-[13px] font-semibold text-brand-red">
                    Question {numberOf(q)}: {p}
                  </p>
                ))}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={addAll}
            disabled={busy || needFixing > 0}
            className="mt-3 cursor-pointer rounded-btn bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : `Add ${parsed.length} question${parsed.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
