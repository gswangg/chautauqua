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
// phone user on step 1 has no visible submit control): this scan counts it
// (it belongs in the population and the ceiling) but must never receipt it
// -- a receipt here would be the DEC-976 shape one wave over (a citation
// naming a fix that isn't there). The Save-draft restore carved that
// control out of the selector below, so the submit hide itself is still
// unreceipted. A receipt becomes legal here only once a verified re-lined
// submit control exists on the phone surface (cited by file:line) or a
// verified navigation dead-end rules the control out entirely -- never on
// assumption.

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
// closing sentence as a work item, not as prose). Re-measured wave-106
// (task v12m-w2-b) after settings-lists.css's two desktop-twin hides
// gained their DEC-919 receipt: the six remaining unreceipted interactive
// rules are, each, a capability with no phone home -- none is exempted
// here because none is either a proven dead-end navigation control or a
// verified re-lined replacement. The forms.css pair cited by an earlier
// wave's count is gone (field-row action and add-question control now
// have phone renderers); a new offender, `.chq-detail-back-full`, has
// appeared in its place:
//   * `[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]`
//     (cfp.css.ts:254) -- step 1 renders no submit control of any kind at
//     390; a receipt becomes legal only once a verified re-lined submit
//     control exists on the phone surface (cited by file:line) or a
//     verified navigation dead-end rules it out entirely.
//   * `.chq-content-worklist-selecting .chq-bulkbar-actions .chq-btn-tertiary`
//     (content.css) -- the bulk-selection secondary action disappears at
//     390 with no phone equivalent found.
//   * `.chq-overview-btn-waitlist` (overview.css) -- the waitlist action
//     has no phone equivalent found.
//   * `.chq-review-criterion-row > .chq-forms-field-drag` (review.css) --
//     a drag handle is a legal disabled-token use, not a legal
//     display:none use; this rule removes the reorder capability outright
//     at 390 rather than disabling it in place.
//   * `.chq-detail-back-full` (submissions/detail.css) -- a back-navigation
//     control drops out at 390 with no verified phone equivalent found
//     (not receipted on assumption -- a genuine dead-end must be verified
//     before it earns a `phone-hidden:` reason).
//   * `.chq-auth-stack .chq-auth-tertiary` (auth.css) -- the tertiary auth
//     action drops out at 390 with no phone equivalent found. The ruling
//     has since landed: a geometry frame that omits a control removes
//     geometry, not navigation, so the legal repair is to RE-LINE the
//     tertiary action at the 44px floor on the phone surface -- a receipt
//     claiming a navigation dead-end here would be false. This row stays
//     unreceipted until that re-lining lands and is cited by file:line.
// A future wave closes each by giving its cluster a phone-width
// affordance, or by writing a receipt once a genuine re-lined replacement
// or navigation dead-end is verified -- never by receipting on assumption.
// Re-measured 2026-08-19 (wave 106, task v12m-w2-b) against this branch's
// tree: truth is 6, down from the stale ceiling of 10 this file shipped
// with. Tightening this constant is a merge-train act performed once per
// batch (re-measure the whole tree, not a worker's mid-lane snapshot) --
// the ratchet remains one-sided from HERE: receipt or remove to lower it,
// never raise it again to accommodate a new unreceipted rule.
export const PHONE_HIDDEN_UNRECEIPTED_CEILING = 6;

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

  // DEC-989 wave-114 amendment: a branch-named `it(...)` title or receipt
  // reason locks a real fix out (a lane that closes the work item turns the
  // sentinel red) and decays the moment the named branch merges or is
  // abandoned (DEC-099 waves 76/77 already banned branch names as reasons).
  // Scans this file's own `it(...)` titles plus every runtime `phone-hidden:`
  // receipt reason actually parsed off the tree -- never a hand-picked
  // subset -- for a branch-name-shaped token.
  it('no it(...) title or phone-hidden receipt reason in this file names a branch (DEC-989 wave-114)', () => {
    const BRANCH_TOKEN_RE = /\bv12m-w\d+-[a-z]\b|\btask-w\d+-[a-z]\b/i;

    const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const itTitles = [...ownSource.matchAll(/\bit\(\s*(['"`])((?:(?!\1)[\s\S])*?)\1/g)].map(
      (m) => m[2] ?? '',
    );
    expect(itTitles.length).toBeGreaterThan(5); // vacuous-population tripwire

    const receiptReasons = PHONE_DISPLAY_NONE_RULES.map((r) => r.receipt).filter(
      (r): r is string => r !== undefined,
    );

    const offenders = [
      ...itTitles.filter((t) => BRANCH_TOKEN_RE.test(t)).map((t) => `it title: ${t}`),
      ...receiptReasons
        .filter((r) => BRANCH_TOKEN_RE.test(r))
        .map((r) => `receipt reason: ${r}`),
    ];
    expect(offenders, offenders.join('\n')).toEqual([]);

    // Positive control: the regex itself must actually detect the shape it
    // claims to forbid, on synthetic strings shaped like the ones this file
    // used to carry (never checked against the real file content above).
    expect(BRANCH_TOKEN_RE.test('owned by task v12m-w14-b')).toBe(true);
    expect(BRANCH_TOKEN_RE.test('a ruling is owned by task v12m-w13-d')).toBe(true);

    // Negative control: a wave/DEC citation with no branch-shaped substring
    // must not trip the same regex (the regex is a pure shape match -- any
    // string carrying a `v12m-wN-x` or `task-wN-x` substring, in any
    // context, is exactly what it exists to catch).
    expect(BRANCH_TOKEN_RE.test('re-measured wave 106, DEC-989 wave-114 amendment')).toBe(false);
    expect(BRANCH_TOKEN_RE.test('a navigation control with nothing to reach')).toBe(false);
  });

  it('unreceipted interactive phone display:none rules never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = UNRECEIPTED.map((r) => `${r.sheet} :: ${r.selector}`).join('\n');
    expect(
      UNRECEIPTED.length,
      `unreceipted interactive phone display:none rules (${UNRECEIPTED.length}, ceiling ${PHONE_HIDDEN_UNRECEIPTED_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(PHONE_HIDDEN_UNRECEIPTED_CEILING);
  });

  // Companion to the ceiling test above, mirroring
  // test/phone-frame-ledger.scan.test.ts's stale-floor companion (DEC-808):
  // a ceiling that sits ABOVE the measured truth is just as much a lie as
  // one that sits below it -- it licenses stagnation instead of forbidding
  // debt. This FAILS whenever the measured unreceipted count falls BELOW
  // PHONE_HIDDEN_UNRECEIPTED_CEILING, printing the exact replacement line.
  // Re-tightening the constant is a merge-train act performed once per
  // batch (re-measure the whole tree, never a worker's mid-lane edit) --
  // the ratchet's one-sided half still stands: this companion only ever
  // asks for a LOWER number, never licenses raising the ceiling back up to
  // accommodate a new unreceipted rule.
  it('never sits ABOVE the measured truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (UNRECEIPTED.length < PHONE_HIDDEN_UNRECEIPTED_CEILING) {
      throw new Error(
        `${UNRECEIPTED.length} unreceipted interactive phone display:none rule(s), below the ` +
          `ratchet ceiling of ${PHONE_HIDDEN_UNRECEIPTED_CEILING}. This is the ratchet working: ` +
          `coverage landed. Tighten the ceiling in the same commit (a merge-train act, never a ` +
          `worker's edit mid-lane) by replacing the line:\n` +
          `  export const PHONE_HIDDEN_UNRECEIPTED_CEILING = ${UNRECEIPTED.length};`,
      );
    }
    expect(UNRECEIPTED.length).toBeGreaterThanOrEqual(PHONE_HIDDEN_UNRECEIPTED_CEILING);
  });
});

export { INTERACTIVE_PHONE_DISPLAY_NONE_RULES, PHONE_DISPLAY_NONE_RULES, UNRECEIPTED };
