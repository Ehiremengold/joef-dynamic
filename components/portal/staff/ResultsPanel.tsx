"use client";

import { useCallback, useEffect, useState } from "react";
import { CLASSES, type Attempt } from "@/lib/types";

const YEARS = ["2024", "2025", "2026", "2027"];

export default function ResultsPanel({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      if (className) params.set("className", className);
      if (year) params.set("year", year);
      if (type) params.set("type", type);
      const res = await fetch(`/api/attempts?${params}`);
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const d = await res.json();
      setAttempts(d.attempts || []);
    } finally {
      setLoading(false);
    }
  }, [name, className, year, type, onUnauthorized]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
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
        {loading ? (
          <p className="p-6 text-sm text-graphite">Loading results…</p>
        ) : attempts.length === 0 ? (
          <p className="p-6 text-sm text-graphite">No results match these filters.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Test</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Date</th>
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
                  <td className="px-4 py-3 text-graphite">
                    {new Date(a.submittedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-4 text-[13px] text-pewter">
        {attempts.length} result{attempts.length === 1 ? "" : "s"} shown.
      </p>
    </div>
  );
}
