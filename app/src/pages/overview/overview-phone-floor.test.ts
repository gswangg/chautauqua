// Overview tier-2 tap-floor + overflow fix scan (task w8-g; DEC-393/DEC-989
// wave-90 amendment).
//
// Closes the tap-floor offenders and overflow offenders the wave-90 audit
// (docs/design/audit/tap-floor-v12.md) recorded for
// app/src/pages/overview/overview.css:
//   tap-floor:  .chq-overview-link-btn, .chq-overview-row-actions,
//               .chq-overview-row-actions-column,
//               .chq-overview-row-actions-inline, .chq-overview-section-action
//   overflow:   .chq-overview-btn, .chq-overview-section-action
//
// ORPHAN-CLASS FINDING (`.chq-overview-row-actions-stacked`, listed by the
// audit under a `(no CSS rule)` heading): grepping every *.tsx file under
// app/src (not just Overview.tsx -- the class could in principle live in a
// sibling component the page composes) finds ZERO occurrences of
// `row-actions-stacked` anywhere in markup. It survives ONLY as a code
// comment in overview.css itself (line ~305: "split from the old shared
// `.chq-overview-row-actions-stacked`"), documenting that DEC-735 already
// retired this class and replaced it with `.chq-overview-row-actions-inline`
// / `.chq-overview-row-actions-column`. So this is neither "dead markup"
// nor "a missing rule" -- the audit entry itself is STALE: the token is not
// live markup at all, and no CSS fix is owed for it. (`app/src/pages/
// overview/AgendaWorkSection.tsx` does render `.chq-overview-row-actions-
// column`, which this file's fixes DO cover.)
//
// The fix landed as ONE new `@media (max-width: 700px)` block appended at
// the true end of overview.css (never editing/reordering the blocks
// already there, per DEC-385 -- source order alone decides at equal
// specificity). This test parses the raw CSS text rather than rendering,
// matching the house idiom used by the *.scan.test.ts files this task's
// audit was produced from.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'overview.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');
const APP_SRC = join(HERE, '..', '..');

/** Every *.tsx file under app/src (DEC-808 idiom: enumerate, never a
 * hand-listed manifest). */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out;
}

/** Strips `/* … *\/` comments. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every top-level construct (a plain rule OR a whole `@media { ... }`
 * block, brace-matched, comments skipped) with its raw source span. */
function topLevelConstructs(css: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  let depth = 0;
  let constructStart = -1;
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (depth === 0 && constructStart === -1 && !/\s/.test(css[i] ?? '')) {
      constructStart = i;
    }
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0 && constructStart !== -1) {
        out.push({ start: constructStart, end: i + 1, text: css.slice(constructStart, i + 1) });
        constructStart = -1;
      }
    }
    i++;
  }
  return out;
}

/** True if `css`'s LAST top-level construct is an `@media` block, and
 * `marker` (which lives in the leading comment immediately above that
 * block's `{`, not inside its braces) appears in the span from the end of
 * the PREVIOUS top-level construct through the end of the last one -- i.e.
 * nothing else was appended after our fix block, and the marker comment is
 * the one immediately preceding it. */
function fixBlockIsLastConstruct(css: string, marker: string): boolean {
  const constructs = topLevelConstructs(css);
  if (constructs.length === 0) return false;
  const last = constructs[constructs.length - 1]!;
  if (!/^@media/.test(last.text.trim())) return false;
  const prevEnd = constructs.length >= 2 ? constructs[constructs.length - 2]!.end : 0;
  return css.slice(prevEnd, last.end).includes(marker);
}

/** Every `selector { body }` rule inside every `@media (max-width: <=700px)`
 * block in `css` (brace-matched; body is comment-stripped before return). */
function narrowMediaRules(css: string, maxN = 700): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(css)) !== null) {
    const width = Number(mm[1]);
    if (width > maxN) continue;
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    const block = stripComments(css.slice(bodyStart, i - 1));
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      out.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
    }
  }
  return out;
}

function selectorMentions(selector: string, token: string): boolean {
  return selector
    .split(',')
    .map((s) => s.trim())
    .some((s) => s === `.${token}` || s.endsWith(` .${token}`) || s.endsWith(`.${token}`));
}

/** All four floor properties present inside the phone-width block(s) for a
 * (possibly compound) selector, matched literally against the comma list. */
function hasFloorShapeForSelector(css: string, compoundSelector: string): boolean {
  const bodies = narrowMediaRules(css, 700)
    .filter((r) =>
      r.selector
        .split(',')
        .map((s) => s.trim())
        .includes(`.${compoundSelector}`),
    )
    .map((r) => r.body)
    .join(' ');
  return (
    /min-height\s*:\s*44px/.test(bodies) &&
    /display\s*:\s*flex/.test(bodies) &&
    /align-items\s*:\s*center/.test(bodies) &&
    /padding-inline\s*:\s*10px/.test(bodies) &&
    /margin-inline\s*:\s*-10px/.test(bodies)
  );
}

/** All four floor properties present for a bare (non-compound) token. */
function hasFloorShape(css: string, token: string): boolean {
  const bodies = narrowMediaRules(css, 700)
    .filter((r) => selectorMentions(r.selector, token))
    .map((r) => r.body)
    .join(' ');
  return (
    /min-height\s*:\s*44px/.test(bodies) &&
    /display\s*:\s*flex/.test(bodies) &&
    /align-items\s*:\s*center/.test(bodies) &&
    /padding-inline\s*:\s*10px/.test(bodies) &&
    /margin-inline\s*:\s*-10px/.test(bodies)
  );
}

/** All three overflow-escape properties present inside the phone-width
 * block(s) for a bare token. */
function hasOverflowEscape(css: string, token: string): boolean {
  const bodies = narrowMediaRules(css, 700)
    .filter((r) => selectorMentions(r.selector, token))
    .map((r) => r.body)
    .join(' ');
  return (
    /overflow\s*:\s*hidden/.test(bodies) &&
    /text-overflow\s*:\s*ellipsis/.test(bodies) &&
    /min-width\s*:\s*0/.test(bodies)
  );
}

const FIX_BLOCK_MARKER = 'Tier-2 tap-floor + overflow fixes (task w8-g';

describe('overview phone tap-floor + overflow fixes (task w8-g, DEC-393/DEC-989)', () => {
  it('appends its fix block as the true last top-level construct in the file (falsifiability control)', () => {
    expect(fixBlockIsLastConstruct(CSS, FIX_BLOCK_MARKER)).toBe(true);
    const badCss = `
      @media (max-width: 700px) {
        /* Tier-2 tap-floor + overflow fixes (task w8-g */
        .chq-x { min-height: 44px; }
      }
      .chq-appended-after { color: red; }
    `;
    expect(fixBlockIsLastConstruct(badCss, FIX_BLOCK_MARKER)).toBe(false);
  });

  it.each([
    'chq-overview-row-actions .chq-overview-btn',
    'chq-overview-row-actions-inline .chq-overview-btn',
    'chq-overview-row-actions-column .chq-overview-btn',
  ])('reaches the 44px tap-floor on the anchor inside %s', (compound) => {
    expect(hasFloorShapeForSelector(CSS, compound)).toBe(true);
  });

  it.each(['chq-overview-link-btn', 'chq-overview-section-action'])(
    'grows %s directly (it is itself the tappable control, not a container)',
    (token) => {
      expect(hasFloorShape(CSS, token)).toBe(true);
    },
  );

  it.each(['chq-overview-btn', 'chq-overview-section-action'])(
    'escapes overflow on %s',
    (token) => {
      expect(hasOverflowEscape(CSS, token)).toBe(true);
    },
  );

  it('does not flag a synthetic offender with only three of the four floor properties (falsifiability control)', () => {
    const badCss = `
      @media (max-width: 700px) {
        .chq-x-fake-row-actions .chq-overview-btn {
          min-height: 44px;
          display: flex;
          align-items: center;
        }
      }
    `;
    expect(hasFloorShapeForSelector(badCss, 'chq-x-fake-row-actions .chq-overview-btn')).toBe(false);
  });

  it('does not flag a synthetic nowrap rule missing one of the three escape properties (falsifiability control)', () => {
    const badCss = `
      @media (max-width: 700px) {
        .chq-x-fake-btn { overflow: hidden; text-overflow: ellipsis; }
      }
    `;
    expect(hasOverflowEscape(badCss, 'chq-x-fake-btn')).toBe(false);
  });

  it('`.chq-overview-row-actions-stacked` is not live markup anywhere under app/src (orphan-class finding: the audit entry is stale, DEC-735 already retired it)', () => {
    const tsxFiles = allTsxFiles(APP_SRC);
    expect(tsxFiles.length).toBeGreaterThan(5);
    const liveHits = tsxFiles.filter((p) => readFileSync(p, 'utf-8').includes('row-actions-stacked'));
    expect(liveHits).toEqual([]);
    // The name survives only as a historical comment in this sheet.
    expect(CSS).toContain('chq-overview-row-actions-stacked');
  });
});
