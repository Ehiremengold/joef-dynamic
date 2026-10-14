"use client";

import { useCallback, useEffect, useState } from "react";
import { pageCount, pageRange } from "@/lib/paging";
import { isSuperAdmin, ROLE_LABELS } from "@/lib/roles";
import type { SignedInStaff, Staff, StaffRole } from "@/lib/types";
import Pagination from "./Pagination";

export default function TeamPanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const currentEmail = me.email;
  // Only a super admin can make a super admin, or change one's account.
  const roleChoices: StaffRole[] = isSuperAdmin(me.role) ? ["teacher", "admin", "super_admin"] : ["teacher", "admin"];
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      const list: Staff[] = d.staff || [];
      setStaff(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  /** Accounts list oldest-first, so a new one is on the last page — go there. */
  const showNewest = useCallback(async () => {
    const list = await load();
    if (list) setPage(pageCount(list.length));
  }, [load]);

  // Never past the end, even if the list is shorter than when the page was picked.
  const shownPage = Math.min(page, pageCount(staff.length));
  const { from, to } = pageRange(shownPage);

  useEffect(() => {
    load();
  }, [load]);

  /** Partial update — send only what changed, so nothing else gets clobbered. */
  async function patch(s: Staff, body: Record<string, unknown>) {
    setBusyId(s.id);
    setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, ...body }),
      });
      if (res.status === 401 || res.status === 403) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not update that account");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that account");
    } finally {
      setBusyId("");
    }
  }

  function changeRole(s: Staff, role: Staff["role"]) {
    if (role === s.role) return;
    const ok = window.confirm(
      role === "super_admin"
        ? `Make ${s.fullName} a super admin? They will be able to approve deletions and manage other super admins.`
        : role === "admin"
          ? `Make ${s.fullName} an administrator? They will be able to manage staff, students and exams.`
          : `Make ${s.fullName} a teacher? They will lose admin rights.`
    );
    if (!ok) return;
    patch(s, { role });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[300px_1fr]">
      <AddStaff roleChoices={roleChoices} onAdded={showNewest} onUnauthorized={onUnauthorized} />

      {/* min-w-0 lets the table's overflow-x-auto actually scroll instead of
          stretching the grid column past the viewport on mobile. */}
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight">Staff accounts</h2>
        {error && (
          <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 overflow-x-auto rounded-card border border-smoke bg-white">
          {loading && staff.length === 0 ? (
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
                {staff.slice(from, to + 1).map((s) => {
                  const isSelf = s.email === currentEmail;
                  return (
                    <tr key={s.id} className="border-b border-smoke last:border-0">
                      <td className="px-4 py-3 font-semibold">
                        {s.fullName}
                        {isSelf && <span className="ml-2 text-[12px] text-pewter">(you)</span>}
                      </td>
                      <td className="px-4 py-3">{s.email}</td>
                      <td className="px-4 py-3">
                        {isSelf || (isSuperAdmin(s.role) && !isSuperAdmin(me.role)) ? (
                          // Nobody changes their own role, and only a super
                          // admin can change a super admin's.
                          <span className="rounded-btn bg-brand-gold px-2 py-0.5 text-xs font-bold uppercase text-ink">
                            {ROLE_LABELS[s.role]}
                          </span>
                        ) : (
                          <select
                            value={s.role}
                            disabled={busyId === s.id}
                            onChange={(e) => changeRole(s, e.target.value as Staff["role"])}
                            aria-label={`Role for ${s.fullName}`}
                            className={`cursor-pointer rounded-btn border border-smoke px-2 py-1 text-xs font-bold uppercase outline-none focus:border-brand-navy disabled:opacity-50 ${
                              s.role === "teacher" ? "bg-mist text-graphite" : "bg-brand-gold text-ink"
                            }`}
                          >
                            {roleChoices.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.active ? (
                          <span className="text-brand-green">Active</span>
                        ) : (
                          <span className="text-pewter">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf || (isSuperAdmin(s.role) && !isSuperAdmin(me.role)) ? (
                          <span className="text-[13px] text-pewter">—</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => patch(s, { active: !s.active })}
                            className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline disabled:opacity-50"
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
        <Pagination page={shownPage} total={staff.length} onPage={setPage} />
      </div>
    </div>
  );
}

function AddStaff({
  roleChoices,
  onAdded,
  onUnauthorized,
}: {
  roleChoices: StaffRole[];
  onAdded: () => void;
  onUnauthorized: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("teacher");
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
        onChange={(e) => setRole(e.target.value as StaffRole)}
        className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
      >
        {roleChoices.map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
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
