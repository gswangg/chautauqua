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

// DEC-925 (amendment, wave 52): the ONE spelled-number word list. Every
// module that needs a prose count ("three tracks", not "3 tracks") imports
// this instead of hand-copying its own array -- three private copies had
// already drifted (one 1-9, one 0-10 capitalised, one 0-10 lowercase) and a
// scan (test/count-grammar.scan.test.ts) now bans a fourth.
const SPELLED_COUNTS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Spells 0-10 ('zero' .. 'ten'), falls back to `String(n)` above 10.
 * Lowercase always -- callers that need a capitalized/uppercase sentence
 * head (a heading, a shouted date chip) capitalize the *result*, the same
 * way plural()'s bare noun is capitalized by its caller. Throws on a
 * negative or non-integer count (fail loudly: a spelled count is a display
 * value, never a defensive fallback for a bad upstream count). */
export function spellCount(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`spellCount: expected a non-negative integer, got ${n}`);
  }
  if (n > 10) return String(n);
  const word = SPELLED_COUNTS[n];
  if (word === undefined) throw new Error(`spellCount: no word for count ${n}`);
  return word;
}
