"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TestRunner, { type SubmittedResult } from "@/components/portal/TestRunner";
import type { Attempt, ClassName, PublicExam } from "@/lib/types";

type Me = { fullName: string; className: ClassName; admissionNumber?: string } | null;

export default function CbtPage() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"take" | "results">("take");

  const refresh = useCallback(async () => {
    try {
      const d = await (await fetch("/api/me")).json();
      if (d.kind === "taker" && d.taker.kind === "student") {
        setMe({ fullName: d.taker.name, className: d.taker.className });
      } else {
        setMe(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
  }

  return (
    <>
      <Nav />
      <main className="min-h-[70vh] bg-mist">
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
              {me && (
                <button
                  type="button"
                  onClick={signOut}
                  className="cursor-pointer rounded-btn border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-ink"
                >
                  Sign out
                </button>
              )}
            </div>
            {me && (
              <div className="mt-6 flex gap-2">
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

        <section className="mx-auto max-w-[1200px] px-4 py-10">
          {loading ? (
            <p className="text-sm text-graphite">Loading…</p>
          ) : !me ? (
            <StudentLogin onSignedIn={refresh} />
          ) : tab === "take" ? (
            <TakeTest me={me} onExpired={() => setMe(null)} />
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
        type="text"
        value={admissionNumber}
        onChange={(e) => setAdmissionNumber(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="pin">PIN</label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
      />

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={loading || !admissionNumber || !pin}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function TakeTest({ me, onExpired }: { me: NonNullable<Me>; onExpired: () => void }) {
  const [step, setStep] = useState<"pick" | "test" | "done">("pick");
  const [exams, setExams] = useState<PublicExam[]>([]);
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SubmittedResult | null>(null);

  useEffect(() => {
    fetch(`/api/exams?type=class`)
      .then((r) => {
        if (r.status === 401) {
          onExpired();
          return { exams: [] };
        }
        return r.json();
      })
      .then((d) => {
        const list: PublicExam[] = d.exams || [];
        setExams(list);
        if (list.length === 1) setExamId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, [onExpired]);

  const exam = exams.find((e) => e.id === examId);

  if (step === "test" && exam) {
    return (
      <TestRunner
        exam={exam}
        studentName={me.fullName}
        className={me.className}
        onFinished={(r) => {
          setResult(r);
          setStep("done");
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
          No test is open for {me.className} right now. Check back when your
          teacher opens one.
        </p>
      ) : (
        <>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="mt-3 w-full cursor-pointer rounded-btn border border-smoke bg-white px-4 py-3 text-base outline-none focus:border-brand-navy"
          >
            <option value="">Select a test…</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.questions.length} questions · {e.durationMins} mins
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
    </div>
  );
}

function MyResults() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/attempts")
      .then((r) => r.json())
      .then((d) => setAttempts(d.attempts || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[760px] overflow-x-auto rounded-card border border-smoke bg-white">
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
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-smoke last:border-0">
                <td className="px-4 py-3 font-semibold">{a.examTitle}</td>
                <td className="px-4 py-3">
                  <span className="font-display font-bold">{a.score}/{a.total}</span>{" "}
                  <span className="text-pewter">
                    ({a.total ? Math.round((a.score / a.total) * 100) : 0}%)
                  </span>
                </td>
                <td className="px-4 py-3 text-graphite">
                  {new Date(a.submittedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
