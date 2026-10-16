"use client";

import { useCallback, useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { pageCount } from "@/lib/paging";
import { useApi, useInvalidate } from "@/lib/client/api";

/**
 * A staff list the server pages for us: `GET url?<filters>&page=N` answering
 * `{ [rowsKey]: T[], total }`, read through the shared cache.
 *
 * Changing a filter goes back to page 1, after a short pause so typing in a
 * search box doesn't send a request per keystroke; turning a page is
 * immediate. The rows on screen stay up while the next ones load, and a page
 * seen before shows at once. Call `reload` after changing a row.
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

  // New filters: back to the first page. Done while rendering, so the old
  // page number is never requested against the new filters.
  const [pagedQuery, setPagedQuery] = useState(query);
  if (pagedQuery !== query) {
    setPagedQuery(query);
    setPage(1);
  }

  // What is actually fetched lags typing by 300ms.
  const [fetchedQuery, setFetchedQuery] = useState(query);
  useEffect(() => {
    if (query === fetchedQuery) return;
    const t = setTimeout(() => setFetchedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchedQuery]);

  const { data, isPending, isPlaceholderData } = useApi<Record<string, unknown> & { total: number }>(
    `${url}?${fetchedQuery && `${fetchedQuery}&`}page=${page}`,
    onUnauthorized,
    { placeholderData: keepPreviousData }
  );

  // This page no longer exists (the list got shorter): step back to the last
  // one that does, keeping the current rows up until it arrives.
  const lastPage = data ? pageCount(data.total) : page;
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const invalidate = useInvalidate();
  const reload = useCallback(() => {
    invalidate(url);
  }, [invalidate, url]);

  return {
    rows: ((data?.[rowsKey] as T[] | undefined) ?? []) as T[],
    /** The whole answer, for anything a list sends besides its rows. */
    response: data,
    total: data?.total ?? 0,
    page,
    setPage,
    // True only while the rows shown are not yet the ones asked for — a quiet
    // background refresh of the same page doesn't count.
    loading: isPending || isPlaceholderData || query !== fetchedQuery,
    reload,
  };
}
