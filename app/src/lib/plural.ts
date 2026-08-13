// DEC-925: the ONE count-phrase helper in the SPA. Every "N noun(s)"
// string goes through here instead of a hand-copied `n === 1 ? '' : 's'`
// ternary -- those drift (e.g. a stray "1 days ago"). Irregular plurals
// (e.g. 'person' -> 'people') pass their plural form explicitly; this
// helper NEVER appends 's' to a guess.

/** The noun alone, singular or plural, for the given count. */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** '<n> <noun>' with the noun pluralized correctly for n. */
export function countOf(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${plural(n, singular, pluralForm)}`;
}
