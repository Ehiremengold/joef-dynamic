"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { PAGE_WIDTH } from "@/components/pageWidth";
import { browserClient } from "@/lib/supabase/browser";
import ExamsPanel from "@/components/portal/staff/ExamsPanel";
import ResultsPanel from "@/components/portal/staff/ResultsPanel";
import RosterPanel from "@/components/portal/staff/RosterPanel";
import TeamPanel from "@/components/portal/staff/TeamPanel";
import ClassesPanel from "@/components/portal/staff/ClassesPanel";
import AttendancePanel from "@/components/portal/staff/AttendancePanel";
import ReportCardsPanel from "@/components/portal/staff/ReportCardsPanel";
import PromotionPanel from "@/components/portal/staff/PromotionPanel";
import SessionsPanel from "@/components/portal/staff/SessionsPanel";
import TermScoresPanel from "@/components/portal/staff/TermScoresPanel";
import ApprovalsTab from "@/components/portal/staff/ApprovalsTab";
import ChangePasswordDialog from "@/components/portal/staff/ChangePasswordDialog";
import { useConfirm } from "@/components/portal/staff/useConfirm";
import { clearDrafts, examsWithDrafts } from "@/lib/client/questionDrafts";
import GuideTour from "@/components/portal/GuideTour";
import { STAFF_SIGNIN_TOUR, staffDashboardTour, staffTabTour, type StaffTab } from "@/lib/tours";
import { isAdmin, isSuperAdmin, ROLE_LABELS } from "@/lib/roles";
import { forgetSignedIn, setSignInAgain, SIGNED_IN, useApi } from "@/lib/client/api";
import type { SignedInStaff, Term } from "@/lib/types";

type Me = SignedInStaff | null;
type Tab = StaffTab;

function useStaff() {
  const client = useQueryClient();
  const { data, isPending, refetch } = useApi<{ kind: string | null; staff?: SignedInStaff }>("/api/me", undefined, SIGNED_IN);
  const me: Me = data?.kind === "staff" && data.staff ? data.staff : null;

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  /** Ask the server who is signed in now. */
  const checkMe = useCallback(async (): Promise<Me> => {
    const r = await refetch();
    return r.data?.kind === "staff" && r.data.staff ? r.data.staff : null;
  }, [refetch]);

  // A new person at the keyboard must never see the last person's cached lists.
  const forgetEverything = useCallback(() => client.clear(), [client]);

  const signedIn = useCallback(async () => {
    forgetEverything();
    await refetch();
  }, [forgetEverything, refetch]);

  const [signingOut, setSigningOut] = useState(false);
  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      // The server ends the login and removes its cookies (see /api/auth/logout).
      await fetch("/api/auth/logout", { method: "POST" });
      // Drop the browser client's copy too, without waiting on its lock.
      void browserClient().auth.signOut({ scope: "local" }).catch(() => undefined);
    } finally {
      forgetSignedIn(client);
      setSigningOut(false);
    }
  }, [client]);

  return { me, loading: isPending, refresh, checkMe, signedIn, signOut, signingOut };
}

/**
 * When a signed-in person's session ends mid-task (a request answers 401),
 * keep their page on screen and ask them to sign in again over it, rather
 * than swapping the page for the sign-in form and losing what they typed.
 *
 * `shown` is who the page is for: the signed-in person, or the one whose
 * session just ended. `waitForSignIn` lets a save wait for the new sign-in
 * and then be sent again.
 */
function useSignInAgainFlow(me: Me, checkMe: () => Promise<Me>) {
  const client = useQueryClient();
  const [held, setHeld] = useState<SignedInStaff | null>(null);
  const [expired, setExpired] = useState(false);
  const shown = me ?? held;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const waiters = useRef<((ok: boolean) => void)[]>([]);

  const settle = useCallback((ok: boolean) => {
    const w = waiters.current;
    waiters.current = [];
    w.forEach((resolve) => resolve(ok));
  }, []);

  const finish = useCallback(
    (now: Me, person: SignedInStaff) => {
      setHeld(null);
      setExpired(false);
      if (now && now.id === person.id) {
        // Still them: read again only the lists that failed meanwhile.
        void client.invalidateQueries({ predicate: (q) => isPageData(q) && q.state.status === "error" });
        settle(true);
      } else {
        // Someone else is signed in now: never show them this person's lists.
        client.removeQueries({ predicate: isPageData });
        settle(false);
      }
    },
    [client, settle]
  );

  /** A request answered 401 (or 403): is this person still signed in? */
  const onUnauthorized = useCallback(async () => {
    const person = shownRef.current;
    if (!person) {
      // Nobody's page to keep: the sign-in form shows as usual.
      await checkMe();
      settle(false);
      return;
    }
    setHeld(person); // keeps the page while we ask
    const now = await checkMe();
    if (now) finish(now, person);
    else setExpired(true);
  }, [checkMe, finish]);

  const waitForSignIn = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiters.current.push(resolve);
        void onUnauthorized();
      }),
    [onUnauthorized]
  );

  /** Signed in again from the dialog. */
  const signedInAgain = useCallback(async () => {
    const person = shownRef.current;
    const now = await checkMe();
    if (person) finish(now, person);
  }, [checkMe, finish]);

  /** Gave up from the dialog (signed out instead). */
  const abandon = useCallback(() => {
    setHeld(null);
    setExpired(false);
    settle(false);
  }, [settle]);

  // Every save or read made with getJson/sendJson (lib/client/api.ts) that
  // meets an ended session waits here, then is sent again.
  useEffect(() => setSignInAgain(waitForSignIn), [waitForSignIn]);

  return { shown, expired, onUnauthorized, signedInAgain, abandon };
}

/** A cached list of the page's data, as opposed to "who is signed in" (/api/me). */
const isPageData = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== "/api/me";

/** How many requests are waiting for this super admin's decision (0 for everyone else). */
function useWaitingApprovals(me: Me): number {
  const decides = me !== null && isSuperAdmin(me.role);
  const changes = useApi<{ requests: { status: string }[] }>(decides ? "/api/change-requests?pending=1" : null);
  const deletions = useApi<{ requests: { status: string }[] }>(decides ? "/api/deletion-requests" : null);
  if (!decides) return 0;
  const pending = (q: typeof changes) => (q.data?.requests ?? []).filter((r) => r.status === "pending").length;
  return pending(changes) + pending(deletions);
}

const TAB_KEY = "jdc-staff-tab";

/** The open tab, kept for this browser tab so a page reload lands back on it. */
function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>("exams");
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.some(([key]) => key === saved)) setTabState(saved);
    } catch {
      /* storage blocked */
    }
  }, []);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    try {
      window.sessionStorage.setItem(TAB_KEY, t);
    } catch {
      /* storage blocked */
    }
  }, []);
  return [tab, setTab];
}

const ADMIN_TABS: Tab[] = ["classes", "sessions", "team", "approvals"];

// Bump a tab's number when its tour changes enough that everyone should see it again.
const TAB_TOUR_VERSION: Partial<Record<Tab, number>> = { students: 8, exams: 9, team: 4, scores: 2, results: 2, reports: 2 };

const TABS: [Tab, string][] = [
  ["exams", "Exams & questions"],
  ["results", "Results"],
  ["students", "Students"],
  ["classes", "Classes"],
  ["sessions", "Sessions & terms"],
  ["scores", "Term scores"],
  ["attendance", "Attendance"],
  ["reports", "Report cards"],
  ["promotion", "Promotion & graduation"],
  ["team", "Staff accounts"],
  ["approvals", "Approvals"],
];

export default function StaffPage() {
  const { me: signedInNow, loading, checkMe, signedIn, signOut, signingOut } = useStaff();
  const session = useSignInAgainFlow(signedInNow, checkMe);
  // Who the page is for: also the person whose session just ended, so their page stays.
  const me = session.shown;
  const [chosenTab, setTab] = useTab();
  // A teacher never lands on an admin-only tab, even one remembered from an admin's visit.
  const tab: Tab = me && !isAdmin(me.role) && ADMIN_TABS.includes(chosenTab) ? "exams" : chosenTab;
  const waiting = useWaitingApprovals(me);
  const [changingPassword, setChangingPassword] = useState(false);
  const { confirm, dialog } = useConfirm();

  /**
   * Sign out the person the page is for. Unsaved questions hold answers, so
   * they are removed from this computer; with any waiting, ask first.
   */
  async function confirmAndSignOut() {
    if (!me) return;
    const n = examsWithDrafts(me.id).length;
    if (n > 0) {
      const ok = await confirm({
        title: "Sign out and discard unsaved questions?",
        message: `You have questions you haven't added or saved yet in ${n} test${n === 1 ? "" : "s"}. Signing out removes them from this computer.`,
        confirmLabel: "Sign out anyway",
        danger: true,
      });
      if (!ok) return;
    }
    clearDrafts(me.id);
    await signOut();
    session.abandon();
  }

  return (
    <>
      {dialog}
      {session.expired && me && (
        <SessionEndedDialog person={me} onSignedIn={session.signedInAgain} onSignOut={confirmAndSignOut} />
      )}
      <Nav wide />
      <main className="min-h-[70vh] bg-mist">
        <section className="bg-brand-navy text-white">
          <div className={`mx-auto px-6 py-10 ${PAGE_WIDTH.wide}`}>
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
                    {me.fullName} · {ROLE_LABELS[me.role]} ·{" "}
                    <button
                      type="button"
                      data-tour="staff-change-password"
                      onClick={() => setChangingPassword(true)}
                      className="cursor-pointer font-semibold text-white/85 underline-offset-2 hover:text-brand-gold hover:underline"
                    >
                      Change my password
                    </button>
                  </p>
                )}
                {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} onUnauthorized={session.onUnauthorized} />}
                {me && <CurrentTerm onOpen={isAdmin(me.role) ? () => setTab("sessions") : undefined} />}
              </div>
              {!loading && (
                <div className="flex flex-wrap gap-2">
                  {me ? (
                    <GuideTour
                      key={me.role}
                      // Admins: v2 showed where Sessions & terms moved to, v3 the Approvals tab.
                      id={`staff-dashboard-${me.role}-${isAdmin(me.role) ? "v3" : "v1"}`}
                      steps={staffDashboardTour(me.role)}
                    />
                  ) : (
                    <GuideTour id="staff-signin-v1" steps={STAFF_SIGNIN_TOUR} />
                  )}
                  {me && (
                    <button
                      type="button"
                      data-tour="staff-signout"
                      onClick={confirmAndSignOut}
                      disabled={signingOut}
                      className="cursor-pointer rounded-btn border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-ink disabled:cursor-wait disabled:opacity-60"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  )}
                </div>
              )}
            </div>
            {me && (
              <div className="mt-6 flex flex-wrap gap-2">
                {TABS.filter(([key]) => !ADMIN_TABS.includes(key) || isAdmin(me.role)).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      data-tour={`tab-${key}`}
                      onClick={() => setTab(key)}
                      className={`cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                        tab === key
                          ? "bg-brand-gold text-ink"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {label}
                      {key === "approvals" && waiting > 0 && (
                        <span className="ml-1.5 rounded-btn bg-brand-red px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${waiting} waiting`}>
                          {waiting}
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        <section className={`mx-auto px-6 py-10 ${PAGE_WIDTH.wide}`}>
          {loading ? (
            <p className="text-sm text-graphite">Loading…</p>
          ) : !me ? (
            <StaffLogin onSignedIn={signedIn} />
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                {/* Starts by itself the first time a tab is opened, after the page tour.
                    Promotion keeps the id its tour had before every tab got one,
                    so people who already saw it aren't shown it again. */}
                <GuideTour
                  key={tab}
                  id={tab === "promotion" ? "staff-promotion-v2" : `staff-tab-${tab}-v${TAB_TOUR_VERSION[tab] ?? 1}`}
                  steps={staffTabTour(tab, me.role)}
                  label="How this tab works"
                  tone="light"
                  autoStartDelay={1400}
                />
              </div>
              {/* Keyed by person: someone else signing in starts every panel afresh. */}
              <TabPanel key={me.id} tab={tab} me={me} onUnauthorized={session.onUnauthorized} />
            </>
          )}
        </section>
      </main>
      <Footer wide />
    </>
  );
}

/**
 * Over the page, when the session of the person using it has ended: sign in
 * again and carry on where they were. Nothing on the page is lost meanwhile.
 */
function SessionEndedDialog({
  person,
  onSignedIn,
  onSignOut,
}: {
  person: SignedInStaff;
  onSignedIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="staff-signin-title" className="w-full max-w-[420px]">
        <StaffLogin
          onSignedIn={onSignedIn}
          title="Please sign in again"
          intro={`Your sign-in has ended, ${person.fullName}. Sign in again to carry on: everything on the page is kept, and what you were saving is sent again once you're back. If something still shows as not saved, press its button again.`}
          initialEmail={person.email}
          footer={
            <button
              type="button"
              onClick={onSignOut}
              className="mt-3 w-full cursor-pointer text-sm font-semibold text-graphite hover:text-ink"
            >
              Sign out instead
            </button>
          }
        />
      </div>
    </div>
  );
}

/** The open tab's panel. */
function TabPanel({ tab, me, onUnauthorized }: { tab: Tab; me: SignedInStaff; onUnauthorized: () => void }) {
  switch (tab) {
    case "exams":
      return <ExamsPanel me={me} onUnauthorized={onUnauthorized} />;
    case "results":
      return <ResultsPanel me={me} onUnauthorized={onUnauthorized} />;
    case "students":
      return <RosterPanel me={me} onUnauthorized={onUnauthorized} />;
    case "classes":
      return <ClassesPanel onUnauthorized={onUnauthorized} />;
    case "sessions":
      return <SessionsPanel onUnauthorized={onUnauthorized} />;
    case "scores":
      return <TermScoresPanel me={me} onUnauthorized={onUnauthorized} />;
    case "attendance":
      return <AttendancePanel me={me} onUnauthorized={onUnauthorized} />;
    case "reports":
      return <ReportCardsPanel me={me} onUnauthorized={onUnauthorized} />;
    case "promotion":
      return <PromotionPanel me={me} onUnauthorized={onUnauthorized} />;
    case "team":
      return <TeamPanel me={me} onUnauthorized={onUnauthorized} />;
    case "approvals":
      return <ApprovalsTab me={me} onUnauthorized={onUnauthorized} />;
  }
}

/** "Current term: Third Term · 2025/2026", so everyone can see which term the portal is on. */
function CurrentTerm({ onOpen }: { onOpen?: () => void }) {
  const { data } = useApi<{ terms: Term[] }>("/api/terms");
  if (!data) return null;
  const current = data.terms.find((t) => t.isCurrent);
  return (
    <p data-tour="current-term" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-btn bg-white/10 px-2 py-0.5 text-white/90">
        {current ? `Current term: ${current.name} · ${current.sessionName}` : "No current term set"}
      </span>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="cursor-pointer font-semibold text-brand-gold hover:underline"
        >
          Change
        </button>
      )}
    </p>
  );
}

function StaffLogin({
  onSignedIn,
  title = "Staff sign in",
  intro = "Sign in with your school email and password. Accounts are created by an administrator.",
  initialEmail = "",
  footer,
}: {
  onSignedIn: () => void;
  title?: string;
  intro?: string;
  initialEmail?: string;
  footer?: React.ReactNode;
}) {
  const [email, setEmail] = useState(initialEmail);
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
      <h2 id="staff-signin-title" className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-graphite">{intro}</p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="staff-email">
        Email
      </label>
      <input
        id="staff-email"
        data-tour="staff-email"
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
        data-tour="staff-password"
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
      {footer}
    </form>
  );
}
