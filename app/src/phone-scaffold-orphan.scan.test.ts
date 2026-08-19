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
import { join } from 'node:path';

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

// Which declared classes have at least one renderer: a source file (outside
// styles.css, which is CSS not markup) whose text contains the bare class
// name. A substring match is deliberately generous -- it catches className
// string literals, template literals and conditional expressions alike, the
// same idiom css-contract.scan.test.ts's own invariant C/D already use.
function classesWithRenderers(declared: string[]): Set<string> {
  const files = [...walkSourceFiles(appSrcDir), ...walkSourceFiles(srcDir)];
  const withRenderer = new Set<string>();
  const remaining = new Set(declared);
  for (const file of files) {
    if (remaining.size === 0) break;
    const contents = readFileSync(file, 'utf8');
    for (const cls of [...remaining]) {
      if (contents.includes(cls)) {
        withRenderer.add(cls);
        remaining.delete(cls);
      }
    }
  }
  return withRenderer;
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
});
