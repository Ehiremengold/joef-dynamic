"use client";

import { useCallback, useEffect, useState } from "react";
import { CLASSES, type Exam } from "@/lib/types";
import EntranceAccess from "./EntranceAccess";

/** Cookie-authenticated fetch; calls onUnauthorized on a 401 so the shell re-checks. */
type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

export default function ExamsPanel({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authFetch: AuthFetch = useCallback(
    async (url, init) => {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      });
      if (res.status === 401) {
        onUnauthorized();
        throw new Error("Your session has expired — please sign in again");
      }
      return res;
    },
    [onUnauthorized]
  );

  const reload = useCallback(async () => {
    try {
      const d = await (await authFetch("/api/exams")).json();
      setExams(d.exams || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load exams");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

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
            No exams yet — create your first one on the left.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} authFetch={authFetch} onChanged={reload} />
            ))}
          </div>
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
    <form onSubmit={submit} className="h-fit rounded-card border border-smoke bg-white p-6">
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
  authFetch,
  onChanged,
}: {
  exam: Exam;
  authFetch: AuthFetch;
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<"none" | "questions" | "sittings">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = panel === "questions";

  async function update(patch: Record<string, unknown>) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${exam.title}" and its questions? Results already taken are kept.`)) return;
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
      <div className="flex flex-wrap items-center gap-3 p-5">
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
            {exam.questions.length} questions · {exam.durationMins} mins
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={exam.active}
            disabled={busy}
            onChange={(e) => update({ active: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-brand-green"
          />
          {exam.active ? (
            <span className="text-brand-green">Open</span>
          ) : (
            <span className="text-pewter">Hidden</span>
          )}
        </label>
        <button
          type="button"
          onClick={() => setPanel(open ? "none" : "questions")}
          className="cursor-pointer rounded-btn border border-ink px-3 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white"
        >
          {open ? "Close" : "Questions"}
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "sittings" ? "none" : "sittings")}
          className="cursor-pointer rounded-btn border border-ink px-3 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white"
        >
          {panel === "sittings" ? "Close" : "Sittings"}
        </button>
        <a
          href={`/api/exams/${exam.id}/results-pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer rounded-btn border border-brand-navy px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors duration-200 hover:bg-brand-navy hover:text-white"
        >
          Download results
        </a>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label={`Delete ${exam.title}`}
          className="cursor-pointer rounded-btn border border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition-colors duration-200 hover:bg-brand-red hover:text-white"
        >
          Delete
        </button>
      </div>
      {error && <p className="px-5 pb-3 text-sm font-semibold text-brand-red">{error}</p>}
      {open && (
        <QuestionEditor exam={exam} busy={busy} onSave={(questions) => update({ questions })} />
      )}
      {panel === "sittings" && <SittingsPanel exam={exam} authFetch={authFetch} />}
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

/**
 * Who is mid-test, and who has finished. The clock never pauses on its own, so
 * this is where a student who lost time to a power cut or a dead network gets
 * it back.
 */
function SittingsPanel({ exam, authFetch }: { exam: Exam; authFetch: AuthFetch }) {
  const [inProgress, setInProgress] = useState<Sitting[]>([]);
  const [submitted, setSubmitted] = useState<Submitted[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const d = await (await authFetch(`/api/exams/${exam.id}/sittings`)).json();
      setInProgress(d.inProgress || []);
      setSubmitted(d.submitted || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sittings");
    } finally {
      setLoading(false);
    }
  }, [authFetch, exam.id]);

  // Live-ish: a teacher watching a test in progress wants the clocks to move.
  useEffect(() => {
    reload();
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
  }, [reload]);

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
    const ok = window.confirm(
      `Delete ${attempt.takerName}'s score of ${attempt.score}/${attempt.total} so they can sit "${exam.title}" again? This cannot be undone.`
    );
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
              {[5, 10].map((mins) => (
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
        The clock keeps running even if a student closes the tab — their answers
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
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => allowRetake(a)}
                  className="cursor-pointer rounded-btn border border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition-colors duration-200 hover:bg-brand-red hover:text-white disabled:opacity-50"
                >
                  Allow retake
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function QuestionEditor({
  exam,
  busy,
  onSave,
}: {
  exam: Exam;
  busy: boolean;
  onSave: (questions: Exam["questions"]) => void;
}) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [formError, setFormError] = useState("");

  function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (!text.trim() || filled.length < 2) {
      setFormError("Enter the question and at least two options");
      return;
    }
    if (!options[correctIndex]?.trim()) {
      setFormError("The correct answer can't be an empty option");
      return;
    }
    const kept = options.map((o, i) => ({ o: o.trim(), i })).filter(({ o }) => o);
    const newCorrect = kept.findIndex(({ i }) => i === correctIndex);
    setFormError("");
    onSave([
      ...exam.questions,
      {
        id: "",
        text: text.trim(),
        options: kept.map(({ o }) => o),
        correctIndex: newCorrect,
        position: exam.questions.length,
      },
    ]);
    setText("");
    setOptions(["", "", "", ""]);
    setCorrectIndex(0);
  }

  return (
    <div className="border-t border-smoke p-5">
      {exam.questions.length > 0 && (
        <ol className="space-y-3">
          {exam.questions.map((q, qi) => (
            <li key={q.id || qi} className="rounded-btn bg-mist p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">
                  <span className="mr-2 text-pewter">{qi + 1}.</span>
                  {q.text}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSave(exam.questions.filter((_, x) => x !== qi))}
                  aria-label={`Remove question ${qi + 1}`}
                  className="cursor-pointer text-sm font-semibold text-brand-red hover:underline"
                >
                  Remove
                </button>
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
          ))}
        </ol>
      )}

      <form onSubmit={addQuestion} className="mt-5 rounded-btn border border-dashed border-pewter/50 p-4">
        <p className="font-display text-sm font-bold tracking-tight">Add a question</p>
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
                name={`correct-${exam.id}`}
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                aria-label={`Mark option ${String.fromCharCode(65 + i)} as correct`}
                className="h-4 w-4 shrink-0 cursor-pointer accent-brand-green"
              />
              <input
                type="text"
                value={opt}
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                }
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="w-full rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-pewter">Tick the radio next to the correct answer.</p>
        {formError && (
          <p className="mt-2 text-sm font-semibold text-brand-red" role="alert">{formError}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-3 cursor-pointer rounded-btn bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add question"}
        </button>
      </form>
    </div>
  );
}
