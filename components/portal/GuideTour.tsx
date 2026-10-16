"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * One step of a guided tour. `target` is the value of a `data-tour="…"`
 * attribute on the page; leave it out for a step that sits in the middle of
 * the screen (an introduction or a closing note). Steps whose target is not
 * on the page right now (a tab the viewer can't see, an empty list) are
 * skipped, so one tour can serve teachers and admins alike.
 */
export type TourStep = {
  target?: string;
  title: string;
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Show this step only while that target is NOT on the page: a summary
   * standing in for detailed steps that can't be shown yet (no student
   * picked, no exams made).
   */
  unless?: string;
};

const onPage = (target: string) => document.querySelector(`[data-tour="${target}"]`) !== null;

const seenKey = (id: string) => `jdc-tour-seen:${id}`;

// One tour on screen at a time: a tour that wants to start by itself while
// another is showing waits for it to finish (the page tour, then the tab's).
// Asked of driver.js itself rather than tracked from its "destroyed" hook,
// which doesn't always fire when a tour is closed mid-animation.
let current: Driver | null = null;
const tourShowing = () => current?.isActive() === true || document.querySelector(".driver-popover") !== null;

function hasSeen(id: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(id)) === "1";
  } catch {
    // Storage blocked (private window): don't nag on every visit.
    return true;
  }
}

function markSeen(id: string) {
  try {
    window.localStorage.setItem(seenKey(id), "1");
  } catch {
    /* nothing to remember it in */
  }
}

/**
 * A "How this page works" button that walks the viewer through the page with
 * driver.js. The first time someone opens a page its tour starts by itself
 * (once per browser); after that it runs only from the button.
 */
export default function GuideTour({
  id,
  steps,
  label = "How this page works",
  autoStart = true,
  autoStartDelay = 900,
  tone = "dark",
}: {
  /** Names the tour for "already seen"; change it when the tour changes a lot. */
  id: string;
  steps: TourStep[];
  label?: string;
  autoStart?: boolean;
  /** How long after the page appears it starts by itself, so lists have loaded. */
  autoStartDelay?: number;
  /** "dark" for the navy page headers, "light" on white cards. */
  tone?: "dark" | "light";
}) {
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  /** Shows the tour; false when none of its steps are on the page. */
  const start = useCallback((): boolean => {
    const present: DriveStep[] = stepsRef.current
      .filter((s) => (!s.target || onPage(s.target)) && (!s.unless || !onPage(s.unless)))
      .map((s) => ({
        element: s.target ? `[data-tour="${s.target}"]` : undefined,
        popover: { title: s.title, description: s.text, side: s.side, align: "start" },
      }));
    if (present.length === 0) return false;
    markSeen(id);
    current = driver({
      steps: present,
      showProgress: present.length > 1,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Got it",
      popoverClass: "jdc-tour",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 10,
      smoothScroll: true,
    });
    current.drive();
    return true;
  }, [id]);

  useEffect(() => {
    if (!autoStart || hasSeen(id)) return;
    // Wait for the page to fill in (lists load, tabs appear): start once the
    // number of this tour's targets on screen has stopped growing (or after
    // 8s), and once no other tour is showing.
    const onScreen = () => stepsRef.current.filter((st) => st.target && onPage(st.target)).length;
    let last = -1;
    let waited = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const now = onScreen();
      waited += 400;
      const settled = now === last || waited >= 8000;
      last = now;
      if (!settled) return (timer = setTimeout(check, 400));
      if (tourShowing()) return (timer = setTimeout(check, 500));
      if (!hasSeen(id)) start();
    };
    timer = setTimeout(check, autoStartDelay);
    return () => clearTimeout(timer);
  }, [autoStart, autoStartDelay, id, start]);

  return (
    <button
      type="button"
      onClick={() => start()}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-btn px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
        tone === "dark"
          ? "border border-white/40 text-white hover:bg-white hover:text-ink"
          : "border border-smoke text-brand-navy hover:border-brand-navy"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.75c-.5.2-.8.6-.8 1.1v.45M8 11.4v.1" />
      </svg>
      {label}
    </button>
  );
}
