// V12 mobile campaign — DEC-808's wave-85 amendment on DEC-385 ("single-
// direction responsive: narrow overrides wide via max-width media queries
// ONLY") ruled that a per-file pin (content.css, comms.css) cannot see a
// sheet nobody pinned, and that an ENUMERATING cascade-order scan was owed.
// This is that scan.
//
// POPULATION (DEC-808 — enumerate, never a manifest):
//   * every `*.css` file under app/src, via readdirSync recursion
//   * every SSR `*_CSS` module derived by test/helpers/ssr-css-sources.ts
//     (this already walks all of src/ for top-level `export const X_CSS`
//     template literals, per DEC-367/DEC-808 wave 57 — a superset of "every
//     *.css.ts under src/routes" that a hand-scoped `src/routes` walk could
//     silently miss if a future SSR sheet lands outside that directory)
//
//   This was a CLAIM until wave-108's DEC-613 amendment, which deleted the
//   independently-authored app/src/phone-cascade-order.scan.test.ts (same
//   rule, same rough population, a one-sided SHADOWED_CEILING=20 over an
//   already-clean tree) after PROVING containment: this file's population
//   (43 files: 27 app/src *.css + 16 SSR *_CSS modules) is a strict
//   superset of the deleted copy's (40 files: 27 app/src *.css + 13
//   *.css.ts under src/routes) — every one of the deleted copy's 40 files
//   appears here too, plus 3 SSR *_CSS modules outside src/routes/. See
//   src/decisions-data/DEC-613.md, "Amendment (wave 108)" for the measured
//   file lists.
//
// RULE: for every declaration inside a `@media (max-width: …)` block, flag
// it when the SAME selector is re-declared at TOP LEVEL for the SAME
// property AFTER that block closes. In a flat, single-direction stylesheet
// this is a cascade-order bug: the "wide" declaration, appearing later in
// source order, wins over the narrow override that was supposed to beat it.
//
// Blocks are brace-matched, never regex-bound (a naive `\{[^}]*\}` stops at
// the first nested rule's closing brace and silently truncates); comments
// are stripped first so an explanatory `{` inside one cannot desynchronise
// the depth counter. Mirrors app/src/pages/contacts/contacts-phone-frames
// .test.ts's read/phoneLayer/desktopLayer shape, generalised from "look up
// one selector" to "enumerate every declaration".
//
// RATCHET (two-sided, the shape DEC-808's wave-85 amendment settled for the
// phone-frame ledger): SHADOWED_CEILING is seeded at the count measured on
// this branch. The scan fails if the count rises (naming every offending
// pair) and fails if the count drops below the ceiling without the ceiling
// itself being lowered — lowering the ceiling is a merge-train act, once a
// sheet is actually fixed, never a worker's mid-lane edit.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { selectorMentionsToken } from '../app/src/phone-tap-target-scan/core';
import { ssrCssSources } from './helpers/ssr-css-sources';
import { stripCssComments as stripComments } from './helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');

// -- population: every *.css under app/src ------------------------------

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listCssFiles(full));
    } else if (entry.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

interface Sheet {
  label: string;
  text: string;
}

function appSrcSheets(): Sheet[] {
  return listCssFiles(APP_SRC_ROOT)
    .map((full) => ({
      label: relative(REPO_ROOT, full).split(sep).join('/'),
      text: stripComments(readFileSync(full, 'utf-8')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function ssrSheets(): Sheet[] {
  return ssrCssSources()
    .map((s) => ({ label: s.path, text: stripComments(s.text) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// -- brace-matched top-level block parser --------------------------------

interface Block {
  header: string;
  bodyStart: number;
  bodyEnd: number; // exclusive, index of the closing '}'
  blockEnd: number; // index just past the closing '}'
  start: number; // index of the first char of the header
}

/** Parses `css` into a flat list of top-level blocks (rules and at-rules),
 * brace-matched so a nested rule's `}` can never end a block early. Bare
 * statements terminated by `;` (e.g. `@import ...;`) are skipped. Offsets
 * are relative to `css` itself — callers translate with `baseOffset`. */
function parseTopLevelBlocks(css: string): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css.charAt(i))) i += 1;
    if (i >= css.length) break;
    let j = i;
    while (j < css.length && css.charAt(j) !== '{' && css.charAt(j) !== ';') j += 1;
    if (j >= css.length) break;
    if (css.charAt(j) === ';') {
      i = j + 1;
      continue;
    }
    const header = css.slice(i, j).trim();
    let depth = 1;
    let k = j + 1;
    const bodyStart = k;
    while (k < css.length && depth > 0) {
      if (css.charAt(k) === '{') depth += 1;
      else if (css.charAt(k) === '}') depth -= 1;
      k += 1;
    }
    if (depth !== 0) throw new Error(`unbalanced block starting at offset ${i}: "${header}"`);
    blocks.push({ header, bodyStart, bodyEnd: k - 1, blockEnd: k, start: i });
    i = k;
  }
  return blocks;
}

interface Decl {
  selector: string;
  property: string;
  offset: number;
}

function normaliseSelector(sel: string): string {
  return sel.trim().replace(/\s+/g, ' ');
}

/** Excludes template-literal interpolation artefacts (`.${SOME_CONST}`) from
 * being treated as a real selector header. `${` is itself a spurious
 * balanced-brace pair to `parseTopLevelBlocks`'s naive char scan, so a
 * `*.css.ts` interpolated selector desyncs the header/body split for that
 * one block (ported from app/src/phone-cascade-order.scan.test.ts's
 * `isSelectorHeader`, wave-108 DEC-613 amendment: proven on
 * src/routes/public/css/agenda.css.ts's `.${ACCENT_BOUND_CLASSES[1]}` phone
 * rule, which the unfiltered parser silently dropped via an empty-header
 * side effect rather than an intentional exclusion). Excluding it here is
 * explicit and can only make the scan UNDER-count (a missed shadow behind
 * an interpolated selector), never fabricate one, so it cannot inflate
 * SHADOWED_CEILING. */
function isSelectorHeader(header: string): boolean {
  const t = header.trim();
  if (!t) return false;
  if (t.includes('$') || t.includes('`')) return false;
  return true;
}

/** Extracts (selector, property) declarations from a plain rule's body.
 * A comma-separated selector list is split into its whole members — never
 * substring-matched — so `.a` and `.b .a` are distinct declarations. */
function extractDecls(header: string, bodyStart: number, bodyEnd: number, css: string): Decl[] {
  const selectors = header
    .split(',')
    .map(normaliseSelector)
    .filter(Boolean);
  if (selectors.length === 0) return [];
  const body = css.slice(bodyStart, bodyEnd);
  const decls: Decl[] = [];
  for (const stmt of body.split(';')) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const property = trimmed.slice(0, colon).trim();
    if (!property) continue;
    for (const selector of selectors) {
      decls.push({ selector, property, offset: bodyStart });
    }
  }
  return decls;
}

const MAX_WIDTH_RE = /max-width\s*:\s*\d+px/;
const MIN_WIDTH_RE = /min-width\s*:/;

interface MediaDecl extends Decl {
  mediaBlockEnd: number;
}

/** Splits a stylesheet into (a) every declaration that lives inside a
 * `@media (max-width: …)` block, tagged with where that block closes, and
 * (b) every declaration that lives at the sheet's TOP LEVEL (i.e. outside
 * any @media block). Other at-rules (`@supports`, `@keyframes`, `@font-
 * face`, non-max-width `@media`, …) are opaque: brace-matched past, never
 * descended into — they are not part of the narrow/wide contract DEC-385
 * governs. */
function classify(css: string): { mediaDecls: MediaDecl[]; topDecls: Decl[] } {
  const mediaDecls: MediaDecl[] = [];
  const topDecls: Decl[] = [];
  for (const block of parseTopLevelBlocks(css)) {
    if (block.header.startsWith('@media')) {
      if (MAX_WIDTH_RE.test(block.header) && !MIN_WIDTH_RE.test(block.header)) {
        const inner = css.slice(block.bodyStart, block.bodyEnd);
        for (const nested of parseTopLevelBlocks(inner)) {
          if (nested.header.startsWith('@')) continue;
          if (!isSelectorHeader(nested.header)) continue;
          const decls = extractDecls(
            nested.header,
            block.bodyStart + nested.bodyStart,
            block.bodyStart + nested.bodyEnd,
            css,
          );
          for (const d of decls) mediaDecls.push({ ...d, mediaBlockEnd: block.blockEnd });
        }
      }
      continue; // non-max-width @media blocks are opaque
    }
    if (block.header.startsWith('@')) continue; // other at-rules opaque
    if (!isSelectorHeader(block.header)) continue;
    topDecls.push(...extractDecls(block.header, block.bodyStart, block.bodyEnd, css));
  }
  return { mediaDecls, topDecls };
}

/** Every `<selector> { <property> }` re-declared at top level, in the same
 * sheet, AFTER the max-width block that set it narrowly has closed. */
function shadowedPairs(sheet: Sheet): string[] {
  const { mediaDecls, topDecls } = classify(sheet.text);
  const found = new Set<string>();
  for (const md of mediaDecls) {
    for (const td of topDecls) {
      if (td.selector === md.selector && td.property === md.property && td.offset > md.mediaBlockEnd) {
        found.add(`${sheet.label} — ${md.selector} { ${md.property} }`);
      }
    }
  }
  return [...found];
}

function allShadowedPairs(): string[] {
  const sheets = [...appSrcSheets(), ...ssrSheets()];
  const out: string[] = [];
  for (const sheet of sheets) out.push(...shadowedPairs(sheet));
  return out.sort();
}

// -- second detector: equal-or-higher-specificity DIFFERENT selector -----
//
// DEC-385 amendment (wave 27): the identical-selector detector above is
// evidence about identical selectors, not about the ruled exposure -- "a
// stylesheet whose desktop rules are declared AFTER its max-width block
// silently kills EQUAL-SPECIFICITY phone overrides". A different-but-
// equal-specificity top-level selector, declared after the max-width block
// closes, that (a) targets the same component (shares a `chq-` class token
// with the phone selector, checked on a real class boundary via
// `selectorMentionsToken` -- DEC-613, never a second copy of that check)
// and (b) has specificity >= the phone selector's, wins the cascade just
// as completely as an identical-selector re-declaration, and is invisible
// to the first detector.

/** Every distinct `chq-…` token appearing anywhere in a selector string. */
function chqTokensIn(selector: string): string[] {
  return [...new Set([...selector.matchAll(/chq-[a-z0-9-]+/g)].map((m) => m[0]))];
}

/** A simple (id, class-ish, element-ish) specificity tuple, computed over
 * class/id/attribute/pseudo-class selectors and bare element/pseudo-element
 * selectors -- adequate for this codebase's plain compound selectors
 * (DEC-385 amendment: "computed over simple class/element/pseudo
 * selectors", not a full CSS selector-grammar implementation). Summed
 * across the WHOLE selector (all combinators), matching the CSS spec's own
 * whole-chain summation rather than only the rightmost compound. */
function specificity(selector: string): [number, number, number] {
  let id = 0;
  let cls = 0;
  let elem = 0;
  // Strip pseudo-element and pseudo-class/id/class/attribute tokens out as
  // we count them, then whatever bare-word tokens remain are elements.
  let rest = selector;
  rest = rest.replace(/::[\w-]+/g, () => {
    elem += 1;
    return ' ';
  });
  rest = rest.replace(/#[\w-]+/g, () => {
    id += 1;
    return ' ';
  });
  rest = rest.replace(/\.[\w-]+/g, () => {
    cls += 1;
    return ' ';
  });
  rest = rest.replace(/\[[^\]]*\]/g, () => {
    cls += 1;
    return ' ';
  });
  rest = rest.replace(/:[\w-]+(?:\([^)]*\))?/g, () => {
    cls += 1;
    return ' ';
  });
  for (const token of rest.split(/[\s>+~]+/)) {
    const t = token.trim();
    if (!t || t === '*') continue;
    elem += 1;
  }
  return [id, cls, elem];
}

function specificityGte(a: [number, number, number], b: [number, number, number]): boolean {
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] >= b[2];
}

/** Every `<narrow selector> vs <wide selector> { <property> }` pair where a
 * different, equal-or-higher-specificity top-level selector sharing a
 * `chq-` class token wins the cascade after the narrow declaration's
 * max-width block has closed. */
function equalSpecificityShadowedPairs(sheet: Sheet): string[] {
  const { mediaDecls, topDecls } = classify(sheet.text);
  const found = new Set<string>();
  for (const md of mediaDecls) {
    const narrowTokens = chqTokensIn(md.selector);
    if (narrowTokens.length === 0) continue;
    const narrowSpec = specificity(md.selector);
    for (const td of topDecls) {
      if (td.selector === md.selector) continue; // identical selector: first detector's case
      if (td.property !== md.property) continue;
      if (td.offset <= md.mediaBlockEnd) continue;
      if (!narrowTokens.some((tok) => selectorMentionsToken(td.selector, tok))) continue;
      if (!specificityGte(specificity(td.selector), narrowSpec)) continue;
      found.add(
        `${sheet.label} — [${md.selector}] vs [${td.selector}] { ${md.property} }`,
      );
    }
  }
  return [...found];
}

function allEqualSpecificityShadowedPairs(): string[] {
  const sheets = [...appSrcSheets(), ...ssrSheets()];
  const out: string[] = [];
  for (const sheet of sheets) out.push(...equalSpecificityShadowedPairs(sheet));
  return out.sort();
}

// -- ratchet --------------------------------------------------------------

// Seeded at the count measured on this branch (v12m-w4-j). If this rises,
// a lane appended (or another lane's edit exposed) a new wide-after-narrow
// shadow and must be named below. If it drops, a lane fixed a sheet: bump
// the ceiling DOWN as part of that same merge-train step, printing the
// exact new count the assertion below reports — never edit this number
// from inside a worker lane that isn't the one doing the fix.
//
// v12m-w10-a proposed 22 -> 20 off an older main; main had already reached 19.
// Per DEC-385 (wave-93 amendment) "the merge train re-measures once for the
// batch", so this constant is set by the megabatch merge train after all lanes
// land, not by any single lane.
//
// Re-measured 19 -> 16 by the megabatch merge train after landing
// v12m-w2-{m,k,p,q,r,o}: w2-o's contacts/comms/speakers sheet sweeps removed
// three shadowed declarations. One re-measurement for the whole batch.
//
// Re-measured 16 -> 0 by the megabatch merge train after landing the wave-21
// terminal-block lanes (v12m-w3-{j,k,l} and v12m-w2-t): review.css, styles.css
// and the two submissions sheets were forward-merged into single terminal
// phone blocks, which removed every remaining shadowed declaration in the
// tree. One re-measurement for the whole batch.
export const SHADOWED_CEILING = 0;

// Seeded at the count MEASURED on this branch (v12m-w27-f): forced to -1
// first, the run printed zero offenders, the ceiling was then written back
// as 0. Two-sided, mirroring SHADOWED_CEILING's shape: fails on a rise
// (names every pair) and fails on a drop without the ceiling itself being
// lowered in the same merge-train step that fixed the sheet.
export const EQUAL_SPECIFICITY_SHADOWED_CEILING = 0;

describe('phone cascade order (DEC-385 single-direction, DEC-808 enumerating scan)', () => {
  it('does not exceed the shadowed-declaration ceiling', () => {
    const pairs = allShadowedPairs();
    if (pairs.length > SHADOWED_CEILING) {
      throw new Error(
        `${pairs.length} shadowed declarations exceed SHADOWED_CEILING=${SHADOWED_CEILING}. ` +
          `A max-width override is being beaten by a later top-level rule for the same ` +
          `selector+property (DEC-385 is single-direction: narrow overrides wide). ` +
          `Offending pairs:\n` +
          pairs.map((p) => `  - ${p}`).join('\n'),
      );
    }
    expect(pairs.length).toBeLessThanOrEqual(SHADOWED_CEILING);
  });

  it('does not fall below the ceiling without a merge-train ceiling bump', () => {
    const pairs = allShadowedPairs();
    if (pairs.length < SHADOWED_CEILING) {
      throw new Error(
        `${pairs.length} shadowed declarations measured, below SHADOWED_CEILING=` +
          `${SHADOWED_CEILING}. A sheet's shadowing was fixed -- good -- but the ceiling ` +
          `licenses stagnation until it moves too (the mirror failure of a floor that never ` +
          `rises). Lower SHADOWED_CEILING to exactly ${pairs.length} as part of the SAME ` +
          `merge-train step that fixed the sheet. This is a merge-train act, never a worker ` +
          `lane's mid-task edit.`,
      );
    }
    expect(pairs.length).toBe(SHADOWED_CEILING);
  });

  it('falsifiability control: content.css and comms.css read zero shadowed declarations', () => {
    const controlled = allShadowedPairs().filter(
      (p) => p.startsWith('app/src/pages/content/content.css —') ||
        p.startsWith('app/src/pages/comms/comms.css —'),
    );
    expect(controlled).toEqual([]);
  });

  it('the scan is not vacuous: it walks a non-trivial population', () => {
    const sheets = [...appSrcSheets(), ...ssrSheets()];
    expect(sheets.length).toBeGreaterThan(20);
    expect(sheets.some((s) => s.label === 'app/src/pages/content/content.css')).toBe(true);
    expect(sheets.some((s) => s.label === 'app/src/pages/comms/comms.css')).toBe(true);
  });
});

describe('phone cascade order — equal-specificity, different-selector exposure (DEC-385 wave-27 amendment)', () => {
  it('does not exceed the equal-specificity shadowed ceiling', () => {
    const pairs = allEqualSpecificityShadowedPairs();
    if (pairs.length > EQUAL_SPECIFICITY_SHADOWED_CEILING) {
      throw new Error(
        `${pairs.length} equal-or-higher-specificity shadowed pairs exceed ` +
          `EQUAL_SPECIFICITY_SHADOWED_CEILING=${EQUAL_SPECIFICITY_SHADOWED_CEILING}. A ` +
          `different top-level selector sharing a chq- token with a max-width override, ` +
          `declared after that block closes, with equal-or-higher specificity, silently ` +
          `wins the cascade (DEC-385 is single-direction: narrow overrides wide). ` +
          `Offending pairs:\n` +
          pairs.map((p) => `  - ${p}`).join('\n'),
      );
    }
    expect(pairs.length).toBeLessThanOrEqual(EQUAL_SPECIFICITY_SHADOWED_CEILING);
  });

  it('does not fall below the equal-specificity ceiling without a merge-train ceiling bump', () => {
    const pairs = allEqualSpecificityShadowedPairs();
    if (pairs.length < EQUAL_SPECIFICITY_SHADOWED_CEILING) {
      throw new Error(
        `${pairs.length} equal-specificity shadowed pairs measured, below ` +
          `EQUAL_SPECIFICITY_SHADOWED_CEILING=${EQUAL_SPECIFICITY_SHADOWED_CEILING}. A ` +
          `sheet's shadowing was fixed -- good -- but the ceiling licenses stagnation until ` +
          `it moves too. Lower EQUAL_SPECIFICITY_SHADOWED_CEILING to exactly ${pairs.length} ` +
          `as part of the SAME merge-train step that fixed the sheet. This is a merge-train ` +
          `act, never a worker lane's mid-task edit.`,
      );
    }
    expect(pairs.length).toBe(EQUAL_SPECIFICITY_SHADOWED_CEILING);
  });

  it('is not vacuous: chqTokensIn extracts tokens and specificity orders a bare-class selector below an id selector', () => {
    expect(chqTokensIn('.chq-foo .chq-bar')).toEqual(['chq-foo', 'chq-bar']);
    expect(specificityGte(specificity('#id'), specificity('.cls'))).toBe(true);
    expect(specificityGte(specificity('.cls'), specificity('#id'))).toBe(false);
  });
});
