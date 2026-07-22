"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { browserClient } from "@/lib/supabase/browser";
import ExamsPanel from "@/components/portal/staff/ExamsPanel";
import ResultsPanel from "@/components/portal/staff/ResultsPanel";
import RosterPanel from "@/components/portal/staff/RosterPanel";
import TeamPanel from "@/components/portal/staff/TeamPanel";
import ClassesPanel from "@/components/portal/staff/ClassesPanel";
import AttendancePanel from "@/components/portal/staff/AttendancePanel";
import type { StaffRole } from "@/lib/types";

type Me = { id: string; fullName: string; role: StaffRole; email: string } | null;
type Tab = "exams" | "results" | "students" | "classes" | "attendance" | "team";

function useStaff() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await (await fetch("/api/me")).json();
      setMe(d.kind === "staff" ? d.staff : null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await browserClient().auth.signOut();
    setMe(null);
  }, []);

  return { me, loading, refresh, signOut };
}

const TABS: [Tab, string][] = [
  ["exams", "Exams & questions"],
  ["results", "Results"],
  ["students", "Students"],
  ["classes", "Classes"],
  ["attendance", "Attendance"],
  ["team", "Staff accounts"],
];

export default function StaffPage() {
  const { me, loading, refresh, signOut } = useStaff();
  const [tab, setTab] = useState<Tab>("exams");

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
                  Staff Section
                </h1>
                {me && (
                  <p className="mt-1 text-sm text-white/70">
                    {me.fullName} · {me.role === "admin" ? "Administrator" : "Teacher"}
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
              <div className="mt-6 flex flex-wrap gap-2">
                {TABS.filter(([key]) => (key !== "team" && key !== "classes") || me.role === "admin").map(
                  ([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                        tab === key
                          ? "bg-brand-gold text-ink"
                          : "bg-white/10 text-white hover:bg-white/20"
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
            <StaffLogin onSignedIn={refresh} />
          ) : tab === "exams" ? (
            <ExamsPanel onUnauthorized={refresh} />
          ) : tab === "results" ? (
            <ResultsPanel onUnauthorized={refresh} />
          ) : tab === "students" ? (
            <RosterPanel onUnauthorized={refresh} />
          ) : tab === "classes" ? (
            <ClassesPanel onUnauthorized={refresh} />
          ) : tab === "attendance" ? (
            <AttendancePanel me={me} onUnauthorized={refresh} />
          ) : (
            <TeamPanel currentEmail={me.email} onUnauthorized={refresh} />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function StaffLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await browserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError("Incorrect email or password");
      return;
    }
    onSignedIn();
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-[420px] rounded-card border border-smoke bg-white p-6 md:p-8"
    >
      <h2 className="font-display text-xl font-bold tracking-tight">Staff sign in</h2>
      <p className="mt-2 text-sm leading-relaxed text-graphite">
        Sign in with your school email and password. Accounts are created by an
        administrator.
      </p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="staff-email">
        Email
      </label>
      <input
        id="staff-email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="staff-password">
        Password
      </label>
      <input
        id="staff-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-brand-navy"
      />

      {error && (
        <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
