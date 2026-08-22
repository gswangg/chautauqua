// Shared digit-collapsed skeleton join (DEC-808; DEC-613: one join, not two).
//
// A frame draws a live-looking value (a date, a clock time, a retention
// count, a masked-password dot count) whose DIGITS the real product renders
// differently at runtime (today's date, a real clock reading, a live
// counter) while every surrounding word stays identical. An own-text-equal
// join (any tier requiring the label to match a rendered element's text or
// attribute value BYTE FOR BYTE) can never resolve such a row, even when the
// app draws the exact same template with a different live number. Collapsing
// every digit run to one sentinel character on BOTH the label and the corpus
// turns that into an exact match again, without ever touching non-digit
// words -- a date's month name, an email's domain, a button's verb all still
// have to match letter-for-letter.
//
// ORIGIN (wave 29, DEC-808 amendment, task w29-e): this join was built and
// measured on branch `v12m-w29-e` as a private pair of functions
// (`collapseDigitsToSkeleton` / `skeletonOwnTextTokens`) inside
// `test/desktop-control-floor.scan.test.ts`. That branch has NOT landed on
// main as of this file's own wave (wave 31, task w31-b, DEC-808 wave-31
// amendment). Per DEC-613 ("a second copy of a vocabulary is a trap with a
// delay fuse"), this module is the ONE shared home for the join technique
// itself, so the phone ledger (`test/frame-control-floor.scan.test.ts`,
// this wave's consumer) and the desktop ledger never carry two independently
// -maintained copies.
//
// *** WHEN v12m-w29-e LANDS: *** `test/desktop-control-floor.scan.test.ts`
// must DELETE its own private `collapseDigitsToSkeleton` /
// `skeletonOwnTextTokens` (and the `SKELETON_BLOBS` constant built from
// them) and import `collapseDigitsToSkeleton`, `buildSkeletonBlobs`, and
// `skeletonOwnTextTokens` from this module instead -- never leave a second
// copy standing alongside this one.
//
// The join's own-text-match primitives (`allBoundaryMatches`, `ownTextEquals`,
// `classTokensNear`) are DELIBERATELY NOT re-implemented here. Every ledger
// file in this campaign that needs them PORTS its own copy rather than
// importing a sibling's, because every one of those siblings is itself a
// vitest suite (`describe`/`it` calls at module scope) -- importing it would
// execute those calls a second time and double-register its tests (see
// `test/frame-control-floor.scan.test.ts`'s own "PORTING NOTE (wave 25)").
// This module has NO module-scope test registration, so it is safe to
// import from as many ledger files as need it; the three primitives are
// instead accepted as parameters, supplied by whichever ledger file already
// ported its own copies.

/** Collapses every run of ASCII digits in `s` to a single sentinel
 * character, `#` -- never itself a digit, so it can never re-match a real
 * digit run, and never otherwise produced by any step in this pipeline (no
 * frame label or app string in this pack has ever been observed to contain
 * a literal `#`). */
export function collapseDigitsToSkeleton(s: string): string {
  return s.replace(/\d+/g, '#');
}

/** Builds the digit-collapsed twin of a caller's own normalized source-blob
 * corpus, once, so a per-row join never re-collapses the same blobs. */
export function buildSkeletonBlobs(blobs: readonly string[]): string[] {
  return blobs.map(collapseDigitsToSkeleton);
}

export interface SkeletonJoinResult {
  tokens: string[];
  matched: boolean;
}

/** Every `chq-` token the skeleton join resolves for `label` against a
 * caller-supplied pre-collapsed blob corpus (`buildSkeletonBlobs`), plus
 * whether it matched at all. SAME algorithm as any ledger's own-text tier
 * (`allBoundaryMatches` + `ownTextEquals` + `classTokensNear`, each
 * supplied by the caller -- see the module header), run with a
 * digit-collapsed label over the digit-collapsed blobs, so a token set the
 * caller's primary own-text tier could never see (because the drawn and
 * rendered digit runs differ) resolves identically to how a literal match
 * would have. Skipped entirely (returns unmatched) when `label` carries no
 * digit at all -- collapsing would be a no-op and the primary tier has
 * already tried the identical string. */
export function skeletonOwnTextTokens(
  label: string,
  skeletonBlobs: readonly string[],
  allBoundaryMatches: (label: string, blob: string) => number[],
  ownTextEquals: (label: string, blob: string, idx: number) => boolean,
  classTokensNear: (blob: string, idx: number) => string[],
): SkeletonJoinResult {
  if (!/\d/.test(label)) return { tokens: [], matched: false };
  const skelLabel = collapseDigitsToSkeleton(label);
  const tokens: string[] = [];
  let matched = false;
  for (const blob of skeletonBlobs) {
    for (const idx of allBoundaryMatches(skelLabel, blob)) {
      if (!ownTextEquals(skelLabel, blob, idx)) continue;
      matched = true;
      tokens.push(...classTokensNear(blob, idx));
    }
  }
  return { tokens: [...new Set(tokens)], matched };
}

// -- WAVE 31 (DEC-808 wave-31 amendment, task w31-b): composed-vs-not-drawn
// disposition for whatever the skeleton pass still cannot resolve ----------
//
// A row that still carries no match after both the own-text tier and the
// skeleton pass above is not automatically "the app never draws this" -- a
// label that occurs only inside a JS conditional expression or as a
// TEMPLATE LITERAL's fixed segments (`` `${count} tries left` ``) is real,
// live app text no own-text-equal join can ever see by construction (the
// enclosing tag's own text content is the whole expression, never the
// string literal alone). These two functions distinguish that case ("the
// app composes this and the join cannot see it") from a label with no
// trace anywhere in the corpus at all ("the app does not draw this") --
// the second is a genuine, repairable phone-conformance defect.

function isQuoteChar(ch: string | undefined): boolean {
  return ch === '"' || ch === "'" || ch === '`';
}

/** True when `label` (whitespace-collapsed) occurs, boundary-anchored, as a
 * COMPLETE quoted string literal (flanked by the SAME quote character on
 * both sides) anywhere in `blobs` -- e.g. the alternate branch of a
 * ternary, a named constant's value, a switch case. Never strong enough on
 * its own to resolve a token or move a row to `ok`/`offender`: a ternary
 * branch carries no reachable class attribute this join can safely
 * attribute to the label. */
export function labelIsComposedLiteral(label: string, blobs: readonly string[]): boolean {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return false;
  for (const blob of blobs) {
    let idx = blob.indexOf(needle);
    while (idx !== -1) {
      const before = idx > 0 ? blob[idx - 1] : undefined;
      const after = blob[idx + needle.length];
      if (isQuoteChar(before) && before === after) return true;
      idx = blob.indexOf(needle, idx + 1);
    }
  }
  return false;
}

/** True when `label` has the SHAPE of a concrete data value a frame draws as
 * illustrative fixture content -- a masked password, an email, a date, a
 * clock time, a timezone name, a bare count, a slug/URL, a venue address, a
 * two-word proper name, or free-run body copy long enough to be
 * self-evidently reviewer/speaker-authored content, never static app
 * vocabulary. This content is genuinely rendered by the real control from a
 * live record; no literal-text join can ever match a specific fixture
 * instance against source code that names no such literal -- it names a
 * field, not a value. */
export function looksLikeDataValue(label: string): boolean {
  const s = label.trim();
  if (/^[•]{3,}$/.test(s)) return true; // masked password
  if (/^\S+@\S+\.\S+$/.test(s)) return true; // email address
  if (/^\S+@\S+$/.test(s) && s.includes('@')) return true; // truncated email fixture
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(,\s*\d{1,2}:\d{2})?$/.test(s)) return true; // "16 Aug 2027" / "16 Aug 2026, 23:59"
  if (/^\d{1,2}:\d{2}$/.test(s)) return true; // clock time "15:30"
  if (/^[A-Z][a-z]+\s\d{1,2}$/.test(s)) return true; // calendar day "Wed 13"
  if (/^[A-Za-z_]+\/[A-Za-z_]+$/.test(s)) return true; // IANA zone
  if (/^(Pacific|Eastern|Central|Mountain|UTC|GMT)$/.test(s)) return true; // zone short name
  if (/^\d+$/.test(s)) return true; // bare number
  if (/^\d+\s+(months?|to)\s*\d*$/.test(s)) return true; // "24 months" / "1 to 5"
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s) && /\d/.test(s)) return true; // slug with a digit
  if (/^[a-z0-9.]+\.[a-z]{2,}\//.test(s)) return true; // bare domain path
  if (/,\s*[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(s) && /^[A-Z]/.test(s)) return true; // "Moscone West, San Francisco"
  if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(s)) return true; // two-word proper name
  if (/^[A-Z][a-z]+$/.test(s) && s.length <= 12) return true; // bare given/family name
  if (/▾$/.test(s)) return true; // a closed dropdown's current live selection
  if (s.length >= 40) return true; // long free-run body copy
  return false;
}

// -- WAVE 31 (DEC-808 wave-31 amendment, task w31-b): affix-stripped
// composed-literal check --------------------------------------------------
//
// A handful of drawn labels are composed from a FIXED literal plus a
// variable AFFIX the app renders as a sibling text node or a live count
// badge, rather than as one interpolated string -- so no substring of the
// drawn label is ever the complete text of any single element, and neither
// `labelIsComposedLiteral` (looks for the WHOLE label as one quoted
// literal) nor the digit-skeleton join (requires a digit already present at
// the matching position in source) can see it. Two shapes recur across this
// pack, both machine-derivable from the label's own text, never
// hand-per-row:
//   (a) a trailing live COUNT BADGE, `<text> · <digits>` (e.g. "Approved
//       · 9", composed as `{label}{counts[t] !== null ? \` · ${counts[t]}\`
//       : ''}` -- the count has no digit in source at all, so the skeleton
//       tier's "already carries a digit at this position" requirement can
//       never fire);
//   (b) a leading CHEVRON-PREFIXED breadcrumb, `‹ <text>` (e.g.
//       "‹ Settings", composed as `` &lsaquo; {section ? section.label :
//       'Settings'} `` -- the leading glyph is a literal HTML entity, the
//       trailing word is a SEPARATE ternary branch, so the two never occur
//       adjacent as one literal).
// Stripping the known affix and re-testing the residual against
// `labelIsComposedLiteral` finds the SAME literal the desktop file's own
// composed tier would resolve if it could see the affix at all -- this
// never resolves a token (same non-negotiable limit as the two functions
// above), it only explains a `no-label-match` row honestly. */
export function labelIsComposedWithKnownAffix(label: string, blobs: readonly string[]): boolean {
  const countSuffix = label.match(/^(.+?)\s*·\s*\d+$/);
  if (countSuffix && labelIsComposedLiteral(countSuffix[1]!.trim(), blobs)) return true;
  const chevronPrefix = label.match(/^[‹<]\s*(.+)$/);
  if (chevronPrefix && labelIsComposedLiteral(chevronPrefix[1]!.trim(), blobs)) return true;
  return false;
}
