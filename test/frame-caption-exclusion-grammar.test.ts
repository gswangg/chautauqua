// Caption exclusion GRAMMAR (DEC-976 wave-140 clauses (a)+(b); task w15-gg).
//
// test/frame-caption-ledger.scan.test.ts ships four hand-listed exclusion
// tables (EXPLAINER, FIXTURE, EXEMPLAR_ARTICLE, COMPOSED) whose `reason` is
// free prose nothing checks -- an exclusion a comment can satisfy is not an
// exclusion (DEC-967, one level out from its original sighting: a LEDGER a
// comment can satisfy is not a ledger; here it is an EXCLUSION TABLE a
// comment can satisfy). This file proves four machine-checkable properties
// over those four tables themselves -- never over the ledger's UNMATCHED
// population, which is a different lane's ratchet (DEC-989, owned by five
// sibling wave-140 lanes, untouched here):
//
//   (1) no exclusion row's `text` is a caption some src/decisions-data/
//       DEC-*.md amendment has already ruled BUILDABLE -- DEC-976 wave-140
//       clause (a): "a caption named as buildable in any
//       src/decisions-data/DEC-*.md amendment is INELIGIBLE for
//       EXPLAINER/FIXTURE/EXEMPLAR-ARTICLE/COMPOSED -- it is BUILT". A row
//       is flagged only when its normalized `text` occurs as a substring of
//       a registry file's normalized content AND a buildability marker
//       (`RULED: build`, `is a BUILD`, `is BUILT`, `always buildable`,
//       `ruled BUILD`, `ruled buildable` -- every verb this campaign's own
//       rulings have actually used, grepped out of src/decisions-data/*.md
//       itself rather than invented) appears within a bounded window around
//       that occurrence, so a caption merely MENTIONED in passing prose
//       (DEC-976.md itself lists `Priya Raman \xb7 Latticework Systems` as
//       an illustrative FIXTURE example, never ruling it buildable) is not
//       a false offender.
//   (2) every `reason` is CONTENT-anchored: no `path:NNN` coordinate into a
//       mutable code/doc file (`.ts`/`.tsx`/`.js`/`.jsx`/`.css`/`.md`).
//       `.dc.html` frame citations are the one structural carve-out
//       (DEC-967 wave-121: "the frame IS the coordinate system the campaign
//       measures against ... re-pointed and receipted, not re-anchored").
//   (3) every FIXTURE row's `reason` names a token that actually occurs in
//       that row's own `text` -- a FIXTURE claim about a caption containing
//       no fixture token is a mis-file.
//   (5) every UNBACKED row's `reason` (task w17-g, DEC-976 wave-142's fifth
//       exclusion class) quotes, verbatim, a line occurring in
//       docs/design/DEVIATIONS.md -- an UNBACKED row asserts a ruled
//       non-build, and this clause proves the assertion cites the ruling
//       rather than merely restating it.
//   (4) every COMPOSED row that quotes a backtick composing expression has
//       at least one such expression occurring verbatim (comments stripped,
//       whitespace collapsed) in the non-test source corpus, enumerated via
//       this ledger's OWN enumerateSourceFiles/stripComments (not
//       frame-source-corpus's narrower .ts/.tsx/.css-only set, and not
//       normalizeCaption's entity-decoding -- a composing expression is
//       code, not prose, and a reason satisfied only by a code COMMENT must
//       fail). COMPOSED rows with no backtick expression at all (the
//       "the same ... composing expression" cross-references, and the one
//       DEC-597 citation) are shape (ii)/(iii) by construction -- PARTIAL
//       and BLESSED/DEFERRED reasons cite a DEC ruling or an already-quoted
//       sibling row, not a fresh composing expression of their own -- and
//       are out of this clause's population; DEC-976 wave-140 clause (b)
//       only obliges "a same-commit render/unit pin" for the
//       composed-from-data shape.
//
// NON-VACUITY is proved over FABRICATED rows only (field guide waves
// 124-127: a `toBeGreaterThan(0)` tripwire on a real population is itself a
// sentinel) -- one row per clause that must be caught, one clean row per
// clause that must pass, run through the SAME functions this file exports
// and the ledger's own exported functions, never through a live table.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COMPOSED_EXCLUSIONS,
  enumerateSourceFiles,
  EXEMPLAR_ARTICLE_EXCLUSIONS,
  EXPLAINER_EXCLUSIONS,
  FIXTURE_EXCLUSIONS,
  normalizeCaption,
  stripComments,
  UNBACKED_EXCLUSIONS,
} from './frame-caption-ledger.scan.test';
import { isDecisionRegistryFile } from './frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

interface Exclusion {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

// -- Clause 1: registry buildability -----------------------------------------

/** Every verb this campaign's own src/decisions-data/*.md amendments have
 * actually used to rule a caption buildable, grepped out of the registry
 * itself (RULED: build / is a BUILD / is BUILT / always buildable / ruled
 * BUILD / ruled buildable -- DEC-380's and DEC-976's own wave-133/135/137/
 * 139/140 amendments), not invented. */
const BUILDABILITY_MARKER_RE = /RULED:\s*build|is a BUILD\b|\bis BUILT\b|always buildable|ruled BUILD|ruled buildable/i;

/** Half-width of the character window scanned around a text match for a
 * buildability marker -- wide enough to span "RULED:" opening a paragraph
 * whose quoted caption sits mid-sentence (DEC-380's own amendments run to
 * several hundred characters between the RULED: verb and a quoted caption
 * later in the same paragraph), narrow enough that two unrelated amendments
 * in the same file can't bleed into each other. */
const BUILDABLE_WINDOW = 500;

/** Every *.md file under `root` that isDecisionRegistryFile identifies as
 * part of the decision registry, enumerated via readdirSync rather than
 * named (DEC-808). frame-source-corpus.ts's own enumerateSourceFiles cannot
 * be reused directly here: its isSourceFile predicate is .ts/.tsx/.css only
 * and deliberately EXCLUDES isDecisionRegistryFile matches (it enumerates
 * the app's *source*, skipping the registry) -- the opposite of what this
 * clause needs. The shared PREDICATE is reused; the enumeration walks .md
 * files and keeps only the ones the predicate accepts. */
export function registryFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = join(entry.parentPath, entry.name);
    if (!isDecisionRegistryFile(full)) continue;
    out.push(full);
  }
  return out.sort();
}

/** True when `text` (normalized) occurs inside some normalized registry
 * blob AND a buildability marker appears within BUILDABLE_WINDOW characters
 * of that occurrence. Exported so the non-vacuity fixture below can drive
 * this exact function over fabricated blobs, never a live registry count. */
export function isRuledBuildableIn(text: string, normalizedRegistryBlobs: string[]): boolean {
  const needle = normalizeCaption(text);
  if (needle.length === 0) return false;
  for (const blob of normalizedRegistryBlobs) {
    let idx = blob.indexOf(needle);
    while (idx !== -1) {
      const start = Math.max(0, idx - BUILDABLE_WINDOW);
      const end = Math.min(blob.length, idx + needle.length + BUILDABLE_WINDOW);
      if (BUILDABILITY_MARKER_RE.test(blob.slice(start, end))) return true;
      idx = blob.indexOf(needle, idx + 1);
    }
  }
  return false;
}

const REGISTRY_FILES = registryFiles(SRC_ROOT);
const NORMALIZED_REGISTRY_BLOBS: string[] = REGISTRY_FILES.map((f) => normalizeCaption(readFileSync(f, 'utf-8')));

// -- Clause 2: content-anchored reasons ---------------------------------------

/** A `path:NNN` coordinate into a MUTABLE code/doc file. `.dc.html` is the
 * one structural carve-out (DEC-967 wave-121): the frame pack IS the
 * coordinate system the campaign measures against, so a frame citation
 * keeps `file:line` by design and is not a defect here. */
export const PATH_LINE_COORDINATE_RE = /\.(ts|tsx|js|jsx|css|md):\d+/;

// -- Clause 3: FIXTURE token grammar ------------------------------------------

/** A FIXTURE reason must literally quote a token, anchored on the
 * `fixture token: '...'` convention this table's own rows use, that also
 * occurs verbatim in the row's own `text` -- the proper name, sample
 * domain, or invented title the reason claims is fixture data. Anchored on
 * that specific marker rather than "any single-quoted span in the reason"
 * because a reason's own prose routinely carries an unpaired possessive
 * apostrophe ("the portal settings' welcomeMessage field") ahead of the
 * marker, which would otherwise pair with the WRONG following quote and
 * capture the prose between them instead of the token. Exported so the
 * non-vacuity fixture drives this exact function. */
export function fixtureReasonNamesOwnToken(row: Exclusion): boolean {
  const m = /fixture token:\s*'([^']*)'/.exec(row.reason);
  if (!m) return false;
  const token = m[1]!;
  return token.length > 0 && row.text.includes(token);
}

// -- Clause 4: COMPOSED expression grammar ------------------------------------

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Backtick-quoted spans inside a reason string -- candidate composing
 * expressions. A row with none is a cross-reference ("the same ... composing
 * expression") or a DEC-citation (shape ii/iii), out of this clause's
 * population by construction (see file header). */
export function backtickSpans(reason: string): string[] {
  return [...reason.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
}

/** True when at least one of `spans` occurs verbatim (comments stripped,
 * whitespace collapsed) inside at least one of `strippedCollapsedBlobs` --
 * blobs that MUST already have had stripComments applied by the caller, so
 * a span satisfied only by a code comment fails. Exported so the
 * non-vacuity fixture drives this exact function over a fabricated
 * comment-only blob. */
export function anyComposingSpanMatches(spans: string[], strippedCollapsedBlobs: string[]): boolean {
  return spans.some((span) => {
    const needle = collapseWhitespace(span);
    if (needle.length === 0) return false;
    return strippedCollapsedBlobs.some((blob) => blob.includes(needle));
  });
}

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const STRIPPED_COLLAPSED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) =>
  collapseWhitespace(stripComments(readFileSync(f, 'utf-8')))
);

// -- Clause 5: UNBACKED reasons self-grade against DEVIATIONS.md -------------

/** Every double-quoted span inside a reason string -- candidate quotes of a
 * DEVIATIONS.md line. Mirrors backtickSpans' shape but over double quotes,
 * because an UNBACKED row's DEVIATIONS.md quote and its source-comment quote
 * use different quoting styles by convention (the former double-quoted
 * prose, the latter a backtick-quoted code comment) so this clause only
 * grades the former. */
export function doubleQuotedSpans(reason: string): string[] {
  return [...reason.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

/** True when at least one of `spans` occurs verbatim (whitespace collapsed)
 * inside `deviationsBlob` -- the same shape as clause 4's
 * anyComposingSpanMatches, over DEVIATIONS.md instead of the source corpus.
 * Exported so the non-vacuity fixture drives this exact function over a
 * fabricated DEVIATIONS.md blob, never the live file. */
export function anyDeviationsSpanMatches(spans: string[], deviationsBlob: string): boolean {
  return spans.some((span) => {
    const needle = collapseWhitespace(span);
    return needle.length > 0 && deviationsBlob.includes(needle);
  });
}

const DEVIATIONS_PATH = join(REPO_ROOT, 'docs', 'design', 'DEVIATIONS.md');
const DEVIATIONS_BLOB = collapseWhitespace(readFileSync(DEVIATIONS_PATH, 'utf-8'));

// -- Guards over the five real tables -----------------------------------------

const ALL_TABLES: { name: string; rows: Exclusion[] }[] = [
  { name: 'EXPLAINER', rows: EXPLAINER_EXCLUSIONS },
  { name: 'FIXTURE', rows: FIXTURE_EXCLUSIONS },
  { name: 'EXEMPLAR_ARTICLE', rows: EXEMPLAR_ARTICLE_EXCLUSIONS },
  { name: 'COMPOSED', rows: COMPOSED_EXCLUSIONS },
  { name: 'UNBACKED', rows: UNBACKED_EXCLUSIONS },
];

describe('caption exclusion grammar (DEC-976 wave-140, self-grading over the tables themselves)', () => {
  it('non-vacuity: population is non-trivial across all five tables', () => {
    expect(EXPLAINER_EXCLUSIONS.length).toBeGreaterThan(10);
    expect(FIXTURE_EXCLUSIONS.length).toBeGreaterThan(10);
    expect(EXEMPLAR_ARTICLE_EXCLUSIONS.length).toBeGreaterThan(2);
    expect(COMPOSED_EXCLUSIONS.length).toBeGreaterThan(10);
    expect(UNBACKED_EXCLUSIONS.length).toBeGreaterThan(0);
    expect(REGISTRY_FILES.length).toBeGreaterThan(10);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  describe('clause 1: no exclusion row is a caption a DEC amendment already ruled buildable', () => {
    it('non-vacuity (synthetic): a fabricated row quoted beside RULED: build is caught; a clean one and a mere-mention one pass', () => {
      const caughtText = 'Zzy Synthetic Exclusion Row The Registry Already Ruled Buildable Verbatim';
      const cleanText = 'Zzy Synthetic Exclusion Row Nobody Has Ever Ruled On At All';
      const mentionedOnlyText = 'Zzy Synthetic Exclusion Row Merely Mentioned As An Example Elsewhere';

      const filler = 'Zzy filler prose unrelated to any ruling, repeated to push the two mentions apart. '.repeat(20);
      const fabricatedRegistryBlob = normalizeCaption(
        [
          `RULED: build "${caughtText}" verbatim, because it has a live referent on screen.`,
          filler,
          `Roughly fifteen fixture identities were dropped from the population, e.g. "${mentionedOnlyText}" -- illustrative only, no ruling attaches to it.`,
        ].join('\n\n')
      );

      expect(isRuledBuildableIn(caughtText, [fabricatedRegistryBlob])).toBe(true);
      expect(isRuledBuildableIn(cleanText, [fabricatedRegistryBlob])).toBe(false);
      expect(isRuledBuildableIn(mentionedOnlyText, [fabricatedRegistryBlob])).toBe(false);
    });

    for (const { name, rows } of ALL_TABLES) {
      it(`${name}: no row is a caption ruled buildable by any src/decisions-data/DEC-*.md amendment`, () => {
        const offenders = rows.filter((r) => isRuledBuildableIn(r.text, NORMALIZED_REGISTRY_BLOBS));
        expect(
          offenders,
          `${offenders.length} ${name} row(s) are captions a decision-registry amendment already ruled BUILDABLE ` +
            `(DEC-976 wave-140 clause (a)) but are still parked in an exclusion table:\n` +
            offenders.map((o) => `${o.fileName}:${o.line} -- "${o.text}"`).join('\n')
        ).toEqual([]);
      });
    }
  });

  describe('clause 2: every reason is content-anchored, no path:NNN coordinate into a mutable file', () => {
    it('non-vacuity (synthetic): a reason citing app/src/Foo.tsx:42 is caught; the bare-path form and a .dc.html frame citation both pass', () => {
      const caught: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'irrelevant to this clause',
        reason: "app/src/pages/Foo.tsx:42 composes the caption from the record's live name.",
      };
      const cleanBarePath: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'irrelevant to this clause',
        reason: "app/src/pages/Foo.tsx composes the caption from `theExpression` verbatim.",
      };
      const cleanFrameCitation: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'irrelevant to this clause',
        reason: 'the pack cites its own Chautauqua Zzy.dc.html:900 elsewhere -- frame coordinates are exempt.',
      };
      expect(PATH_LINE_COORDINATE_RE.test(caught.reason)).toBe(true);
      expect(PATH_LINE_COORDINATE_RE.test(cleanBarePath.reason)).toBe(false);
      expect(PATH_LINE_COORDINATE_RE.test(cleanFrameCitation.reason)).toBe(false);
    });

    for (const { name, rows } of ALL_TABLES) {
      it(`${name}: no reason contains a path:NNN coordinate into a .ts/.tsx/.js/.jsx/.css/.md file`, () => {
        const offenders = rows.filter((r) => PATH_LINE_COORDINATE_RE.test(r.reason));
        expect(
          offenders,
          `${offenders.length} ${name} reason(s) cite a path:NNN coordinate into a mutable file, the exact form ` +
            `DEC-967 wave-115/121 forbids because it goes dead on the next edit. Re-anchor on the composing ` +
            `expression's CONTENT (a bare path immediately followed by a verbatim quote):\n` +
            offenders.map((o) => `${o.fileName}:${o.line} -- reason: "${o.reason}"`).join('\n')
        ).toEqual([]);
      });
    }
  });

  describe('clause 3: every FIXTURE reason names a token present in its own text', () => {
    it("non-vacuity (synthetic): a reason with no matching quoted token is caught; one that quotes its own text's token passes", () => {
      const caught: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'Zzy Synthetic Sample Name · Sample Company',
        reason: "the portal settings' invented sample identity used as mock card content, not a real UI caption. (fixture token: 'Nowhere In The Text')",
      };
      const clean: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'Zzy Synthetic Sample Name · Sample Company',
        reason: "the portal settings' invented sample identity used as mock card content, not a real UI caption. (fixture token: 'Zzy Synthetic Sample Name')",
      };
      expect(fixtureReasonNamesOwnToken(caught)).toBe(false);
      expect(fixtureReasonNamesOwnToken(clean)).toBe(true);
    });

    it('every FIXTURE row names a token present in its own text', () => {
      const offenders = FIXTURE_EXCLUSIONS.filter((r) => !fixtureReasonNamesOwnToken(r));
      expect(
        offenders,
        `${offenders.length} FIXTURE row(s) have a reason that names no token actually present in the row's own ` +
          `text -- a FIXTURE claim about a caption containing no fixture token is a mis-file:\n` +
          offenders.map((o) => `${o.fileName}:${o.line} -- "${o.text}" / reason: "${o.reason}"`).join('\n')
      ).toEqual([]);
    });
  });

  describe('clause 4: every COMPOSED row that quotes an expression quotes one that resolves in source', () => {
    it('non-vacuity (synthetic): an expression satisfied only by a comment is caught; one present in real code passes', () => {
      const commentOnlyBlob = collapseWhitespace(
        stripComments("// const zzySyntheticComposingExpression = totallyFake();\nconst realCode = 1;")
      );
      const realBlob = collapseWhitespace(stripComments('const zzySyntheticComposingExpression = totallyFake();'));

      expect(anyComposingSpanMatches(['const zzySyntheticComposingExpression = totallyFake();'], [commentOnlyBlob])).toBe(
        false
      );
      expect(anyComposingSpanMatches(['const zzySyntheticComposingExpression = totallyFake();'], [realBlob])).toBe(true);
    });

    it('every COMPOSED row with a backtick-quoted expression has one resolving verbatim in the non-test source corpus', () => {
      const rowsWithSpans = COMPOSED_EXCLUSIONS.map((r) => ({ row: r, spans: backtickSpans(r.reason) })).filter(
        (r) => r.spans.length > 0
      );
      expect(rowsWithSpans.length).toBeGreaterThan(5); // non-vacuity: most COMPOSED rows do quote an expression
      const offenders = rowsWithSpans.filter(({ spans }) => !anyComposingSpanMatches(spans, STRIPPED_COLLAPSED_SOURCE_BLOBS));
      expect(
        offenders,
        `${offenders.length} COMPOSED row(s) quote a composing expression that resolves nowhere (comments stripped) ` +
          `in the non-test source corpus:\n` +
          offenders.map(({ row, spans }) => `${row.fileName}:${row.line} -- spans: ${JSON.stringify(spans)}`).join('\n')
      ).toEqual([]);
    });
  });

  describe('clause 5: every UNBACKED reason quotes a line occurring verbatim in DEVIATIONS.md', () => {
    it('non-vacuity (synthetic): a reason quoting an absent line is caught; one quoting a line present in a fabricated deviations blob passes', () => {
      const presentLine = 'no retention column backs this synthetic control, building it alone would declare a setting nothing reads';
      const absentLine = 'this synthetic line was never written into any deviations file anywhere';
      const fabricatedDeviationsBlob = collapseWhitespace(
        [
          '## 1. Ruled omissions',
          '',
          `- **Synthetic control** -- NOT built. DEC-000: ${presentLine}.`,
        ].join('\n')
      );

      const caught: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'irrelevant to this clause',
        reason: `DEVIATIONS.md rules this a non-build, quoting: "${absentLine}"`,
      };
      const clean: Exclusion = {
        fileName: 'Chautauqua Zzy.dc.html',
        line: 1,
        text: 'irrelevant to this clause',
        reason: `DEVIATIONS.md rules this a non-build, quoting verbatim: "${presentLine}"`,
      };

      expect(anyDeviationsSpanMatches(doubleQuotedSpans(caught.reason), fabricatedDeviationsBlob)).toBe(false);
      expect(anyDeviationsSpanMatches(doubleQuotedSpans(clean.reason), fabricatedDeviationsBlob)).toBe(true);
    });

    it('every UNBACKED row quotes a line occurring verbatim in the real DEVIATIONS.md', () => {
      const offenders = UNBACKED_EXCLUSIONS.filter(
        (r) => !anyDeviationsSpanMatches(doubleQuotedSpans(r.reason), DEVIATIONS_BLOB)
      );
      expect(
        offenders,
        `${offenders.length} UNBACKED row(s) have a reason that quotes no line occurring verbatim in ` +
          `docs/design/DEVIATIONS.md -- an UNBACKED exclusion must cite the ruling that blessed the non-build, ` +
          `not merely assert one:\n` +
          offenders.map((o) => `${o.fileName}:${o.line} -- reason: "${o.reason}"`).join('\n')
      ).toEqual([]);
    });
  });
});
