// DEC-937 wave-121 amendment: cancelled padding (padding-inline:N paired
// with an equal-and-opposite margin-inline:-N) is a FACE-scoped idiom. It
// is safe on a control that paints NO box -- the negative margin drags
// nothing but empty hit-box past the layout edge. On a PAINTED control
// (a border and/or a background) the same pair does two wrong things at
// once: padding-inline OVERRIDES the face's own inline padding (the drawn
// box narrows), and the negative margin then drags the PAINTED box past
// its layout edge on each side. This file is the "painted-face half" of
// the lens: it finds every cancelled-padding rule in the tree and asks,
// for each selector it targets, whether the resolved face is painted.
//
// This is the twin of app/src/phone-tap-target-scan/anchor-floor.ts's
// row-action-anchor evasion lens (same house shape: enumerate a
// population from source content, resolve a derived fact per member,
// grade it against a two-sided ratchet) but answers a different question
// -- not "is the tap floor met" but "is the idiom legal on this face".
//
// POPULATION (DEC-808, never hand-listed): every app/src/**/*.css and
// every src/**/*.css.ts (CSS-in-TS template-literal export), excluding
// *.test.*. A rule is a population MEMBER when its declaration body
// contains BOTH `padding-inline: Npx` and `margin-inline: -Npx` for the
// SAME N > 0.
//
// COMMENT STRIPPING (v12m-w9-k's repaired shape, applied here from the
// start): every source is comment-stripped BEFORE any regex walks it. A
// comment merely naming a class (e.g. "see .chq-btn above") must never
// fabricate a population member or a false face resolution -- exactly the
// bug rowActionContainerTokens carried and anchor-floor.ts's history
// records as repaired on the v12m-w9-k branch.
//
// FACE RESOLUTION: for each selector in a member rule, the KEY COMPOUND is
// the last space/`>`-separated compound (the element the rule actually
// targets). If the key compound carries its own class token(s), each
// token is resolved by reading every TOP-LEVEL (non-@media) rule for that
// token, first in the member's own sheet, then in app/src/styles.css --
// mirroring anchor-floor.ts's own reuse of topLevelRulesWithExemption +
// selectorMentionsToken so this lens is not a second copy of that walk
// (DEC-613). The face is PAINTED if any resolved rule declares
// `border`/`border-width`/`border-style` other than `none`/`0`, or
// `background`/`background-color` other than `none`/`transparent`.
//
// If the key compound is a BARE ELEMENT (`a`, `button`) with no class of
// its own, the selector cannot be resolved from the CSS tree alone -- the
// real class lives on the JSX element the selector reaches by tag. Two
// hand-curated, scan-checked maps cover this (DEC-991's shape: an
// exemption/resolution names a receipt the scan itself re-verifies, never
// a bare assertion):
//   - ELEMENT_KEY_FACE: the selector DOES reach a real `<a>`/`<Link>` in
//     its componentPath, carrying classNameLiteral. A companion test below
//     asserts classNameLiteral appears VERBATIM in componentPath's source.
//   - DEAD_ELEMENT_SELECTORS: the selector's container renders NO
//     `<a>`/`<Link>` at all (every action in it is a `<button>`) -- the
//     selector matches nothing live and is recorded as a DEAD SELECTOR row
//     in the audit doc, never as a face row. A companion test asserts the
//     JSX block bounded by the container's own tag nesting contains
//     neither `<a ` nor `<Link` (a receipt the scan itself re-derives, not
//     a hand claim) and that the container class literal is real.
//
// Both maps are population-complete for the bare-element members this
// branch measured (grep app/src/**/*.tsx for the exact selector text
// finds no third case) -- an unresolved bare-element member throws
// (Fail Loudly) rather than silently skipping a population row.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_613, DEC_808, DEC_937, DEC_967, DEC_991 } from '../../src/decisions';
import {
  selectorMentionsToken,
  stripComments,
  topLevelRulesWithExemption,
} from './phone-tap-target-scan/core.js';

void DEC_937; // this scan's whole reason to exist: the painted-face half of the cancelled-padding lens
void DEC_393; // the idiom's companion invariant (the borderless family this lens's negative space belongs to)
void DEC_991; // ELEMENT_KEY_FACE / DEAD_ELEMENT_SELECTORS name a receipt the scan itself re-checks, never a bare claim
void DEC_808; // population by source content, readdirSync, never a hand-listed manifest
void DEC_613; // face resolution reuses anchor-floor.ts's own core.ts walk rather than growing a second copy
void DEC_967; // this file's audit doc cites CSS files in the drift-proof bare-path form, never path:line

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const APP_SRC_ROOT = HERE;
const SRC_ROOT = join(REPO_ROOT, 'src');
const STYLES_CSS_PATH = join(APP_SRC_ROOT, 'styles.css');

// --- population enumeration (DEC-808) --------------------------------

function allCssFilesUnder(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CSS_EXPORT_RE = /export const [A-Z0-9_]*CSS\s*=\s*/;

function cssTsModuleFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
    const absPath = join(entry.parentPath, entry.name);
    if (CSS_EXPORT_RE.test(readFileSync(absPath, 'utf-8'))) out.push(absPath);
  }
  return out.sort();
}

/** Joins every template-literal body in a CSS-in-TS module and strips
 * `${...}` interpolations -- adequate here because (measured on this
 * branch) NOT ONE src/**\/*.css.ts module contains a padding-inline +
 * margin-inline pair, so no interpolation-mangled selector could ever
 * become a population member; a future module that DID add one would
 * still be caught (the properties this scan matches live in the
 * declaration body, never inside a selector-position interpolation). */
function extractCssTsLiteral(raw: string): string {
  const literals = [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
  return literals.join('\n').replace(/\$\{[^}]*\}/g, '.');
}

interface SourceFile {
  absPath: string;
  label: string;
  css: string; // comment-stripped
}

const APP_CSS_FILES = allCssFilesUnder(APP_SRC_ROOT);
const CSS_TS_FILES = cssTsModuleFiles(SRC_ROOT);

const SOURCES: SourceFile[] = [
  ...APP_CSS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: stripComments(readFileSync(absPath, 'utf-8')),
  })),
  ...CSS_TS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: stripComments(extractCssTsLiteral(readFileSync(absPath, 'utf-8'))),
  })),
];

const STYLES_CSS = stripComments(readFileSync(STYLES_CSS_PATH, 'utf-8'));

// --- rule extraction: same flat-regex trick phone-horizontal-overflow.scan
// uses -- an `@media (...) { ... }` header can never itself satisfy
// `[^{}]+\{[^{}]*\}` (its own body nests a `{`), so this single pattern
// finds every innermost `selector { body }` rule, media or no media,
// directly in comment-stripped text. ---------------------------------

export interface Rule {
  selector: string;
  body: string;
}

export function extractRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const selector = (m[1] ?? '').trim();
    if (!selector || selector.startsWith('@')) continue;
    rules.push({ selector, body: m[2] ?? '' });
  }
  return rules;
}

/** True if `body` declares `padding-inline: Npx` and `margin-inline: -Npx`
 * for the SAME N > 0 -- the cancelled-padding idiom's own shape. */
export function cancelledPaddingN(body: string): number | undefined {
  const pi = body.match(/padding-inline\s*:\s*(\d+(?:\.\d+)?)px/);
  const mi = body.match(/margin-inline\s*:\s*-(\d+(?:\.\d+)?)px/);
  if (!pi || !mi) return undefined;
  const piN = Number(pi[1]);
  const miN = Number(mi[1]);
  if (piN <= 0 || piN !== miN) return undefined;
  return piN;
}

// --- face resolution ---------------------------------------------------

/** True if `body` declares a border or background other than the
 * unpainted vocabulary (`none`/`0` for border-ish, `none`/`transparent`
 * for background-ish). Property names are matched EXACTLY (no
 * `border-radius`/`background-image` false-positive) via lookaround, not
 * `\b`, since `\b` sits at the hyphen in `border-radius` too and would
 * wrongly credit an unrelated shorthand as "painted". */
export function isPaintedFace(body: string): { painted: boolean; reason?: string } {
  const borderRe = /(?<![\w-])(border-width|border-style|border)(?![\w-])\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = borderRe.exec(body)) !== null) {
    const value = (m[2] ?? '').trim();
    if (!/^(none|0)\b/.test(value)) return { painted: true, reason: `${m[1]}: ${value}` };
  }
  const bgRe = /(?<![\w-])(background-color|background)(?![\w-])\s*:\s*([^;]+);/g;
  while ((m = bgRe.exec(body)) !== null) {
    const value = (m[2] ?? '').trim();
    if (!/^(none|transparent)\b/.test(value)) return { painted: true, reason: `${m[1]}: ${value}` };
  }
  return { painted: false };
}

/** Resolves a class token's face by reading every top-level (non-@media)
 * rule mentioning it, first in `ownCss`, then in `stylesCss` -- reuses
 * anchor-floor.ts's own selectorMentionsToken/topLevelRulesWithExemption
 * walk rather than growing a second copy (DEC-613). */
export function resolveTokenFace(
  token: string,
  ownCss: string,
  stylesCss: string,
): { painted: boolean; reason?: string } {
  const ownRules = topLevelRulesWithExemption(ownCss).filter((r) => selectorMentionsToken(r.selector, token));
  const styleRules = topLevelRulesWithExemption(stylesCss).filter((r) => selectorMentionsToken(r.selector, token));
  for (const r of [...ownRules, ...styleRules]) {
    const res = isPaintedFace(r.body);
    if (res.painted) return { painted: true, reason: `${res.reason} (selector \`${r.selector}\`)` };
  }
  return { painted: false };
}

/** The last space/`>`-separated compound of a selector -- the element the
 * rule actually targets (DEC-937's "key compound"). */
export function keyCompound(selector: string): string {
  const parts = selector
    .split(/\s*>\s*|\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? selector.trim();
}

/** Every `chq-…` class token in a compound (may be more than one, e.g.
 * `.chq-overview-link-btn.chq-overview-link-muted`). */
export function classTokensOf(compound: string): string[] {
  return [...compound.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]);
}

/** True if `compound` is a bare element selector (`a`, `button`, …) with
 * no class of its own -- the shape that must be resolved through
 * ELEMENT_KEY_FACE / DEAD_ELEMENT_SELECTORS rather than the CSS tree. */
export function isBareElementCompound(compound: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*(:[\w-]+(\([^)]*\))?)*$/.test(compound) && !compound.includes('.');
}

// --- bare-element resolution maps (DEC-991's receipt shape) ------------
//
// Every entry below was verified by hand against this branch's tree
// (grep for the selector's container class in app/src/**/*.tsx, read the
// component). Ground truth for the four painted/link entries was also
// independently stated in DEC-937's own wave-121 amendment text
// (src/decisions-data/DEC-937.md) before this scan existed.

export interface ElementKeyFaceEntry {
  selector: string;
  componentPath: string; // relative to repo root
  classNameLiteral: string;
  reason: string;
}

export const ELEMENT_KEY_FACE: ElementKeyFaceEntry[] = [
  {
    selector: '.chq-contacts-title-actions a',
    componentPath: 'app/src/pages/contacts/ContactsApp.tsx',
    classNameLiteral: 'chq-btn chq-btn-secondary',
    reason: 'the Export CSV anchor is rendered `<a className="chq-btn chq-btn-secondary">` -- PAINTED (styles.css .chq-btn-secondary: background + border)',
  },
  {
    selector: '.chq-contacts-rail-duplicate-actions a',
    componentPath: 'app/src/pages/contacts/DuplicateRow.tsx',
    classNameLiteral: 'chq-link-button',
    reason: 'the Merge Link is rendered `<Link className="chq-link-button">` -- unpainted (the quiet-action family the idiom was built for)',
  },
  {
    selector: '.chq-speaker-detail-actions a',
    componentPath: 'app/src/pages/speakers/SpeakerDetailPage.tsx',
    classNameLiteral: 'chq-btn chq-btn-secondary',
    reason: 'the Email anchor is rendered `<a className="chq-btn chq-btn-secondary" href={`mailto:...`}>` -- PAINTED',
  },
  {
    selector: '.chq-review-plan-actions > a',
    componentPath: 'app/src/pages/review/PlanList.tsx',
    classNameLiteral: 'chq-review-plan-action-link',
    reason: 'each per-plan row action is a `<Link className="chq-review-plan-action-link">` -- unpainted (no border/background declared anywhere for the class)',
  },
];

export interface DeadElementSelectorEntry {
  selector: string;
  componentPath: string; // relative to repo root
  containerClassLiteral: string;
  reason: string;
}

export const DEAD_ELEMENT_SELECTORS: DeadElementSelectorEntry[] = [
  {
    selector: '.chq-speakers-head-actions a',
    componentPath: 'app/src/pages/speakers/OnboardingGrid.tsx',
    containerClassLiteral: 'chq-speakers-head-actions',
    reason: 'every action inside is a `<button>` (Add speaker / New task / Remind all outstanding) -- no `<a>` or `<Link>` renders here',
  },
  {
    selector: '.chq-speakers-pager-actions a',
    componentPath: 'app/src/pages/speakers/OnboardingGrid.tsx',
    containerClassLiteral: 'chq-speakers-pager-actions',
    reason: 'the pager is two `<button>`s (Previous / Next) -- no `<a>` or `<Link>` renders here',
  },
  {
    selector: '.chq-speakers-write-failure-actions a',
    componentPath: 'app/src/pages/speakers/OnboardingGrid.tsx',
    containerClassLiteral: 'chq-speakers-write-failure-actions',
    reason: 'the rolled-back-write recovery actions are two `<button>`s (Reload the grid / Try again) -- no `<a>` or `<Link>` renders here',
  },
  {
    selector: '.chq-speaker-detail-logistics-actions a',
    componentPath: 'app/src/pages/speakers/SpeakerDetailPage.tsx',
    containerClassLiteral: 'chq-speaker-detail-logistics-actions',
    reason: 'the logistics edit form actions are two `<button>`s (Save / Cancel) -- no `<a>` or `<Link>` renders here',
  },
  {
    selector: '.chq-taskview-actions a',
    componentPath: 'app/src/pages/speakers/TaskView.tsx',
    containerClassLiteral: 'chq-taskview-actions',
    reason: 'every action here (Export answers / Move the due date / …) is a `<button>` -- no `<a>` or `<Link>` renders here',
  },
];

const ELEMENT_KEY_FACE_BY_SELECTOR = new Map(ELEMENT_KEY_FACE.map((e) => [e.selector, e]));
const DEAD_SELECTOR_SET = new Set(DEAD_ELEMENT_SELECTORS.map((e) => e.selector));

// --- JSX containing-block extraction, used only by the DEAD_ELEMENT_SELECTORS
// companion test below: finds the nearest enclosing `<div ...>` before a
// literal marker and walks forward tracking generic tag-open/tag-close
// depth (ignoring self-closing tags) until that div's own matching close,
// returning the substring. Adequate for this codebase's plain JSX (no tag
// name confusion needed -- depth-only balancing is exactly what a
// same-file "is there an <a> nested inside this specific container div"
// check requires). ------------------------------------------------------

export function extractEnclosingDivBlock(src: string, marker: string): string {
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error(`marker not found in source: ${marker}`);
  const openStart = src.lastIndexOf('<div', idx);
  if (openStart === -1) throw new Error(`no enclosing <div found before marker: ${marker}`);
  const tagRe = /<\/?[a-zA-Z][^>]*>/g;
  tagRe.lastIndex = openStart;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    const tag = m[0];
    if (tag.startsWith('</')) {
      depth--;
      if (depth === 0) return src.slice(openStart, m.index + tag.length);
    } else if (!tag.endsWith('/>')) {
      depth++;
    }
  }
  throw new Error(`unbalanced JSX walking forward from ${openStart} for marker: ${marker}`);
}

// --- assemble population + offenders ------------------------------------

export interface FaceRow {
  file: string;
  selector: string;
  n: number;
  painted: boolean;
  reason: string;
}

export interface DeadRow {
  file: string;
  selector: string;
  n: number;
}

const FACE_ROWS: FaceRow[] = [];
const DEAD_ROWS: DeadRow[] = [];
const MEMBER_COUNT = { rules: 0 };

for (const source of SOURCES) {
  const rules = extractRules(source.css);
  for (const rule of rules) {
    const n = cancelledPaddingN(rule.body);
    if (n === undefined) continue;
    MEMBER_COUNT.rules++;
    for (const rawSelector of rule.selector.split(',')) {
      const selector = rawSelector.trim();
      if (!selector) continue;
      const compound = keyCompound(selector);
      if (isBareElementCompound(compound)) {
        if (DEAD_SELECTOR_SET.has(selector)) {
          DEAD_ROWS.push({ file: source.label, selector, n });
          continue;
        }
        const entry = ELEMENT_KEY_FACE_BY_SELECTOR.get(selector);
        if (!entry) {
          throw new Error(
            `cancelled-padding-face.scan: bare-element selector "${selector}" in ${source.label} is not ` +
              `resolved by ELEMENT_KEY_FACE or DEAD_ELEMENT_SELECTORS -- add a receipted entry, never skip it silently`,
          );
        }
        const tokens = classTokensOf(entry.classNameLiteral);
        let painted = false;
        let reason = 'unpainted';
        for (const t of tokens) {
          const res = resolveTokenFace(t, source.css, STYLES_CSS);
          if (res.painted) {
            painted = true;
            reason = `${res.reason} — ${entry.reason}`;
            break;
          }
        }
        if (!painted) reason = entry.reason;
        FACE_ROWS.push({ file: source.label, selector, n, painted, reason });
        continue;
      }
      const tokens = classTokensOf(compound);
      let painted = false;
      let reason = 'unpainted';
      for (const t of tokens) {
        const res = resolveTokenFace(t, source.css, STYLES_CSS);
        if (res.painted) {
          painted = true;
          reason = res.reason ?? 'painted';
          break;
        }
      }
      FACE_ROWS.push({ file: source.label, selector, n, painted, reason });
    }
  }
}

const OFFENDERS = FACE_ROWS.filter((r) => r.painted);

// This count may only be LOWERED as the drain lanes fix each offender's
// face-vs-idiom mismatch -- re-measured against THIS branch's tree, not
// copied from the task brief. Measured 8 at authoring time: agenda.css x3
// (.chq-agenda-head-actions .chq-btn, .chq-breaks-add-actions .chq-btn,
// .chq-breaks-row-actions .chq-btn), overview.css x3
// (.chq-overview-row-actions .chq-overview-btn,
// .chq-overview-row-actions-inline .chq-overview-btn,
// .chq-overview-row-actions-column .chq-overview-btn), contacts.css x1
// (.chq-contacts-title-actions a, Export CSV), speakers.css x1
// (.chq-speaker-detail-actions a, Email).
//
// DEC-989 (task w12-o, 2026-08-20): lowered 8 -> 3. agenda.css's
// .chq-agenda-head-actions .chq-btn and .chq-breaks-add-actions .chq-btn,
// and overview.css's three .chq-overview-row-actions(-inline/-column)
// .chq-overview-btn selectors, are REMOVED from their shared
// cancelled-padding rule's own selector list (not merely out-cascaded by a
// later override) -- see agenda.css/overview.css. Left standing:
// contacts.css and speakers.css (out of this task's scope, owned by other
// lanes) plus agenda.css's .chq-breaks-row-actions .chq-btn, which this
// scan's resolveTokenFace still reports painted because
// `selectorMentionsToken`'s `\.chq-btn\b` also matches `.chq-btn-primary`/
// `.chq-btn-secondary` (word-boundary fires at the hyphen, not at the end
// of the class name) -- a false positive: the buttons this selector
// actually reaches (BreaksPanel.tsx Edit/Remove) are .chq-btn-tertiary
// (background:none; border:none), which app/src/pages/agenda/
// agenda-phone-floor.test.ts's own task-w10-m pins already assert stays
// on the shared cancelled-padding floor with NO override rule -- changing
// that would contradict an existing, correct pin to satisfy a scan bug in
// shared code (`app/src/phone-tap-target-scan/core.ts`'s
// `selectorMentionsToken`, reused by anchor-floor.ts per DEC-613) that is
// out of this task's file scope. Flagged for the planner/scribe, not
// fixed here.
export const PAINTED_CANCELLED_PADDING_CEILING = 3;

describe('cancelled-padding face lens (DEC-937 wave-121 amendment)', () => {
  it('found more than one CSS source to scan (vacuous-population tripwire, file side)', () => {
    expect(APP_CSS_FILES.length).toBeGreaterThan(5);
  });

  it('the CSS-in-TS module population is derived from source content, not a filename glob (DEC-808)', () => {
    expect(CSS_TS_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('found more than zero cancelled-padding rules in the tree (vacuous-population tripwire, member side)', () => {
    expect(MEMBER_COUNT.rules).toBeGreaterThan(0);
  });

  it('measured cancelled-padding member rules at authoring time (re-derive, never trust a stale count)', () => {
    // Field guide / DEC-937 measured 24 rules at 17deea82; this branch
    // re-measures rather than importing that number. A drain lane fixing
    // an offender's FACE never changes rule COUNT (it changes whether the
    // rule keeps padding-inline/margin-inline at all, or the face), so
    // this is a coarse sanity band, not the ratchet itself.
    expect(MEMBER_COUNT.rules).toBeGreaterThanOrEqual(20);
    expect(MEMBER_COUNT.rules).toBeLessThanOrEqual(30);
  });

  describe('cancelledPaddingN', () => {
    it('POSITIVE control: matching padding-inline/margin-inline is recognised', () => {
      expect(cancelledPaddingN('padding-inline: 10px; margin-inline: -10px;')).toBe(10);
    });
    it('NEGATIVE control: mismatched N is not recognised', () => {
      expect(cancelledPaddingN('padding-inline: 10px; margin-inline: -6px;')).toBeUndefined();
    });
    it('NEGATIVE control: N=0 is not recognised (nothing cancelled)', () => {
      expect(cancelledPaddingN('padding-inline: 0px; margin-inline: -0px;')).toBeUndefined();
    });
    it('NEGATIVE control: only one of the pair present is not recognised', () => {
      expect(cancelledPaddingN('padding-inline: 10px;')).toBeUndefined();
      expect(cancelledPaddingN('margin-inline: -10px;')).toBeUndefined();
    });
  });

  describe('isPaintedFace', () => {
    it('POSITIVE control: a synthetic border fires', () => {
      const res = isPaintedFace('border: 1px solid red; background: none;');
      expect(res.painted).toBe(true);
    });
    it('NEGATIVE control: border:none + background:none does not fire', () => {
      const res = isPaintedFace('border: none; background: none;');
      expect(res.painted).toBe(false);
    });
    it('NEGATIVE control: no border/background declaration at all does not fire', () => {
      expect(isPaintedFace('display: flex; padding: 4px;').painted).toBe(false);
    });
    it('a non-none/transparent background fires', () => {
      expect(isPaintedFace('background: var(--chq-surface-sunk);').painted).toBe(true);
    });
    it('border-radius alone (not `border`) never fires -- exact property match, not a `\\b` prefix match', () => {
      expect(isPaintedFace('border-radius: 8px; background-image: none;').painted).toBe(false);
    });
  });

  describe('keyCompound / isBareElementCompound / classTokensOf', () => {
    it('takes the last space-separated compound', () => {
      expect(keyCompound('.chq-agenda-head-actions .chq-btn')).toBe('.chq-btn');
    });
    it('takes the last >-separated compound', () => {
      expect(keyCompound('.chq-comms-editor-actions > .chq-link-button')).toBe('.chq-link-button');
    });
    it('a single-compound selector is its own key compound', () => {
      expect(keyCompound('.chq-toolbar-link')).toBe('.chq-toolbar-link');
    });
    it('recognises a bare element compound', () => {
      expect(isBareElementCompound('a')).toBe(true);
      expect(isBareElementCompound('button')).toBe(true);
    });
    it('does not treat a classed compound as bare', () => {
      expect(isBareElementCompound('.chq-btn')).toBe(false);
    });
    it('collects multiple class tokens off one compound', () => {
      expect(classTokensOf('.chq-overview-link-btn.chq-overview-link-muted')).toEqual([
        'chq-overview-link-btn',
        'chq-overview-link-muted',
      ]);
    });
  });

  describe('ELEMENT_KEY_FACE receipts (DEC-991 shape): classNameLiteral appears verbatim in componentPath', () => {
    it.each(ELEMENT_KEY_FACE)('$selector -> $componentPath', (entry) => {
      const abs = join(REPO_ROOT, entry.componentPath);
      const src = readFileSync(abs, 'utf-8');
      expect(
        src.includes(entry.classNameLiteral),
        `${entry.componentPath} does not contain "${entry.classNameLiteral}" verbatim -- stale ELEMENT_KEY_FACE entry for ${entry.selector}`,
      ).toBe(true);
    });
  });

  describe('DEAD_ELEMENT_SELECTORS receipts (DEC-991 shape): the container renders no <a>/<Link>', () => {
    it.each(DEAD_ELEMENT_SELECTORS)('$selector -> $componentPath', (entry) => {
      const abs = join(REPO_ROOT, entry.componentPath);
      const src = readFileSync(abs, 'utf-8');
      const block = extractEnclosingDivBlock(src, `"${entry.containerClassLiteral}"`);
      expect(
        /<a[\s>]|<Link\b/.test(block),
        `${entry.componentPath}'s "${entry.containerClassLiteral}" block now renders an <a>/<Link> -- ` +
          `stale DEAD_ELEMENT_SELECTORS entry for ${entry.selector}, move it to ELEMENT_KEY_FACE`,
      ).toBe(false);
    });

    it('extractEnclosingDivBlock POSITIVE control: a synthetic block containing an <a> is detected', () => {
      const src = '<div className="chq-fixture-actions"><a className="x">hi</a></div>';
      const block = extractEnclosingDivBlock(src, '"chq-fixture-actions"');
      expect(/<a[\s>]|<Link\b/.test(block)).toBe(true);
    });
  });

  it('offender count never exceeds the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = OFFENDERS.map((o) => `${o.file} :: ${o.selector} (N=${o.n}) -- ${o.reason}`).join('\n');
    expect(
      OFFENDERS.length,
      `offenders (${OFFENDERS.length}) exceed PAINTED_CANCELLED_PADDING_CEILING (${PAINTED_CANCELLED_PADDING_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(PAINTED_CANCELLED_PADDING_CEILING);
  });

  it(`never falls below PAINTED_CANCELLED_PADDING_CEILING (${PAINTED_CANCELLED_PADDING_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < PAINTED_CANCELLED_PADDING_CEILING) {
      throw new Error(
        `offenders (${OFFENDERS.length}) fell below PAINTED_CANCELLED_PADDING_CEILING of ` +
          `${PAINTED_CANCELLED_PADDING_CEILING}. This is the ratchet working: offenders got fixed. Lower ` +
          `the ceiling in the same commit (a merge-train act, never a worker's edit mid-lane) by ` +
          `replacing the line:\n  export const PAINTED_CANCELLED_PADDING_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(PAINTED_CANCELLED_PADDING_CEILING);
  });

  it('every DEAD_ELEMENT_SELECTORS entry is genuinely dead in the measured population (no face row also claims it)', () => {
    const faceSelectors = new Set(FACE_ROWS.map((r) => `${r.file}::${r.selector}`));
    for (const dead of DEAD_ROWS) {
      expect(faceSelectors.has(`${dead.file}::${dead.selector}`)).toBe(false);
    }
  });
});

export { FACE_ROWS, DEAD_ROWS, MEMBER_COUNT, SOURCES };
