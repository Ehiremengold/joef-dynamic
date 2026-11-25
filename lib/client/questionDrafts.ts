"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * Questions a teacher has typed but not added (or changed but not saved) yet,
 * kept in this browser so they survive a reload, a closed tab, an expired
 * sign-in, a save refused because the test changed elsewhere, or simply
 * hiding the questions panel.
 *
 * Per teacher and test there is one draft for the paste box, one for the
 * "Add one question" form, and one per question being edited (named after
 * the question as it was, so it can be found again after other saves).
 * Drafts hold answers, so they are removed when the teacher signs out and
 * expire after DRAFT_DAYS; a teacher's drafts are never shown to anyone else
 * signed in on the same computer.
 *
 * Storage can be blocked or cleared (a private window), so every read and
 * write is guarded and the page works without it: the draft just isn't kept.
 */

/** Whose draft, for which test. */
export type DraftOf = { staffId: string; examId: string };
export type QuestionFields = { text: string; options: string[]; correctIndex: number };
/** A change to an existing question, with the question as it was, to find it again. */
export type EditDraft = QuestionFields & { original: { text: string; options: string[] } };
type Values = { paste: string; one: QuestionFields; edit: EditDraft };
export type DraftBox = keyof Values;
type Stored<B extends DraftBox = DraftBox> = DraftOf & { box: B; savedAt: number; value: Values[B] };
export type SavedDraft<B extends DraftBox> = { key: string; value: Values[B]; savedAt: number };

const PREFIX = "jdc-question-draft:";
const DRAFT_DAYS = 14;
const CHANGED = "jdc-question-drafts-changed";

/** When this page was loaded: a draft older than this was typed before it. */
export const PAGE_LOADED_AT = Date.now();

function keyOf(d: DraftOf, box: DraftBox, slot = ""): string {
  return `${PREFIX}${d.staffId}:${d.examId}:${box}${slot ? `:${slot}` : ""}`;
}

/** The slot of an edit draft: a short fingerprint of the question as it was. */
export function editSlot(original: EditDraft["original"]): string {
  let h = 5381;
  for (const ch of JSON.stringify(original)) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Stored;
    return typeof d?.savedAt === "number" && typeof d.examId === "string" && "value" in d ? d : null;
  } catch {
    return null;
  }
}

/** A stored draft, or null; an expired one is removed on the way. */
function readKey(key: string): Stored | null {
  const s = storage();
  if (!s) return null;
  try {
    const d = parse(s.getItem(key));
    if (d && Date.now() - d.savedAt > DRAFT_DAYS * 86_400_000) {
      s.removeItem(key);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

/** Keep (or, with null, forget) a draft. Writing what is already kept does nothing, so its age stands. */
function writeKey<B extends DraftBox>(key: string, d: DraftOf, box: B, value: Values[B] | null) {
  const s = storage();
  if (!s) return;
  const before = readKey(key);
  if (value === null ? before === null : before !== null && JSON.stringify(before.value) === JSON.stringify(value)) return;
  try {
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify({ ...d, box, savedAt: Date.now(), value } satisfies Stored<B>));
  } catch {
    /* full or blocked: the draft just isn't kept */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Every key of this teacher's drafts, optionally only for one test. */
function keysOf(staffId: string, examId?: string): string[] {
  const s = storage();
  if (!s) return [];
  const start = `${PREFIX}${staffId}:${examId ? `${examId}:` : ""}`;
  const keys: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(start)) keys.push(k);
    }
  } catch {
    return [];
  }
  return keys;
}

/** This teacher's draft for one box of a test, if any. */
export function readDraft<B extends DraftBox>(d: DraftOf, box: B, slot = ""): SavedDraft<B> | null {
  const key = keyOf(d, box, slot);
  const stored = readKey(key) as Stored<B> | null;
  return stored ? { key, value: stored.value, savedAt: stored.savedAt } : null;
}

/** Every unsaved edit this teacher has for a test's questions. */
export function readEditDrafts(d: DraftOf): SavedDraft<"edit">[] {
  return keysOf(d.staffId, d.examId)
    .map((key) => ({ key, stored: readKey(key) }))
    .filter((x): x is { key: string; stored: Stored<"edit"> } => x.stored?.box === "edit")
    .map(({ key, stored }) => ({ key, value: stored.value, savedAt: stored.savedAt }));
}

/** Keep (or, with null, forget) the draft for one box. */
export function writeDraft<B extends DraftBox>(d: DraftOf, box: B, value: Values[B] | null, slot = "") {
  writeKey(keyOf(d, box, slot), d, box, value);
}

/** Forget one draft by its key (one that can't be shown in a box any more). */
export function forgetDraft(key: string) {
  try {
    storage()?.removeItem(key);
  } catch {
    /* blocked */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The tests this teacher has unsaved questions for. */
export function examsWithDrafts(staffId: string): string[] {
  const ids = keysOf(staffId).flatMap((k) => {
    const d = readKey(k);
    return d ? [d.examId] : [];
  });
  return [...new Set(ids)].sort();
}

/** Forget all of this teacher's drafts (on sign out, so answers don't stay on a shared computer). */
export function clearDrafts(staffId: string) {
  const s = storage();
  if (!s) return;
  for (const k of keysOf(staffId)) {
    try {
      s.removeItem(k);
    } catch {
      /* blocked */
    }
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  // Another tab of the same browser saved or cleared one.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The ids of the tests this teacher has unsaved questions for, kept up to date. */
export function useExamsWithDrafts(staffId: string): Set<string> {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => examsWithDrafts(staffId).join(","),
    () => ""
  );
  return useMemo(() => new Set(snapshot ? snapshot.split(",") : []), [snapshot]);
}

/** What was kept for this box when it opened (read once), to start its fields from. */
export function useSavedDraft<B extends DraftBox>(d: DraftOf | null, box: B, slot = ""): SavedDraft<B> | null {
  const [saved] = useState(() => (d ? readDraft(d, box, slot) : null));
  return saved;
}

/**
 * Keep a box's draft while the teacher types, for one box of one test:
 *  - `current` is what to keep, or null when there is nothing worth keeping
 *    (an empty box, or an edit that changes nothing). Null forgets the draft.
 *  - `apply` shows a draft another tab of this browser wrote (or null when
 *    that tab added or discarded it), so one teacher's tabs show one draft
 *    and nothing already added is left in a box to be added twice.
 * Also warns before the tab closes while there is something unsaved.
 *
 * `restoredAt` is when a draft typed before this page was opened was last
 * changed, for a notice saying so; null once it is added or discarded.
 */
export function useKeepDraft<B extends DraftBox>(
  d: DraftOf | null,
  box: B,
  slot: string,
  saved: SavedDraft<B> | null,
  current: Values[B] | null,
  apply: (value: Values[B] | null) => void
): { restoredAt: number | null; forgetRestored: () => void } {
  const [restoredAt, setRestoredAt] = useState(saved && saved.savedAt < PAGE_LOADED_AT ? saved.savedAt : null);
  useWarnBeforeLeaving(current !== null);

  const key = d ? keyOf(d, box, slot) : null;
  const json = current === null ? null : JSON.stringify(current);
  const latest = useRef({ json, apply, current });
  useEffect(() => {
    latest.current = { json, apply, current };
  });

  useEffect(() => {
    if (key && d) writeKey(key, d, box, latest.current.current);
    // Written when the content changes (json), not on every new object.
  }, [key, json]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return;
    const follow = (e: StorageEvent) => {
      if (e.key !== key) return;
      const incoming = (parse(e.newValue)?.value ?? null) as Values[B] | null;
      // Already showing it: nothing to do (this also stops tabs echoing each other).
      if ((incoming === null ? null : JSON.stringify(incoming)) === latest.current.json) return;
      latest.current.apply(incoming);
      if (incoming === null) setRestoredAt(null);
    };
    window.addEventListener("storage", follow);
    return () => window.removeEventListener("storage", follow);
  }, [key]);

  return { restoredAt: current === null ? null : restoredAt, forgetRestored: () => setRestoredAt(null) };
}

/** Ask before the tab is closed or reloaded while `unsaved` is true. */
export function useWarnBeforeLeaving(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers need returnValue set; the text itself isn't shown.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
}
