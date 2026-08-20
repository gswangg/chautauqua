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
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_808, DEC_976, DEC_989, DEC_991 } from '../../src/decisions';

void DEC_989; // this scan's whole reason to exist: DEC-989's horizontal-extent-vs-390-viewport probe (wave 119 amendment: candidacy is cascade-aware)
void DEC_991; // a new overflow-exempt comment may be authored only in the commit that makes its rule flagged -- this task authors none
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

/**
 * Parses `import { A, B } from "./relative"` statements in a CSS-in-TS
 * module's raw source and, for each imported name, resolves a same-repo
 * `export const NAME = [...]` string-literal array from the imported
 * module -- used to turn a selector-position `.${NAME[N]}` interpolation
 * back into its real class name instead of a bare `.`.
 */
function resolveImportedArrayConstants(raw: string, fileDir: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const importRe = /import\s*\{\s*([^}]+?)\s*\}\s*from\s*["'](\.[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(raw)) !== null) {
    const names = (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const modPath = m[2] ?? '';
    const abs = join(fileDir, modPath.endsWith('.ts') ? modPath : `${modPath}.ts`);
    let modSrc: string;
    try {
      modSrc = readFileSync(abs, 'utf-8');
    } catch {
      continue; // module resolves outside this simple relative-.ts lookup (e.g. a barrel) -- not this scan's concern
    }
    for (const name of names) {
      const arrMatch = modSrc.match(new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
      if (!arrMatch) continue;
      const values = [...(arrMatch[1] ?? '').matchAll(/["']([^"']*)["']/g)].map((v) => v[1] ?? '');
      if (values.length > 0) out.set(name, values);
    }
  }
  return out;
}

/**
 * Extracts the literal CSS text out of a `export const X_CSS = \`...\`;`
 * module. A selector-position interpolation (`.${NAME[N]}`, e.g. agenda.css.ts's
 * `.${ACCENT_BOUND_CLASSES[0]}`) is RESOLVED to its real class name via
 * `resolveImportedArrayConstants` rather than stripped -- stripping it
 * produces a bare `.` selector that both hides the rule's true identity and
 * (worse) makes an unrelated rule's declarations collide with it under a
 * meaningless selector. Any interpolation that cannot be resolved this way
 * (content fragments like `${ERROR_STATES_CSS}`, which name another
 * module's own exported CSS constant, itself enumerated and scanned
 * separately as that file) is stripped exactly as before -- that stripping
 * is intentional there, never a silent drop of a selector's identity.
 * Unresolved selector-position interpolations (`.${...}` that isn't a
 * `NAME[N]` array-index this resolver can chase down) are recorded in
 * `skipped` so they surface loudly instead of silently becoming `.`.
 */
function extractCssTsLiteral(raw: string, fileDir: string): { css: string; skipped: string[] } {
  const arrayConsts = resolveImportedArrayConstants(raw, fileDir);
  const skipped: string[] = [];
  const literals = [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
  const joined = literals.join('\n');
  const withSelectorsResolved = joined.replace(
    /\.\$\{\s*([A-Za-z0-9_]+)\[(\d+)\]\s*\}/g,
    (whole: string, name: string, idxStr: string) => {
      const values = arrayConsts.get(name);
      const value = values?.[Number(idxStr)];
      if (value === undefined) {
        skipped.push(whole);
        return whole; // left in place so the generic strip below still avoids a false "." ; recorded above for visibility
      }
      return `.${value}`;
    },
  );
  // Any remaining `.${...}` (unresolved) is a selector-position interpolation
  // this resolver could not chase down -- already loudly recorded above, so
  // it is safe to fold it into the generic content-fragment strip below
  // rather than let it leak through as a literal `${...}` token.
  return { css: withSelectorsResolved.replace(/\$\{[^}]*\}/g, ''), skipped };
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

// Selector-position CSS-in-TS interpolations that `extractCssTsLiteral`
// could not resolve to a real class name (empty unless a future module adds
// one) -- collected here, never silently dropped, and asserted empty by a
// test below so an unresolvable case fails loudly instead of shipping a
// `.`-named offender.
const UNRESOLVED_INTERPOLATION_SELECTORS: Array<{ file: string; expression: string }> = [];

const SOURCES: SourceFile[] = [
  ...APP_CSS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: sanitizeCommentBraces(readFileSync(absPath, 'utf-8')),
  })),
  ...CSS_TS_FILES.map((absPath) => {
    const raw = readFileSync(absPath, 'utf-8');
    const { css, skipped } = extractCssTsLiteral(raw, dirname(absPath));
    const label = relative(REPO_ROOT, absPath);
    for (const expression of skipped) UNRESOLVED_INTERPOLATION_SELECTORS.push({ file: label, expression });
    return { absPath, label, css: sanitizeCommentBraces(css) };
  }),
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

export function checkGridTemplateColumns(body: string): string[] {
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

export function checkNowrap(body: string): string[] {
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

// --- cascade-aware candidacy (DEC-989 wave-119 amendment) ----------------
//
// THE HOLE this repairs: the old candidacy test dropped a top-level rule
// from the population the instant ANY phone-scoped rule in the file named
// the same selector token, whether or not that override touched the
// flagged property (settings.css:1142 `.chq-settings-row-hint`'s top-level
// `white-space: nowrap` was never checked because a wholly unrelated
// terminal phone rule at settings.css:1586 happened to declare only
// `align-self: flex-end` for the same selector). The repair: every
// top-level rule is ALWAYS a candidate, but it is checked against its
// EFFECTIVE declaration map -- its own top-level declarations, overridden
// property-by-property (last-wins, file order) by every phone-scoped rule
// whose comma-split selector tokens intersect its own -- not its raw body.
// A phone rule that overrides an unrelated property no longer hides a real
// offender; a phone rule that actually overrides the flagged property still
// clears it, exactly as before.

/** Ordered `[property, value]` pairs parsed out of a declaration body. */
function parseDeclarations(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /(-{0,2}[a-zA-Z][a-zA-Z-]*)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push([(m[1] ?? '').trim(), (m[2] ?? '').trim()]);
  }
  return out;
}

/**
 * The effective declaration body for a TOP-LEVEL rule: its own declarations,
 * then every phone-scoped rule's declarations in the same file whose
 * comma-split selector tokens intersect this rule's own tokens, applied in
 * source order, last value wins per property.
 */
function effectiveBodyFor(rule: Rule, fileRules: Rule[]): string {
  const tokens = new Set(rule.selector.split(',').map((s) => s.trim()));
  const merged = new Map<string, string>();
  for (const [prop, val] of parseDeclarations(rule.body)) merged.set(prop, val);
  for (const r of fileRules) {
    if (!r.isPhoneScoped) continue;
    const rTokens = r.selector.split(',').map((s) => s.trim());
    if (!rTokens.some((t) => tokens.has(t))) continue;
    for (const [prop, val] of parseDeclarations(r.body)) merged.set(prop, val);
  }
  return [...merged.entries()].map(([prop, val]) => `${prop}: ${val};`).join(' ');
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

  for (const rule of rules) {
    // Cascade-aware (DEC-989 wave-119 amendment): every top-level rule is a
    // candidate, checked against its EFFECTIVE (cascade-merged) body rather
    // than its raw one; a phone-scoped rule is checked exactly as before.
    const isCandidate = rule.isPhoneScoped || rule.isTopLevel;
    const effectiveRule: Rule =
      rule.isTopLevel && !rule.isPhoneScoped ? { ...rule, body: effectiveBodyFor(rule, rules) } : rule;

    const hits = isCandidate ? runChecks(effectiveRule, rules) : [];

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
//
// Re-measured 20 -> 18 by the merge train on 2026-08-19 (megabatch gate) by
// running this scan: two more 390-overflow offenders were fixed at source in
// the wave-111 batch. Lowered to the measured truth.
//
// Drained 18 -> 0 by task w6-h (wave 117, DEC-989): every one of the 18
// offenders named in the wave-117 handoff (review.css x7, scorecard.css x2,
// detail.css x4, submissions.css x3, portal.css.ts's .chq-field-counter,
// rail.css.ts's .chq-pub-schedule-browse-link) got either a real phone
// override appended inside its sheet's terminal @media (max-width: 700px)
// block (grid tracks reflow to 1fr, nowrap captions gained a wrap/ellipsis
// escape, the save-view modal's width moved to a vw-relative calc()) or,
// for .chq-field-counter alone, an inline `overflow-exempt:` receipt
// directly above its rule (a truncated counter states a wrong remaining
// count, DEC-650 wave-82 amendment). Measured truth at authoring time was 0.
//
// PREDICATE REPAIR, 0 -> 31, task w8-a (wave 119, DEC-989/DEC-991). The
// prior value of 0 was BLIND, not clean: the candidacy test computed
// `isCandidate = rule.isPhoneScoped || (rule.isTopLevel &&
// !rule.selector.split(',').some((s) => phoneSelectorParts.has(s.trim())))`
// -- a top-level rule was dropped from the population the instant ANY
// phone-scoped rule anywhere in the file named the same selector token, on
// ANY property, whether or not that override ever touched the flagged
// declaration. settings.css:1142's `.chq-settings-row-hint { white-space:
// nowrap; text-align: right; }` was never checked because a wholly
// unrelated terminal phone rule at settings.css:1586 declared only
// `align-self: flex-end` for the same selector -- a false "fixed" reading
// with a real, unclipped nowrap sitting behind it. The repair: every
// top-level rule is now ALWAYS a candidate, but checked against its
// EFFECTIVE declaration map (its own declarations, overridden
// property-by-property, last-wins, by every phone-scoped rule whose
// comma-split selector tokens intersect its own) rather than its raw body
// -- a phone override that actually clears the flagged property still
// clears the rule; one that doesn't no longer hides it. No stylesheet was
// edited and no `overflow-exempt:` comment was authored to reach this
// number (DEC-991) -- 31 is the real, previously-undercounted population,
// measured by running this scan (`npx vitest run --config
// vitest.fast.config.ts app/src/phone-horizontal-overflow.scan.test.ts`)
// against this branch's tree at authoring time. This also newly includes
// `src/routes/public/css/agenda.css.ts :: .chq-pub-day-pill` (previously
// mis-surfaced as a bare "." -- `extractRules` was reading the file's own
// `.${ACCENT_BOUND_CLASSES[1]}` CSS-in-TS interpolation as an empty
// selector; the CSS-in-TS literal extraction now resolves a selector-position
// `.${NAME[N]}` interpolation against its imported array constant instead of
// stripping it blind, so the rule is checked and reported under its real
// class name) and `app/src/pages/contacts/contacts-panels.css ::
// .chq-contacts-pipeline-columns`, which the "fixed files" canary test
// below used to claim clean under the same blind-candidacy hole. This is
// the ratchet doing its job -- a ceiling may also rise here, once, to match
// a corrected predicate's true count; it may never rise again afterward to
// accommodate a genuinely new offender.
//
// 31 -> 26, set by the merge train integrating w8-a + w8-b as one batch,
// per DEC-989 wave-9: "the merge train re-measures every touched constant
// once per batch and sets it to the post-batch truth". 26 was MEASURED by
// forcing this constant to -1 and running the scan against the merged tree
// (`npx vitest run --config vitest.fast.config.ts
// app/src/phone-horizontal-overflow.scan.test.ts`), not read from an audit
// doc and not arrived at by taking either branch's side. Neither branch
// could have written this number: w8-a repaired the candidacy predicate and
// w8-b fixed settings.css offenders, and only the two together produce 26.
//
// 26 -> 7, set by the merge train integrating w8-e + w8-d + w8-c + w8-f +
// w8-h + w8-g as one batch, per DEC-989 wave-9 and DEC-385's clause that no
// worker lane edits this constant and "the merge train re-measures each ONCE
// per batch". 7 was MEASURED by forcing this constant to -1 and running the
// scan against the fully merged tree (`npx vitest run
// app/src/phone-horizontal-overflow.scan.test.ts`), not read from an audit
// doc and not arrived at by taking any branch's side: w8-e drained the SSR
// public surface, w8-d and w8-c drained the blind-predicate offenders the
// repaired candidacy gate exposed, and only all of them together produce 7.
// The 7 survivors are listed in docs/design/audit/overflow-390-v12.md; two
// of them (`.chq-review-criteria-eyebrow`, `.chq-reviewer-plan-head-row`)
// are `display: none` at 390 and were examined and deliberately left by
// w8-c, which is why this ceiling is 7 rather than 5.
// 2026-08-20 (v12m-w12-m, DEC-989 lane-owned lowering): CONTENT cluster's
// one owned overflow offender (content.css's chq-content-phone-select-
// toggle/-selecting-meta cascade-merge artifact) cleared -- 7 -> 6, re-
// measured on this branch alone. Concurrent lanes touch the same integer;
// the merge train re-measures the integrated tree.
//
// 2026-08-20 (task w12-l, DEC-989): drained both. The scan reads declared
// property VALUES regardless of `display`, so display:none never clears a
// candidate on its own -- `.chq-review-criteria-eyebrow` gained an explicit
// `overflow: hidden; text-overflow: ellipsis;` escape in its phone rule
// (harmless: the element never paints there) and
// `.chq-reviewer-plan-head-row`'s phone rule gained `grid-template-columns:
// 1fr;` clearing its fixed-track sum (also harmless: display:none). Neither
// changes anything a user can see; both were re-measured by forcing this
// constant to -1 and reading the offender list. 7 -> 5.
// Thunderdome megabatch (wave 124): re-measured on the INTEGRATED tree
// after 15 lanes landed in one pass -- concurrent lanes drained the same
// population, so the combined truth is lower than any single branch saw.
// 4 -> 1. Lowering is a merge-train act (DEC-989).
//
//
// Re-measured 7 -> 6 (task v12m-w12-q, DEC-989, wave 123 CONTACTS + MODAL +
// SUBMISSION-DETAIL tier-2 sweep): contacts-panels.css
// `.chq-contacts-pipeline-columns` declared `min-width: 1000px` against the
// 358px budget -- the desktop five-column board this rule sizes is hidden
// at 390 (`display: none` in the same phone rule), and the Pipeline 390
// frame (`docs/design/Chautauqua Contacts.dc.html`) draws no five-column
// strip at this width at all -- ONE stage at a time via a separate
// `.chq-contacts-pipeline-phone-stages`/`-phone-list` markup pair, already
// sized to budget. Dropped the stale min-width in the same phone rule
// (`min-width: 0`) rather than adding `overflow-x` to hide it. Ceiling
// lowered to the measured truth; this ratchet may only fall.
//
// Thunderdome megabatch (wave 123): the lane lowerings above are independent
// drains of disjoint offender sets merged in one pass; the constant below is
// the re-measured truth of the integrated tree, not any single branch's
// figure. This ratchet may only fall.
export const OVERFLOW_OFFENDERS_CEILING = 0;

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

  // v12m wave 117 (task w6-h, DEC-989): the real population reached 0 --
  // every actual offender got fixed or received a documented exemption, so
  // OFFENDERS is legitimately empty on this tree. A vacuity canary that
  // reads the real file population can no longer prove the shape detectors
  // still fire (the previous .chq-review-scorecard-grid canary below hit
  // this exact trap once its own offense was fixed). Proven against
  // synthetic fixtures instead, run through the SAME exported check
  // functions the real scan uses -- this is the identical shape the
  // DEC-976 cross-bundle checker's positive control already uses a few
  // lines down in this file.
  it('found more than zero offenders (vacuous-population tripwire, flagged-shape side): the shape detectors themselves still fire on synthetic fixtures', () => {
    expect(checkNowrap('white-space: nowrap;')).not.toEqual([]);
    expect(checkNowrap('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')).toEqual([]);
    expect(
      checkGridTemplateColumns('grid-template-columns: 550px 190px; gap: 20px;'),
    ).not.toEqual([]);
    expect(checkGridTemplateColumns('grid-template-columns: 1fr 1fr; gap: 20px;')).toEqual([]);
  });

  // v12m wave 8: the previous canary (.chq-speakers-grid min-width in
  // speakers.css) stopped being a *flagged* rule when w8-a gave it a
  // documented inline `overflow-exempt:` comment -- exempted rules land in
  // neither OFFENDERS nor STALE_EXEMPTIONS, so a still-real overflow no
  // longer served as a vacuity canary. Repointed at the scorecard grid,
  // whose fixed 1120px tracks overflow the 358px budget structurally (not a
  // nowrap escape one wave can quietly add) and which no frame exempts.
  //
  // v12m wave 117 (task w6-h, DEC-989): that canary hit the identical trap
  // -- .chq-review-scorecard-grid now carries its own <=700px override
  // (this scan's fr-tracks-yield rule), so it is no longer a flagged real
  // offender either. Repointed at a synthetic fixture built from the SAME
  // literal shape the real rule used to have (1120px fixed tracks + 60px
  // gap, no phone override for the selector) so the population-derivation
  // machinery (extractRules/mediaSpans/runChecks) stays exercised end to
  // end, not just the leaf check function in isolation above.
  it('the flagged-shape detection pipeline (extractRules + phone-override lookup) still finds a fixed-track grid with no phone override (synthetic fixture)', () => {
    const fixture = `.chq-fixture-scorecard-grid {\n  display: grid;\n  grid-template-columns: 820px 300px;\n  gap: 60px;\n}\n`;
    const spans = mediaSpans(fixture);
    const rules = extractRules(fixture, spans);
    expect(rules).toHaveLength(1);
    const rule = rules[0]!;
    expect(rule.isTopLevel).toBe(true);
    expect(runChecks(rule, rules)).not.toEqual([]);
  });

  it('no CSS-in-TS selector-position interpolation is left unresolved (loud, never a silent "." drop)', () => {
    expect(
      UNRESOLVED_INTERPOLATION_SELECTORS,
      UNRESOLVED_INTERPOLATION_SELECTORS.map((s) => `${s.file} -- unresolved interpolation ${s.expression}`).join('\n'),
    ).toEqual([]);
  });

  // v12m wave 119 (task w8-a, DEC-989 predicate repair): the old candidacy
  // test dropped a top-level rule from the population the instant ANY
  // phone-scoped rule in the file named the same selector token -- whether
  // or not that override touched the flagged property. Both controls run
  // through the SAME source-population pipeline the real scan uses
  // (readFileSync -> sanitizeCommentBraces -> mediaSpans -> extractRules ->
  // the cascade-aware candidacy computed above), written to a tmpdir file
  // like tautological-assertion.scan.test.ts's own controls -- never
  // anchored on a real offender (DEC-967 w103).
  describe('candidacy is cascade-aware, not selector-token-aware (DEC-989 wave-119 predicate repair)', () => {
    function scanFixture(cssBody: string): Offender[] {
      const dir = mkdtempSync(join(tmpdir(), 'overflow-cascade-scan-'));
      const file = join(dir, 'fixture.css');
      try {
        writeFileSync(file, cssBody);
        const css = sanitizeCommentBraces(readFileSync(file, 'utf-8'));
        const spans = mediaSpans(css);
        const rules = extractRules(css, spans);
        const offenders: Offender[] = [];
        for (const rule of rules) {
          const isCandidate = rule.isPhoneScoped || rule.isTopLevel;
          const effectiveRule: Rule =
            rule.isTopLevel && !rule.isPhoneScoped ? { ...rule, body: effectiveBodyFor(rule, rules) } : rule;
          const hits = isCandidate ? runChecks(effectiveRule, rules) : [];
          if (!rule.isExempt && hits.length > 0) offenders.push({ file: 'fixture.css', selector: rule.selector, reasons: hits });
        }
        return offenders;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    it('POSITIVE control: a top-level nowrap rule is flagged even though a phone override exists for the SAME selector on an UNRELATED property', () => {
      const fixture = '.x { white-space: nowrap; }\n@media (max-width: 700px) { .x { align-self: flex-end; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toHaveLength(1);
      expect(offenders[0]!.selector).toBe('.x');
      expect(offenders[0]!.reasons.join(' ')).toMatch(/nowrap/);
    });

    it('NEGATIVE control: the same top-level nowrap rule is NOT flagged once the phone override actually adds the escape', () => {
      const fixture =
        '.x { white-space: nowrap; }\n@media (max-width: 700px) { .x { overflow: hidden; text-overflow: ellipsis; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toEqual([]);
    });
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

  // v12m wave 119 (task w8-a, DEC-989 predicate repair): contacts-panels.css
  // dropped out of this "fixed" claim. Under the old (selector-token-blind)
  // candidacy test, `.chq-contacts-pipeline-columns`'s top-level
  // `min-width: 1000px` was excluded from the population purely because
  // SOME phone-scoped rule in the file named `.chq-contacts-pipeline-columns`
  // -- for an unrelated property, never zeroing out the min-width. The
  // cascade-aware repair surfaces it as the real, previously-hidden
  // overflow it always was; this is the ratchet doing its job, not a
  // regression, and the offender is carried by OVERFLOW_OFFENDERS_CEILING
  // below rather than papered over by narrowing this assertion's file list
  // to only what is still actually clean.
  it('fixed files (app/src/components/*.css) carry zero offenders', () => {
    const fixedOffenders = OFFENDERS.filter((o) => o.file.startsWith('app/src/components/'));
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
