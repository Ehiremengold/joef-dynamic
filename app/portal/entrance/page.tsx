"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TestRunner, { type SubmittedResult } from "@/components/portal/TestRunner";
import type { PublicExam } from "@/lib/types";

export default function EntrancePage() {
  const [step, setStep] = useState<"register" | "pick" | "test" | "done">("register");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [candidateNo, setCandidateNo] = useState("");
  const [exams, setExams] = useState<PublicExam[]>([]);
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmittedResult | null>(null);

  async function loadExams() {
    setLoading(true);
    try {
      const d = await (await fetch("/api/exams?type=entrance")).json();
      const list: PublicExam[] = d.exams || [];
      setExams(list);
      if (list.length === 1) setExamId(list[0].id);
    } finally {
      setLoading(false);
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("Enter the candidate's full name");
      return;
    }
    if (!code.trim()) {
      setError("Enter the access code given by the school");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/candidates/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name.trim(),
          parentPhone: phone.trim(),
          code: code.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not register");
      setCandidateNo(d.candidate.candidateNumber);
      await loadExams();
      setStep("pick");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register");
    } finally {
      setLoading(false);
    }
  }

  const exam = exams.find((e) => e.id === examId);

  return (
    <>
      <Nav />
      <main className="min-h-[70vh] bg-mist">
        <section className="bg-brand-navy text-white">
          <div className="mx-auto max-w-[1200px] px-4 py-10">
            <Link href="/portal" className="text-sm text-white/70 transition-colors duration-200 hover:text-brand-gold">
              ← Portal home
            </Link>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Common Entrance Test
            </h1>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-10">
          {step === "register" && (
            <form onSubmit={register} className="mx-auto max-w-[520px] rounded-card border border-smoke bg-white p-6 md:p-8">
              <h2 className="font-display text-xl font-bold tracking-tight">Register to begin</h2>
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                Enter the candidate&rsquo;s details. You&rsquo;ll get a candidate
                number, then take the test straight away.
              </p>

              <label className="mt-6 block text-sm font-semibold" htmlFor="c-name">Candidate full name</label>
              <input
                id="c-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chidera Okafor"
                className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
              />

              <label className="mt-4 block text-sm font-semibold" htmlFor="c-phone">Parent / guardian phone</label>
              <input
                id="c-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0803 000 0000"
                className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
              />

              <label className="mt-4 block text-sm font-semibold" htmlFor="c-code">Access code</label>
              <input
                id="c-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Given by the school on test day"
                className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
              />

              {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:opacity-50"
              >
                {loading ? "Registering…" : "Register & continue"}
              </button>
            </form>
          )}

          {step === "pick" && (
            <div className="mx-auto max-w-[520px] rounded-card border border-smoke bg-white p-6 md:p-8">
              <span className="inline-block rounded-btn bg-brand-gold px-2.5 py-1 text-sm font-semibold text-ink">
                Candidate no. {candidateNo}
              </span>
              <h2 className="mt-4 font-display text-xl font-bold tracking-tight">Choose your test</h2>
              {loading ? (
                <p className="mt-3 text-sm text-graphite">Loading available tests…</p>
              ) : exams.length === 0 ? (
                <p className="mt-3 rounded-btn bg-mist px-4 py-3 text-sm text-graphite">
                  No entrance test is open right now. Please contact the school on{" "}
                  <a href="tel:+2348034035705" className="font-semibold underline">0803 403 5705</a>.
                </p>
              ) : (
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
              )}
              <button
                type="button"
                disabled={!exam}
                onClick={() => setStep("test")}
                className="mt-6 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start test
              </button>
            </div>
          )}

          {step === "test" && exam && (
            <TestRunner
              exam={exam}
              studentName={name.trim()}
              onFinished={(r) => {
                setResult(r);
                setStep("done");
                window.scrollTo({ top: 0 });
              }}
            />
          )}

          {step === "done" && result && (
            <div className="mx-auto max-w-[520px] rounded-card border border-smoke bg-white p-8 text-center">
              <span className="inline-block rounded-btn bg-brand-gold px-2.5 py-1 text-sm font-semibold text-ink">
                Test submitted
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
                Well done, {result.studentName}!
              </h2>
              <p className="mt-6 font-display text-5xl font-bold tracking-tight text-brand-navy">
                {result.score}/{result.total}
              </p>
              <p className="mt-2 text-sm text-graphite">
                {result.examTitle} · Candidate no. {candidateNo}
              </p>
              <p className="mt-6 text-sm leading-relaxed text-graphite">
                Your result has been recorded. The admissions team will contact
                you at the next stage.
              </p>
              <Link
                href="/portal"
                className="mt-6 inline-block rounded-btn bg-brand-navy px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-ink"
              >
                Back to portal
              </Link>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
