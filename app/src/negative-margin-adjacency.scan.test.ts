// Negative-margin adjacency scan (DEC-919 wave-152 amendment, task w8-eg).
// INSTRUMENT ONLY -- no product CSS byte moves in this task.
//
// MECHANISM. A negative top/all-sides margin is sometimes authored to tuck
// a rule under a SIBLING selector -- correct only while that sibling is
// `display: none`. If some `@media` block later reveals the sibling
// (changes its `display` away from `none`) without the pulling rule's own
// negative margin being neutralised for that same width, the pull now
// drags the rule on top of the newly-visible sibling, superimposing both.
// The known live instance (app/src/pages/submissions/detail.css's
// `.chq-detail-placement` pulling up under the h1 while
// `.chq-detail-byline` was display:none, then the terminal phone block
// revealing the byline) was repaired before this instrument landed
// (detail.css's phone block now carries `.chq-detail-placement { margin-
// top: 0; }`, pinned by
// app/src/pages/submissions/detail-head-390.test.ts:128) -- this scan
// seeds against that already-fixed tree, not re-opening it. DEC-919's
// wave-152 amendment states the contract this scan grades verbatim: "A
// negative top margin is correct only for the sibling it was measured
// against, so it carries a receipt naming that sibling -- and never sits
// after a node a narrower block un-hides."
//
// TWO THINGS GRADED PER CANDIDATE DECLARATION:
//   (A) RECEIPT: does the comment immediately preceding the rule (nothing
//       but whitespace between the comment's close and the rule's
//       selector) name an EXTERNAL sibling selector -- a `.chq-*` class
//       token that is not one of the declaring rule's own selector's
//       classes? A rule whose comment names no external sibling is making
//       no adjacency claim this scan can check (a cancelled-own-padding
//       margin, a visually-hidden 1px clip, or simply undocumented) --
//       DEC-919's receipt requirement is necessary but not sufficient for
//       offender status; see (B).
//   (B) MECHANISM: for each named sibling, is there a top-level
//       (non-media) rule for that sibling with `display: none`, AND some
//       `@media` rule (any breakpoint -- DEC-991's "grade every media
//       block that applies", not just <=700px, so a <=900px block is
//       graded exactly like a <=700px one) for that same sibling with
//       `display` set to anything other than `none`? That is the exact
//       shape that burned detail.css: the negative margin was measured
//       against a sibling assumed permanently hidden, and a media block
//       proved that assumption false.
// A declaration is an OFFENDER iff (A) and (B) both hold for the same
// named sibling.
//
// NARROWING FLAGGED (design gap, narrowest reasonable reading taken): the
// receipt regex below only recognises `.chq-*` class tokens as "a named
// selector" -- every real CSS class in this codebase carries that prefix
// (measured), so this excludes zero real sibling references while
// excluding every false positive a looser token regex picks up from prose
// (file-path fragments like `.scan.test.ts`/`.tsx`/`.css`, or bare English
// words like "label"/"table" that happen to also be CSS type-selector
// names -- both measured to occur in this exact 16-declaration population
// and both would have manufactured false offenders under a looser regex).
// A future amendment widening the receipt vocabulary to element/id
// selectors is legitimate scope, not something this task's "no CSS byte
// moves" instruction blocks -- flagged here rather than guessed at.
//
// PARSING. Two representations of the same source, DEC-374's amendment
// distinction applied directly: rule STRUCTURE (selector/body/media
// nesting, used for locating negative-margin declarations and for the
// mechanism check's `display` reads) is derived from comment-STRIPPED
// text via the shared stripper (`stripCssComments`, reused from
// app/src/test-utils/phoneBlock.ts rather than re-derived -- DEC-613's
// "a second copy of a vocabulary is a trap with a delay fuse" shape); the
// RECEIPT comment text is read RAW, because the comment is the subject of
// (A)'s check, not incidental prose to be discarded before parsing
// (DEC-374's amendment: "a source-scanning ratchet reads a comment
// verbatim ONLY when the comment is its subject").
//
// POPULATION. Every `.css` file under app/src (recursive readdirSync,
// matching no-fitted-geometry.scan.test.ts's derivation) plus every SSR
// `*_CSS` module found by `ssrCssSources()` (DEC-808's derived-population
// idiom, which is how `src/views/theme.ts` and the `src/routes/public/
// css/*.css.ts` fragments enter the sweep without a hand-picked
// directory list). `.ts`/`.css.ts` sources are reduced to their own
// backtick template-literal bodies before parsing (extractCssText below)
// so a source file's own JS-level prose/import statements -- which are
// not CSS and can carry unbalanced `/* `/`*/`-shaped substrings inside a
// `//` line comment, e.g. src/routes/public/public.css.ts's own header
// prose mentioning "css/*.css.ts fragments" -- never reach the CSS rule
// parser. Candidates are every `margin`/`margin-top`/`margin-block-start`
// declaration whose TOP component (the shorthand's first token, which is
// always the top value for the 1/2/3/4-value forms, or the whole value for
// the two longhand properties) is negative -- `margin-inline`,
// `margin-left`, `margin-right`, `margin-bottom` are excluded by property
// name, matching the task brief's exact population.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_374, DEC_919, DEC_991 } from '../../src/decisions';
import { ssrCssSources } from '../../test/helpers/ssr-css-sources';
import { stripCssComments } from './test-utils/phoneBlock';
import { NEGATIVE_MARGIN_ADJACENCY_CEILING } from './negative-margin-adjacency-ceiling';

void DEC_374; // comments read raw only when the comment is the subject (the receipt side of this scan)
void DEC_919; // the adjacency-receipt contract itself
void DEC_991; // grade every @media block that applies, not just <=700px

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;
const REPO_ROOT = join(HERE, '..', '..');

// ---------------------------------------------------------------------------
// Population derivation (mirrors no-fitted-geometry.scan.test.ts's idiom).
// ---------------------------------------------------------------------------

function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.css') && !entry.name.endsWith('.css.ts')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface CssSource {
  path: string; // absolute
  rel: string; // repo-relative, for messages
  text: string; // raw file text (app/src/*.css) or raw module text (*.ts SSR source)
}

function loadSources(): CssSource[] {
  const appFiles = allCssFiles(APP_SRC).map((abs) => ({
    path: abs,
    rel: relative(REPO_ROOT, abs),
    text: readFileSync(abs, 'utf-8'),
  }));
  const ssr = ssrCssSources().map((s) => ({
    path: join(REPO_ROOT, s.path),
    rel: s.path,
    text: s.text,
  }));
  return [...appFiles, ...ssr];
}

/** Reduces a source's text to just its CSS content: `.css` files are pure
 * CSS already; `.ts`/`.css.ts` sources are reduced to the concatenation of
 * every backtick template-literal body in the file (there is no other use
 * of a template literal in these modules -- each is a `export const
 * X_CSS = \`...\`` declaration), which drops the surrounding JS import
 * statements and `//`/`/* *\/`-shaped prose that is not CSS and would
 * otherwise desynchronise a CSS-shaped parser (measured failure mode:
 * src/routes/public/public.css.ts's own header comment mentions
 * "css/*.css.ts fragments" inside a `//` line, an unterminated-looking
 * `/*` if the whole file were parsed as CSS). */
function extractCssText(source: CssSource): string {
  if (source.path.endsWith('.css')) return source.text;
  const literals = source.text.match(/`[\s\S]*?`/g) ?? [];
  return literals.map((lit) => lit.slice(1, -1)).join('\n');
}

// ---------------------------------------------------------------------------
// Rule parser: single pass, comment-aware, tracks @media nesting depth and
// the RAW comment (if any) immediately preceding each rule's selector.
// ---------------------------------------------------------------------------

interface ParsedRule {
  selector: string; // comment-stripped, whitespace-collapsed
  body: string; // comment-stripped (via the shared stripCssComments stripper)
  media: readonly string[]; // stack of enclosing @media preludes, outer to inner; [] = top-level
  precedingComment: string | null; // RAW comment text, only if nothing but whitespace separates it from the selector
}

function parseCssRules(raw: string): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const mediaStack: string[] = [];
  const n = raw.length;
  let i = 0;
  let headerBuf = '';
  let commentBeforeHeader: string | null = null;

  while (i < n) {
    if (raw[i] === '/' && raw[i + 1] === '*') {
      const end = raw.indexOf('*/', i + 2);
      if (end === -1) throw new Error('unterminated CSS comment while parsing rule structure');
      const text = raw.slice(i + 2, end);
      // A comment counts as "immediately preceding" only when nothing but
      // whitespace has accumulated in headerBuf since the last boundary --
      // otherwise it's a comment stranded mid-selector, not a receipt.
      if (headerBuf.trim() === '') commentBeforeHeader = text;
      i = end + 2;
      continue;
    }
    const ch = raw[i];
    if (ch === '{') {
      const header = headerBuf.trim().replace(/\s+/g, ' ');
      headerBuf = '';
      if (/^@media\b/.test(header)) {
        mediaStack.push(header);
        commentBeforeHeader = null;
        i += 1;
        continue;
      }
      // Find the matching close brace, skipping over comments (which may
      // themselves contain `{`/`}`-shaped prose) so depth-counting stays
      // correct.
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (raw[j] === '/' && raw[j + 1] === '*') {
          const e2 = raw.indexOf('*/', j + 2);
          if (e2 === -1) throw new Error('unterminated CSS comment inside a rule body');
          j = e2 + 2;
          continue;
        }
        if (raw[j] === '{') depth += 1;
        else if (raw[j] === '}') depth -= 1;
        j += 1;
      }
      const rawBody = raw.slice(i + 1, j - 1);
      rules.push({
        selector: header,
        body: stripCssComments(rawBody),
        media: [...mediaStack],
        precedingComment: commentBeforeHeader,
      });
      i = j;
      commentBeforeHeader = null;
      continue;
    }
    if (ch === '}') {
      if (mediaStack.length > 0) mediaStack.pop();
      headerBuf = '';
      commentBeforeHeader = null;
      i += 1;
      continue;
    }
    headerBuf += ch;
    i += 1;
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Candidate declarations: margin/margin-top/margin-block-start with a
// negative top component.
// ---------------------------------------------------------------------------

interface Candidate {
  fileRel: string;
  selector: string;
  property: string;
  value: string;
  precedingComment: string | null;
  rules: readonly ParsedRule[]; // every rule in this candidate's own source, for the mechanism check
}

const NEGATIVE_TOP_MARGIN_PROPS = new Set(['margin', 'margin-top', 'margin-block-start']);

function findCandidates(fileRel: string, cssText: string): Candidate[] {
  const rules = parseCssRules(cssText);
  const out: Candidate[] = [];
  for (const rule of rules) {
    for (const stmt of rule.body.split(';')) {
      const m = /^\s*(margin|margin-top|margin-block-start)\s*:\s*([^;]+)$/.exec(stmt);
      if (!m) continue;
      const property = m[1] as string;
      if (!NEGATIVE_TOP_MARGIN_PROPS.has(property)) continue;
      const value = (m[2] as string).trim();
      const topToken = value.split(/\s+/)[0] ?? '';
      if (!topToken.startsWith('-')) continue;
      out.push({
        fileRel,
        selector: rule.selector,
        property,
        value,
        precedingComment: rule.precedingComment,
        rules,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Receipt + mechanism checks.
// ---------------------------------------------------------------------------

/** Every `.chq-*` class token in `text` (project-wide class prefix --
 * measured to be the ONLY class shape this codebase's stylesheets use, so
 * restricting to it is a false-positive elimination, not a coverage cut:
 * see the NARROWING note in this file's header for the two measured false-
 * positive shapes a looser token regex admits). */
const CHQ_CLASS_RE = /\.chq-[\w-]+/g;

function classTokens(text: string): Set<string> {
  return new Set(text.match(CHQ_CLASS_RE) ?? []);
}

/** The external siblings a candidate's receipt comment names -- every
 * `.chq-*` token in the comment that is NOT also a class in the
 * declaring rule's own selector (so `.chq-drawer .chq-modal-head`'s own
 * comment naming `.chq-drawer` doesn't count as an external sibling --
 * that's the rule's own ancestor-scope selector, not a toggled sibling). */
function namedSiblings(candidate: Candidate): string[] {
  if (!candidate.precedingComment) return [];
  const own = classTokens(candidate.selector);
  const named = classTokens(candidate.precedingComment);
  return [...named].filter((token) => !own.has(token));
}

/** Does `selector` include `token` (a `.chq-*` class) as one of its own
 * class components? Uses a negative lookahead instead of `\b` because CSS
 * class names legitimately contain hyphens -- `\b` alone would treat
 * `.chq-modal` as "mentioned" inside `.chq-modal-head` (wrong: different
 * class), since `\b` fires at the letter/hyphen boundary too. */
function mentionsToken(selector: string, token: string): boolean {
  const cls = token.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${cls}(?![\\w-])`).test(selector);
}

function hasDisplayNone(body: string): boolean {
  return /display\s*:\s*none\b/.test(body);
}

/** The rule's `display` value if it declares one and it is not `none`. */
function revealsDisplay(body: string): boolean {
  const m = /display\s*:\s*([a-zA-Z-]+)/.exec(body);
  return m !== null && m[1] !== 'none';
}

function siblingBaseDisplayNone(token: string, rules: readonly ParsedRule[]): boolean {
  return rules.some((r) => r.media.length === 0 && mentionsToken(r.selector, token) && hasDisplayNone(r.body));
}

function siblingRevealedInMedia(token: string, rules: readonly ParsedRule[]): boolean {
  return rules.some((r) => r.media.length > 0 && mentionsToken(r.selector, token) && revealsDisplay(r.body));
}

interface OffenderReport {
  candidate: Candidate;
  via: string; // the named sibling whose reveal triggered offender status
}

function checkOffender(candidate: Candidate): OffenderReport | null {
  for (const sibling of namedSiblings(candidate)) {
    if (siblingBaseDisplayNone(sibling, candidate.rules) && siblingRevealedInMedia(sibling, candidate.rules)) {
      return { candidate, via: sibling };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Real population.
// ---------------------------------------------------------------------------

const SOURCES = loadSources();
const ALL_CANDIDATES: Candidate[] = SOURCES.flatMap((s) => findCandidates(s.rel, extractCssText(s)));
const OFFENDERS: OffenderReport[] = ALL_CANDIDATES.map(checkOffender).filter(
  (o): o is OffenderReport => o !== null,
);

// ---------------------------------------------------------------------------
// Vacuous-population tripwire: this task's own measured counts at
// main 9c39b12e. A derivation that silently narrows (wrong root, wrong
// suffix filter, a broken template-literal split) shows up here as a count
// mismatch long before it would show up as a suspiciously-quiet ratchet.
// ---------------------------------------------------------------------------

describe('negative-margin adjacency scan: population sanity (DEC-919 wave-152 amendment)', () => {
  it('sweeps exactly 43 CSS-bearing sources (app/src/**/*.css + ssrCssSources())', () => {
    expect(SOURCES.length).toBe(43);
  });

  // 160 -> 161 (DEC-919 wave-156, task qb-settings-yourdata-read-drill): the
  // read drill's per-row boxed action is phone-only, so
  // `.chq-settings-summary-row-action` carries a desktop `display: none` in
  // settings-lists.css -- a real new declaration, not a sweep regression.
  // 169 -> 174 (wave-16 megabatch): phone-only reveals landed in
  // settings.css (DESKTOP_FLOOR_DIVERGENCE work) and overview.css (DEC-833's
  // four phone-only section labels), each pairing its phone rule with a
  // desktop `display: none`. Real new declarations, not a sweep regression.
  it('the swept population carries exactly 174 comment-stripped `display: none` declarations', () => {
    let total = 0;
    for (const s of SOURCES) {
      const stripped = stripCssComments(extractCssText(s));
      total += (stripped.match(/display\s*:\s*none\b/g) ?? []).length;
    }
    expect(total).toBe(174);
  });

  it('finds exactly the 17 negative margin/margin-top/margin-block-start declarations named in the task brief', () => {
    const found = ALL_CANDIDATES.map((c) => `${c.fileRel} :: ${c.selector}`).sort();
    const expected = [
      'app/src/components/error-states.css :: .chq-error-summary a.chq-error-summary-link',
      'app/src/components/modal-frame.css :: .chq-modal-head',
      'app/src/components/modal-frame.css :: .chq-drawer .chq-modal-head',
      'app/src/components/page-skeleton.css :: .chq-skeleton-sr-label',
      'app/src/pages/comms/comms.css :: .chq-comms-status-pill-input',
      'app/src/pages/comms/comms.css :: .chq-comms-visually-hidden',
      'app/src/pages/contacts/contacts-panels.css :: .chq-contacts-import-review-sub',
      'app/src/pages/contacts/contacts-panels.css :: .chq-contacts-import-phone-target-input',
      'app/src/pages/content/content.css :: .chq-content-upload-input',
      'app/src/pages/review/review.css :: .chq-review-criterion-guidance',
      'app/src/pages/review/review.css :: .chq-review-editor-title-input',
      'app/src/pages/review/review.css :: .chq-review-criterion-weight-caption',
      'app/src/pages/submissions/detail.css :: .chq-detail-placement',
      // DEC-878 wave-16 amendment: the phone stand-down for the Abstract /
      // Form-answers headings copies the house visually-hidden recipe
      // verbatim, `margin: -1px` included -- receipted in detail.css, and
      // the adjacency ratchet below still reads 0 offenders.
      'app/src/pages/submissions/detail.css :: .chq-detail-section-title-frameless',
      'app/src/styles.css :: .chq-check-hit',
      'src/routes/public/css/chrome.css.ts :: .chq-visually-hidden',
      'src/routes/public/css/chrome.css.ts :: .chq-pub-activefilters',
    ].sort();
    expect(found).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Fabricated controls -- prove the (A)+(B) pipeline both fires and holds
// its fire, through the exact same functions the real population uses.
// ---------------------------------------------------------------------------

describe('negative-margin adjacency scan: fabricated controls', () => {
  it('positive control: a receipted negative-top-margin rule whose named sibling is display:none at top level and revealed in @media is an offender', () => {
    const fixture = [
      '.chq-sib { display: none; }',
      '/* tucks under .chq-sib while it stays hidden */',
      '.chq-x { margin-top: -16px; }',
      '@media (max-width: 700px) {',
      '  .chq-sib { display: block; }',
      '}',
    ].join('\n');
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(candidate).toBeDefined();
    expect(checkOffender(candidate!)).not.toBeNull();
  });

  it('positive control: a <=900px media block reveals the sibling exactly like a <=700px one would (DEC-991)', () => {
    const fixture = [
      '.chq-sib { display: none; }',
      '/* tucks under .chq-sib while it stays hidden */',
      '.chq-x { margin: -16px 0 0; }',
      '@media (max-width: 900px) {',
      '  .chq-sib { display: flex; }',
      '}',
    ].join('\n');
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(checkOffender(candidate!)).not.toBeNull();
  });

  it('negative control: no preceding comment at all -- no receipt, so no adjacency claim to check', () => {
    const fixture = ['.chq-sib { display: none; }', '.chq-x { margin-top: -16px; }', '@media (max-width: 700px) {', '  .chq-sib { display: block; }', '}'].join(
      '\n',
    );
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(checkOffender(candidate!)).toBeNull();
  });

  it('negative control: receipted, but the sibling is never revealed (stays display:none everywhere) -- not an offender', () => {
    const fixture = [
      '.chq-sib { display: none; }',
      '/* tucks under .chq-sib while it stays hidden */',
      '.chq-x { margin-top: -16px; }',
      '@media (max-width: 700px) {',
      '  .chq-sib { display: none; }',
      '}',
    ].join('\n');
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(checkOffender(candidate!)).toBeNull();
  });

  it('negative control: receipted, sibling reveals, but the sibling was never display:none at top level -- no hazard to reveal', () => {
    const fixture = [
      '.chq-sib { display: block; }',
      '/* tucks under .chq-sib */',
      '.chq-x { margin-top: -16px; }',
      '@media (max-width: 700px) {',
      '  .chq-sib { display: flex; }',
      '}',
    ].join('\n');
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(checkOffender(candidate!)).toBeNull();
  });

  it('negative control: comment only names the rule\'s OWN selector (self-reference, not an external sibling)', () => {
    const fixture = [
      '.chq-x { display: none; }',
      '@media (max-width: 700px) {',
      '  /* .chq-x reveals here */',
      '  .chq-x { display: block; margin-top: -16px; }',
      '}',
    ].join('\n');
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(candidate).toBeDefined();
    expect(namedSiblings(candidate!)).toEqual([]);
    expect(checkOffender(candidate!)).toBeNull();
  });

  it('negative control: a -1px border-collapse-style offset satisfies receipt by naming the border it overlaps, with no reveal to trigger', () => {
    const fixture = [
      '.chq-table-cell { border: 1px solid #ccc; }',
      '/* -1px collapses onto .chq-table-cell\'s own border so adjacent cells share one hairline */',
      '.chq-x { margin: -1px; }',
    ].join('\n');
    const [candidate] = findCandidates('fixture.css', fixture);
    expect(candidate).toBeDefined();
    // .chq-table-cell is named and is an external sibling, but it never
    // carries display:none anywhere, so the mechanism never triggers --
    // the border-collapse case is receipted-but-never-an-offender, exactly
    // as the task brief's "satisfies this by naming the border it
    // overlaps" describes.
    expect(namedSiblings(candidate!)).toEqual(['.chq-table-cell']);
    expect(checkOffender(candidate!)).toBeNull();
  });

  it('negative control: margin-inline/-left/-right/-bottom never enter the population (no top component)', () => {
    const fixture = [
      '.chq-x {',
      '  margin-inline: -10px;',
      '  margin-left: -6px;',
      '  margin-right: -6px;',
      '  margin-bottom: -4px;',
      '}',
    ].join('\n');
    expect(findCandidates('fixture.css', fixture)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The ratchet: two-sided per DEC-808 -- may only fall, and a companion test
// fails loudly with the exact replacement line if the real count drops
// below the pinned ceiling without the ceiling being lowered to match.
// ---------------------------------------------------------------------------

describe('negative-margin adjacency ratchet (DEC-919 wave-152 amendment)', () => {
  it('offender count never exceeds NEGATIVE_MARGIN_ADJACENCY_CEILING (one-sided ratchet: may only fall)', () => {
    const detail = OFFENDERS.map(
      (o) => `${o.candidate.fileRel} :: ${o.candidate.selector} (${o.candidate.property}: ${o.candidate.value}) -- reveals via ${o.via}`,
    ).join('\n');
    expect(
      OFFENDERS.length,
      `negative-margin adjacency offenders (${OFFENDERS.length}) exceed NEGATIVE_MARGIN_ADJACENCY_CEILING ` +
        `(${NEGATIVE_MARGIN_ADJACENCY_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(NEGATIVE_MARGIN_ADJACENCY_CEILING);
  });

  it(`never falls below NEGATIVE_MARGIN_ADJACENCY_CEILING (${NEGATIVE_MARGIN_ADJACENCY_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < NEGATIVE_MARGIN_ADJACENCY_CEILING) {
      throw new Error(
        `negative-margin adjacency offenders (${OFFENDERS.length}) fell below the ` +
          `NEGATIVE_MARGIN_ADJACENCY_CEILING of ${NEGATIVE_MARGIN_ADJACENCY_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling in the same commit (a merge-train act, never a ` +
          `worker's edit mid-lane) by replacing the line in ` +
          `app/src/negative-margin-adjacency-ceiling.ts:\n  export const ` +
          `NEGATIVE_MARGIN_ADJACENCY_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(NEGATIVE_MARGIN_ADJACENCY_CEILING);
  });
});
