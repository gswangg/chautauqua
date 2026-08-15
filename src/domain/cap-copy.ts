// DEC-422 (amendment): the ONE over-cap refusal grammar. Every field-length
// (character) or field-count (item) cap refusal across the codebase builds
// its fields-map value and message sentence from here, instead of a
// hand-composed bare-number cap string or a private "N over the limit"
// sentence -- five such grammars had already drifted before this module
// existed. Both
// helpers state what was submitted, how far over, and the limit itself
// (comma-formatted via toLocaleString('en-US'), matching the grammar
// src/domain/files.ts already used for its comment-length refusal).
//
// Pure core (DEC-002): no node:/cloudflare/drizzle imports, so both the
// API/mail layer and the SPA can share this.

import { overBudgetBy, countOf } from "./count-copy";

/** Terse fields-map value for a CHARACTER-length cap violation, e.g.
 * '1,500 characters — 300 over the 1,200 limit'. Throws (via overBudgetBy)
 * if `length` does not actually exceed `max` -- this is a refusal-
 * composition helper, not a defensive length check. */
export function overCapFieldMessage(length: number, max: number): string {
  return `${length.toLocaleString("en-US")} ${length === 1 ? "character" : "characters"} — ${overBudgetBy(length, max)} the ${max.toLocaleString("en-US")} limit`;
}

/** Full sentence naming `label`, for a CHARACTER-length cap violation, e.g.
 * 'Abstract is 1,500 characters — 300 over the 1,200-character limit.' */
export function overCapSentence(label: string, length: number, max: number): string {
  return `${label} is ${length.toLocaleString("en-US")} ${length === 1 ? "character" : "characters"} — ${overBudgetBy(length, max)} the ${max.toLocaleString("en-US")}-character limit.`;
}

/** Terse fields-map value for a COUNT (item, not character) cap violation,
 * e.g. '7 rules — 2 over the 5 limit'. `noun` is the singular noun for one
 * item (e.g. 'rule', 'row', 'track') -- built directly on countOf (not
 * overBudgetBy, which hardcodes the "character" noun for the length
 * grammar above). Throws if `count` does not actually exceed `max` -- this
 * is a refusal-composition helper, not a defensive count check.
 *
 * `pluralForm` is the irregular plural, forwarded to countOf for nouns that
 * do not pluralize by appending 's' (e.g. 'criterion' -> 'criteria').
 * countOf NEVER guesses a plural, so an irregular noun must pass it here. */
export function overCapCountMessage(count: number, max: number, noun: string, pluralForm?: string): string {
  if (count <= max) {
    throw new Error(`overCapCountMessage: count ${count} does not exceed max ${max}`);
  }
  return `${countOf(count, noun, pluralForm)} — ${countOf(count - max, noun, pluralForm)} over the ${max.toLocaleString("en-US")} limit`;
}
