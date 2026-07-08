"use client";

import { useCallback, useEffect, useState } from "react";

type Access = { code: string | null; active: boolean };

export default function EntranceAccess({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [access, setAccess] = useState<Access>({ code: null, active: false });
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/entrance-code");
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      setAccess(d.access);
      setDraft(d.access?.code || "");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(patch: { code?: string | null; active?: boolean }) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/entrance-code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not update");
      setAccess(d.access);
      setDraft(d.access?.code || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-card border border-smoke bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Entrance access code
          </h2>
          <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-pewter">
            Candidates must enter this code to take the common entrance test. Set
            it ahead of time, activate it on test day, then deactivate it when the
            exam is over.
          </p>
        </div>
        <span
          className={`rounded-btn px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
            access.active ? "bg-brand-green/15 text-brand-green" : "bg-mist text-pewter"
          }`}
        >
          {access.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="block text-sm font-semibold" htmlFor="entrance-code">
            Code
          </label>
          <input
            id="entrance-code"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. JDC-ENTR-2026"
            className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
          />
        </div>
        <button
          type="button"
          disabled={busy || draft.trim() === (access.code || "")}
          onClick={() => update({ code: draft })}
          className="cursor-pointer rounded-btn border border-ink px-4 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save code
        </button>
        {access.active ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => update({ active: false })}
            className="cursor-pointer rounded-btn border border-brand-red px-4 py-2.5 text-sm font-semibold text-brand-red transition-colors duration-200 hover:bg-brand-red hover:text-white disabled:opacity-50"
          >
            Deactivate (revoke)
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !(draft.trim() || access.code)}
            onClick={() => update({ code: draft, active: true })}
            className="cursor-pointer rounded-btn bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Activate (release)
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}

      <p className="mt-4 text-[13px] text-pewter">
        {access.code
          ? access.active
            ? "Candidates can register now with this code."
            : "Code saved but not released — candidates can't register yet."
          : "No code set yet."}
      </p>
    </div>
  );
}
