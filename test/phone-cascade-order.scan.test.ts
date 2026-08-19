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
import { ssrCssSources } from './helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');

// -- comment stripping -------------------------------------------------

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

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
