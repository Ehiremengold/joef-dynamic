"use client";

import { useState } from "react";
import { isSuperAdmin } from "@/lib/roles";
import { CLASSES, type Attempt, type SignedInStaff } from "@/lib/types";
import Pagination from "./Pagination";
import { usePagedList } from "./usePagedList";
import { useConfirm } from "./useConfirm";

const YEARS = ["2024", "2025", "2026", "2027"];

export default function ResultsPanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const { rows: attempts, total, page, setPage, loading, reload } = usePagedList<Attempt>({
    url: "/api/attempts",
    rowsKey: "attempts",
    filters: { name: name.trim(), className, year, type },
    onUnauthorized,
  });

  /** Super admins only, for a result whose exam is gone — otherwise it is cleared from that exam's sittings. */
  async function remove(a: Attempt) {
    const ok = await confirm({
      title: `Delete ${a.takerName}'s result?`,
      message: `Their ${a.score}/${a.total} for “${a.examTitle}” is deleted for good.`,
      confirmLabel: "Delete result",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/attempts/${a.id}`, { method: "DELETE" });
    if (res.status === 401) return onUnauthorized();
    if (res.ok) reload();
  }

  return (
    <div>
      {dialog}
      <div className="rounded-card border border-smoke bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-semibold" htmlFor="f-name">Search name</label>
            <input
              id="f-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student or candidate name"
              className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="f-class">Class</label>
            <select
              id="f-class"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            >
              <option value="">All classes</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="f-year">Year</label>
            <select
              id="f-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            >
              <option value="">All years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="f-type">Type</label>
            <select
              id="f-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-2 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            >
              <option value="">All types</option>
              <option value="class">Class test</option>
              <option value="entrance">Common entrance</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-card border border-smoke bg-white">
        {loading && attempts.length === 0 ? (
          <p className="p-6 text-sm text-graphite">Loading results…</p>
        ) : attempts.length === 0 ? (
          <p className="p-6 text-sm text-graphite">No results match these filters.</p>
        ) : (
          <table className={`w-full min-w-[720px] text-left text-sm transition-opacity duration-150 ${loading ? "opacity-60" : ""}`}>
            <thead>
              <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Test</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-smoke last:border-0">
                  <td className="px-4 py-3 font-semibold">{a.takerName}</td>
                  <td className="px-4 py-3">{a.examTitle}</td>
                  <td className="px-4 py-3">
                    {a.examType === "entrance" ? "Entrance" : "Class test"}
                  </td>
                  <td className="px-4 py-3">{a.className || "—"}</td>
                  <td className="px-4 py-3">{a.year}</td>
                  <td className="px-4 py-3">
                    <span className="font-display font-bold">{a.score}/{a.total}</span>{" "}
                    <span className="text-pewter">
                      ({a.total ? Math.round((a.score / a.total) * 100) : 0}%)
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-graphite">
                    {new Date(a.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 whitespace-nowrap">
                      <a
                        href={`/api/attempts/${a.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                      >
                        Slip
                      </a>
                      {a.takerType === "student" && a.studentId && (
                        <a
                          href={`/api/students/${a.studentId}/transcript`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer text-[13px] font-semibold text-brand-red hover:underline"
                        >
                          Transcript
                        </a>
                      )}
                      {a.examId === null && isSuperAdmin(me.role) && (
                        <button
                          type="button"
                          onClick={() => remove(a)}
                          className="cursor-pointer text-[13px] font-semibold text-graphite hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} total={total} onPage={setPage} />
    </div>
  );
}
