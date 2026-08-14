/**
 * DEC-906 (wave-9 amendment): the product's ONE pagination-summary shape,
 * used by every paged table. "Showing {start}–{end} of {total}" with a
 * U+2013 EN DASH (never an ASCII hyphen, never an `&ndash;` entity) --
 * total === 0 collapses to "Showing 0 of 0", never "Showing 0–0 of 0".
 *
 * `shownOnPage` lets a caller whose "end" is determined by the actual
 * number of rows rendered on the page (not blindly `page * perPage`, which
 * overshoots on a partial last page or an empty page) pass that count
 * directly instead of re-deriving it.
 */
export function paginationSummary(page: number, perPage: number, total: number, shownOnPage?: number): string {
  if (total === 0) return 'Showing 0 of 0';
  const start = (page - 1) * perPage + 1;
  const end = shownOnPage !== undefined ? (page - 1) * perPage + shownOnPage : Math.min(page * perPage, total);
  return `Showing ${start}–${end} of ${total}`;
}
