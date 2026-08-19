// DEC-919 (wave-96): TIER 2 -- phone capability-removal probe. The
// mandate's own words: "390 keeps desktop's capabilities, and display:none
// is legal only for a control that has nothing left to govern" (a
// NAVIGATION control with nothing to reach, or a control RE-LINED
// elsewhere on the same phone surface). No prior probe checks this --
// 44px floor, overflow-390, cascade order, and density pairing all check a
// GEOMETRY property; none of them asks whether an interactive control that
// existed on desktop still exists, in some form, at 390.
//
// POPULATION (DEC-808, readdirSync recursion, never a hand list):
//   * sheets: every app/src/**/*.css file, PLUS every src/**/*.ts (test
//     files excluded) whose body declares `export const <NAME>CSS = \``
//     (derived by CONTENT, not by a `.css.ts` filename suffix -- the
//     wave-95 lesson (DEC-808) is that a suffix glob missed
//     src/views/theme.ts, which carries real phone rules under a plain
//     `.ts` name).
//   * rules: every `selector { … }` declaring `display: none` inside an
//     `@media (… max-width: Npx …)` block with N <= 700, found by brace-
//     matching the media block's body so a nested rule can never truncate
//     it (mirrors phone-horizontal-overflow.scan.test.ts's idiom).
//   * narrowed to INTERACTIVE: a rule is interactive if some comma-
//     separated part of its selector either
//       (a) addresses a bare interactive element -- `a`, `button`,
//           `input`, `select`, `textarea`, including attribute forms like
//           `button[type="submit"]` -- as its own compound (not merely a
//           descendant-chain substring), or
//       (b) names a `chq-…` token that appears in a class position on an
//           `<a>`, `<Link>`, `<button>`, `<input>`, `<select>` or
//           `<textarea>` tag in some non-test `.tsx` file under app/src or
//           src, accepting both `class=` and `className=` with `"…"`,
//           `{…}` or `` `…` `` values (DEC-393 wave-95(b): Hono JSX writes
//           `class=`, the SPA writes `className=`).
//
// RECEIPT: a `/* phone-hidden: <reason> */` comment sitting IMMEDIATELY
// above the rule it exempts (no code between the comment's closer and the
// selector's opener but whitespace) -- a structural inline comment beside
// the rule it exempts, never a file:line ledger (DEC-967: every edit above
// a pinned line silently drifts the pin onto a different expression).
//
// RATCHET: one-sided, may only be LOWERED as receipts land or rules are
// deleted -- never raised to accommodate a new unreceipted rule, and never
// read off a failing run's own output as a fresh allowlist.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_919 } from '../../src/decisions';

void DEC_919; // this scan's whole reason to exist: DEC-919's capability-removal probe

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
const PHONE_MAX_WIDTH_PX = 700;

// --- generic file enumeration (DEC-808 idiom) --------------------------

function allFiles(root: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// --- comment handling ---------------------------------------------------

/** Neutralises `{`/`}` inside `/* … *\/` comments (without changing string
 * length) so brace-matching below can't be desynchronised by a literal
 * brace quoted in a comment (this codebase's own convention of citing a
 * design frame's Handlebars-ish placeholder text). Mirrors
 * phone-horizontal-overflow.scan.test.ts's `sanitizeCommentBraces`. */
function sanitizeCommentBraces(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[{}]/g, '·'));
}

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const PHONE_HIDDEN_RECEIPT_RE = /\/\*\s*phone-hidden:\s*([^*]*)\*\//;

// --- sheet discovery (population, DEC-808) ------------------------------

interface Sheet {
  absPath: string;
  label: string;
  css: string; // sanitized (comment braces neutralised)
}

const APP_CSS_FILES = allFiles(HERE, '.css');

/** Every literal backtick-delimited string in a file, joined, with any
 * `${...}` interpolation stripped (it names another module's own exported
 * constant, itself enumerated and scanned separately as that module's own
 * file). Mirrors phone-horizontal-overflow.scan.test.ts's
 * `extractCssTsLiteral`. */
function extractBacktickLiterals(raw: string): string {
  const literals = [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
  return literals.join('\n').replace(/\$\{[^}]*\}/g, '');
}

/** Every non-test `.ts` file under `src/` whose body declares
 * `export const <NAME>CSS = \`` -- derived from CONTENT, never a `.css.ts`
 * filename glob (DEC-808 wave-95/96 lesson: theme.ts is a `.ts` file, not
 * a `.css.ts` file, and carries real phone rules). */
function cssInTsFiles(): string[] {
  const out: string[] = [];
  for (const path of allFiles(SRC_ROOT, '.ts')) {
    if (path.includes('.test.')) continue;
    const raw = readFileSync(path, 'utf-8');
    if (/export const \w*CSS\s*=\s*`/.test(raw)) out.push(path);
  }
  return out.sort();
}

const CSS_IN_TS_FILES = cssInTsFiles();

const SHEETS: Sheet[] = [
  ...APP_CSS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: sanitizeCommentBraces(readFileSync(absPath, 'utf-8')),
  })),
  ...CSS_IN_TS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: sanitizeCommentBraces(extractBacktickLiterals(readFileSync(absPath, 'utf-8'))),
  })),
];

// --- phone display:none rule extraction (brace-matched) ------------------

interface PhoneDisplayNoneRule {
  sheet: string;
  selector: string;
  receipt: string | undefined; // reason text if a `phone-hidden:` comment sits directly above
}

/** Every `@media(...) { … }` span in `css`, matched by brace depth (a
 * nested rule can never truncate it), reporting the media condition and
 * the raw body text between the outer braces. */
function mediaSpans(css: string): Array<{ condition: string; body: string }> {
  const out: Array<{ condition: string; body: string }> = [];
  const openRe = /@media([^{]*)\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    const condition = (m[1] ?? '').trim();
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push({ condition, body: css.slice(bodyStart, i - 1) });
    openRe.lastIndex = i;
  }
  return out;
}

function isPhoneCondition(condition: string): boolean {
  const m = condition.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
  return m !== null && Number(m[1]) <= PHONE_MAX_WIDTH_PX;
}

/** Every innermost `selector { body }` rule inside a phone media block's
 * body, with an optional leading `/* phone-hidden: … *\/` receipt comment,
 * filtered to those declaring `display: none`. A nested `@media` inside a
 * phone block (rare, none on main at authoring time) is walked too since
 * the innermost-rule regex ignores `@` headers structurally (an `@media`
 * opener can never itself satisfy `[^{}]+\{[^{}]*\}` -- its own body
 * contains a nested `{`). */
function phoneDisplayNoneRulesInBlock(sheetLabel: string, body: string): PhoneDisplayNoneRule[] {
  const out: PhoneDisplayNoneRule[] = [];
  // The optional leading-comment group can only ever match when the
  // engine's scan position sits EXACTLY at the comment's opening `/*` --
  // for the first rule in a block that isn't true (the scan starts at
  // index 0, which is usually whitespace), so a receipt's presence is
  // read off the WHOLE match text (mirrors
  // phone-tap-target.scan.test.ts's `topLevelRulesWithExemption`, which
  // checks `m[0].trimStart().startsWith('/*')` rather than trusting the
  // optional capture group) rather than off the optional group alone.
  const re = /(?:\/\*\s*phone-hidden:[^*]*\*\/\s*)?([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const whole = m[0];
    const selectorRaw = m[1] ?? '';
    const declBody = m[2] ?? '';
    const selector = selectorRaw.replace(COMMENT_RE, ' ').trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;
    if (!/display\s*:\s*none\b/.test(declBody)) continue;
    const trimmed = whole.trimStart();
    const receiptMatch = trimmed.startsWith('/*') ? PHONE_HIDDEN_RECEIPT_RE.exec(trimmed) : null;
    out.push({
      sheet: sheetLabel,
      selector,
      receipt: receiptMatch ? (receiptMatch[1] ?? '').trim() : undefined,
    });
  }
  return out;
}

function allPhoneDisplayNoneRules(): PhoneDisplayNoneRule[] {
  const out: PhoneDisplayNoneRule[] = [];
  for (const sheet of SHEETS) {
    for (const span of mediaSpans(sheet.css)) {
      if (!isPhoneCondition(span.condition)) continue;
      out.push(...phoneDisplayNoneRulesInBlock(sheet.label, span.body));
    }
  }
  return out;
}

const PHONE_DISPLAY_NONE_RULES = allPhoneDisplayNoneRules();

// --- interactive-token population (DEC-808, derived not hand-written) ----

const INTERACTIVE_TAGS = ['a', 'Link', 'button', 'input', 'select', 'textarea'] as const;
const BARE_ELEMENT_TAGS = ['a', 'button', 'input', 'select', 'textarea'] as const;

function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out;
}

/** Strips `//` line comments and `/* *\/` block comments from TSX source
 * (mirrors phone-tap-target.scan.test.ts's `stripTsxComments`). */
function stripTsxComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Every distinct `chq-…` token found in a class position on one of
 * INTERACTIVE_TAGS, accepting both `class=` (Hono JSX) and `className=`
 * (the SPA), with `"…"`, `{…}` or `` `…` `` values (DEC-393 wave-95(b)). */
function interactiveTagTokens(src: string): string[] {
  const out = new Set<string>();
  const tagAlt = INTERACTIVE_TAGS.join('|');
  const tagRe = new RegExp(`<(${tagAlt})\\b([^>]*)>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    const attrs = m[2] ?? '';
    const classMatch = attrs.match(/(?:class|className)\s*=\s*(\{[^}]*\}|"[^"]*"|`[^`]*`)/);
    if (!classMatch) continue;
    const classText = classMatch[1] ?? '';
    for (const t of classText.matchAll(/chq-[a-z0-9-]+/g)) out.add(t[0]);
  }
  return [...out];
}

function allInteractiveTagTokens(): Set<string> {
  const out = new Set<string>();
  const roots = [HERE, SRC_ROOT];
  for (const root of roots) {
    for (const path of allTsxFiles(root)) {
      const src = stripTsxComments(readFileSync(path, 'utf-8'));
      for (const t of interactiveTagTokens(src)) out.add(t);
    }
  }
  return out;
}

const INTERACTIVE_TOKENS = allInteractiveTagTokens();

/** True if `selectorPart` addresses a bare interactive element as its own
 * compound -- `a`, `button[type="submit"]`, `input:not(...)`, etc -- not
 * merely a substring somewhere in a descendant chain naming an unrelated
 * class. Mirrors phone-tap-target.scan.test.ts's `selectorReachesAnchor`
 * boundary idiom, generalised across all five bare tags. */
function selectorPartIsBareInteractiveElement(selectorPart: string): boolean {
  const tagAlt = BARE_ELEMENT_TAGS.join('|');
  const re = new RegExp(`(^|[\\s>+~])(${tagAlt})(?=[.:#\\[\\s,]|$)`);
  return re.test(selectorPart);
}

function selectorPartMentionsToken(selectorPart: string, token: string): boolean {
  return new RegExp(`\\.${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(selectorPart);
}

/** True if any comma-separated part of `selector` is interactive per the
 * derived population above. */
function selectorIsInteractive(selector: string): boolean {
  return selector
    .split(',')
    .map((s) => s.trim())
    .some((part) => {
      if (selectorPartIsBareInteractiveElement(part)) return true;
      for (const t of INTERACTIVE_TOKENS) {
        if (selectorPartMentionsToken(part, t)) return true;
      }
      return false;
    });
}

const INTERACTIVE_PHONE_DISPLAY_NONE_RULES = PHONE_DISPLAY_NONE_RULES.filter((r) =>
  selectorIsInteractive(r.selector),
);

const UNRECEIPTED = INTERACTIVE_PHONE_DISPLAY_NONE_RULES.filter((r) => r.receipt === undefined);

// [data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"] --
// cfp.css.ts:254 -- is a real, still-live capability-removal defect (a
// phone user on step 1 has no visible submit control). It is OWNED by
// task v12m-w14-b, not this one: this scan counts it (it belongs in the
// population and the ceiling) but must never receipt it -- a receipt here
// would be the DEC-976 shape one wave over (a citation naming a fix that
// isn't there).
// w14-b landed the Save-draft restore, so the work item's selector now
// carves that control out -- the submit hide itself is still unreceipted.
const CFP_SUBMIT_BUTTON_WORK_ITEM = '[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft)';

// This count may only be LOWERED, either by a receipt landing on a rule
// that legitimately qualifies (a navigation control with nothing to reach,
// or a control re-lined elsewhere on the same phone surface, both cited by
// file:line in the receipt) or by the underlying capability being restored
// some other way. It may NEVER be raised to accommodate a new unreceipted
// rule, and the number below must never be read off a failing run's own
// output as a fresh allowlist -- it is measured against this branch's tree
// at authoring time only to seed the ratchet, not to license what it
// counted.
//
// UNOWNED WORK ITEMS (named per the field-guide rule: read a ratchet's
// closing sentence as a work item, not as prose). Measured on this branch
// at authoring time, the seven remaining unreceipted interactive rules
// are, each, a capability with no phone home -- none is exempted here
// because none is either a proven dead-end navigation control or a
// verified re-lined replacement:
//   * `[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]`
//     (cfp.css.ts:254) -- step 1 renders no submit control of any kind;
//     explicitly out of THIS task's scope (owned by task v12m-w14-b).
//   * `.chq-content-worklist-selecting .chq-bulkbar-actions .chq-btn-tertiary`
//     (content.css) -- the bulk-selection secondary action disappears at
//     390 with no phone equivalent found.
//   * `.chq-forms-field-actions .chq-btn:last-child` and
//     `.chq-forms-add-question` (forms.css) -- a field-row action and the
//     add-question control both drop out at 390.
//   * `.chq-overview-btn-waitlist` (overview.css) -- the waitlist action
//     has no phone equivalent found.
//   * `.chq-review-criterion-row > .chq-forms-field-drag` (review.css) --
//     a drag handle is a legal disabled-token use, not a legal
//     display:none use; this rule removes the reorder capability outright
//     at 390 rather than disabling it in place.
//   * `.chq-auth-stack .chq-auth-tertiary` (auth.css) -- the tertiary auth
//     action drops out at 390 with no phone equivalent found.
// A future wave closes each by giving its cluster a phone-width
// affordance, or by writing a receipt once a genuine re-lined replacement
// or navigation dead-end is verified -- never by receipting on assumption.
// Re-baselined 2026-08-19 at merge time: the probe was authored on the
// stranded wave-14 branch against a 7-rule main; waves 15+ added three
// unreceipted hides before the probe landed. The ratchet is one-sided
// from HERE -- receipt or remove to lower it, never raise it again.
export const PHONE_HIDDEN_UNRECEIPTED_CEILING = 10;

describe('DEC-919 phone capability-removal probe', () => {
  it('finds more than one sheet (vacuous-population tripwire, sheet side)', () => {
    expect(SHEETS.length).toBeGreaterThan(5);
  });

  it('the sheet population includes a content-derived (non-.css.ts-suffix) module (src/views/theme.ts)', () => {
    expect(SHEETS.some((s) => s.label === 'src/views/theme.ts')).toBe(true);
  });

  it('the sheet population includes a plain app/src *.css file and a src/routes *.css.ts file', () => {
    expect(SHEETS.some((s) => s.label === 'app/src/styles.css')).toBe(true);
    expect(SHEETS.some((s) => s.label === 'src/routes/public/cfp.css.ts')).toBe(true);
  });

  it('finds more than zero phone display:none rules (vacuous-population tripwire, rule side)', () => {
    expect(PHONE_DISPLAY_NONE_RULES.length).toBeGreaterThan(0);
  });

  it('finds more than zero interactive tokens (vacuous-population tripwire, token side)', () => {
    expect(INTERACTIVE_TOKENS.size).toBeGreaterThan(0);
  });

  it('flags a synthetic interactive bare-button phone display:none rule with no receipt (positive control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-actions button[type="submit"] { display: none; }
      }
    `;
    const spans = mediaSpans(sanitizeCommentBraces(css)).filter((s) => isPhoneCondition(s.condition));
    expect(spans.length).toBe(1);
    const rules = phoneDisplayNoneRulesInBlock('synthetic', spans[0]!.body);
    expect(rules.length).toBe(1);
    expect(rules[0]!.receipt).toBeUndefined();
    expect(selectorIsInteractive(rules[0]!.selector)).toBe(true);
  });

  it('does not flag a synthetic phone display:none rule carrying a phone-hidden receipt (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        /* phone-hidden: navigation control with nothing to reach -- step 1 has no previous step */
        .chq-x-fake-back { display: none; }
      }
    `;
    const spans = mediaSpans(sanitizeCommentBraces(css)).filter((s) => isPhoneCondition(s.condition));
    const rules = phoneDisplayNoneRulesInBlock('synthetic', spans[0]!.body);
    expect(rules.length).toBe(1);
    expect(rules[0]!.receipt).toBe(
      'navigation control with nothing to reach -- step 1 has no previous step',
    );
  });

  it('does not flag a synthetic non-interactive phone display:none rule (negative control: a bare <section> class)', () => {
    const css = `.chq-x-fake-section { display: none; }`;
    const spans = mediaSpans(
      sanitizeCommentBraces(`@media (max-width: 700px) { ${css} }`),
    ).filter((s) => isPhoneCondition(s.condition));
    const rules = phoneDisplayNoneRulesInBlock('synthetic', spans[0]!.body);
    expect(rules.length).toBe(1);
    // Not a bare interactive element and not a token ever placed on an
    // interactive tag in any real .tsx file -- must read as non-interactive.
    expect(selectorIsInteractive(rules[0]!.selector)).toBe(false);
  });

  it('ignores a rule outside any phone-width media block (a wide desktop-only display:none is not this probe\'s subject)', () => {
    const css = sanitizeCommentBraces(
      `@media (min-width: 1200px) { button.chq-x-fake-desktop-only { display: none; } }`,
    );
    const phoneSpans = mediaSpans(css).filter((s) => isPhoneCondition(s.condition));
    expect(phoneSpans.length).toBe(0);
  });

  it('the two cfp.css.ts step-navigation dead-ends carry a phone-hidden receipt naming the reason', () => {
    const back = INTERACTIVE_PHONE_DISPLAY_NONE_RULES.find(
      (r) => r.sheet === 'src/routes/public/cfp.css.ts' && r.selector.includes('chq-cfp-step-back'),
    );
    const next = INTERACTIVE_PHONE_DISPLAY_NONE_RULES.find(
      (r) => r.sheet === 'src/routes/public/cfp.css.ts' && r.selector.includes('chq-cfp-step-next'),
    );
    expect(back?.receipt).toBeTruthy();
    expect(next?.receipt).toBeTruthy();
  });

  it('the cfp submit-button work item (owned by task v12m-w14-b) is counted, never receipted, here', () => {
    const rule = INTERACTIVE_PHONE_DISPLAY_NONE_RULES.find(
      (r) => r.sheet === 'src/routes/public/cfp.css.ts' && r.selector === CFP_SUBMIT_BUTTON_WORK_ITEM,
    );
    expect(rule).toBeDefined();
    expect(rule!.receipt).toBeUndefined();
  });

  it('unreceipted interactive phone display:none rules never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = UNRECEIPTED.map((r) => `${r.sheet} :: ${r.selector}`).join('\n');
    expect(
      UNRECEIPTED.length,
      `unreceipted interactive phone display:none rules (${UNRECEIPTED.length}, ceiling ${PHONE_HIDDEN_UNRECEIPTED_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(PHONE_HIDDEN_UNRECEIPTED_CEILING);
  });
});

export { INTERACTIVE_PHONE_DISPLAY_NONE_RULES, PHONE_DISPLAY_NONE_RULES, UNRECEIPTED };
