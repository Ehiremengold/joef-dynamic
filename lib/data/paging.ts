import "server-only";
import { pageRange, type Page } from "@/lib/paging";

type Row = Record<string, unknown>;
type Counted = PromiseLike<{ data: Row[] | null; count: number | null; error: unknown }>;

/**
 * Read one page of a counted query. `run` builds the query — with
 * `{ count: "exact" }` and a stable order — and applies the range it is given.
 *
 * Asking PostgREST for a page past the end is an error that carries no count.
 * When that happens the first row is fetched instead, purely to learn the real
 * total, so the caller can step back to the last page that still exists.
 */
export async function readPage<T>(
  run: (from: number, to: number) => Counted,
  page: number,
  map: (row: Row) => T
): Promise<Page<T>> {
  const { from, to } = pageRange(page);
  const { data, count, error } = await run(from, to);
  if (error && page > 1) {
    const first = await run(0, 0);
    return { rows: [], total: first.count ?? 0 };
  }
  return { rows: (data ?? []).map(map), total: count ?? 0 };
}
