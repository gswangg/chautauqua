// Pack prose-measure (`ch`) register (DEC-896 wave-49 amendment; task
// w49-e). MEASURE ONLY -- this lane moves no CSS byte.
//
// WHY: DEC-896's wave-48 amendment settled `grid-template-columns` as the
// last divergent VALUE-vocabulary axis in the pack by probing every inline
// property in docs/design/*.dc.html against the served CSS. That histogram
// grades a value vocabulary, so a property the product barely declares at
// all reads as nearly clean -- `max-width:<N>ch` is exactly that property.
// Measured at main 405a4518b: the pack draws 26 `max-width:<N>ch` clamps
// across 10 distinct values; the served corpus declares 9 across 7 values,
// two of which (34ch, 32ch) the pack never draws, and 52ch -- the pack's
// most-drawn measure -- is served exactly once. 70ch, 78ch, 76ch, 56ch and
// 46ch are drawn and served nowhere. This file is the instrument that
// measures that gap (re-measured live on THIS tree, never snapshotted from
// the wave-49 rationale above).
//
//   1. POPULATION (DEC-808, derived from disk, never hand-listed): every
//      `<TAG style="...max-width:<N>ch...">` opening tag inside
//      docs/design/*.dc.html, keyed to its frame file, its own line, and
//      its ENCLOSING frame extent (app/src/frame-citation-frames.ts's own
//      phone/desktop extent machinery, imported rather than re-derived --
//      DEC-613 -- so this population's extents end at the frame's own
//      `</x-dc>` template close, never at `nextLabel ? nextLabel.line :
//      Infinity`, the exact bug DEC-967 wave-41 fixed once already and this
//      campaign has since re-fixed in a dozen other walks). A clamp whose
//      line falls outside every phone/desktop extent (past template close,
//      or before the file's first frame) is a population-derivation defect
//      and this scan throws loudly rather than silently dropping it.
//
//      Each clamp's SIGNATURE TEXT is the longest text run its element
//      encloses: the element's inner HTML is captured with brace-balanced
//      same-tag-name tracking (a wrapping `<div style="...max-width:Nch">`
//      commonly wraps an `<h1>` heading AND a `<p>` sentence as two
//      separate child blocks -- the concatenation of both never appears
//      verbatim as one string in the product, so this scan searches each
//      inline text RUN between tags separately and keeps every run
//      >= 20 chars as a candidate, rather than the whole blob as one
//      needle) -- entities decoded and whitespace collapsed with the same
//      primitives test/frame-source-corpus.ts already exports (DEC-613:
//      reused, not re-derived).
//
//   2. JOIN -- "the product's declared max-width for the block that renders
//      that prose": for each candidate text run, this scan searches the
//      non-test app/src/**+src/** corpus (test/frame-source-corpus.ts's
//      enumerateSourceFiles + normalizeSource + labelIsMatched -- the same
//      corpus and matcher every sibling ledger in this campaign already
//      uses) for a verbatim, boundary-anchored occurrence. The FIRST file
//      (or files) any candidate run resolves to is the RENDER FILE. Inside
//      that render file, this scan looks for:
//        a. an inline `max-width:\s*(\d+)ch` declaration anywhere in the
//           file, and
//        b. every `chq-*` class token the file mentions, cross-referenced
//           against a map of every `.chq-*` CSS selector (app/src/**/*.css
//           and every SSR `*_CSS` module test/helpers/ssr-css-sources.ts
//           derives, DEC-808 -- never a hand-picked directory list) that
//           declares `max-width:\s*(\d+)ch`.
//      The union of (a) and (b) is the render file's DECLARED set. This is
//      a file-grained join, not a true DOM-block join (a full DOM/selector
//      resolver is out of this lane's scope) -- documented here and in the
//      audit doc as the instrument's own known limitation, never
//      overclaimed as a per-element join.
//
//   3. CLASSIFICATION, one row per drawn clamp:
//        - MATCHED    -- the render file's declared set contains the
//                         frame's own value.
//        - DIVERGES   -- the render file resolves and its declared set is
//                         non-empty, but does not contain the frame's
//                         value.
//        - UNCLAMPED  -- the render file resolves but its declared set is
//                         empty (the product renders the prose but clamps
//                         it nowhere).
//        - UNRESOLVED -- no candidate text run matches anywhere in the
//                         product corpus -- an instrument-completeness
//                         fact ("this ledger cannot pin the product-side
//                         block"), never a claim the site is fine.
//
//   4. RATCHETS (DEC-808, two-sided, `test/campaign-ratchet-two-sided.scan.
//      test.ts` grades this):
//        - PACK_PROSE_MEASURE_DIVERGENCE_CEILING over the DIVERGES +
//          UNCLAMPED count -- the fidelity fact -- hand-measured by
//          forcing it to -1 and reading the printed offender list (never
//          `= OFFENDERS.length`, the ninth saturated-ratchet-lie pattern
//          the field guide names).
//        - a vacuous-population tripwire on the DRAWN count, keyed on
//          CONTENT (a specific file+value+text-substring spot-check) per
//          DEC-999, never on a source line number.
//
//   5. SCOPE: this lane MOVES NO CSS BYTE. Desktop is frozen and several of
//      these blocks are desktop-only; repair is a later lane's, sized from
//      this roster. PACK_PROSE_MEASURE_DIVERGENCE_CEILING is registered
//      OUT_OF_CAMPAIGN_SCOPE (scripts/exit-predicate/campaign-scope.ts) as
//      a newly-derived population, with a PARKED_FIDELITY_PROMISES row --
//      a freshly measured, previously-uncounted population must not move
//      the campaign's goalposts mid-convergence.
//
// LEDGER: docs/design/audit/pack-prose-measure-v12.md records the full
// drawn-vs-served table and every row's classification and citation.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEC_896 } from '../src/decisions';
import {
  ALL_DESKTOP_FRAME_EXTENTS,
  ALL_FRAME_EXTENTS,
} from '../app/src/frame-citation-frames';
import { DESIGN_ROOT, designFileNames } from '../app/src/frame-citation-core';
import { ENTITY_MAP, enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';
import { ssrCssSources } from './helpers/ssr-css-sources';

void DEC_896; // wave-49: this file is the instrument DEC-896's wave-49 amendment describes.

const REPO_ROOT = join(DESIGN_ROOT, '..', '..');
const APP_SRC_DIR = join(REPO_ROOT, 'app', 'src');

// ---------------------------------------------------------------------------
// 1. POPULATION -- every drawn `max-width:<N>ch` clamp, keyed to its frame
//    file, its own line, its signature text runs, and its enclosing extent.
// ---------------------------------------------------------------------------

export interface DrawnClamp {
  readonly fileName: string;
  readonly line: number;
  readonly tag: string;
  readonly value: number;
  readonly rawStyle: string;
  /** Candidate text runs >= 20 chars, decoded + whitespace-collapsed. */
  readonly textRuns: readonly string[];
  readonly extentKind: 'phone' | 'desktop';
}

function lineOfIndex(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function decodeEntities(s: string): string {
  let out = s;
  for (const [entity, char] of Object.entries(ENTITY_MAP)) out = out.split(entity).join(char);
  return out;
}

/** Finds the index of the closing `</tag>` matching the opening tag whose
 * `>` sits at `openEnd`, tracking same-tag-name nesting depth (a wrapping
 * `<div>` can contain further `<div>`s). Throws loudly on an unbalanced
 * document rather than guessing (fail-loudly). */
function findMatchingClose(text: string, tag: string, openEnd: number): number {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = openEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0] === `</${tag}>`) {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  throw new Error(`pack-prose-measure: unbalanced <${tag}> starting at index ${openEnd}`);
}

/** Splits `inner` HTML on tag boundaries into plain-text runs, decodes
 * entities, collapses whitespace, and keeps every run >= 20 chars trimmed
 * (mirrors the caption ledger's own >= 20 char discriminator, which this
 * scan borrows the reasoning for rather than the population itself: a run
 * this short risks an accidental substring collision when matched as a
 * plain, non-boundary-anchored substring). */
function textRunsOf(inner: string): string[] {
  const runs: string[] = [];
  for (const raw of inner.split(/<[^>]+>/)) {
    const decoded = decodeEntities(raw).replace(/\s+/g, ' ').trim();
    if (decoded.length >= 20) runs.push(decoded);
  }
  return runs;
}

function extentKindFor(fileName: string, line: number): 'phone' | 'desktop' {
  if (ALL_FRAME_EXTENTS.some((f) => f.fileName === fileName && line >= f.line && line < f.extentEnd)) {
    return 'phone';
  }
  if (
    ALL_DESKTOP_FRAME_EXTENTS.some((f) => f.fileName === fileName && line >= f.line && line < f.extentEnd)
  ) {
    return 'desktop';
  }
  throw new Error(
    `pack-prose-measure: ${fileName}:${line} draws a max-width:<N>ch clamp outside every known phone ` +
      `and desktop frame extent -- population derivation defect, not a silently-droppable row.`
  );
}

const OPEN_TAG_RE = /<([a-z][a-z0-9-]*)\s+style="([^"]*max-width:(\d+)ch[^"]*)"/g;

function clampsInFile(fileName: string): DrawnClamp[] {
  const text = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8');
  const out: DrawnClamp[] = [];
  OPEN_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN_TAG_RE.exec(text))) {
    const tag = m[1]!;
    const rawStyle = m[2]!;
    const value = Number(m[3]);
    const openEnd = m.index + m[0].length + 1; // past the opening tag's own '>'
    const closeStart = findMatchingClose(text, tag, openEnd);
    const inner = text.slice(openEnd, closeStart);
    const line = lineOfIndex(text, m.index);
    out.push({
      fileName,
      line,
      tag,
      value,
      rawStyle,
      textRuns: textRunsOf(inner),
      extentKind: extentKindFor(fileName, line),
    });
  }
  return out;
}

export const ALL_CLAMPS: readonly DrawnClamp[] = designFileNames().flatMap(clampsInFile);

// ---------------------------------------------------------------------------
// 2. JOIN -- render-file resolution, then declared-max-width lookup.
// ---------------------------------------------------------------------------

const SOURCE_FILES = enumerateSourceFiles(APP_SRC_DIR).concat(
  enumerateSourceFiles(join(REPO_ROOT, 'src'))
);

interface NormalizedFile {
  readonly path: string;
  readonly blob: string;
  readonly raw: string;
}

const NORMALIZED_FILES: readonly NormalizedFile[] = SOURCE_FILES.map((path) => {
  const raw = readFileSync(path, 'utf-8');
  return { path, raw, blob: normalizeSource(raw) };
});

/** Every render file at least one of `textRuns` matches verbatim,
 * boundary-anchored, in the normalized product corpus. */
function resolveRenderFiles(textRuns: readonly string[]): string[] {
  const hits = new Set<string>();
  for (const run of textRuns) {
    for (const f of NORMALIZED_FILES) {
      if (labelIsMatched(run, [f.blob])) hits.add(f.path);
    }
  }
  return Array.from(hits).sort();
}

const MAX_WIDTH_CH_RE = /max-width:\s*(\d+)ch\b/g;

/** Every `.chq-*` CSS selector token that declares `max-width:<N>ch`,
 * mapped from every value back to the file(s)/line(s) that declare it --
 * built once from app/src/**\/*.css (readdirSync, DEC-808) plus every SSR
 * `*_CSS` module test/helpers/ssr-css-sources.ts derives (never a
 * hand-picked directory: that helper's own header names the exact gap a
 * directory glob left, src/views/theme.ts). */
function cssFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const entry of readdirSync(APP_SRC_DIR, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push({ path: full, text: readFileSync(full, 'utf-8') });
  }
  for (const src of ssrCssSources()) out.push({ path: src.path, text: src.text });
  return out;
}

function classTokensInSelector(selectorText: string): string[] {
  const out: string[] = [];
  const re = /\.([a-zA-Z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selectorText))) out.push(m[1]!);
  return out;
}

const CLASS_MAX_WIDTH_MAP = new Map<string, number[]>();
for (const { text } of cssFiles()) {
  MAX_WIDTH_CH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAX_WIDTH_CH_RE.exec(text))) {
    const value = Number(m[1]);
    const lastOpen = text.lastIndexOf('{', m.index);
    const lastClose = text.lastIndexOf('}', m.index);
    if (lastOpen === -1 || lastOpen < lastClose) continue; // no enclosing rule (stray/comment text)
    const prevClose = text.lastIndexOf('}', lastOpen);
    const selectorText = text.slice(prevClose + 1, lastOpen);
    for (const token of classTokensInSelector(selectorText)) {
      const list = CLASS_MAX_WIDTH_MAP.get(token) ?? [];
      list.push(value);
      CLASS_MAX_WIDTH_MAP.set(token, list);
    }
  }
}

const CLASS_TOKEN_RE = /chq-[a-zA-Z0-9-]+/g;

/** The render file's DECLARED max-width set: every inline `<N>ch` in the
 * file itself, unioned with every `.chq-*` class the file mentions that
 * some CSS rule clamps. */
function declaredMaxWidthsFor(renderFilePath: string): number[] {
  const raw = NORMALIZED_FILES.find((f) => f.path === renderFilePath)?.raw;
  if (raw === undefined) throw new Error(`pack-prose-measure: ${renderFilePath} missing from corpus cache`);
  const declared = new Set<number>();
  MAX_WIDTH_CH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAX_WIDTH_CH_RE.exec(raw))) declared.add(Number(m[1]));
  CLASS_TOKEN_RE.lastIndex = 0;
  const seen = new Set<string>();
  while ((m = CLASS_TOKEN_RE.exec(raw))) seen.add(m[0]);
  for (const token of seen) {
    for (const v of CLASS_MAX_WIDTH_MAP.get(token) ?? []) declared.add(v);
  }
  return Array.from(declared).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 3. CLASSIFICATION
// ---------------------------------------------------------------------------

export type ClampVerdict = 'MATCHED' | 'DIVERGES' | 'UNCLAMPED' | 'UNRESOLVED';

export interface GradedClamp extends DrawnClamp {
  readonly renderFiles: readonly string[];
  readonly declared: readonly number[];
  readonly verdict: ClampVerdict;
}

function grade(clamp: DrawnClamp): GradedClamp {
  const renderFiles = resolveRenderFiles(clamp.textRuns);
  if (renderFiles.length === 0) {
    return { ...clamp, renderFiles, declared: [], verdict: 'UNRESOLVED' };
  }
  const declared = Array.from(new Set(renderFiles.flatMap(declaredMaxWidthsFor))).sort((a, b) => a - b);
  if (declared.includes(clamp.value)) {
    return { ...clamp, renderFiles, declared, verdict: 'MATCHED' };
  }
  // DEC-896 wave-52 amendment: a COMPOSED-SENTENCE element (one element
  // whose rendered text varies by state -- e.g. src/routes/root.tsx's
  // heroSummary(), which composes one of several hub-state sentences into
  // the SAME `.chq-home-hero p`) cannot carry a distinct max-width per
  // sampled sentence: one element, one clamp. When the render file's own
  // declared set already contains a value AT OR ABOVE this row's drawn
  // value, the wider declared clamp is the real, already-served measure
  // and this narrower sample is the same rule seen against shorter copy --
  // MATCHED, never DIVERGES. A declared value below the drawn one is still
  // a real gap (the served clamp is narrower than the frame draws) and
  // stays DIVERGES.
  if (declared.some((d) => d >= clamp.value)) {
    return { ...clamp, renderFiles, declared, verdict: 'MATCHED' };
  }
  if (declared.length > 0) {
    return { ...clamp, renderFiles, declared, verdict: 'DIVERGES' };
  }
  return { ...clamp, renderFiles, declared, verdict: 'UNCLAMPED' };
}

export const GRADED: readonly GradedClamp[] = ALL_CLAMPS.map(grade);

export const DIVERGES_AND_UNCLAMPED: readonly GradedClamp[] = GRADED.filter(
  (c) => c.verdict === 'DIVERGES' || c.verdict === 'UNCLAMPED'
);
export const UNRESOLVED: readonly GradedClamp[] = GRADED.filter((c) => c.verdict === 'UNRESOLVED');

// ---------------------------------------------------------------------------
// 4. RATCHET -- hand-measured on this branch, never `= DIVERGES_AND_UNCLAMPED.length`.
// ---------------------------------------------------------------------------

export const PACK_PROSE_MEASURE_DIVERGENCE_CEILING = 0;

describe('pack prose-measure (ch) register (DEC-896 wave-49, v12 mobile campaign)', () => {
  it('non-vacuity: drawn population spans several frames (vacuous-grammar guard)', () => {
    expect(ALL_CLAMPS.length).toBeGreaterThanOrEqual(20);
    const distinctFiles = new Set(ALL_CLAMPS.map((c) => c.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(8);
  });

  it('vacuous-population tripwire keyed on CONTENT, never a source line number (DEC-999)', () => {
    // A specific known row, pinned by frame file + drawn value + a quoted
    // text substring -- never by the line the clamp happens to sit on
    // today, which a legitimate unrelated edit could shift.
    const homeRow = ALL_CLAMPS.find(
      (c) =>
        c.fileName === 'Chautauqua Home.dc.html' &&
        c.value === 54 &&
        c.textRuns.some((t) => t.includes('One call for papers is open'))
    );
    expect(homeRow, 'Chautauqua Home.dc.html no longer draws its 54ch hero-sentence clamp').toBeDefined();

    const overviewRow = ALL_CLAMPS.find(
      (c) =>
        c.fileName === 'Chautauqua Overview.dc.html' &&
        c.value === 78 &&
        c.textRuns.some((t) => t.includes('show nothing'))
    );
    expect(
      overviewRow,
      'Chautauqua Overview.dc.html no longer draws its 78ch skeleton-rules clamp'
    ).toBeDefined();
  });

  it('every clamp resolves to exactly one enclosing phone/desktop extent (population derivation sanity)', () => {
    for (const c of ALL_CLAMPS) {
      expect(['phone', 'desktop']).toContain(c.extentKind);
    }
  });

  it('every clamp is graded exactly one of MATCHED/DIVERGES/UNCLAMPED/UNRESOLVED', () => {
    const verdicts: ClampVerdict[] = ['MATCHED', 'DIVERGES', 'UNCLAMPED', 'UNRESOLVED'];
    for (const g of GRADED) {
      expect(verdicts).toContain(g.verdict);
    }
    expect(GRADED.length).toBe(ALL_CLAMPS.length);
  });

  it(
    `never exceeds PACK_PROSE_MEASURE_DIVERGENCE_CEILING (${PACK_PROSE_MEASURE_DIVERGENCE_CEILING}) DIVERGES+UNCLAMPED clamps`,
    () => {
      if (DIVERGES_AND_UNCLAMPED.length > PACK_PROSE_MEASURE_DIVERGENCE_CEILING) {
        const offenders = DIVERGES_AND_UNCLAMPED.map(
          (c) =>
            `${c.fileName}:${c.line} <${c.tag}> max-width:${c.value}ch -- ${c.verdict}` +
            ` (render file(s): ${c.renderFiles.join(', ') || 'none'}; declared: ${c.declared.join(', ') || 'none'})`
        );
        throw new Error(
          `${DIVERGES_AND_UNCLAMPED.length} prose-measure clamps DIVERGE or are UNCLAMPED, above the ` +
            `ceiling of ${PACK_PROSE_MEASURE_DIVERGENCE_CEILING}. PACK_PROSE_MEASURE_DIVERGENCE_CEILING ` +
            `may only be RAISED (a merge-train act, never a worker's edit mid-lane), and only once ` +
            `re-measured against the integrated tree. Offenders:\n${offenders.join('\n')}`
        );
      }
      expect(DIVERGES_AND_UNCLAMPED.length).toBeLessThanOrEqual(PACK_PROSE_MEASURE_DIVERGENCE_CEILING);
    }
  );

  it(
    `never sits BELOW PACK_PROSE_MEASURE_DIVERGENCE_CEILING (${PACK_PROSE_MEASURE_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`,
    () => {
      if (DIVERGES_AND_UNCLAMPED.length < PACK_PROSE_MEASURE_DIVERGENCE_CEILING) {
        throw new Error(
          `${DIVERGES_AND_UNCLAMPED.length} clamps DIVERGE or are UNCLAMPED, below the ceiling of ` +
            `${PACK_PROSE_MEASURE_DIVERGENCE_CEILING}. This is the ratchet working: coverage landed. ` +
            `Lower the ceiling in the same commit (a merge-train act) by replacing the line:\n` +
            `  export const PACK_PROSE_MEASURE_DIVERGENCE_CEILING = ${DIVERGES_AND_UNCLAMPED.length};`
        );
      }
      expect(DIVERGES_AND_UNCLAMPED.length).toBeGreaterThanOrEqual(PACK_PROSE_MEASURE_DIVERGENCE_CEILING);
    }
  );
});
