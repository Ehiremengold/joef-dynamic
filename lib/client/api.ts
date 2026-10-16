"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  QueryClient,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";

/** A non-2xx answer from one of the portal's own API routes. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** GET a portal API route as JSON, throwing ApiError (with the route's own message) on failure. */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error || "Something went wrong", res.status);
  return body as T;
}

/** POST/PUT/PATCH/DELETE a portal API route; same errors as getJson. */
export async function sendJson<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || "Something went wrong", res.status);
  return data as T;
}

/**
 * The cache key for an API URL: the path, then its query parameters.
 * Keying on the path first is what lets a save refresh "everything under
 * /api/classes" with one invalidate — see useInvalidate.
 */
export function apiKey(url: string): QueryKey {
  const [path, search] = url.split("?");
  return search ? [path, Object.fromEntries(new URLSearchParams(search))] : [path];
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Shown straight from the cache when you come back to a tab, and
        // quietly refreshed behind it once it is this old.
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: true,
        // A 4xx won't fix itself; a flaky network might.
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      },
    },
  });
}

/**
 * Read a portal API route through the shared cache. Pass null to wait (a
 * select not chosen yet). A 401 calls onUnauthorized so the page re-checks
 * who is signed in.
 *
 * `isPending` is only true the very first time — after that the last answer
 * stays on screen while a newer one loads (`isFetching`).
 */
export function useApi<T>(
  url: string | null,
  onUnauthorized?: () => void,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn" | "enabled">
) {
  const query = useQuery<T, Error>({
    queryKey: url ? apiKey(url) : ["disabled"],
    queryFn: () => getJson<T>(url!),
    enabled: url !== null,
    ...options,
  });

  const unauthorized = useRef(onUnauthorized);
  useEffect(() => {
    unauthorized.current = onUnauthorized;
  });
  const status = query.error instanceof ApiError ? query.error.status : 0;
  useEffect(() => {
    if (status === 401) unauthorized.current?.();
  }, [status, query.errorUpdatedAt]);

  return query;
}

/**
 * Settings for a sheet someone types into (attendance, report cards,
 * promotion). Opening it shows the cached copy at once and checks for a newer
 * one; after that it is only re-read when the viewer switches class/term or
 * saves — never on window focus, so nothing changes under someone's typing.
 */
export const EDITABLE = {
  staleTime: 0,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

/**
 * After a save: refresh every cached answer under these API paths, e.g.
 * invalidate("/api/classes") refreshes /api/classes and /api/classes?campusId=…
 * (but not /api/classes/:id/…, which has a path of its own).
 */
export function useInvalidate() {
  const client = useQueryClient();
  return useCallback(
    (...paths: string[]) => Promise.all(paths.map((p) => client.invalidateQueries({ queryKey: [p] }))),
    [client]
  );
}
