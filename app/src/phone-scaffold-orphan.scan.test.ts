// DEC-576 (wave-85 amendment a). The v12 phone page-scaffold primitives
// (.chq-phone-head/-head-drill/-body/-dock/-back, styles.css's ~2182-2260
// max-width:700px block) were designed to be composed onto every 390 frame
// -- but css-contract.scan.test.ts's own dead-rule guard (invariant D)
// explicitly carves `/^chq-phone-/` OUT of scope "the phone layer ... has
// its own guard" -- a guard that, until this file, did not exist. This is
// that guard: it ENUMERATES the `.chq-phone-*` classes styles.css actually
// declares (never a hand-listed array, DEC-808) and counts how many have
// zero renderers anywhere under app/src or src.
//
// ORPHAN_CEILING below is the deliverable. It is seeded at the count
// measured on this branch: `.chq-phone-dock` has one reader
// (SubmissionDetailPage.tsx:1870); `-head`, `-head-drill`, `-body` and
// `-back` have none. It may only DECREASE as pages adopt the scaffold --
// never raised to match a regression. The failure message names every
// class it found orphaned.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { ssrCssSources } from '../../test/helpers/ssr-css-sources';

const appSrcDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const srcDir = join(repoRoot, 'src');
const stylesCssPath = join(appSrcDir, 'styles.css');

// Parse styles.css for every `.chq-phone-...` class token that appears in a
// SELECTOR (the text preceding a `{`), after stripping comments so a class
// name mentioned only in prose (this file's own header, or styles.css's
// citation comments) is never mistaken for a declaration.
function declaredPhoneScaffoldClasses(): string[] {
  const css = readFileSync(stylesCssPath, 'utf8');
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = new Set<string>();
  const ruleRe = /([^{}]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(withoutComments))) {
    const prelude = match[1];
    if (prelude === undefined) throw new Error('unexpected regex match with no capture group');
    const tokens = prelude.match(/\.chq-phone-[a-zA-Z0-9-]+/g);
    if (tokens === null) continue;
    for (const token of tokens) classes.add(token.slice(1));
  }
  return [...classes].sort();
}

// Deterministic recursive walk collecting non-test .ts/.tsx files, mirroring
// test/decisions-orphan-ratchet.test.ts's walkSourceFiles idiom so the two
// orphan guards never silently diverge on what counts as a source file.
function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      out.push(...walkSourceFiles(full));
      continue;
    }
    if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
    // A class kept alive only by a test's own assertion string is dead in
    // the product -- exclude every *.test.ts(x) and *.scan.test.ts, this
    // file included.
    if (/\.test\.tsx?$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

// The core matching predicate, factored out so a test can pin it against
// synthetic source text (below) without touching disk: a declared class has
// a renderer when some source text contains the BARE class token (no
// leading dot -- markup spells `className="chq-phone-foo"`, never
// `className=".chq-phone-foo"`). A substring match is deliberately generous
// -- it catches className string literals, template literals and
// conditional expressions alike, the same idiom css-contract.scan.test.ts's
// own invariant C/D already use.
function withRenderers(declared: string[], sourceTexts: string[]): Set<string> {
  const withRenderer = new Set<string>();
  const remaining = new Set(declared);
  for (const contents of sourceTexts) {
    if (remaining.size === 0) break;
    for (const cls of [...remaining]) {
      if (contents.includes(cls)) {
        withRenderer.add(cls);
        remaining.delete(cls);
      }
    }
  }
  return withRenderer;
}

// Which declared classes have at least one renderer: a source file (outside
// styles.css, which is CSS not markup) whose text contains the bare class
// name.
function classesWithRenderers(declared: string[]): Set<string> {
  const files = [...walkSourceFiles(appSrcDir), ...walkSourceFiles(srcDir)];
  return withRenderers(declared, files.map((f) => readFileSync(f, 'utf8')));
}

// Re-measured wave-106 (task v12m-w2-b) against this branch's tree: every
// declared `.chq-phone-*` class now has at least one renderer, so the truth
// is 0 -- down from the stale ceiling of 4 this file shipped with (the
// wave-86 count of `.chq-phone-head`, `.chq-phone-head-drill`,
// `.chq-phone-body` and `.chq-phone-back` as orphans no longer holds; pages
// have since adopted the scaffold). Lower this number as pages adopt the
// scaffold; never raise it to match a regression -- a ratchet raised to
// match a regression is a ceiling, not a floor (DEC-576/DEC-180).
export const ORPHAN_CEILING = 0;

describe('phone page-scaffold orphan ratchet (DEC-576 wave-85 amendment a)', () => {
  it('declares at least the five known scaffold classes', () => {
    // A sanity floor on the parser itself: if this drops to 0 the parser
    // broke, not the scaffold.
    const declared = declaredPhoneScaffoldClasses();
    expect(declared.length).toBeGreaterThanOrEqual(5);
  });

  it('the number of orphaned .chq-phone-* classes stays at or below ORPHAN_CEILING', () => {
    const declared = declaredPhoneScaffoldClasses();
    const withRenderers = classesWithRenderers(declared);
    const orphans = declared.filter((cls) => !withRenderers.has(cls));
    expect(
      orphans.length,
      `${orphans.length} orphaned .chq-phone-* class(es) with zero renderers under app/src or src: ${orphans.join(', ')}. A ratchet is never raised to match a regression -- either give the class a renderer or, if ORPHAN_CEILING itself needs to move, only ever move it down.`,
    ).toBeLessThanOrEqual(ORPHAN_CEILING);
  });

  // Companion to the ceiling test above, mirroring
  // test/phone-frame-ledger.scan.test.ts's stale-floor companion (DEC-808):
  // a ceiling that sits ABOVE the measured truth is just as much a lie as
  // one that sits below it -- it licenses stagnation instead of forbidding
  // debt. This FAILS whenever the measured orphan count falls BELOW
  // ORPHAN_CEILING, printing the exact replacement line. Re-tightening the
  // constant is a merge-train act performed once per batch (re-measure the
  // whole tree, never a worker's mid-lane edit) -- the ratchet's one-sided
  // half still stands: this companion only ever asks for a LOWER number,
  // never licenses raising ORPHAN_CEILING back up to match a regression.
  it('never sits ABOVE the measured truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    const declared = declaredPhoneScaffoldClasses();
    const withRenderers = classesWithRenderers(declared);
    const orphans = declared.filter((cls) => !withRenderers.has(cls));
    if (orphans.length < ORPHAN_CEILING) {
      throw new Error(
        `${orphans.length} orphaned .chq-phone-* class(es), below the ratchet ceiling of ` +
          `${ORPHAN_CEILING}. This is the ratchet working: coverage landed. Tighten the ` +
          `ceiling in the same commit (a merge-train act, never a worker's edit mid-lane) by ` +
          `replacing the line:\n  export const ORPHAN_CEILING = ${orphans.length};`,
      );
    }
    expect(orphans.length).toBeGreaterThanOrEqual(ORPHAN_CEILING);
  });

  // Regression control (wave-107 amendment, DEC-941/DEC-989): a sibling copy
  // of this same population (app/src/phone-page-scaffold.test.ts's now-
  // deleted orphan describe) declared classes DOTTED (`.chq-phone-foo`) and
  // then asked `src.includes(cls)` of .tsx MARKUP, which never spells the
  // leading dot -- a literal match against the wrong alphabet, silently
  // reporting false orphans (or, worse, false non-orphans whenever the dotted
  // string happened to appear in a comment). This file's own
  // `classesWithRenderers` strips the dot (`token.slice(1)`, line 42) before
  // matching; pin that behaviour directly against synthetic fixtures so a
  // future edit can't reintroduce the dotted-selector bug silently.
  it('withRenderers matches the BARE class token in synthetic markup, and fabricates an orphan when the fixture spells the DOTTED selector instead', () => {
    const declared = ['chq-phone-fixture-a', 'chq-phone-fixture-b'];

    // Synthetic source text carrying the BARE token, as real TSX markup
    // does (className="chq-phone-fixture-a ...") -- both classes must be
    // found, zero orphans.
    const bareMarkup = ['<div className="chq-phone-fixture-a" />', 'const x = "chq-phone-fixture-b";'];
    const bareResult = withRenderers(declared, bareMarkup);
    const bareOrphans = declared.filter((cls) => !bareResult.has(cls));
    expect(bareOrphans).toEqual([]);

    // The regression this test guards against: fixture text spelling the
    // DOTTED CSS selector (as the deleted app/src/phone-page-scaffold.test.ts
    // orphan describe did via `css.match(/\.chq-phone-.../)`, matched
    // against `.tsx` source that never contains the leading dot). Matching
    // the dotted string against text that only contains the bare token must
    // fabricate exactly one orphan.
    const dottedNeedle = `.${declared[1]}`; // '.chq-phone-fixture-b'
    const dottedResult = withRenderers([declared[0]!, dottedNeedle], bareMarkup);
    const dottedOrphans = [declared[0]!, dottedNeedle].filter((cls) => !dottedResult.has(cls));
    expect(dottedOrphans).toEqual([dottedNeedle]);
  });
});

// DEC-385/DEC-613 (wave-107 amendment): "no min-width media query" was
// pinned over ONE file (app/src/styles.css, in
// app/src/phone-page-scaffold.test.ts). Widened here to the DERIVED
// population every other freeze/density/cascade scan already shares
// (DEC-808/DEC-367): every app/src/**/*.css file PLUS every SSR `*_CSS`
// module found by ssrCssSources() -- never a `src/**/*.css.ts` filename
// glob, which silently drops src/views/theme.ts (it exports THEME_CSS from
// a .ts file, not a .css.ts file). "Desktop is FROZEN" is a mandate rule;
// one file was never a population.
interface CssSource {
  rel: string;
  text: string;
}

function allAppCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

function desktopFreezePopulation(): CssSource[] {
  const appSources: CssSource[] = allAppCssFiles(appSrcDir).map((file) => ({
    rel: relative(repoRoot, file),
    text: readFileSync(file, 'utf8'),
  }));
  const ssrSources: CssSource[] = ssrCssSources().map((s) => ({ rel: s.path, text: s.text }));
  return [...appSources, ...ssrSources].sort((a, b) => a.rel.localeCompare(b.rel));
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// Matches an @media rule's CONDITION LIST ONLY (up to its opening `{`), the
// same scoping test/breakpoint-conformance.test.ts uses -- `min-width` is
// also a legitimate ordinary CSS declaration property (e.g. on a <select>
// or a flex item, `min-width: 0` appears dozens of times in this tree) and
// must never trip this check; only a min-width WITHIN an @media condition
// list is a violation.
function hasMinWidthMediaQuery(text: string): boolean {
  const clean = stripComments(text);
  const mediaRe = /@media\s*([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = mediaRe.exec(clean))) {
    if (/min-width\s*:/.test(m[1]!)) return true;
  }
  return false;
}

describe('DEC-385: no min-width media query in ANY app/src/**/*.css file or SSR *_CSS module (wave-107 widened population)', () => {
  const population = desktopFreezePopulation();

  it('the population is real, not vacuous: more than 20 sheets, including styles.css and at least one SSR module', () => {
    expect(population.length).toBeGreaterThan(20);
    expect(population.some((s) => s.rel.endsWith('app/src/styles.css') || s.rel === 'app/src/styles.css')).toBe(true);
    expect(population.some((s) => s.rel.startsWith('src/'))).toBe(true);
  });

  it('declares no min-width media query anywhere in the population', () => {
    const violations = population.filter((s) => hasMinWidthMediaQuery(s.text)).map((s) => s.rel);
    expect(violations).toEqual([]);
  });

  it('positive control: a fixture sheet with a min-width query IS flagged by the same predicate', () => {
    const fixture: CssSource = {
      rel: 'fixture.css',
      text: '@media (min-width: 900px) { .chq-x { display: none; } }',
    };
    const violations = [...population, fixture].filter((s) => hasMinWidthMediaQuery(s.text)).map((s) => s.rel);
    expect(violations).toEqual(['fixture.css']);
  });
});
