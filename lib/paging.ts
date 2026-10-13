/** Rows per page in the staff tables (roster, results, staff accounts). */
export const PAGE_SIZE = 20;

/** One page of a longer list, plus how many rows the whole list has. */
export type Page<T> = { rows: T[]; total: number };

/** How many pages `total` rows fill — never fewer than one. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** Zero-based, inclusive row range of a 1-based page. */
export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}
