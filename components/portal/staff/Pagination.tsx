"use client";

import { pageCount, pageRange } from "@/lib/paging";

const BUTTON =
  "cursor-pointer rounded-btn border border-smoke bg-white px-3 py-1.5 font-semibold text-ink transition-colors duration-150 hover:border-brand-navy disabled:cursor-not-allowed disabled:opacity-40";

/** "1–20 of 990" with Previous / page picker / Next. Renders nothing for an empty list. */
export default function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const pages = pageCount(total);
  const { from, to } = pageRange(page);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-pewter">
      <p>
        {from + 1}–{Math.min(to + 1, total)} of {total}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={BUTTON}>
            Previous
          </button>
          <label className="flex items-center gap-2">
            Page
            <select
              value={page}
              onChange={(e) => onPage(Number(e.target.value))}
              className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1.5 font-semibold text-ink outline-none focus:border-brand-navy"
            >
              {Array.from({ length: pages }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
            of {pages}
          </label>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={BUTTON}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
