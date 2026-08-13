// DEC-925: the ONE count-phrase helper for the whole codebase. Every "N
// noun, singular or plural" string goes through here instead of a
// hand-copied `n === 1 ? '' : 's'` ternary -- those drift (e.g. a stray
// "1 days ago").
// Irregular plurals (e.g. 'person' -> 'people') pass their plural form
// explicitly; this helper NEVER appends 's' to a guess.
//
// DEC-957: this is pure core (no node:/cloudflare/drizzle imports, DEC-002)
// so both the API/mail layer and the SPA can share one implementation. The
// SPA crosses the app/ -> src/ boundary via app/src/lib/plural.ts, the ONE
// named crossing for this vocabulary (same style as merge-fields.ts's
// DEC-660).

/** The noun alone, singular or plural, for the given count. */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** '<n> <noun>' with the noun pluralized correctly for n. */
export function countOf(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${plural(n, singular, pluralForm)}`;
}
