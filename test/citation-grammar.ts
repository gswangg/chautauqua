// Shared EXHIBIT citation grammar (DEC-967 wave-137 ruling, implemented
// wave-138, task w13-aa). Field guide DEC-613: "a second copy of a
// citation vocabulary is a trap with a delay fuse" -- this is the ONE
// exported helper both test/decision-doc-citation.scan.test.ts and
// test/citation-form-drift.scan.test.ts import; neither file re-derives
// the sigil grammar privately.
//
// THE INVERTED CONTRACT, IN FULL:
//
// src/decisions-data/*.md prose sometimes needs to CATALOGUE a dead
// citation -- a coordinate a ruling measured as broken (a moved/renamed
// file, a drifted line, an ambiguous bare basename) -- as evidence for
// the ruling's own claim. A citation written in that role is not a
// pointer asserting "this is still true here"; it is the SUBJECT of the
// sentence, being described. But the ordinary citation scan cannot tell
// the two apart: `path:line` followed by a backtick quote looks
// identical whether it is offered as a live reference or catalogued as a
// broken one. Two wrong fixes were already ruled out:
//   - Re-pointing the coordinate to somewhere that resolves destroys the
//     evidence the ruling is built on (the amendment is ABOUT that dead
//     anchor).
//   - Exempting the paragraph from the scan (a blanket exclusion, a file
//     path, a DEC-number allowlist) builds exactly the allowlist DEC-991's
//     wave-119 amendment forbids -- unverifiable by any scan, trusted
//     forever on the strength of a human's one-time judgement.
//
// The EXHIBIT grammar instead marks the coordinate INLINE, in the prose
// itself, with the literal sigil string immediately before it (see
// EXHIBIT_SIGIL below), and grades every sigilled citation INVERTED: the
// scan asserts the exhibit citation does NOT resolve (or, when it does
// resolve to a real file/line, that its receipted quote does NOT match
// verbatim). The moment an exhibit HEALS -- the file reappears at that
// path, the line count grows back past it, the quote starts matching
// again -- the inverted check fails loudly, which is the scan's way of
// telling the author: this exhibit is stale, retire the sigil (turn it
// back into an ordinary citation, repoint it, or delete the paragraph's
// claim) because the fact it was cataloguing no longer holds.
//
// This keeps the catalogue self-cleaning and re-checked every run, rather
// than a write-once allowlist: a sigil is not a licence to ignore a
// citation, it is a standing claim ("this one is still broken") that the
// scan actively re-verifies every time it runs.
//
// ATTACHMENT RULE: the sigil must sit immediately before the citation's
// own path text, inside the same run of prose (at most a handful of
// characters of connective punctuation between them -- see
// EXHIBIT_ATTACH_RE below). A sigil written three sentences away, or
// once at the top of a paragraph covering several citations that follow
// it loosely, does not attach to any of them -- attachment is anchored,
// never proximity/`includes` over the whole paragraph. Each individual
// dead coordinate that a catalogue paragraph lists must carry its own
// sigil.

/** The literal marker that turns an ordinary citation into an exhibit:
 * written immediately before the citation's path text (see
 * EXHIBIT_ATTACH_RE for exactly how immediately). Chosen to read in
 * prose ("EXHIBIT! src/db/schema.ts:669") and to be a string that could
 * never occur by accident in this corpus -- no existing citation, path,
 * or quoted code literal in the tree spells the word "EXHIBIT" followed
 * by "!" immediately before a path. */
export const EXHIBIT_SIGIL = "EXHIBIT!";

// Immediately before the citation's path start: the sigil itself, then
// AT MOST a few characters of connective punctuation (a markdown
// code-span backtick opening the citation's own span, whitespace, or a
// relative-path prefix like "./" that CITATION_RE's own \b-anchored
// capture group does not include in its match -- e.g. the corpus's own
// "EXHIBIT!./index.tsx:61", where the citation regex's captured group
// starts at "index.tsx", not "./index.tsx", because \b does not fire
// between "!"/"." /"." /"/" -- all non-word characters). Deliberately
// narrow -- not "the sigil anywhere earlier in the paragraph"
// (proximity/`includes` over a long paragraph is exactly the
// false-attachment failure mode DEC-967 sighting #13 named: "a quoted
// coordinate inside a deferral REASON reads as an assertion in three
// scanners at once"). A sigil three sentences away must not attach to a
// citation that merely happens to follow it later.
const EXHIBIT_ATTACH_RE = /EXHIBIT![`\s./]{0,3}$/;
const EXHIBIT_ATTACH_WINDOW = EXHIBIT_SIGIL.length + 3;

/** True when the citation whose path text starts at `citationStartIndex`
 * in `content` is an EXHIBIT: the sigil (optionally followed by its own
 * opening backtick / whitespace / a relative-path prefix) sits
 * IMMEDIATELY before the path, with no other prose in between. Detected
 * by an anchored regex against the short window of text ending exactly
 * at `citationStartIndex`, never by scanning the whole paragraph or file
 * for the sigil's mere presence (that would be the proximity/`includes`
 * failure mode this grammar exists to avoid). */
export function isExhibitCitation(content: string, citationStartIndex: number): boolean {
  const windowStart = Math.max(0, citationStartIndex - EXHIBIT_ATTACH_WINDOW);
  const window = content.slice(windowStart, citationStartIndex);
  return EXHIBIT_ATTACH_RE.test(window);
}
