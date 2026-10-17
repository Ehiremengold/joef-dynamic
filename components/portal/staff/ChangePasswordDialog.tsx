"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, sendJson } from "@/lib/client/api";

const INPUT = "mt-1 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy";

/** A signed-in staff member sets their own password (the current one first). */
export default function ChangePasswordDialog({ onClose, onUnauthorized }: { onClose: () => void; onUnauthorized: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mismatch = again.length > 0 && again !== next;
  const short = next.length > 0 && next.length < 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/me/password", "POST", { currentPassword: current, newPassword: next });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not change your password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 text-ink" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pw-title" className="w-full max-w-[420px] rounded-card border border-smoke bg-white p-6">
        <h3 id="pw-title" className="font-display text-lg font-bold tracking-tight">Change my password</h3>
        {done ? (
          <>
            <p className="mt-3 text-sm font-semibold text-brand-green">Your password is changed. Use the new one next time you sign in.</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mt-4 block text-[13px] font-semibold" htmlFor="pw-current">Current password</label>
            <input id="pw-current" ref={first} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={INPUT} />
            <label className="mt-3 block text-[13px] font-semibold" htmlFor="pw-new">New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" className={INPUT} />
            <label className="mt-3 block text-[13px] font-semibold" htmlFor="pw-again">New password again</label>
            <input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={INPUT} />
            {(short || mismatch) && (
              <p className="mt-2 text-[13px] text-brand-red">{short ? "At least 8 characters." : "The two new passwords don't match."}</p>
            )}
            {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !current || next.length < 8 || next !== again}
                className="cursor-pointer rounded-btn bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Saving…" : "Change password"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
