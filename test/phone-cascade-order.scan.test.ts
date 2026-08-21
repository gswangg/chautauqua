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
// RULE (widened, wave-28 DEC-385 amendment): for every declaration inside a
// `@media (max-width: …)` block, flag it when a TOP-LEVEL declaration for
// the SAME property, positioned AFTER that block closes, would beat it in
// the cascade -- either because it is the byte-identical selector (the
// original rule), OR because it is a SUBJECT-SUBSET shadow: a single
// compound (no combinator) whose tokens are a subset of the narrow
// selector's rightmost (subject) compound -- meaning every element the
// narrow rule matched is also matched by the wide one -- AND whose
// specificity triple is >= the narrow selector's. A differently-written
// top-level selector that still matches every element the narrow rule
// matched, at equal or greater specificity, beats the phone override on
// source order exactly like an identical string would; the old
// identical-string-only rule was blind to it. In a flat, single-direction
// stylesheet this is a cascade-order bug: the "wide" declaration, appearing
// later in source order, wins over the narrow override that was supposed to
// beat it.
//
// The identical-string case is a strict subset of the widened case: it
// trivially satisfies "single compound, no combinator" (when the narrow
// selector's subject IS the whole selector) with identical tokens and
// identical specificity. Where the narrow selector itself has a combinator
// (e.g. `.a .b`), an identical top-level re-declaration is still caught by
// an explicit identical-string branch, so the widened predicate can never
// catch strictly fewer pairs than the old one -- see the "widening is a
// strict superset" test below, proved through this file's own
// `shadowedPairs`, never a parallel copy.
//
// MEASURED at df55360702068950b0bb1d9743680cc97682ad9e (main, wave 28):
// identical-string count = 0, widened count = 0. The widening drains
// nothing today -- it hardens the predicate so a future regression (a
// rewritten selector that still shadows) cannot hide behind a
// string-equality gap.
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

// -- subject-subset shadowing: specificity + compound extraction ---------

/** Splits a selector into its top-level compounds, breaking on combinator
 * characters (whitespace, `>`, `+`, `~`) that sit OUTSIDE any bracket/paren
 * nesting -- so an attribute selector's internal space (`[data-x="a b"]`)
 * or a functional pseudo-class's argument (`:not(.a .b)`) can never be
 * mistaken for a combinator. */
function splitCompounds(selector: string): string[] {
  const s = selector.trim();
  const segments: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < s.length) {
    const ch = s.charAt(i);
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (depth === 0 && /[\s>+~]/.test(ch)) {
      if (current.trim()) segments.push(current.trim());
      current = '';
      while (i < s.length && /[\s>+~]/.test(s.charAt(i))) i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

/** The rightmost compound of a selector -- the "subject" the rule is
 * ultimately about (e.g. for `.card .title` the subject is `.title`; every
 * element the rule can match is a `.title`). */
function subjectCompound(selector: string): string {
  const compounds = splitCompounds(selector);
  return compounds.length > 0 ? (compounds[compounds.length - 1] ?? '') : '';
}

// Matches one simple-selector token: `::pseudo-element`, `:pseudo-class(...)`
// or bare `:pseudo-class`, `#id`, `.class`, `[attr...]`, a bare element name,
// or `*`. Order matters -- `::` must be tried before `:`.
const TOKEN_RE = /::[\w-]+|:[\w-]+(?:\([^)]*\))?|#[\w-]+|\.[\w-]+|\[[^\]]*\]|[a-zA-Z][\w-]*|\*/g;

function tokenize(compound: string): string[] {
  return compound.match(TOKEN_RE) ?? [];
}

/** Standard specificity triple: [ids, classes+attributes+pseudo-classes,
 * elements+pseudo-elements]. The universal selector `*` contributes to
 * none of the three. Functional pseudo-classes (`:not(...)`, `:is(...)`)
 * are counted as a single pseudo-class token each -- a simplification the
 * codebase's actual selectors never exercise deeply enough to matter for a
 * directional (>=) comparison. */
function specificity(selector: string): [number, number, number] {
  let ids = 0;
  let classesEtc = 0;
  let elementsEtc = 0;
  for (const tok of tokenize(selector)) {
    if (tok.startsWith('#')) ids += 1;
    else if (tok.startsWith('::')) elementsEtc += 1;
    else if (tok.startsWith(':') || tok.startsWith('.') || tok.startsWith('[')) classesEtc += 1;
    else if (tok === '*') continue;
    else elementsEtc += 1;
  }
  return [ids, classesEtc, elementsEtc];
}

/** True iff `a` is specificity-greater-than-or-equal-to `b`, compared as
 * the standard lexicographic triple (ids, then classes, then elements). */
function specificityGte(a: [number, number, number], b: [number, number, number]): boolean {
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] >= b[2];
}

function isSubsetOf(subset: string[], superset: string[]): boolean {
  if (subset.length === 0) return false;
  const supersetSet = new Set(superset);
  return subset.every((t) => supersetSet.has(t));
}

/** True iff a top-level (wide) declaration's selector would shadow a
 * narrow (media-block) declaration's selector on cascade order: either the
 * byte-identical selector (the original rule), or a subject-subset shadow
 * -- a single compound with no combinator, whose tokens are a subset of
 * the narrow selector's subject compound, at equal-or-greater
 * specificity -- meaning every element the narrow rule can match, the wide
 * rule can match too, at least as strongly. */
function isShadow(narrowSelector: string, wideSelector: string): boolean {
  if (wideSelector === narrowSelector) return true;
  const wideCompounds = splitCompounds(wideSelector);
  if (wideCompounds.length !== 1) return false; // must have NO combinator
  const [wideCompound] = wideCompounds;
  const wideTokens = tokenize(wideCompound ?? '');
  const narrowTokens = tokenize(subjectCompound(narrowSelector));
  if (!isSubsetOf(wideTokens, narrowTokens)) return false;
  return specificityGte(specificity(wideSelector), specificity(narrowSelector));
}

/** Every `<narrow selector> { <property> }` shadowed by a top-level
 * declaration, in the same sheet, AFTER the max-width block that set it
 * narrowly has closed -- identical-string OR subject-subset (see
 * `isShadow`). */
function shadowedPairs(sheet: Sheet): string[] {
  const { mediaDecls, topDecls } = classify(sheet.text);
  const found = new Set<string>();
  for (const md of mediaDecls) {
    for (const td of topDecls) {
      if (td.property === md.property && td.offset > md.mediaBlockEnd && isShadow(md.selector, td.selector)) {
        found.add(`${sheet.label} — ${md.selector} { ${md.property} } shadowed by ${td.selector}`);
      }
    }
  }
  return [...found];
}

/** The original (pre-wave-28) identical-string-only rule, kept solely to
 * prove containment below -- built from the SAME `classify` this file's
 * production `shadowedPairs` uses, never a parallel copy. */
function identicalStringPairs(sheet: Sheet): string[] {
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

// -- widening non-vacuity: two synthetic fixtures, run through the SAME
// classify()/shadowedPairs() the production scan uses, never a parallel
// copy (DEC-967: never validate a detector by reading the same array it
// grades as its own evidence). ------------------------------------------

describe('subject-subset widening (wave-28 DEC-385 amendment)', () => {
  it('POSITIVE: a differently-written top-level selector at equal specificity, matching the same subject set, is caught -- and is NOT caught by identical-string matching alone', () => {
    const sheet: Sheet = {
      label: 'synthetic/positive.css',
      text: `
        @media (max-width: 700px) {
          .a.b { padding: 0; }
        }
        .b.a { padding: 12px; }
      `,
    };
    // Different selector strings ('.a.b' vs '.b.a'): the old rule is blind.
    expect(identicalStringPairs(sheet)).toEqual([]);
    // Same tokens {.a, .b}, same specificity [0,2,0]: the widened rule catches it.
    const widened = shadowedPairs(sheet);
    expect(widened).toHaveLength(1);
    expect(widened[0]).toContain('.a.b');
    expect(widened[0]).toContain('shadowed by .b.a');
  });

  it('NEGATIVE: a top-level descendant selector that does not match the narrow rule\'s subject set is NOT caught', () => {
    const sheet: Sheet = {
      label: 'synthetic/negative.css',
      text: `
        @media (max-width: 700px) {
          .a.b { padding: 0; }
        }
        .c .b { padding: 12px; }
      `,
    };
    expect(identicalStringPairs(sheet)).toEqual([]);
    // '.c .b' is two compounds (a combinator is present) -- disqualified on
    // that ground alone, independent of the subset/specificity checks.
    expect(shadowedPairs(sheet)).toEqual([]);
  });

  it('the widened predicate is a STRICT superset of the identical-string predicate: every identical-string pair is also a widened pair, and the widened set can be strictly larger', () => {
    const combined: Sheet = {
      label: 'synthetic/combined.css',
      text: `
        @media (max-width: 700px) {
          .a { padding: 0; }
          .a.b { margin: 0; }
        }
        .a { padding: 12px; }
        .b.a { margin: 8px; }
        .c .b { margin: 4px; }
      `,
    };
    const identical = identicalStringPairs(combined);
    const widened = shadowedPairs(combined);
    // The identical-string case ('.a' re-declared verbatim) is caught by both.
    expect(identical).toHaveLength(1);
    expect(identical[0]).toContain('.a { padding }');
    // Containment: every identical-string pair's (selector, property) key
    // appears as a widened pair too (labels differ by the trailing
    // "shadowed by ..." clause the widened rule adds, so compare on the
    // shared "<label> — <selector> { <property> }" prefix).
    for (const pair of identical) {
      expect(widened.some((w) => w.startsWith(pair))).toBe(true);
    }
    // Strict: the widened set additionally catches the '.a.b'/'.b.a' pair
    // that identical-string matching missed, and still correctly excludes
    // the '.c .b' descendant selector.
    expect(widened.length).toBeGreaterThan(identical.length);
    expect(widened.some((w) => w.includes('shadowed by .b.a'))).toBe(true);
    expect(widened.some((w) => w.includes('.c .b'))).toBe(false);
  });
});
