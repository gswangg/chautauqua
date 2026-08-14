// DEC-908 (wave-9 amendment): ONE session-shape display vocabulary, swept
// across every reader. Pure-core (no node:/cf imports, no DB types) -- these
// are DISPLAY-only reshapings. The wire contract stays verbatim (DEC-857/
// DEC-986): format and audienceLevel travel exactly as the server sends
// them; only how a reader PRINTS them changes here.

// 'Talk (30 min)' -> 'Talk, 30 min' -- strips ONE trailing parenthetical
// into a comma clause. A format with no parenthetical returns verbatim.
export function sessionFormatLabel(raw: string): string {
  return raw.replace(/\s*\(([^)]+)\)$/, ', $1');
}

// 'Advanced' -> 'advanced' -- lowercases the stored label. Returns verbatim
// otherwise (already-lowercase input round-trips unchanged).
export function audienceLevelLabel(raw: string): string {
  return raw.toLowerCase();
}
