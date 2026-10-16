"use client";

import { useState } from "react";
import { ApiError, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import type { AcademicSession, Term } from "@/lib/types";

const TERM_NAMES: Term["name"][] = ["First Term", "Second Term", "Third Term"];

/** "2025/2026" → "2026/2027"; a fresh install suggests this year's. */
function nextSessionName(sessions: AcademicSession[]): string {
  const latest = [...sessions].map((s) => Number(s.name.slice(0, 4))).filter(Boolean).sort().pop();
  const start = latest ? latest + 1 : new Date().getFullYear();
  return `${start}/${start + 1}`;
}

/**
 * The school calendar: academic sessions, their three terms, which term is
 * current, and the "next term begins" date printed on each term's report
 * sheets. Admins only.
 */
export default function SessionsPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const invalidate = useInvalidate();
  const sessionsQ = useApi<{ sessions: AcademicSession[] }>("/api/sessions", onUnauthorized);
  const termsQ = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized);
  const [newSession, setNewSession] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (sessionsQ.isPending || termsQ.isPending) return <p className="text-sm text-graphite">Loading…</p>;
  const sessions = [...(sessionsQ.data?.sessions ?? [])].sort((a, b) => b.name.localeCompare(a.name));
  const terms = termsQ.data?.terms ?? [];
  const current = terms.find((t) => t.isCurrent);
  const suggested = nextSessionName(sessions);

  async function run(key: string, action: () => Promise<unknown>, done: string): Promise<boolean> {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
      await invalidate("/api/sessions", "/api/terms");
      setNotice(done);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy("");
    }
  }

  const addSession = (e: React.FormEvent) => {
    e.preventDefault();
    const name = (newSession.trim() || suggested).replace(/\s*[-–]\s*/, "/");
    run("session", () => sendJson("/api/sessions", "POST", { name }), `Session ${name} added. Now add its terms.`).then(
      (ok) => ok && setNewSession("")
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Sessions &amp; terms</h2>
        <p className="mt-1 max-w-[680px] text-sm leading-relaxed text-graphite">
          The current term is the one attendance, report cards and results open on for everyone.
          Start each new session here: add it, add its terms, then make First Term current. The
          “next term begins” date prints at the bottom of that term’s report sheets.
        </p>
      </div>

      <div data-tour="sessions-current" className="rounded-card border border-brand-gold bg-brand-gold/15 px-4 py-3 text-sm">
        {current ? (
          <>
            The portal is on <strong>{current.name}, {current.sessionName}</strong>.
          </>
        ) : (
          <>No term is current yet. Choose one below.</>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-brand-red" role="alert">{error}</p>}
      {notice && <p className="text-sm font-semibold text-brand-green">{notice}</p>}

      <form data-tour="sessions-add" onSubmit={addSession} className="flex flex-wrap items-end gap-2 rounded-card border border-smoke bg-white p-4">
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="sess-name">Add a session</label>
          <input
            id="sess-name"
            type="text"
            value={newSession}
            onChange={(e) => setNewSession(e.target.value)}
            placeholder={suggested}
            className="mt-1 w-40 rounded-btn border border-smoke px-3 py-2 text-sm outline-none focus:border-brand-navy"
          />
        </div>
        <button
          type="submit"
          disabled={busy !== ""}
          className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add {newSession.trim() || suggested}
        </button>
      </form>

      {sessions.length === 0 ? (
        <p className="text-sm text-graphite">No sessions yet.</p>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => {
            const mine = terms.filter((t) => t.sessionId === s.id);
            return (
              <div key={s.id} className="rounded-card border border-smoke bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-smoke px-4 py-3">
                  <h3 className="font-display text-base font-bold tracking-tight">{s.name}</h3>
                  {s.isCurrent && (
                    <span className="rounded-btn bg-brand-gold px-2 py-0.5 text-[12px] font-semibold text-ink">
                      Current session
                    </span>
                  )}
                </div>
                <ul>
                  {TERM_NAMES.map((name) => {
                    const t = mine.find((x) => x.name === name);
                    return (
                      <li
                        key={name}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-smoke px-4 py-2.5 text-sm last:border-0"
                      >
                        <span className={t ? "font-semibold" : "text-pewter"}>{name}</span>
                        {!t ? (
                          <button
                            type="button"
                            data-tour="sessions-add-term"
                            disabled={busy !== ""}
                            onClick={() =>
                              run(`add-${s.id}-${name}`, () => sendJson("/api/terms", "POST", { sessionId: s.id, name }), `${name} ${s.name} added.`)
                            }
                            className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline disabled:opacity-50"
                          >
                            Add {name}
                          </button>
                        ) : (
                          <span className="flex flex-wrap items-center gap-3">
                            <label data-tour="sessions-date" className="flex items-center gap-2 text-[13px] text-pewter">
                              Next term begins
                              <input
                                type="date"
                                defaultValue={t.nextTermBegins ?? ""}
                                key={t.nextTermBegins ?? ""}
                                onBlur={(e) => {
                                  const date = e.target.value || null;
                                  if (date === (t.nextTermBegins ?? null)) return;
                                  run(
                                    `date-${t.id}`,
                                    () => sendJson("/api/terms", "PATCH", { id: t.id, action: "set-next-term-begins", date }),
                                    `Next-term date for ${name} ${s.name} saved.`
                                  );
                                }}
                                className="rounded-btn border border-smoke px-2 py-1 text-[13px] text-ink outline-none focus:border-brand-navy"
                              />
                            </label>
                            {t.isCurrent ? (
                              <span className="rounded-btn bg-brand-gold px-2 py-1 text-[12px] font-semibold text-ink">
                                Current term
                              </span>
                            ) : (
                              <button
                                type="button"
                                data-tour="sessions-make-current"
                                disabled={busy !== ""}
                                onClick={() =>
                                  run(
                                    `cur-${t.id}`,
                                    () => sendJson("/api/terms", "PATCH", { id: t.id, action: "set-current" }),
                                    `${name} ${s.name} is now the current term.`
                                  )
                                }
                                className="cursor-pointer rounded-btn border border-smoke px-2.5 py-1 text-[13px] font-semibold text-brand-navy hover:border-brand-navy disabled:opacity-50"
                              >
                                {busy === `cur-${t.id}` ? "Saving…" : "Make current"}
                              </button>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
