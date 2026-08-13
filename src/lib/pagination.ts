// Pure pagination helpers per DEC-013: page is 1-based, perPage defaults to
// 50 and is server-clamped to a max of 200. No node:/cloudflare imports
// (DEC-002 pure-core rule) — plain arithmetic only, safe for any list route.

import { DEC_465 } from "../decisions";

void DEC_465;

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;
const MAX_PAGE = 10_000;

/** Clamps an arbitrary (possibly absent/NaN/negative/huge) page param to
 * [1, MAX_PAGE] per DEC-013 wave 54 amendment: a page param is clamped,
 * never trusted into an offset — `(clampPage(x)-1)*clampPerPage(y)` must
 * always be a safe integer for any input. */
export function clampPage(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

/** Clamps an arbitrary perPage param to [1, 200], defaulting to 50. */
export function clampPerPage(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return DEFAULT_PER_PAGE;
  return Math.min(n, MAX_PER_PAGE);
}

/** DEC-465: the one perPage rule for list endpoints that render every row
 * today (DEC-461(a)), replacing five local per-route copies (three of which
 * mishandled `?perPage=abc` by falling through to clampPerPage's
 * DEFAULT_PER_PAGE=50 instead of the site default of 200). Absent, null,
 * empty-string, or invalid all resolve to MAX_PER_PAGE; an explicit valid
 * value gets the normal [1, MAX_PER_PAGE] clamp. */
export function listPerPage(raw: string | number | null | undefined): number {
  if (raw === undefined || raw === null || raw === "") return MAX_PER_PAGE;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return MAX_PER_PAGE;
  return Math.min(n, MAX_PER_PAGE);
}

export { DEFAULT_PER_PAGE, MAX_PER_PAGE, MAX_PAGE };
