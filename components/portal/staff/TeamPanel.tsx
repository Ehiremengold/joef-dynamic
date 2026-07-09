"use client";

import { useCallback, useEffect, useState } from "react";
import type { Staff } from "@/lib/types";

export default function TeamPanel({
  currentEmail,
  onUnauthorized,
}: {
  currentEmail: string;
  onUnauthorized: () => void;
}) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      setStaff(d.staff || []);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(s: Staff) {
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    if (res.ok) load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <AddStaff onAdded={load} onUnauthorized={onUnauthorized} />

      {/* min-w-0 lets the table's overflow-x-auto actually scroll instead of
          stretching the grid column past the viewport on mobile. */}
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight">Staff accounts</h2>
        <div className="mt-4 overflow-x-auto rounded-card border border-smoke bg-white">
          {loading ? (
            <p className="p-6 text-sm text-graphite">Loading…</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const isSelf = s.email === currentEmail;
                  return (
                    <tr key={s.id} className="border-b border-smoke last:border-0">
                      <td className="px-4 py-3 font-semibold">
                        {s.fullName}
                        {isSelf && <span className="ml-2 text-[12px] text-pewter">(you)</span>}
                      </td>
                      <td className="px-4 py-3">{s.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-btn px-2 py-0.5 text-xs font-bold uppercase ${
                            s.role === "admin" ? "bg-brand-gold text-ink" : "bg-mist text-graphite"
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.active ? (
                          <span className="text-brand-green">Active</span>
                        ) : (
                          <span className="text-pewter">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-[13px] text-pewter">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleActive(s)}
                            className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline"
                          >
                            {s.active ? "Deactivate" : "Reactivate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function AddStaff({
  onAdded,
  onUnauthorized,
}: {
  onAdded: () => void;
  onUnauthorized: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not create account");
      setOk(`${fullName} can now sign in with ${email}.`);
      setFullName("");
      setEmail("");
      setPassword("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="h-fit rounded-card border border-smoke bg-white p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Add staff</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-pewter">
        Create a login for a teacher or administrator. Share the password with
        them securely; they can change it later.
      </p>

      <label className="mt-5 block text-sm font-semibold" htmlFor="t-name">Full name</label>
      <input
        id="t-name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="t-email">Email</label>
      <input
        id="t-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="t-pass">Temporary password</label>
      <input
        id="t-pass"
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="t-role">Role</label>
      <select
        id="t-role"
        value={role}
        onChange={(e) => setRole(e.target.value as "teacher" | "admin")}
        className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      >
        <option value="teacher">Teacher</option>
        <option value="admin">Administrator</option>
      </select>

      {error && <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">{error}</p>}
      {ok && <p className="mt-3 text-sm font-semibold text-brand-green">{ok}</p>}

      <button
        type="submit"
        disabled={busy || !fullName.trim() || !email.trim() || password.length < 8}
        className="mt-5 w-full cursor-pointer rounded-btn bg-brand-red px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
