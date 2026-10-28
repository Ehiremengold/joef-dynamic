"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { forgetSignedIn, SIGNED_IN, useApi, useInvalidate } from "@/lib/client/api";
import { formatExamTime } from "@/lib/lagosTime";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TestRunner, { type SubmittedResult } from "@/components/portal/TestRunner";
import AnswerReviewLoader from "@/components/portal/AnswerReviewLoader";
import GuideTour from "@/components/portal/GuideTour";
import { STUDENT_AREA_TOUR, STUDENT_SIGNIN_TOUR } from "@/lib/tours";
import { percent } from "@/lib/results";
import type { Attempt, ClassName, PublicExam } from "@/lib/types";

/** A test with a date and time that hasn't arrived yet. */
type Upcoming = { id: string; title: string; durationMins: number; opensAt: string; questionCount: number };

type Me = { fullName: string; className: ClassName; admissionNumber?: string } | null;

export default function CbtPage() {
  const client = useQueryClient();
  const meQ = useApi<{ kind: string | null; taker?: { kind: string; name: string; className: ClassName } }>("/api/me", undefined, SIGNED_IN);
  const me: Me =
    meQ.data?.kind === "taker" && meQ.data.taker?.kind === "student"
      ? { fullName: meQ.data.taker.name, className: meQ.data.taker.className }
      : null;
  const loading = meQ.isPending;
  const [tab, setTab] = useState<"take" | "results">("take");
  // While a test is running the page header (tabs, sign out) is put away: the time bar sits there
  // instead, and switching tab mid-test would leave the test.
  const [testing, setTesting] = useState(false);
  const { refetch } = meQ;

  // A shared school computer: the next student must never see the last one's cached tests or scores.
  const refresh = useCallback(async () => {
    client.clear();
    await refetch();
  }, [client, refetch]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    forgetSignedIn(client);
  }

  return (
    <>
      <Nav />
      <main className="min-h-[70vh] bg-mist">
        {!(testing && me) && (
          <section className="bg-brand-navy text-white">
            <div className="mx-auto max-w-[1200px] px-4 py-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Link href="/portal" className="text-sm text-white/70 transition-colors duration-200 hover:text-brand-gold">
                    ← Portal home
                  </Link>
                  <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                    Student CBT &amp; Results
                  </h1>
                  {me && (
                    <p className="mt-1 text-sm text-white/70">
                      {me.fullName} · {me.className}
                    </p>
                  )}
                </div>
                {!loading && (
                  <div className="flex flex-wrap gap-2">
                    {me ? (
                      <GuideTour id="student-area-v3" steps={STUDENT_AREA_TOUR} />
                    ) : (
                      <GuideTour id="student-signin-v1" steps={STUDENT_SIGNIN_TOUR} />
                    )}
                    {me && (
                      <button
                        type="button"
                        data-tour="student-signout"
                        onClick={signOut}
                        className="cursor-pointer rounded-btn border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-ink"
                      >
                        Sign out
                      </button>
                    )}
                  </div>
                )}
              </div>
              {me && (
                <div data-tour="student-tabs" className="mt-6 flex gap-2">
                  {([["take", "Take a test"], ["results", "My results"]] as const).map(
                    ([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                          tab === key ? "bg-brand-gold text-ink" : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-[1200px] px-4 py-10">
          {loading ? (
            <p className="text-sm text-graphite">Loading…</p>
          ) : !me ? (
            <StudentLogin onSignedIn={refresh} />
          ) : tab === "take" ? (
            <TakeTest me={me} onExpired={refresh} onTesting={setTesting} />
          ) : (
            <MyResults />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function StudentLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/students/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admissionNumber, pin }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not sign in");
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-[420px] rounded-card border border-smoke bg-white p-6 md:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight">Student sign in</h2>
      <p className="mt-2 text-sm leading-relaxed text-graphite">
        Use the admission number and PIN your school gave you.
      </p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="adm">Admission number</label>
      <input
        id="adm"
        data-tour="student-admission"
        type="text"
        value={admissionNumber}
        onChange={(e) => setAdmissionNumber(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="pin">PIN</label>
      <input
        id="pin"
        data-tour="student-pin"
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
      />

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
      <button
        type="submit"
        data-tour="student-signin"
        disabled={loading || !admissionNumber || !pin}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function TakeTest({
  me,
  onExpired,
  onTesting,
}: {
  me: NonNullable<Me>;
  onExpired: () => void;
  onTesting: (testing: boolean) => void;
}) {
  const [step, setStep] = useState<"pick" | "test" | "done">("pick");
  const invalidate = useInvalidate();
  const examsQ = useApi<{ exams: PublicExam[]; upcoming?: Upcoming[]; serverNow?: string }>("/api/exams?type=class", onExpired, {
    // A test with a date and time should appear by itself when the time comes.
    refetchInterval: 60_000,
  });
  const exams = examsQ.data?.exams ?? [];
  const upcoming = examsQ.data?.upcoming ?? [];
  const loading = examsQ.isPending;
  // ...and right on time, not up to a minute late: ask again a second after
  // the next one opens, timed by the server's clock (a device's own clock can
  // be minutes out). Until the server lists it as open, keep asking every few
  // seconds; after two minutes the minute check above takes over.
  const nextOpens = upcoming.length ? Math.min(...upcoming.map((u) => Date.parse(u.opensAt))) : null;
  const serverNow = examsQ.data?.serverNow;
  const { refetch, dataUpdatedAt } = examsQ;
  useEffect(() => {
    if (nextOpens === null || !serverNow) return;
    const clockOffset = Date.parse(serverNow) - dataUpdatedAt;
    const wait = nextOpens - (Date.now() + clockOffset) + 1000;
    // Further off than the minute check reaches: that will get there first.
    if (wait > 24 * 60 * 60_000 || wait < -2 * 60_000) return;
    const t = setTimeout(() => void refetch(), wait > 0 ? wait : 5000);
    return () => clearTimeout(t);
  }, [nextOpens, serverNow, dataUpdatedAt, refetch]);
  const [chosenExam, setExamId] = useState("");
  const [result, setResult] = useState<SubmittedResult | null>(null);
  // With only one test open, it is already chosen.
  const examId = chosenExam || (exams.length === 1 ? exams[0].id : "");

  const exam = exams.find((e) => e.id === examId);
  const inTest = step === "test" && !!exam;
  useEffect(() => {
    onTesting(inTest);
    return () => onTesting(false);
  }, [inTest, onTesting]);

  if (step === "test" && exam) {
    return (
      <TestRunner
        exam={exam}
        studentName={me.fullName}
        className={me.className}
        onFinished={(r) => {
          setResult(r);
          setStep("done");
          // The new score belongs in My results, and the test may now be closed to them.
          invalidate("/api/attempts", "/api/exams");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (step === "done" && result) {
    return (
      <div className="mx-auto max-w-[520px] rounded-card border border-smoke bg-white p-8 text-center">
        <span className="inline-block rounded-btn bg-brand-gold px-2.5 py-1 text-sm font-semibold text-ink">
          Test submitted
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">Well done, {result.studentName}!</h2>
        <p className="mt-6 font-display text-5xl font-bold tracking-tight text-brand-navy">
          {result.score}/{result.total}
        </p>
        <p className="mt-2 text-sm text-graphite">{result.examTitle}</p>
        <button
          type="button"
          onClick={() => {
            setStep("pick");
            setResult(null);
            setExamId("");
          }}
          className="mt-6 cursor-pointer rounded-btn bg-brand-navy px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-ink"
        >
          Back to tests
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px] rounded-card border border-smoke bg-white p-6 md:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight">Your {me.className} tests</h2>
      {loading ? (
        <p className="mt-3 text-sm text-graphite">Loading tests…</p>
      ) : exams.length === 0 ? (
        <p className="mt-3 rounded-btn bg-mist px-4 py-3 text-sm text-graphite">
          No test is open for {me.className} right now.{" "}
          {upcoming.length ? "Your next test is listed below." : "Check back when your teacher opens one."}
        </p>
      ) : (
        <>
          <select
            data-tour="student-test-picker"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="mt-3 w-full cursor-pointer rounded-btn border border-smoke bg-white px-4 py-3 text-base outline-none focus:border-brand-navy"
          >
            <option value="">Select a test…</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
                {e.opensAt ? ` · ${formatExamTime(e.opensAt)}` : ""} · {e.questions.length} question{e.questions.length === 1 ? "" : "s"} · {e.durationMins} mins
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!exam}
            onClick={() => setStep("test")}
            className="mt-6 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start test
          </button>
        </>
      )}

      {upcoming.length > 0 && (
        <div data-tour="student-upcoming" className="mt-8 border-t border-smoke pt-5">
          <h3 className="font-display text-base font-bold tracking-tight">Coming up</h3>
          <ul className="mt-3 space-y-2">
            {upcoming.map((u) => (
              <li key={u.id} className="rounded-btn bg-mist px-4 py-3">
                <p className="text-sm font-semibold">{u.title}</p>
                <p className="mt-0.5 text-[13px] text-graphite">
                  {formatExamTime(u.opensAt)} · {u.durationMins} mins · {u.questionCount} question{u.questionCount === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-pewter">
            Lagos time. The Start button appears here when the time comes.
          </p>
        </div>
      )}
    </div>
  );
}

function MyResults() {
  const attemptsQ = useApi<{ attempts: Attempt[] }>("/api/attempts");
  const attempts = attemptsQ.data?.attempts ?? [];
  const loading = attemptsQ.isPending;
  // The result being looked through question by question, if any.
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  if (reviewingId) {
    return (
      <div className="mx-auto max-w-[760px]">
        <button
          type="button"
          onClick={() => setReviewingId(null)}
          className="mb-4 cursor-pointer text-sm font-semibold text-brand-navy hover:underline"
        >
          ← Back to my results
        </button>
        <AnswerReviewLoader attemptId={reviewingId} answerLabel="Your answer" />
      </div>
    );
  }

  return (
    <div data-tour="student-results" className="mx-auto max-w-[760px] overflow-x-auto rounded-card border border-smoke bg-white">
      {loading ? (
        <p className="p-6 text-sm text-graphite">Loading your results…</p>
      ) : attempts.length === 0 ? (
        <p className="p-6 text-sm text-graphite">
          You haven&rsquo;t taken any tests yet. Your results will show here.
        </p>
      ) : (
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
              <th className="px-4 py-3 font-semibold">Test</th>
              <th className="px-4 py-3 font-semibold">Score</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Answers</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-smoke last:border-0">
                <td className="px-4 py-3 font-semibold">{a.examTitle}</td>
                <td className="px-4 py-3">
                  <span className="font-display font-bold">{a.score}/{a.total}</span>{" "}
                  <span className="text-pewter">({percent(a.score, a.total)}%)</span>
                </td>
                <td className="px-4 py-3 text-graphite">
                  {new Date(a.submittedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {a.reviewOpen ? (
                    <button
                      type="button"
                      data-tour="student-see-answers"
                      onClick={() => setReviewingId(a.id)}
                      className="cursor-pointer whitespace-nowrap rounded-btn border border-brand-navy px-3 py-1.5 text-[13px] font-semibold text-brand-navy hover:bg-brand-navy hover:text-white"
                    >
                      See answers
                    </button>
                  ) : (
                    <span className="text-[13px] text-pewter">Not open yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
