// DEC-393 wave-121 amendment (task w10-l): the companion-gap half of the
// cancelled-padding lens. DEVIATIONS.md:346-351's rider on the cancelled
// inline-padding idiom (padding-inline cancelled by an equal-and-opposite
// negative margin-inline, DEC-383 wave-109) reads: "wherever such a family
// renders as ADJACENT SIBLINGS, the rule owning their separation adds the
// cancelled padding back, or the rendered gap closes (this regressed the
// two-session identity cell on the roster grid before it was measured and
// fixed)". Nothing in the tree enforces that half of the ruling -- the
// sibling `comms-cancelled-padding.w5n.test.ts` only checks that the FACE
// (bordered vs borderless) is scoped correctly, never the gap on the row
// that hosts the cancelled subjects. This file is the instrument for the
// gap half.
//
// POPULATION (DEC-808, mirrors phone-horizontal-overflow.scan.test.ts): every
// `app/src/**/*.css` and `src/**/*.css.ts` rule -- comments stripped before
// parsing, both `/*...*/` and any brace hiding inside one neutralised first
// (a literal `{`/`}` inside a comment would desync brace-matching, exactly
// the anchor-floor.ts repair this file's task description points at) --
// declaring `padding-inline: Npx` together with `margin-inline: -Npx` for
// the SAME N (the cancelled-padding idiom itself).
//
// CONTAINER: for a comma-separated selector branch made of two or more
// combinator-joined compounds (space or `>`), the container is the branch's
// text with its LAST compound (and the combinator immediately before it)
// removed -- e.g. `.chq-settings-people-actions .chq-link-button` ->
// `.chq-settings-people-actions`, and `.chq-comms-blocked-list li
// .chq-link-button` -> `.chq-comms-blocked-list li` (the full prefix, not
// just the single compound nearest the key -- this is what lets a real
// declared rule for that exact prefix, e.g. `.chq-comms-blocked-list li`'s
// own `gap`, be found at all; stopping at a single bare compound would
// search for an `li` rule with no ancestor scope, which is not what "the
// rule owning their separation" means). A branch with only ONE compound (no
// combinator) has no container and is OUT OF POPULATION -- there is no
// adjacency for a lone bare-text subject to overlap.
//
// Design gap flagged for the planner: DEC-393's wave-121 amendment prose
// also names `.chq-content-worklist-col-actions` and
// `.chq-reviewer-plan-row-action` as containers declaring "no gap". Both are
// SINGLE-compound selectors in the actual CSS (the cancelled-padding pair is
// declared directly on the selector itself, with no descendant/child
// combinator anywhere in the rule) -- under the population rule as specified
// for this task ("a selector with no container compound is out of
// population"), neither is a member here. `.chq-content-worklist-col-actions`
// is an inert `<th>` spacer with no children (content.css's own comment);
// `.chq-reviewer-plan-row-action` sits in a CSS GRID cell, so its true
// separation is owned by the grid's own `gap`, a fact this selector-string
// lens cannot see. Narrowest reasonable reading taken: population is
// selector-derived, not identity-derived: this scan reports what a
// descendant/child selector's own text names as its container.
//
// EFFECTIVE PHONE GAP: last-wins in SOURCE-ORDER POSITION (interleaving
// top-level and narrow-media declarations exactly as they appear in the
// file -- not "all top-level, then all media") across every rule matching
// the container selector EXACTLY as one of its comma branches, considered
// only when top-level or inside an `@media (max-width: N)` with N<=700.
//
// OFFENDER: effective phone gap < 2*N (the ruling's own words, "adds the
// cancelled padding back" -- each of the two adjacent cancelled-padding
// subjects extends N past its own edge, so undoing that requires 2N of
// separation), or no gap declared anywhere reachable.
//
// Escape hatch (DEC-991 shape): SINGLE_TARGET_OK -- a container that can
// only ever hold ONE such target, so no sibling can ever overlap. Empty
// today; the tree's one genuinely conforming container
// (`.chq-contacts-rail-duplicate-actions`, gap 24px >= 2*10) does not need
// it, it already passes on the numbers.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_808, DEC_991 } from '../../src/decisions';

void DEC_393; // this scan's whole reason to exist: the wave-121 companion-gap amendment
void DEC_808; // population is enumerated (readdirSync), never a hand-listed manifest
void DEC_991; // SINGLE_TARGET_OK escape hatch shape: a named exemption the scan itself re-greps

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

/** Every file under `root` whose name ends with `extension`, enumerated rather than named (DEC-808). */
export function allFiles(root: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every `src/**\/*.ts` module whose source declares a CSS template-literal export, mirroring
 * phone-horizontal-overflow.scan.test.ts's `cssModuleFiles` (DEC-808: content-derived, never a
 * `.css.ts` filename-only convention). */
const CSS_EXPORT_RE = /export const [A-Z0-9_]*CSS\s*=\s*/;
export function cssModuleFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
    const absPath = join(entry.parentPath, entry.name);
    if (CSS_EXPORT_RE.test(readFileSync(absPath, 'utf-8'))) out.push(absPath);
  }
  return out.sort();
}

/** Extracts every backtick template-literal body out of a `*.css.ts` module and joins them,
 * stripping `${...}` interpolations (they name another module's own constant, scanned
 * separately as that file) -- deliberately simpler than phone-horizontal-overflow.scan.test.ts's
 * `extractCssTsLiteral` (no selector-position interpolation resolution): this scan's population
 * measured zero cancelled-padding rules under src/**\/*.css.ts, so a resolved-vs-stripped
 * selector never changes which rule is a population member here. */
export function extractCssTsLiteral(raw: string): string {
  const literals = [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
  return literals.join('\n').replace(/\$\{[^}]*\}/g, '');
}

/** Strips `/*...*\/` comments, neutralising any `{`/`}` INSIDE a comment first (without
 * changing length) so later brace-matching never desyncs on a comment's own literal braces --
 * the anchor-floor.ts repair this task's description points at (v12m-w9-k). */
export function stripComments(text: string): string {
  const sanitized = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[{}]/g, '·'));
  return sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
}

export interface ParsedRule {
  selector: string;
  body: string;
  start: number;
  /** max-width in px if this rule sits inside exactly one `@media (max-width: Npx)`
   * block, else null for a top-level rule. A rule inside a media query with no
   * `max-width` term (or a `min-width`-only / range query) is also null -- it is
   * never a "narrow" rule under this scan's predicate. */
  mediaMaxWidth: number | null;
}

/** Every `selector { body }` rule in `css` (comments already stripped), both top-level and
 * one level inside `@media (...)` blocks, tagged with its `mediaMaxWidth` and its character
 * `start` offset so top-level and media rules can be sorted back into true source order --
 * "last-wins in source order" requires the real interleaving, not "all top-level, then all
 * media" (DEC-385's terminal-block idiom means the media block is usually LAST, but a scan
 * that assumed that would silently mis-rank a file authored differently). */
export function parseAllRules(css: string): ParsedRule[] {
  const out: ParsedRule[] = [];
  const parseBlock = (text: string, offsetBase: number, mediaMaxWidth: number | null) => {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const selector = (m[1] ?? '').trim();
      const body = m[2] ?? '';
      if (!selector) continue;
      out.push({ selector, body, start: offsetBase + m.index, mediaMaxWidth });
    }
  };
  const mediaRe = /@media([^{]*)\{/g;
  let lastEnd = 0;
  let mm: RegExpExecArray | null;
  const topSegments: Array<{ text: string; offset: number }> = [];
  while ((mm = mediaRe.exec(css)) !== null) {
    const condStr = mm[1] ?? '';
    let depth = 1;
    let j = mm.index + mm[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(mm.index + mm[0].length, j - 1);
    topSegments.push({ text: css.slice(lastEnd, mm.index), offset: lastEnd });
    const mwMatch = condStr.match(/max-width:\s*(\d+)px/);
    const mw = mwMatch ? Number(mwMatch[1]) : null;
    parseBlock(body, mm.index + mm[0].length, mw);
    lastEnd = j;
    mediaRe.lastIndex = j;
  }
  topSegments.push({ text: css.slice(lastEnd), offset: lastEnd });
  for (const seg of topSegments) parseBlock(seg.text, seg.offset, null);
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Every distinct member `{ N, css }` -- one per file's stripped CSS text -- to scan. */
interface Source {
  label: string;
  css: string;
}

function loadSources(): Source[] {
  const appCssFiles = allFiles(HERE, '.css');
  const cssTsFiles = cssModuleFiles(SRC_ROOT);
  const sources: Source[] = [];
  for (const abs of appCssFiles) {
    sources.push({ label: relative(REPO_ROOT, abs), css: stripComments(readFileSync(abs, 'utf-8')) });
  }
  for (const abs of cssTsFiles) {
    const raw = readFileSync(abs, 'utf-8');
    sources.push({ label: relative(REPO_ROOT, abs), css: stripComments(extractCssTsLiteral(raw)) });
  }
  return sources;
}

export interface CancelledPaddingMember {
  file: string;
  selector: string;
  n: number;
}

/** Population: every rule (top-level or narrow-media, any depth) declaring
 * `padding-inline: Npx` cancelled by `margin-inline: -Npx` for the SAME N. */
export function findCancelledPaddingRules(label: string, css: string): CancelledPaddingMember[] {
  const rules = parseAllRules(css);
  const out: CancelledPaddingMember[] = [];
  for (const r of rules) {
    const pi = r.body.match(/padding-inline:\s*(-?\d+(?:\.\d+)?)px/);
    const mi = r.body.match(/margin-inline:\s*(-?\d+(?:\.\d+)?)px/);
    if (!pi || !mi) continue;
    const n = Number(pi[1]);
    const negN = Number(mi[1]);
    if (n <= 0 || negN !== -n) continue;
    out.push({ file: label, selector: r.selector, n });
  }
  return out;
}

/** Splits a selector into combinator-joined compounds (space or `>`). */
export function splitCompounds(branch: string): string[] {
  return branch
    .trim()
    .split(/\s*>\s*|\s+/)
    .filter(Boolean);
}

/** The container for one comma-separated selector branch: the branch's text with its last
 * compound (and the combinator immediately before it) removed. `null` if the branch is a
 * single bare compound (no container -- out of population). */
export function containerForBranch(branch: string): string | null {
  const compounds = splitCompounds(branch);
  if (compounds.length < 2) return null;
  const trimmed = branch.trim();
  const lastCompound = compounds[compounds.length - 1] as string;
  const idx = trimmed.lastIndexOf(lastCompound);
  return trimmed
    .slice(0, idx)
    .trim()
    .replace(/>\s*$/, '')
    .trim();
}

export interface ContainerRecord {
  file: string;
  container: string;
  n: number;
}

/** Every distinct `(file, container)` pair the population's selectors name, deduped, each
 * carrying the N its member(s) declared (all 24 live members declare N=10, so a container
 * with mixed N across members is a real ambiguity this records rather than silently picking
 * one -- `Set` of Ns is collapsed to its max, the STRICTER (larger) requirement, so a mixed
 * container is never under-checked). */
export function deriveContainers(members: CancelledPaddingMember[]): ContainerRecord[] {
  const byKey = new Map<string, { file: string; container: string; ns: Set<number> }>();
  for (const m of members) {
    for (const branch of m.selector.split(',')) {
      const container = containerForBranch(branch);
      if (container === null) continue;
      const key = `${m.file}::${container}`;
      const existing = byKey.get(key);
      if (existing) existing.ns.add(m.n);
      else byKey.set(key, { file: m.file, container, ns: new Set([m.n]) });
    }
  }
  return [...byKey.values()]
    .map(({ file, container, ns }) => ({ file, container, n: Math.max(...ns) }))
    .sort((a, b) => a.file.localeCompare(b.file) || a.container.localeCompare(b.container));
}

/** The effective phone `gap`/`column-gap` for `container` in `css`: last-wins in true
 * source-order position across every rule (top-level, or inside an `@media (max-width: N)`
 * with N<=700) whose selector names `container` as one of its exact comma branches. `undefined`
 * if no such declaration exists anywhere reachable. */
export function effectivePhoneGap(css: string, container: string): number | undefined {
  const rules = parseAllRules(css);
  let last: number | undefined;
  for (const r of rules) {
    if (r.mediaMaxWidth !== null && r.mediaMaxWidth > 700) continue;
    const branches = r.selector.split(',').map((s) => s.trim());
    if (!branches.includes(container)) continue;
    const matches = [...r.body.matchAll(/(?:^|[;{\s])(?:column-)?gap:\s*(-?\d+(?:\.\d+)?)px/g)];
    if (matches.length === 0) continue;
    last = Number((matches[matches.length - 1] as RegExpMatchArray)[1]);
  }
  return last;
}

/** DEC-991-shaped escape hatch: a container that can only ever hold ONE cancelled-padding
 * target, so no sibling can ever overlap. Each entry's `markupLiteral` must appear verbatim in
 * its `componentPath` (checked below) and its `containerClass` must still be a member of the
 * derived population (checked below) -- a stale entry is deleted, never left standing. Empty
 * today: the tree's one conforming container passes on the numbers alone. */
export const SINGLE_TARGET_OK: Array<[containerClass: string, componentPath: string, markupLiteral: string, reason: string]> = [
  [
    '.chq-settings-tokens-table tbody td:last-child',
    'app/src/pages/settings/ApiTokensPanel.tsx',
    '<button type="button" className="chq-link-button" onClick={() => setPendingDelete(t)}>',
    'the last <td> in each row renders exactly one .chq-link-button (Revoke) -- no sibling cancelled-padding target can ever share the cell, so a `gap` on it (which would do nothing on a non-flex <td> anyway) is not the fix this container needs',
  ],
];

export interface Offender {
  file: string;
  container: string;
  n: number;
  gap: number | undefined;
  required: number;
}

export function findOffenders(containers: ContainerRecord[], sources: Map<string, string>): Offender[] {
  const exemptClasses = new Set(SINGLE_TARGET_OK.map(([c]) => c));
  const out: Offender[] = [];
  for (const { file, container, n } of containers) {
    if (exemptClasses.has(container)) continue;
    const css = sources.get(file);
    if (css === undefined) throw new Error(`cancelled-padding-gap.scan: no loaded source for ${file}`);
    const gap = effectivePhoneGap(css, container);
    const required = 2 * n;
    if (gap === undefined || gap < required) {
      out.push({ file, container, n, gap, required });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.container.localeCompare(b.container));
}

// --- Ratchet -------------------------------------------------------------
// Two-sided (DEC-948 shape): offenders <= ceiling, AND the ceiling is never
// left stale above the measured truth. Seeded at THIS branch's own
// measurement -- 23 containers derived, 22 offenders, exactly one
// (`.chq-contacts-rail-duplicate-actions`, gap 24 >= 2*10) conforms.
// DEC-989 (wave-123 amendment): the lane that drains this ratchet lowers
// it to its own measured value -- lowered 17 -> 13 by task v12m-w12-n,
// COMMS cluster tier-2 sweep. All 4 comms.css members resolved: 3 gap
// values raised inside the phone media block (chq-comms-editor-actions
// 9->29, chq-comms-blocked-list li 8->28, chq-comms-recent-sends
// .chq-section-head NONE->40, all frame-own-gap + 2N per DEC-937), and
// chq-comms-send-detail's cancelled padding removed (display:contents,
// single-target, no adjacency to protect). Re-measured 2026-08-20.
//
//
// w12-p (2026-08-20): re-measured at 10, down from 17. speakers.css's
// `.chq-speakers-write-failure-actions`/`.chq-speakers-head-actions`/
// `.chq-speakers-pager-actions`/`.chq-speaker-detail-logistics-actions` and
// task-view.css's `.chq-taskview-actions` were widened to the frame's drawn
// gap plus 2*10 (9->29, 8->28) -- each holds an unpainted dead-`a`-selector
// cancelled-padding sibling (cancelled-padding-face.scan.test.ts's
// DEAD_ELEMENT_SELECTORS), so the idiom stays legal and only the
// separation needed restoring. settings.css's
// `.chq-settings-tokens-table tbody td:last-child` is cleared via the
// SINGLE_TARGET_OK escape hatch above (its `<td>` renders exactly one
// .chq-link-button, so no sibling can ever overlap and a `gap` on a
// non-flex cell would do nothing anyway). DEC-989: the lane that drains an
// offender set lowers the ceiling to its own measured value in the same
// commit; a merge-train re-measures the integrated tree afterward (the
// "merge-train act" framing above is superseded this wave, field guide
// wave-123).
//
// Thunderdome megabatch (wave 123): the lane lowerings above are independent
// drains of disjoint offender sets merged in one pass; the constant below is
// the re-measured truth of the integrated tree, not any single branch's
// figure. This ratchet may only fall.
export const CANCELLED_PADDING_GAP_CEILING = 6;

describe('cancelled-padding companion-gap lens (DEC-393 wave-121 amendment, task w10-l)', () => {
  const sourceList = loadSources();
  const sources = new Map(sourceList.map((s) => [s.label, s.css]));
  const members = sourceList.flatMap((s) => findCancelledPaddingRules(s.label, s.css));
  const containers = deriveContainers(members);
  const offenders = findOffenders(containers, sources);

  it('population is non-vacuous: at least one cancelled-padding member is found (positive control)', () => {
    expect(members.length).toBeGreaterThan(0);
  });

  it('at least one container is derived from the live population (positive control)', () => {
    expect(containers.length).toBeGreaterThan(0);
  });

  it('offenders sit at or under the ceiling', () => {
    expect(offenders.length).toBeLessThanOrEqual(CANCELLED_PADDING_GAP_CEILING);
  });

  it('the ceiling is not stale: it is not more than the measured offender count', () => {
    if (offenders.length < CANCELLED_PADDING_GAP_CEILING) {
      throw new Error(
        `cancelled-padding-gap.scan: CANCELLED_PADDING_GAP_CEILING (${CANCELLED_PADDING_GAP_CEILING}) exceeds the ` +
          `measured offender count (${offenders.length}). Lower it now (DEC-989 wave-123 protocol): the lane ` +
          `that drains offenders re-measures on its own branch (force this constant to -1, read the printed ` +
          `offender list) and writes its own branch's truth; the merge train re-measures the integrated tree ` +
          `and writes the combined truth. A stale ceiling left "for the merge train" is exactly the condition ` +
          `this ratchet's companion exists to forbid -- replace the line:\n` +
          `  export const CANCELLED_PADDING_GAP_CEILING = ${offenders.length};\n` +
          `Offenders:\n${offenders.map((o) => `  ${o.file} — ${o.container} (gap=${o.gap ?? 'NONE'}, required>=${o.required})`).join('\n')}`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(CANCELLED_PADDING_GAP_CEILING);
  });

  it('the known conforming container is not counted as an offender (negative control)', () => {
    const conforming = containers.find((c) => c.container === '.chq-contacts-rail-duplicate-actions');
    expect(conforming, 'expected .chq-contacts-rail-duplicate-actions to be a derived container').toBeDefined();
    expect(offenders.some((o) => o.container === '.chq-contacts-rail-duplicate-actions')).toBe(false);
  });

  it('every SINGLE_TARGET_OK entry still names a container in the derived population (staleness control)', () => {
    const containerKeys = new Set(containers.map((c) => c.container));
    for (const [containerClass] of SINGLE_TARGET_OK) {
      expect(containerKeys.has(containerClass), `${containerClass} is no longer a derived container -- delete this exemption`).toBe(true);
    }
  });

  it('every SINGLE_TARGET_OK markup literal appears verbatim in its named component file', () => {
    for (const [, componentPath, markupLiteral] of SINGLE_TARGET_OK) {
      const abs = join(REPO_ROOT, componentPath);
      const content = readFileSync(abs, 'utf-8');
      expect(content.includes(markupLiteral), `${componentPath} does not contain the literal "${markupLiteral}"`).toBe(true);
    }
  });

  describe('unit: containerForBranch', () => {
    it('a two-compound descendant branch strips its last compound', () => {
      expect(containerForBranch('.chq-settings-people-actions .chq-link-button')).toBe('.chq-settings-people-actions');
    });

    it('a child-combinator branch strips its last compound too', () => {
      expect(containerForBranch('.chq-comms-editor-actions > .chq-link-button')).toBe('.chq-comms-editor-actions');
    });

    it('a three-compound branch keeps the full prefix, not just the immediate compound', () => {
      expect(containerForBranch('.chq-comms-blocked-list li .chq-link-button')).toBe('.chq-comms-blocked-list li');
    });

    it('a single bare compound has no container (out of population)', () => {
      expect(containerForBranch('.chq-comms-send-report-all-history')).toBeNull();
    });
  });

  describe('unit: effectivePhoneGap', () => {
    it('reads a top-level gap when no narrow rule overrides it', () => {
      const css = '.chq-fixture-actions { display: flex; gap: 24px; }';
      expect(effectivePhoneGap(css, '.chq-fixture-actions')).toBe(24);
    });

    it('a later narrow (<=700) rule wins over an earlier top-level one (last-wins in source order)', () => {
      const css = [
        '.chq-fixture-actions { display: flex; gap: 24px; }',
        '@media (max-width: 700px) {',
        '  .chq-fixture-actions { gap: 8px; }',
        '}',
      ].join('\n');
      expect(effectivePhoneGap(css, '.chq-fixture-actions')).toBe(8);
    });

    it('a media query above 700px is not a narrow rule and is ignored', () => {
      const css = [
        '.chq-fixture-actions { display: flex; gap: 24px; }',
        '@media (max-width: 900px) {',
        '  .chq-fixture-actions { gap: 2px; }',
        '}',
      ].join('\n');
      expect(effectivePhoneGap(css, '.chq-fixture-actions')).toBe(24);
    });

    it('returns undefined when no gap is declared anywhere reachable', () => {
      const css = '.chq-fixture-actions { display: flex; }';
      expect(effectivePhoneGap(css, '.chq-fixture-actions')).toBeUndefined();
    });
  });

  describe('unit: findOffenders threshold (synthetic positive/negative controls)', () => {
    const fixtureSources = new Map([
      [
        'fixture.css',
        [
          '.chq-fixture-under { gap: 10px; }',
          '.chq-fixture-exact { gap: 20px; }',
          '.chq-fixture-none { display: flex; }',
        ].join('\n'),
      ],
    ]);

    it('a gap under 2N is an offender (positive control)', () => {
      const result = findOffenders([{ file: 'fixture.css', container: '.chq-fixture-under', n: 10 }], fixtureSources);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ container: '.chq-fixture-under', gap: 10, required: 20 });
    });

    it('a gap exactly at 2N conforms (negative control)', () => {
      const result = findOffenders([{ file: 'fixture.css', container: '.chq-fixture-exact', n: 10 }], fixtureSources);
      expect(result).toHaveLength(0);
    });

    it('no gap declared is an offender', () => {
      const result = findOffenders([{ file: 'fixture.css', container: '.chq-fixture-none', n: 10 }], fixtureSources);
      expect(result).toHaveLength(1);
      expect(result[0]?.gap).toBeUndefined();
    });
  });
});
