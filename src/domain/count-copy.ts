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

// DEC-422 (amendment): the ONE overage-phrase helper -- every field-length
// refusal ("N characters over the limit") goes through here instead of
// hand-composing its own count phrase, so pluralization stays
// single-sourced through countOf/plural above.

/** e.g. '1 character over' or '34 characters over' (noun pluralized via
 * countOf above), for a value that exceeds `max` by `length - max`.
 * Callers embed this in their own sentence (e.g. `${label} is
 * ${overBudgetBy(value.length, max)} the limit.`). Throws if `length` does
 * not actually exceed `max` -- this is a refusal-composition helper, not a
 * defensive length check. */
export function overBudgetBy(length: number, max: number): string {
  if (length <= max) {
    throw new Error(`overBudgetBy: length ${length} does not exceed max ${max}`);
  }
  return `${countOf(length - max, "character")} over`;
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

// DEC-957 (amendment, wave 56): capitalize-first and the error-summary
// heading get ONE home each -- every module that needs to capitalize a
// sentence head (a heading, a shouted date chip) or build the "N things
// need fixing" copy imports these instead of hand-copying its own
// `charAt(0).toUpperCase() + slice(1)` or heading-composition ternary. Five
// private copies of the former, and a re-composed heading sentence, had
// already drifted before this helper existed.

/** Capitalizes the first character; empty string passes through unchanged. */
export function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

/**
 * The top-of-form error summary heading -- 'One thing needs fixing before
 * this can be sent', 'Three things need fixing ...', '11 things need fixing
 * ...'. `tail` is appended after 'fixing ' (e.g. 'before this can be
 * sent').
 */
export function thingsNeedFixingHeading(n: number, tail: string): string {
  return `${capitalizeFirst(spellCount(n))} ${plural(n, "thing")} ${plural(n, "needs", "need")} fixing ${tail}`;
}
