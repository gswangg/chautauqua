// EXHIBIT SIGIL — the shared grammar for a coordinate that is the SUBJECT
// of its sentence rather than a reference (DEC-967 wave-136 amendment,
// ruled in src/decisions-data/DEC-967.md `a coordinate marked with an
// explicit inline exhibit sigil is the SUBJECT of its sentence`).
//
// THE PROBLEM THIS SOLVES. A ruling that commissions a citation ledger
// cannot describe the dead anchors it MEASURED without those anchors
// reading as live assertions in every citation scanner at once -- the
// catalogue paragraph in DEC-967 quotes eight coordinates precisely
// BECAUSE they no longer resolve, and every one of them was reported as an
// unresolved-citation violation by the very scan the ruling commissioned.
//
// WHY NOT AN EXEMPTION LEDGER. Suppressing exhibits with a blanket
// allowlist is the failure DEC-991's wave-119 amendment already named: it
// creates a list only a human can verify, and it lets an author launder a
// live bad citation into silence. So an exhibit is not exempted, it is
// graded INVERTED: the scan asserts the exhibit does NOT resolve (or that
// its quote does not match), and fails loudly the moment it HEALS -- at
// which point the coordinate has become a real, resolving reference and the
// author is told to retire the exhibit. The catalogue therefore stays a
// scan-rechecked population rather than an allowlist, and stays
// self-cleaning.
//
// ONE COPY (DEC-613). This grammar is exported from here and imported by
// every scanner that carries a citation vocabulary --
// test/decision-doc-citation.scan.test.ts (resolution + quote grading) and
// test/citation-form-drift.scan.test.ts (the line-keyed-shape ratchet, whose
// population is references, and an exhibit is not one). The code-comment
// citation ledger the same amendment puts in flight hits this identical
// wall the day it lands; it imports this, it does not re-derive it.

/** The inline marker written immediately before a coordinate, inside any
 * markdown code span that wraps it: `` `EXHIBIT!src/db/schema.ts:669` ``.
 * Deliberately loud and non-accidental -- no prose, path or CSS literal in
 * the corpus contains it, so a match is always a deliberate authoring act. */
export const EXHIBIT_SIGIL = "EXHIBIT!";

/**
 * True when the coordinate starting at `matchStart` in `content` is marked
 * as an exhibit -- i.e. the sigil sits IMMEDIATELY before it, with nothing
 * (not even a space) between. Adjacency is the whole point: a sigil
 * anywhere else in the sentence would let one marker silently swallow every
 * later coordinate in a 1000-character paragraph.
 *
 * The one thing skipped between the sigil and `matchStart` is a leading
 * RELATIVE-path prefix ("./", "../"). Both citation regexes anchor their
 * path capture on a word boundary, which cannot fire between the sigil's
 * "!" and a "." -- so on `EXHIBIT!./index.tsx:61` the match they hand us
 * starts at "index.tsx", with the "./" stranded in between. Stepping back
 * over dots and slashes only (never a space, letter or backtick) keeps
 * adjacency strict while letting the sigil sit where an author would write
 * it: in front of the whole coordinate.
 */
export function isExhibitAt(content: string, matchStart: number): boolean {
  return exhibitSigilStart(content, matchStart) !== -1;
}

/**
 * Index at which the exhibit sigil marking the coordinate at `matchStart`
 * begins, or -1 when the coordinate is not an exhibit. Callers that must
 * reason about what sits BEFORE the whole marked coordinate (e.g. whether
 * it is wrapped in a markdown code span, so a receipt-quote search knows to
 * skip that span's own closing backtick) need this rather than a bare
 * boolean -- otherwise every caller re-derives the sigil's length and the
 * relative-prefix skip, which is the duplication this module exists to
 * prevent.
 */
export function exhibitSigilStart(content: string, matchStart: number): number {
  let at = matchStart;
  while (at > 0 && (content[at - 1] === "." || content[at - 1] === "/")) at--;
  const from = at - EXHIBIT_SIGIL.length;
  if (from < 0) return -1;
  return content.slice(from, at) === EXHIBIT_SIGIL ? from : -1;
}
