"use client";

import { useCallback, useState } from "react";
import { ApiError, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import type { ChangeRequest } from "@/lib/recordChanges";
import EditRecordDialog from "./EditRecordDialog";
import { pageCount, pageRange } from "@/lib/paging";
import { isSuperAdmin, ROLE_LABELS } from "@/lib/roles";
import type { SignedInStaff, Staff, StaffRole } from "@/lib/types";
import Pagination from "./Pagination";
import { useConfirm } from "./useConfirm";

export default function TeamPanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const currentEmail = me.email;
  // Only a super admin can make a super admin, or change one's account.
  const roleChoices: StaffRole[] = isSuperAdmin(me.role) ? ["teacher", "admin", "super_admin"] : ["teacher", "admin"];
  const staffQ = useApi<{ staff: Staff[] }>("/api/staff", onUnauthorized);
  const staff = staffQ.data?.staff ?? [];
  const loading = staffQ.isPending;
  const [busyId, setBusyId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [notice, setNotice] = useState("");
  const pendingQ = useApi<{ requests: ChangeRequest[] }>("/api/change-requests?pending=1", onUnauthorized);
  const pendingFor = new Set(
    (pendingQ.data?.requests ?? []).filter((r) => r.recordType === "staff" && r.status === "pending").map((r) => r.recordId)
  );
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState<{ fullName: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { refetch } = staffQ;
  const invalidate = useInvalidate();
  // Classes show their class teacher's name, so a renamed account refreshes them too.
  const load = useCallback(async () => {
    invalidate("/api/classes");
    return (await refetch()).data?.staff;
  }, [refetch, invalidate]);

  /** Accounts list oldest-first, so a new one is on the last page — go there. */
  const showNewest = useCallback(async () => {
    const list = await load();
    if (list) setPage(pageCount(list.length));
  }, [load]);

  const needle = search.trim().toLowerCase();
  const shown = needle
    ? staff.filter((s) => s.fullName.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle))
    : staff;
  // Never past the end, even if the list is shorter than when the page was picked.
  const shownPage = Math.min(page, pageCount(shown.length));
  const { from, to } = pageRange(shownPage);

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

  async function resetPassword(s: Staff) {
    const ok = await confirm({
      title: `Reset ${s.fullName}'s password?`,
      message: "Their current password stops working straight away. You'll be shown the new one once, to give them privately.",
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    setBusyId(s.id);
    setError("");
    setNewPassword(null);
    setCopied(false);
    try {
      const d = await sendJson<{ password: string }>("/api/staff", "PATCH", { id: s.id, action: "reset-password" });
      setNewPassword({ fullName: s.fullName, email: s.email, password: d.password });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not reset the password");
    } finally {
      setBusyId("");
    }
  }

  async function copyPassword() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword.password);
      setCopied(true);
    } catch {
      /* clipboard blocked: they can still read it off the screen */
    }
  }

  async function changeRole(s: Staff, role: Staff["role"]) {
    if (role === s.role) return;
    const ok = await confirm({
      title: `Make ${s.fullName} ${role === "admin" ? "an administrator" : role === "super_admin" ? "a super admin" : "a teacher"}?`,
      message:
        role === "super_admin"
          ? "They will be able to approve deletions and manage other super admins."
          : role === "admin"
            ? "They will be able to manage staff, students and exams."
            : "They will lose admin rights.",
      confirmLabel: "Change role",
    });
    if (!ok) return;
    patch(s, { role });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[300px_1fr]">
      {dialog}
      {editing && (
        <EditRecordDialog
          recordType="staff"
          recordId={editing.id}
          title={`Edit ${editing.fullName}`}
          initial={{ fullName: editing.fullName, email: editing.email }}
          superAdmin={isSuperAdmin(me.role)}
          onClose={() => setEditing(null)}
          onUnauthorized={onUnauthorized}
          onDone={(applied) => {
            setNotice(
              applied
                ? `${editing.fullName}'s details are saved. Report cards they already signed keep the name they were signed with.`
                : `Change to ${editing.fullName} sent to a super admin for approval.`
            );
            setEditing(null);
            invalidate("/api/change-requests");
            load();
          }}
        />
      )}
      <AddStaff roleChoices={roleChoices} onAdded={showNewest} onUnauthorized={onUnauthorized} />

      {/* min-w-0 lets the table's overflow-x-auto actually scroll instead of
          stretching the grid column past the viewport on mobile. */}
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight">Staff accounts</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email"
          data-tour="team-search"
          className="mt-4 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy sm:max-w-sm"
        />
        {notice && (
          <p className="mt-3 rounded-card border border-brand-green bg-brand-green/10 px-4 py-3 text-sm font-semibold text-ink">{notice}</p>
        )}
        {newPassword && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-green bg-brand-green/10 px-4 py-3">
            <p className="text-sm text-ink">
              New password for <strong>{newPassword.fullName}</strong> ({newPassword.email}):{" "}
              <span className="font-mono text-base font-bold text-brand-green">{newPassword.password}</span>
              <span className="ml-2 text-graphite">Give it to them privately. It won&rsquo;t be shown again.</span>
            </p>
            <span className="flex gap-3">
              <button type="button" onClick={copyPassword} className="cursor-pointer text-sm font-semibold text-brand-navy hover:underline">
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={() => setNewPassword(null)} className="cursor-pointer text-sm font-semibold text-graphite hover:text-ink">
                Dismiss
              </button>
            </span>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">
            {error}
          </p>
        )}
        <div data-tour="team-table" className="mt-4 overflow-x-auto rounded-card border border-smoke bg-white">
          {loading && staff.length === 0 ? (
            <p className="p-6 text-sm text-graphite">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="p-6 text-sm text-graphite">No staff match that search.</p>
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
                {shown.slice(from, to + 1).map((s) => {
                  const isSelf = s.email === currentEmail;
                  // Only a super admin can change a super admin's account.
                  const locked = isSuperAdmin(s.role) && !isSuperAdmin(me.role);
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
                            data-tour="team-role"
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
                        <div className="flex gap-3 whitespace-nowrap">
                          {!locked &&
                            (pendingFor.has(s.id) ? (
                              <span className="rounded-btn bg-brand-gold/30 px-1.5 py-0.5 text-[12px] font-semibold text-ink" title="Waiting for a super admin">
                                Change pending
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === s.id}
                                data-tour="team-rename"
                                onClick={() => setEditing(s)}
                                className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline disabled:opacity-50"
                              >
                                Edit details
                              </button>
                            ))}
                          {!isSelf && !locked && (
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              data-tour="team-password"
                              onClick={() => resetPassword(s)}
                              className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline disabled:opacity-50"
                            >
                              Reset password
                            </button>
                          )}
                          {!isSelf && !locked && (
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              data-tour="team-active"
                              onClick={() => patch(s, { active: !s.active })}
                              className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline disabled:opacity-50"
                            >
                              {s.active ? "Deactivate" : "Reactivate"}
                            </button>
                          )}
                          {locked && <span className="text-[13px] text-pewter">Super admin only</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={shownPage} total={shown.length} onPage={setPage} />
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
    <form data-tour="team-add" onSubmit={submit} className="h-fit rounded-card border border-smoke bg-white p-6">
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
