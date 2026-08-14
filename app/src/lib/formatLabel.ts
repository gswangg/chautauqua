/**
 * The server's Format field returns a verbatim label like "Talk (30 min)" --
 * a raw dropdown-option string, not a formatted display value. This is the
 * ONE place that turns that raw parenthetical into display copy: "Talk, 30
 * min" (or "Talk, 30m" with `abbreviate: true`). A label with no
 * parenthetical (or one that doesn't match the "(N min)" shape) passes
 * through unchanged -- this only ever reshapes the specific pattern the CFP
 * format dropdown produces, never truncates or guesses at arbitrary text.
 */
export function formatFormatLabel(raw: string, opts?: { abbreviate?: boolean }): string {
  const match = raw.match(/^(.*\S)\s*\((\d+)\s*min\)\s*$/);
  if (!match) return raw;
  const [, name, minutes] = match;
  const unit = opts?.abbreviate ? 'm' : ' min';
  return `${name}, ${minutes}${unit}`;
}
