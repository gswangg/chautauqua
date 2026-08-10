// Query-param parsing (pure-ish, inline — small enough not to warrant
// further extraction; itinerary id parsing already lives in src/lib/
// itinerary.ts). Split out of the former monolithic src/routes/public.tsx
// (contention decomposition) — no behavior change.

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function parseTrackId(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

/** Trim-or-null for the ?q= search box, shared by both search surfaces: the
 * EMB-02 keyword search on /sessions (title + speaker names) and the DEC-151
 * name search on /speakers and /gallery. Parsing is identical — only the
 * repo-side condition differs. */
export function parseNameQuery(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}
