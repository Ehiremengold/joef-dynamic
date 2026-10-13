"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pageCount } from "@/lib/paging";

/**
 * A staff list the server pages for us: `GET url?<filters>&page=N` answering
 * `{ [rowsKey]: T[], total }`.
 *
 * Changing a filter goes back to page 1, after a short pause so typing in a
 * search box doesn't send a request per keystroke; turning a page is
 * immediate. Only the newest request's answer is ever shown, and the rows on
 * screen stay up while the next ones load. Call `reload` after changing a row.
 */
export function usePagedList<T>({
  url,
  rowsKey,
  filters,
  onUnauthorized,
}: {
  url: string;
  rowsKey: string;
  /** Query parameters to filter by; empty values are left out. */
  filters: Record<string, string>;
  onUnauthorized: () => void;
}) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== "")
  ).toString();

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  // New filters: back to the first page. Done while rendering, so the old
  // page number is never requested against the new filters.
  const [pagedQuery, setPagedQuery] = useState(query);
  if (pagedQuery !== query) {
    setPagedQuery(query);
    setPage(1);
  }

  const unauthorized = useRef(onUnauthorized);
  useEffect(() => {
    unauthorized.current = onUnauthorized;
  });

  const fetchedQuery = useRef(query);
  useEffect(() => {
    const typing = fetchedQuery.current !== query;
    fetchedQuery.current = query;

    let superseded = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`${url}?${query && `${query}&`}page=${page}`);
      const body = res.ok ? await res.json() : null;
      if (superseded) return;
      if (res.status === 401) unauthorized.current();
      if (body) {
        // This page no longer exists (the list got shorter): step back to the
        // last one that does, and keep the current rows up until it arrives.
        const lastPage = pageCount(body.total);
        if (page > lastPage) return setPage(lastPage);
        setRows(body[rowsKey]);
        setTotal(body.total);
      }
      setLoading(false);
    }, typing ? 300 : 0);

    return () => {
      superseded = true;
      clearTimeout(timer);
    };
  }, [url, rowsKey, query, page, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  return { rows, total, page, setPage, loading, reload };
}
