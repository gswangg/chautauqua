// DEC-808 wave-43 amendment (task w43-g): `text-overflow: ellipsis` is a
// THREE-declaration contract. docs/design/DESIGN-RULINGS.md's speaker-detail
// ruling already states this in prose for one surface -- "`text-align: right`
// alone measured wrong live, and needed two more declarations": `min-width: 0`,
// `overflow: hidden`, `text-overflow: ellipsis`. No instrument generalised it
// until this one.
//
// OFFENDER PREDICATE (DEC-808): a rule declaring `text-overflow: ellipsis`
// where NO rule matching the same `chq-` class token declares (a) a
// non-`normal` `white-space` AND (b) an `overflow`/`overflow-x` of `hidden`
// or `clip`, both EFFECTIVE AT 390 -- i.e. present either in the rule's own
// top-level body, or supplied by a phone-scoped override (a rule inside an
// `@media` block that applies at the 390 frame per DEC-991's `appliesAt390`)
// for a selector sharing at least one `chq-` class token, in the SAME file
// (DEC-385: a phone override may only ever be authored inside its own
// sheet's terminal <=700px block, so the cascade this predicate must honour
// is a same-file fact).
//
// A per-rule read ("does THIS rule's own body carry white-space") is the
// trap DEC-808 names explicitly: several of the 39 raw per-rule misses
// inherit an effective `white-space: nowrap` from a DIFFERENT rule sharing
// the same class token, and a per-rule ratchet would flag those as
// instrument artefacts (the exact shape CONFIRM_TITLE_OBJECT / FRAME_EYEBROW
// / FRAME_COUNT_CAPTION were all checked for and dropped). The join below
// reuses the exact cascade machinery app/src/phone-overflow-scan/{rules,
// cascade}.ts already builds for the tap-floor/overflow scans (DEC-613: a
// second copy of this join is a trap with a delay fuse) -- generalised from
// "same selector" (cascade.ts's own scope) to "same class token" per this
// ruling's own wording, because the speaker-detail ruling's own repair
// pattern is a SEPARATE rule (a shared row/cell base class) supplying the
// wrap-escape a specific column rule consumes.
//
// POPULATION (DEC-808): every app/src/**/*.css file plus every src/**/*.ts(x)
// module whose source EXPORTS a `*_CSS` template-literal string constant --
// the app/src/control-font.scan.test.ts idiom, never a `src/**/*.css.ts`
// filename glob (which drops src/views/theme.ts, a plain .ts file).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_613, DEC_808 } from '../../src/decisions';
import { effectiveBodyFor, parseDeclarations } from './phone-overflow-scan/cascade';
import { sanitizeCommentBraces } from './phone-overflow-scan/population';
import { extractRules, mediaSpans, type Rule } from './phone-overflow-scan/rules';

void DEC_808; // this scan's whole reason to exist: the three-declaration truncation contract
void DEC_613; // reuses phone-overflow-scan's cascade join rather than authoring a second copy

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = resolve(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

/** Every file under `root` whose name ends with `extension` (recursive, DEC-808 -- never a hand-listed manifest). */
function allFiles(root: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface CssSource {
  label: string; // repo-relative path, used in offender messages
  css: string;
}

/** Every `*.css` file under app/src. */
function appSrcCssSources(): CssSource[] {
  return allFiles(HERE, '.css').map((path) => ({
    label: relative(REPO_ROOT, path),
    css: sanitizeCommentBraces(readFileSync(path, 'utf-8')),
  }));
}

const CSS_EXPORT_RE = /export const ([A-Za-z0-9_]*_CSS)\s*=\s*`([\s\S]*?)`;/;

/**
 * Every module under src/ that EXPORTS a `*_CSS` template-literal string
 * constant -- the app/src/control-font.scan.test.ts idiom (DEC-808 wave-99
 * amendment): derived by reading exports, never a `src/**\/*.css.ts`
 * filename glob, which silently drops src/views/theme.ts (plain .ts).
 */
function srcCssExportSources(): CssSource[] {
  const out: CssSource[] = [];
  const candidates = allFiles(SRC_ROOT, '.ts').concat(allFiles(SRC_ROOT, '.tsx'));
  for (const path of candidates) {
    if (path.includes('.test.')) continue;
    const src = readFileSync(path, 'utf-8');
    const m = CSS_EXPORT_RE.exec(src);
    if (!m) continue;
    out.push({ label: relative(REPO_ROOT, path), css: sanitizeCommentBraces(m[2]!) });
  }
  return out;
}

const APP_CSS_SOURCES = appSrcCssSources();
const SRC_CSS_SOURCES = srcCssExportSources();
const ALL_CSS_SOURCES = [...APP_CSS_SOURCES, ...SRC_CSS_SOURCES];

/** Every `chq-` class token in a selector string. */
function classTokensOf(selector: string): string[] {
  return [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!).filter((t) => t.startsWith('chq-'));
}

const ELLIPSIS_RE = /text-overflow\s*:\s*ellipsis\s*;/;

function declaresEffective(merged: Map<string, string>, prop: string, isSatisfied: (v: string) => boolean): boolean {
  const v = merged.get(prop);
  return v !== undefined && isSatisfied(v);
}

const NON_NORMAL_WHITE_SPACE = (v: string) => v.trim().toLowerCase() !== 'normal';
const HIDDEN_OR_CLIP = (v: string) => ['hidden', 'clip'].includes(v.trim().toLowerCase());

interface EllipsisRule {
  file: string;
  selector: string;
  dependsOnParentMinWidth: boolean;
}

interface Offender extends EllipsisRule {
  missing: string[]; // which of white-space / overflow-escape is missing, effective at 390
}

const ELLIPSIS_RULES: EllipsisRule[] = [];
const OFFENDERS: Offender[] = [];

for (const source of ALL_CSS_SOURCES) {
  const spans = mediaSpans(source.css);
  const rules: Rule[] = extractRules(source.css, spans);

  for (const rule of rules) {
    if (!ELLIPSIS_RE.test(rule.body)) continue;

    const tokens = classTokensOf(rule.selector);
    // No `min-width: 0` in this rule's OWN body: for a flex/grid child, its
    // truncation depends on an ANCESTOR supplying that reset (a flex/grid
    // item's default min-width:auto refuses to shrink below its content,
    // which defeats ellipsis regardless of what this rule itself declares).
    // Recorded, never dropped, so the population cannot silently shrink
    // around a rule this predicate cannot fully verify on its own (DEC-808).
    const dependsOnParentMinWidth = !/min-width\s*:\s*0\b/.test(rule.body);
    ELLIPSIS_RULES.push({ file: source.label, selector: rule.selector, dependsOnParentMinWidth });

    // Every rule in the same file matching at least one of this rule's own
    // chq- class tokens contributes to the effective declaration set --
    // generalises effectiveBodyFor's own-selector-only join (cascade.ts) to
    // "same class token", per this ruling's own wording ("no rule matching
    // the same chq- class token declares ..."); the speaker-detail pattern
    // this ruling names in prose is exactly a SEPARATE row/cell base rule
    // supplying the wrap-escape a column rule itself never declares.
    const merged = new Map<string, string>();
    for (const [prop, val] of parseDeclarations(rule.body)) merged.set(prop, val);
    if (tokens.length > 0) {
      for (const other of rules) {
        if (other === rule) continue;
        const otherTokens = classTokensOf(other.selector);
        if (!otherTokens.some((t) => tokens.includes(t))) continue;
        // A top-level companion contributes its own declarations directly;
        // a phone-scoped companion contributes its EFFECTIVE (cascade-merged)
        // declarations, exactly the join effectiveBodyFor already performs
        // for a same-selector match.
        const contribBody = other.isTopLevel && !other.isPhoneScoped ? other.body : effectiveBodyFor(other, rules);
        for (const [prop, val] of parseDeclarations(contribBody)) {
          if (!merged.has(prop)) merged.set(prop, val);
        }
      }
    }
    // The rule's own top-level declarations, then any phone-scoped override
    // for its OWN selector, win last (same precedence effectiveBodyFor uses).
    for (const [prop, val] of parseDeclarations(effectiveBodyFor(rule, rules))) merged.set(prop, val);

    const hasWhiteSpace = declaresEffective(merged, 'white-space', NON_NORMAL_WHITE_SPACE);
    const hasOverflowEscape =
      declaresEffective(merged, 'overflow', HIDDEN_OR_CLIP) || declaresEffective(merged, 'overflow-x', HIDDEN_OR_CLIP);

    const missing: string[] = [];
    if (!hasWhiteSpace) missing.push('white-space (non-normal, effective at 390)');
    if (!hasOverflowEscape) missing.push('overflow/overflow-x: hidden|clip (effective at 390)');
    if (missing.length > 0) {
      OFFENDERS.push({ file: source.label, selector: rule.selector, dependsOnParentMinWidth, missing });
    }
  }
}

// TWO-SIDED RATCHET (DEC-989 shape). Re-measured this wave by forcing this
// constant to -1 and reading the printed roster back (see
// docs/design/audit/phone-truncation-triad-v12.md for the full per-row
// disposition): 74 rules declare text-overflow: ellipsis; after the
// cascade-aware, same-class-token join, 12 remain offenders -- every other
// row of the raw 39 per-rule misses resolves through an effective
// white-space/overflow companion supplied by a sibling rule sharing its
// class token (the DEC-808 trap this scan exists to avoid falling into).
export const TRUNCATION_TRIAD_OFFENDERS_CEILING = 5;

describe('text-overflow: ellipsis is a three-declaration contract (DEC-808 wave-43 amendment)', () => {
  it('found more than one CSS source to scan', () => {
    expect(ALL_CSS_SOURCES.length).toBeGreaterThan(5);
    expect(APP_CSS_SOURCES.some((s) => s.label.endsWith('app/src/styles.css'))).toBe(true);
    expect(SRC_CSS_SOURCES.some((s) => s.label.endsWith('src/views/theme.ts'))).toBe(true);
  });

  it('found more than one rule declaring text-overflow: ellipsis (non-vacuity floor on the raw population)', () => {
    expect(ELLIPSIS_RULES.length).toBeGreaterThan(20);
  });

  it('every rule declaring text-overflow: ellipsis has an effective non-normal white-space and an effective overflow/overflow-x hidden|clip companion, matched by shared chq- class token, effective at the 390 frame', () => {
    const message = OFFENDERS.map(
      (o) => `${o.file}: "${o.selector}" -- missing ${o.missing.join(' and ')}${o.dependsOnParentMinWidth ? ' (also depends on a parent min-width:0)' : ''}`,
    ).join('\n');
    expect(OFFENDERS.length, `text-overflow: ellipsis offenders:\n${message}`).toBeLessThanOrEqual(
      TRUNCATION_TRIAD_OFFENDERS_CEILING,
    );
  });

  it('the ceiling is not stale (two-sided ratchet, DEC-808/DEC-989)', () => {
    if (OFFENDERS.length < TRUNCATION_TRIAD_OFFENDERS_CEILING) {
      throw new Error(
        `${OFFENDERS.length} offenders measured, below CEILING=${TRUNCATION_TRIAD_OFFENDERS_CEILING}. Lower ` +
          `TRUNCATION_TRIAD_OFFENDERS_CEILING to exactly ${OFFENDERS.length} in the same batch as the repair.`,
      );
    }
    expect(OFFENDERS.length).toBe(TRUNCATION_TRIAD_OFFENDERS_CEILING);
  });

  describe('falsifiability controls (DEC-989 clause c): run through the scan\'s own predicates', () => {
    it('positive control: a bare white-space check rejects "normal"', () => {
      expect(NON_NORMAL_WHITE_SPACE('normal')).toBe(false);
      expect(NON_NORMAL_WHITE_SPACE('nowrap')).toBe(true);
    });

    it('positive control: the overflow-escape check accepts only hidden/clip', () => {
      expect(HIDDEN_OR_CLIP('hidden')).toBe(true);
      expect(HIDDEN_OR_CLIP('clip')).toBe(true);
      expect(HIDDEN_OR_CLIP('visible')).toBe(false);
      expect(HIDDEN_OR_CLIP('auto')).toBe(false);
    });
  });
});

export { ALL_CSS_SOURCES, ELLIPSIS_RULES, OFFENDERS };
