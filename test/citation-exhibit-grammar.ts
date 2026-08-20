// EXHIBIT grammar (DEC-967 wave-137 amendment, task w12-cc): shared helper so
// every citation ledger that needs to DISCUSS a broken citation -- rather
// than merely make one -- uses the identical vocabulary (DEC-613: "a second
// copy of a citation vocabulary is a trap with a delay fuse"). The
// code-comment citation ledger drafted this same wave will hit this exact
// wall the day it lands; it must import this module rather than re-inventing
// its own sigil.
//
// THE PROBLEM: a ruling that commissions a citation scan often needs to
// CATALOGUE the offenders the scan found (a paragraph of prose naming dead
// or drifted `path:line` coordinates as evidence for the ruling). But a
// citation scan cannot tell "this coordinate is the SUBJECT of this
// sentence -- proof that it is broken" apart from "this coordinate is an
// ordinary CLAIM the author is asserting is true right now" -- both are the
// same regex shape. Left unmarked, the catalogue paragraph re-triggers the
// very scan it is describing (DEC-967 sighting #13, "a quoted coordinate
// inside a deferral REASON reads as an assertion", recurring here as #15,
// now self-referentially: the ruling about dead citations became itself a
// dead-citation offender).
//
// THE GRAMMAR: a `path:line` coordinate is an EXHIBIT -- the subject of its
// sentence, not a claim -- when it is immediately preceded, with NO
// intervening characters, by the literal 8-character sigil `EXHIBIT:`
// (case-sensitive, colon included, no space before the path). Example:
//   EXHIBIT:src/db/schema.ts:669 no longer resolves -- ...
// The sigil sits immediately against the coordinate's first character,
// wherever that character is -- outside a markdown code span if the
// citation is written as bare prose text, or INSIDE the span's opening
// backtick if the citation is written as `` `path:line` `` (the citation
// regex itself starts matching AT the path's first letter regardless of a
// preceding backtick, so the sigil must sit exactly where the match
// starts: `` `EXHIBIT:src/db/schema.ts:669` ``, sigil inside the
// backticks, immediately before "src"). `hasExhibitSigil` below checks the
// exact 8 preceding characters with a plain slice, no lookaround regex
// needed -- the author is responsible for placing it flush against the
// path, not against the surrounding punctuation.
//
// GRADING IS INVERTED for an exhibit: an ordinary citation is a claim, so
// the scan fails when it does NOT resolve/match. An exhibit is being cited
// AS a broken coordinate, so the scan must fail the opposite way -- when the
// exhibit DOES now resolve and match. A caller computes a citation's normal
// pass/fail result exactly as it would for any other citation, then inverts
// the verdict only for exhibit-marked coordinates: a non-null (failing)
// result is the EXPECTED, healthy state for an exhibit and produces no
// violation; a null (passing) result means the exhibit has HEALED and is
// itself the violation, reported so the author is told to retire the sigil.
//
// This is deliberately NOT a blanket exemption or an allowlist (DEC-991
// wave-119: an allowlist only a human can verify is the failure mode this
// grammar exists to avoid). An exhibit stays a scan-rechecked population --
// nothing here suppresses checking it, only which verdict counts as a
// violation. A live bad citation cannot be laundered into looking clean by
// adding this sigil to it, because doing so only makes it required to STAY
// broken; if a later fix makes it resolve, the scan fails loudly and names
// it, and the author must delete the sigil (retiring the exhibit) as part
// of that same fix -- the same principle as DEC-967 wave-103's "a sentinel
// anchored on a real offender makes fixing that offender illegal" turned
// around: an exhibit anchored on a real offender makes healing it a
// PASS-BLOCKING event until acknowledged, not a silent pass-through.

export const EXHIBIT_SIGIL = "EXHIBIT:";

/**
 * True when `content`'s citation starting at `citationStartIndex` (the
 * index of the first character of the resolved path, i.e. a regex match's
 * own `.index`) is immediately preceded by the EXHIBIT_SIGIL with no
 * intervening characters -- the coordinate is the SUBJECT of its sentence,
 * to be graded INVERTED, not an ordinary claim.
 */
export function hasExhibitSigil(content: string, citationStartIndex: number): boolean {
  return content.slice(citationStartIndex - EXHIBIT_SIGIL.length, citationStartIndex) === EXHIBIT_SIGIL;
}

/**
 * Inverts a per-citation pass/fail result for an exhibit-marked coordinate.
 * `result` is whatever an ordinary citation checker returns for this one
 * citation: `null` when it resolves/matches (a pass), or a non-null value
 * `T` (e.g. a Violation) when it does not. `healedResult` is the value to
 * report when a still-broken exhibit turns out to have healed -- built by
 * the caller so its shape matches `T` exactly (e.g. the same Violation
 * shape the caller's own checker returns).
 *
 * - Not an exhibit: returns `result` unchanged (normal grading).
 * - Exhibit, still broken (`result` is non-null/failing): returns `null` --
 *   this is the exhibit's expected, healthy state, no violation.
 * - Exhibit, now healed (`result` is `null`/passing): returns
 *   `healedResult` so the caller can report a violation telling the author
 *   to retire the sigil.
 */
export function gradeExhibit<T>(isExhibit: boolean, result: T | null, healedResult: T): T | null {
  if (!isExhibit) return result;
  return result === null ? healedResult : null;
}
