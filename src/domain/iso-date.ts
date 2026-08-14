// DEC-510 (wave 46 amendment): the ONE home for the YYYY-MM-DD grammar. Pure
// core — no imports, no node:/cloudflare — so both route-layer validators
// and repo-layer day gates (src/server/repo/agenda/days.ts's isIsoDay)
// delegate here instead of re-spelling the regex.
//
// Shape-only (/^\d{4}-\d{2}-\d{2}$/) is not enough: it accepts calendar-
// invalid values like '2026-02-30' or '2026-13-01', which then break
// downstream string-based date math that assumes a real day. True only when
// the value matches the pattern AND round-trips through Date/toISOString.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}
