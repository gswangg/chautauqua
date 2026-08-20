// DEC-989 (wave-87 amendment, task w5-d): TIER 2 -- horizontal overflow at
// the 390px phone frame, enumerated. The wave-1 handoff already named the
// defect this probe exists to catch: `.chq-table td:first-child/
// td:last-child`'s 16px inset stacking on `.chq-main`'s own 16px phone
// gutter for every card-stacking table (neutralised locally in comms via
// DEC-368, never fixed as a class of bug). jsdom performs no layout, so
// this is built the way this repo builds every other geometry proof --
// mirroring page-measure.test.ts and shell-geometry.test.ts, it reads the
// stylesheets' OWN declarations as text rather than computed style, which
// would silently pass regardless of what the file says.
//
// POPULATION (DEC-808): every app/src/**/*.css and every src/**/*.css.ts,
// enumerated via readdirSync -- never a hand-listed manifest. CSS-in-TS
// files are template-literal strings; the literal text is extracted (any
// `${...}` interpolation stripped, since it names another module's own
// constant, itself enumerated and scanned separately as that module's own
// file).
//
// BUDGET: derived from the shell's own phone gutter rule (`.chq-main`'s
// `padding` inside styles.css's `@media (max-width: 700px)` block), not a
// hardcoded guess -- see CONTENT_BUDGET_PX below.
//
// FLAGGED SHAPES, inside any `@media (max-width: <=700px)` block, and in
// any top-level (unmedia'd) rule that has NO phone override for the same
// selector:
//   (A) a px `width` / `min-width` / `flex-basis` above budget
//   (B) `grid-template-columns` whose fixed px tracks, plus the gaps
//       between them, exceed budget on their own (fr/auto tracks are not
//       counted -- they yield, a fixed track cannot)
//   (C) `white-space: nowrap` with no `overflow`/`text-overflow` escape
//       declared in the same rule
//   (D) `table-layout: fixed` on a selector with more than two declared
//       columns (sibling `:first-child`/`:last-child`/`:nth-child(N)`
//       column-position selectors sharing its base) and no phone reflow
//       (`display: block|contents` or `table-layout: auto`) for that base
//
// EXEMPTIONS are inline `/* overflow-exempt: <reason> */` comments directly
// above the rule they exempt -- never a file:line ledger (DEC-967): every
// edit above a pinned line silently drifts the pin onto a different
// expression. The ratchet is two-sided (DEC-948's wave-49 shape): an
// exemption comment that no longer sits above a rule that would actually
// be flagged fails loudly, naming the file and selector, with an explicit
// "delete this line" message.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_808, DEC_976, DEC_989 } from '../../src/decisions';

void DEC_989; // this scan's whole reason to exist: DEC-989's horizontal-extent-vs-390-viewport probe
void DEC_808; // population-by-source-content, never a hand-listed manifest or a filename convention
void DEC_976; // an SSR sheet's exemption receipt may not cite the unloaded app/src/ SPA bundle

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

/** Every file under `root` whose name ends with `extension`, enumerated rather than named (DEC-808). */
function allFiles(root: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const APP_CSS_FILES = allFiles(HERE, '.css');

/**
 * Every `src/**\/*.ts` module (readdirSync recursive, DEC-808 -- never a
 * hand-listed manifest) whose SOURCE TEXT exports a CSS template-literal
 * constant (`export const X_CSS = ...`), excluding test files. Population is
 * derived from what a module's content actually declares, not from a
 * `.css.ts` filename convention -- src/views/theme.ts exports THEME_CSS
 * (loaded by every SSR surface, and the sheet that carries the SSR 44px
 * phone floor) but does not carry the `.css.ts` suffix, and a filename glob
 * silently drops it (DEC-808, wave-96 finding).
 */
const CSS_EXPORT_RE = /export const [A-Z0-9_]*CSS\s*=\s*/;

function cssModuleFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
    const absPath = join(entry.parentPath, entry.name);
    if (CSS_EXPORT_RE.test(readFileSync(absPath, 'utf-8'))) out.push(absPath);
  }
  return out.sort();
}

const CSS_TS_FILES = cssModuleFiles(SRC_ROOT);

/** Extracts the literal CSS text out of a `export const X_CSS = \`...\`;` module, stripping ${...} interpolations (those name another module's own exported constant, itself enumerated and scanned separately as that file). */
function extractCssTsLiteral(raw: string): string {
  const literals = [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
  return literals.join('\n').replace(/\$\{[^}]*\}/g, '');
}

/**
 * Neutralises `{`/`}` characters that appear INSIDE comments (e.g. this
 * codebase's own convention of quoting a design frame's Handlebars-ish
 * placeholder text in a comment, `/* Frame line 201: \`{{ h.when }}\` *\/`)
 * without changing the string's length or any other character -- every
 * later regex below assumes brace nesting is exactly one level deep
 * (selector/body inside an @media, nothing inside a comment), and a
 * literal brace hiding in a comment breaks that assumption, which is not
 * merely wrong but catastrophically slow (the brace-balancing patterns
 * below backtrack combinatorially over an unbalanced file). Length is
 * preserved so every character offset computed downstream still points at
 * the same place in the original file.
 */
function sanitizeCommentBraces(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[{}]/g, '·'));
}

interface SourceFile {
  absPath: string;
  label: string;
  css: string;
}

const SOURCES: SourceFile[] = [
  ...APP_CSS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: sanitizeCommentBraces(readFileSync(absPath, 'utf-8')),
  })),
  ...CSS_TS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: sanitizeCommentBraces(extractCssTsLiteral(readFileSync(absPath, 'utf-8'))),
  })),
];

// --- BUDGET: derived, not guessed --------------------------------------
// The v12 phone frames are drawn at width:390px (DEC-808). `.chq-main`'s
// own `@media (max-width: 700px)` rule in styles.css sets its phone
// padding -- the ONE place the shell declares the gutter every page's
// content sits inside. Content budget = frame width minus that gutter on
// both sides.
const PHONE_FRAME_WIDTH_PX = 390;

function phoneMediaBlocks(css: string): Array<{ condition: string; body: string }> {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  const out: Array<{ condition: string; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ condition: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return out;
}

function isPhoneCondition(condition: string): boolean {
  const m = condition.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
  return m !== null && Number(m[1]) <= 700;
}

function ruleBodyIn(fragment: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = fragment.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  const body = m?.[1];
  if (body === undefined) throw new Error(`no rule found for ${selector} in the given fragment`);
  return body;
}

const STYLES_CSS = sanitizeCommentBraces(readFileSync(join(HERE, 'styles.css'), 'utf-8'));
const mainPhoneBlock = phoneMediaBlocks(STYLES_CSS).find((b) => isPhoneCondition(b.condition));
if (!mainPhoneBlock) throw new Error('styles.css has no @media (max-width: <=700px) block');
const mainPhoneBody = ruleBodyIn(mainPhoneBlock.body, '.chq-main');
const gutterMatch = mainPhoneBody.match(/(?:^|;)\s*padding:\s*(\d+(?:\.\d+)?)px\s*;/);
if (!gutterMatch) {
  throw new Error(
    ".chq-main's phone rule no longer declares a single-value px padding -- update the derivation above rather than hardcoding a budget",
  );
}
const PHONE_GUTTER_PX = Number(gutterMatch[1]);
export const CONTENT_BUDGET_PX = PHONE_FRAME_WIDTH_PX - 2 * PHONE_GUTTER_PX;

// --- rule extraction ------------------------------------------------------

interface Rule {
  selector: string;
  body: string; // declarations, comments stripped -- a comment sitting between two declarations is not a `;` boundary, and every check below anchors on one
  index: number;
  isPhoneScoped: boolean;
  isTopLevel: boolean; // not nested in ANY @media block
  isExempt: boolean; // an inline overflow-exempt comment sits directly above this rule
}

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const EXEMPT_COMMENT_RE = /\/\*\s*overflow-exempt:\s*[^*]*\*\//;

/**
 * Every innermost `selector { body }` rule in raw text, in source order,
 * with position info. Because the leading `@media (...) {` text can never
 * itself satisfy `[^{}]+\{[^{}]*\}` (its own body contains a nested `{`),
 * every attempt that starts inside a media header fails outright and the
 * engine's next attempt lands on the inner rule -- so this single flat
 * pattern finds every innermost rule directly in the RAW (unstripped)
 * text, media or no media, with real character offsets. Because there is
 * no such forcing failure between two ordinary rules, the captured
 * "selector" text for a normal rule starts right after the PREVIOUS rule's
 * closing `}` and so includes any comments/whitespace sitting between them
 * -- comments are stripped out to get the real selector, and checked for
 * the overflow-exempt marker before being discarded.
 */
function extractRules(css: string, spans: Array<{ start: number; end: number; isPhone: boolean }>): Rule[] {
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const rawPre = m[1] ?? '';
    const isExempt = EXEMPT_COMMENT_RE.test(rawPre);
    const selector = rawPre.replace(COMMENT_RE, ' ').trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue; // @keyframes/@font-face/@supports headers etc.
    const body = (m[2] ?? '').replace(COMMENT_RE, ' ');
    const span = spans.find((s) => m!.index >= s.start && m!.index < s.end);
    rules.push({
      selector,
      body,
      index: m.index,
      isPhoneScoped: span?.isPhone ?? false,
      isTopLevel: span === undefined,
      isExempt,
    });
  }
  return rules;
}

function mediaSpans(css: string): Array<{ start: number; end: number; isPhone: boolean }> {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  const out: Array<{ start: number; end: number; isPhone: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, isPhone: isPhoneCondition((m[1] ?? '').trim()) });
  }
  return out;
}

// --- shape checks -----------------------------------------------------

function checkWidthProps(body: string): string[] {
  const hits: string[] = [];
  const re = /(?:^|;)\s*(width|min-width|flex-basis)\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const px = Number(m[2]);
    if (px > CONTENT_BUDGET_PX) hits.push(`${m[1]}: ${px}px exceeds budget ${CONTENT_BUDGET_PX}px`);
  }
  return hits;
}

function checkGridTemplateColumns(body: string): string[] {
  const gtc = body.match(/grid-template-columns\s*:\s*([^;]+);/);
  if (!gtc) return [];
  const tracks = gtc[1]?.match(/\d+(?:\.\d+)?px/g) ?? [];
  if (tracks.length === 0) return [];
  const trackSum = tracks.reduce((sum, t) => sum + Number(t.replace('px', '')), 0);
  const gapMatch = body.match(/(?:^|;)\s*(?:column-)?gap\s*:\s*(\d+(?:\.\d+)?)px/);
  const gapPx = gapMatch ? Number(gapMatch[1]) * Math.max(0, tracks.length - 1) : 0;
  const total = trackSum + gapPx;
  if (total > CONTENT_BUDGET_PX) {
    return [`grid-template-columns fixed tracks ${trackSum}px + gaps ${gapPx}px = ${total}px exceeds budget ${CONTENT_BUDGET_PX}px`];
  }
  return [];
}

function checkNowrap(body: string): string[] {
  if (!/white-space\s*:\s*nowrap/.test(body)) return [];
  const hasEscape = /(?:overflow(?:-x)?\s*:\s*(?:hidden|auto|scroll))|(?:text-overflow\s*:\s*ellipsis)/.test(body);
  return hasEscape ? [] : ['white-space: nowrap with no overflow/text-overflow escape in the same rule'];
}

function baseToken(selector: string): string {
  // First comma part, first compound token (drop pseudo-classes/descendant chains).
  return (selector.split(',')[0] ?? '').trim().split(/\s+/)[0]?.split(':')[0] ?? '';
}

function checkTableLayout(rule: Rule, fileRules: Rule[]): string[] {
  if (!/table-layout\s*:\s*fixed/.test(rule.body)) return [];
  const base = baseToken(rule.selector);
  if (!base) return [];
  const columnSelectors = fileRules.filter(
    (r) => baseToken(r.selector) === base && /:(?:first-child|last-child|nth-child\(\d+\))/.test(r.selector),
  );
  const distinctColumns = new Set(columnSelectors.map((r) => r.selector));
  if (distinctColumns.size <= 2) return [];
  const hasPhoneReflow = fileRules.some(
    (r) =>
      r.isPhoneScoped &&
      baseToken(r.selector) === base &&
      (/display\s*:\s*(?:block|contents)/.test(r.body) || /table-layout\s*:\s*auto/.test(r.body)),
  );
  if (hasPhoneReflow) return [];
  return [
    `table-layout: fixed on ${base} with ${distinctColumns.size} declared columns, no phone reflow (display:block|contents or table-layout:auto) for the same base`,
  ];
}

function runChecks(rule: Rule, fileRules: Rule[]): string[] {
  return [
    ...checkWidthProps(rule.body),
    ...checkGridTemplateColumns(rule.body),
    ...checkNowrap(rule.body),
    ...checkTableLayout(rule, fileRules),
  ];
}

// --- assemble offenders -------------------------------------------------

interface Offender {
  file: string;
  selector: string;
  reasons: string[];
}

interface Stale {
  file: string;
  selector: string;
}

const OFFENDERS: Offender[] = [];
const STALE_EXEMPTIONS: Stale[] = [];
// Owning cluster derivation used only for the audit doc (best-effort label).
function clusterFor(label: string): string {
  const m = label.match(/^(?:app\/src\/pages\/([^/]+)|app\/src\/components|src\/routes\/([^/]+))/);
  return m?.[1] ?? m?.[2] ?? (label.startsWith('app/src/styles.css') ? 'shell' : 'misc');
}
const AUDIT_ROWS: Array<{ file: string; selector: string; excess: string; cluster: string }> = [];

for (const source of SOURCES) {
  const spans = mediaSpans(source.css);
  const rules = extractRules(source.css, spans);
  // Selectors overridden somewhere in a phone media block, per individual
  // comma-separated selector token.
  const phoneSelectorParts = new Set<string>();
  for (const r of rules) {
    if (!r.isPhoneScoped) continue;
    for (const part of r.selector.split(',').map((s) => s.trim())) phoneSelectorParts.add(part);
  }

  for (const rule of rules) {
    const isCandidate =
      rule.isPhoneScoped ||
      (rule.isTopLevel && !rule.selector.split(',').some((s) => phoneSelectorParts.has(s.trim())));

    const hits = isCandidate ? runChecks(rule, rules) : [];

    if (rule.isExempt) {
      if (hits.length === 0) {
        STALE_EXEMPTIONS.push({ file: source.label, selector: rule.selector });
      }
    } else if (hits.length > 0) {
      OFFENDERS.push({ file: source.label, selector: rule.selector, reasons: hits });
      AUDIT_ROWS.push({ file: source.label, selector: rule.selector, excess: hits.join(' | '), cluster: clusterFor(source.label) });
    }
  }
}

// --- cross-bundle receipt tripwire (DEC-976) ---------------------------
// An `overflow-exempt:`/`tap-floor-exempt:` receipt inside a `src/**` sheet
// (an SSR surface) may not cite a path beginning `app/src/` (the SPA admin
// bundle) -- the SSR surface never loads that bundle, so such a citation
// names a rule the page in front of the user never runs. The SSR carrier
// every `src/**` container exemption should name instead is
// src/views/theme.ts:347-366 (the base .chq-btn/input rule) plus :625-627
// (the phone 44px floor) -- all three legs of DESIGN-RULINGS.md:189.
// One-sided ratchet, seeded at 0 (verified 0 on main today): the five
// existing `app/src/` mentions inside `src/` are prose parity notes, none
// sitting inside an exempt-comment receipt.
function findCrossBundleReceiptCitations(cssText: string): string[] {
  const out: string[] = [];
  const re = /(?:overflow-exempt|tap-floor-exempt):\s*([^*]*?)\*\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText)) !== null) {
    const citation = (m[1] ?? '').trim();
    if (/app\/src\//.test(citation)) out.push(citation);
  }
  return out;
}

interface CrossBundleOffender {
  file: string;
  citation: string;
}

const CROSS_BUNDLE_OFFENDERS: CrossBundleOffender[] = [];
for (const source of SOURCES) {
  if (!source.label.startsWith('src/')) continue; // only SSR sheets, never the app/src SPA bundle itself
  for (const citation of findCrossBundleReceiptCitations(source.css)) {
    CROSS_BUNDLE_OFFENDERS.push({ file: source.label, citation });
  }
}

export const CROSS_BUNDLE_CITATION_CEILING = 0;

// This count may only be LOWERED as offenders are fixed (measured against
// this branch's tree at authoring time -- see docs/design/audit/
// overflow-390-v12.md for the full, per-file breakdown). Raising it back up
// to accommodate a new offender is not a valid fix.
//
// Re-measured wave 108 (v12m-w4-o, DEC-808 amendment) by forcing this const
// to -1 and reading the printed offender list: truth is 24, not the stale
// 65 this constant carried. Set to the measured truth; see the companion
// "never below the ceiling without lowering it" test below for the other
// half of the ratchet this file's own test name always claimed to have.
export const OVERFLOW_OFFENDERS_CEILING = 20;

describe('phone horizontal overflow at 390 (DEC-989)', () => {
  it('found more than one CSS file to scan (vacuous-population tripwire, file side)', () => {
    expect(APP_CSS_FILES.length + CSS_TS_FILES.length).toBeGreaterThan(5);
  });

  it('the file population includes a known file (styles.css)', () => {
    expect(SOURCES.some((s) => s.label === 'app/src/styles.css')).toBe(true);
  });

  it('the CSS-export module population is derived from source content, not a filename glob (DEC-808)', () => {
    // Measured on main: 16 modules export a CSS template-literal constant
    // under src/ (15 *.css.ts sheets plus src/views/theme.ts).
    expect(CSS_TS_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('the CSS-export module population includes src/views/theme.ts (positive control)', () => {
    expect(CSS_TS_FILES.some((p) => relative(REPO_ROOT, p) === 'src/views/theme.ts')).toBe(true);
  });

  it("derives a positive, sane content budget from the shell's own phone gutter", () => {
    expect(PHONE_GUTTER_PX).toBeGreaterThan(0);
    expect(CONTENT_BUDGET_PX).toBe(PHONE_FRAME_WIDTH_PX - 2 * PHONE_GUTTER_PX);
    expect(CONTENT_BUDGET_PX).toBeGreaterThan(0);
    expect(CONTENT_BUDGET_PX).toBeLessThan(PHONE_FRAME_WIDTH_PX);
  });

  it('found more than zero offenders (vacuous-population tripwire, flagged-shape side)', () => {
    expect(OFFENDERS.length).toBeGreaterThan(0);
  });

  // v12m wave 8: the previous canary (.chq-speakers-grid min-width in
  // speakers.css) stopped being a *flagged* rule when w8-a gave it a
  // documented inline `overflow-exempt:` comment -- exempted rules land in
  // neither OFFENDERS nor STALE_EXEMPTIONS, so a still-real overflow no
  // longer served as a vacuity canary. Repointed at the scorecard grid,
  // whose fixed 1120px tracks overflow the 358px budget structurally (not a
  // nowrap escape one wave can quietly add) and which no frame exempts.
  it('the flagged-shape population includes a known offender (.chq-review-scorecard-grid fixed tracks)', () => {
    expect(
      OFFENDERS.some(
        (o) => o.file === 'app/src/pages/review/scorecard.css' && o.selector === '.chq-review-scorecard-grid',
      ),
    ).toBe(true);
  });

  it('offender count never exceeds the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = OFFENDERS.map((o) => `${o.file} :: ${o.selector} -- ${o.reasons.join('; ')}`).join('\n');
    expect(
      OFFENDERS.length,
      `offenders (${OFFENDERS.length}) exceed OVERFLOW_OFFENDERS_CEILING (${OVERFLOW_OFFENDERS_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(OVERFLOW_OFFENDERS_CEILING);
  });

  it(`never falls below OVERFLOW_OFFENDERS_CEILING (${OVERFLOW_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < OVERFLOW_OFFENDERS_CEILING) {
      throw new Error(
        `offenders (${OFFENDERS.length}) fell below the OVERFLOW_OFFENDERS_CEILING of ` +
          `${OVERFLOW_OFFENDERS_CEILING}. This is the ratchet working: offenders got fixed. Lower ` +
          `the ceiling in the same commit (a merge-train act, never a worker's edit mid-lane) by ` +
          `replacing the line:\n  export const OVERFLOW_OFFENDERS_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(OVERFLOW_OFFENDERS_CEILING);
  });

  it('no inline overflow-exempt comment is stale (its rule must actually be flagged, else: delete this line)', () => {
    expect(
      STALE_EXEMPTIONS,
      STALE_EXEMPTIONS.map(
        (s) => `${s.file} :: ${s.selector} -- stale overflow-exempt comment, does not exempt an actually-flagged rule -- delete this line`,
      ).join('\n'),
    ).toEqual([]);
  });

  it('fixed files (app/src/components/*.css, app/src/pages/contacts/contacts-panels.css) carry zero offenders', () => {
    const fixedOffenders = OFFENDERS.filter(
      (o) => o.file.startsWith('app/src/components/') || o.file === 'app/src/pages/contacts/contacts-panels.css',
    );
    expect(fixedOffenders.map((o) => `${o.file} :: ${o.selector} -- ${o.reasons.join('; ')}`)).toEqual([]);
  });
});

describe('SSR sheet exemption receipts never cite the unloaded SPA bundle (DEC-976)', () => {
  it('the matcher fires on a synthetic false citation (positive control)', () => {
    const fixture = '/* overflow-exempt: see app/src/styles.css:1134-1139 for the floor rule */\n.x { width: 999px; }';
    expect(findCrossBundleReceiptCitations(fixture)).toEqual(['see app/src/styles.css:1134-1139 for the floor rule']);
  });

  it('the matcher does not fire on a receipt citing the real SSR carrier (negative control)', () => {
    const fixture = '/* overflow-exempt: see src/views/theme.ts:625-627 for the floor rule */\n.x { width: 999px; }';
    expect(findCrossBundleReceiptCitations(fixture)).toEqual([]);
  });

  it('no src/** sheet exemption receipt cites an app/src/ path (one-sided ratchet, seeded at 0)', () => {
    expect(
      CROSS_BUNDLE_OFFENDERS.length,
      CROSS_BUNDLE_OFFENDERS.map((o) => `${o.file} -- cites "${o.citation}"`).join('\n'),
    ).toBeLessThanOrEqual(CROSS_BUNDLE_CITATION_CEILING);
  });
});

export { AUDIT_ROWS, OFFENDERS };
