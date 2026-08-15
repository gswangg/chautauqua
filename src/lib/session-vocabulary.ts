// DEC-908 (wave-9 amendment): ONE session-shape display vocabulary, swept
// across every reader. Pure-core (no node:/cf imports, no DB types) -- these
// are DISPLAY-only reshapings. The wire contract stays verbatim (DEC-857/
// DEC-986): format and audienceLevel travel exactly as the server sends
// them; only how a reader PRINTS them changes here.

import { parseFormatDurationMin } from '../domain/schedule';

// 'Talk (30 min)' -> 'Talk, 30 min' -- resolves the minutes with the SAME
// rule the scheduler trusts (parseFormatDurationMin) and renders
// '<name>, <N> min'. A label with no parseable "(N min)" duration returns
// VERBATIM -- e.g. 'Panel (in Spanish)' is untouched, not mangled into
// 'Panel, in Spanish' by a blind trailing-parenthetical strip.
export function sessionFormatLabel(raw: string): string {
  const minutes = parseFormatDurationMin(raw);
  if (minutes === null) return raw;
  const name = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return `${name}, ${minutes} min`;
}

// 'Advanced' -> 'advanced' -- lowercases the stored label. Returns verbatim
// otherwise (already-lowercase input round-trips unchanged).
export function audienceLevelLabel(raw: string): string {
  return raw.toLowerCase();
}
