// DEC-744/DEC-808/DEC-989: subscreens hugged the left edge of a 1372px
// desktop frame because each page hand-copied its own px max-width clamp
// (720px in forms.css, 660px in review.css, 760px in settings.css, ...)
// instead of sharing one measure with the token styles.css defines. v6
// (DEC-989, docs/design/README.md "Widths -- three container classes")
// replaces the single --chq-measure clamp with three: reading (820,
// .chq-measure), reading+rail/wide (1180, .chq-measure-wide), table (1440,
// .chq-measure-table) -- plus the one canvas (Agenda) that clamps nothing.
//
// A hand-listed manifest of "the pages that need checking" desyncs the
// moment someone adds a page (DEC-808), so this test ENUMERATES every CSS
// file, and every page's own className="chq-page..." literal, via
// readdirSync rather than importing a fixed list. Mirroring the
// source-scan approach in shell-geometry.test.ts (jsdom does not evaluate
// an external stylesheet's layout), this test reads the CSS/TSX files' own
// text and asserts on the declarations directly.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES_ROOT = join(HERE, 'pages');

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allFiles(root: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
    // node's recursive readdirent `parentPath` is the directory the entry
    // was found in; join with the file name for the full path.
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CSS_FILES = allFiles(HERE, '.css');
const PAGE_TSX_FILES = allFiles(PAGES_ROOT, '.tsx');

/** Every top-level `selector { body }` rule, with @media blocks stripped. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

// A page/content container: a single-column subscreen clamp, by DEC-744's
// own vocabulary — the page shell itself (-page), its content column
// (-page-content / -content), or a direct consumer of one of the shared
// tokens (-measure / -measure-wide / -measure-table). Field grids, strips,
// and other in-column blocks are not page containers and are out of this
// scan's scope.
const CONTAINER_SELECTOR = /-(page|page-content|content|measure|measure-wide|measure-table)$/;

// Modal widths are governed by the ONE dialog contract, not DEC-744/808/989.
function isModalSelector(selector: string): boolean {
  return /modal/i.test(selector);
}

const MEASURE_VAR_RE = /var\(--chq-measure(-wide|-table)?\)/;

describe('page measure (DEC-744/DEC-808/DEC-989)', () => {
  it('found more than one CSS file to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // every assertion below would vacuously pass.
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it('found more than one page TSX file to scan', () => {
    expect(PAGE_TSX_FILES.length).toBeGreaterThan(5);
  });

  it('styles.css defines all three container tokens in the :root token block', () => {
    const stylesCss = readFileSync(join(HERE, 'styles.css'), 'utf-8');
    const rootBody = topLevelRuleBody(stylesCss, ':root');
    expect(rootBody).toMatch(/--chq-measure:\s*820px/);
    expect(rootBody).toMatch(/--chq-measure-wide:\s*1180px/);
    expect(rootBody).toMatch(/--chq-measure-table:\s*1440px/);
  });

  it('each .chq-measure* rule consumes its own var, not a hard-coded px', () => {
    const stylesCss = readFileSync(join(HERE, 'styles.css'), 'utf-8');

    const reading = topLevelRuleBody(stylesCss, '.chq-measure');
    expect(reading).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(reading).not.toMatch(/max-width:\s*\d+px/);

    const wide = topLevelRuleBody(stylesCss, '.chq-measure-wide');
    expect(wide).toMatch(/max-width:\s*var\(--chq-measure-wide\)/);
    expect(wide).not.toMatch(/max-width:\s*\d+px/);

    const table = topLevelRuleBody(stylesCss, '.chq-measure-table');
    expect(table).toMatch(/max-width:\s*var\(--chq-measure-table\)/);
    expect(table).not.toMatch(/max-width:\s*\d+px/);
  });

  it('every page/content container clamp uses one of the three chq-measure* vars, never a hard-coded px', () => {
    for (const path of CSS_FILES) {
      const css = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const { selector, body } of topLevelRules(css)) {
        if (isModalSelector(selector)) continue;
        // A comma-separated selector list can mix container and
        // non-container names; each individual selector is checked.
        const parts = selector.split(',').map((s) => s.trim());
        const isContainer = parts.some((s) => CONTAINER_SELECTOR.test(s));
        if (!isContainer) continue;
        const pxMatch = body.match(/max-width:\s*(\d+)px/);
        expect(pxMatch, `${label} selector "${selector}" hard-codes a max-width instead of a var(--chq-measure*)`).toBeNull();
        if (/max-width:/.test(body)) {
          expect(body, `${label} selector "${selector}" clamps but not with var(--chq-measure*)`).toMatch(MEASURE_VAR_RE);
        }
      }
    }
  });

  it('forms.css subscreen clamps reference var(--chq-measure)', () => {
    const css = readFileSync(join(HERE, 'pages/forms/forms.css'), 'utf-8');
    expect(topLevelRuleBody(css, '.chq-forms-content')).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(topLevelRuleBody(css, '.chq-forms-settings')).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  // `.chq-review-editor-dates` used to be spot-checked here too. It went dead
  // when the Review plan editor was rebuilt to the mock (DEC-706/DEC-709) --
  // no markup has carried the class since -- and the CSS contract's reverse
  // direction, invariant (D) in css-contract.scan.test.ts (DEC-970/DEC-976),
  // deleted the orphaned rule. Re-adding the rule to satisfy this assertion
  // would fail (D); the assertion was pinning dead CSS, so it is gone instead.
  // The enumerating scan above still covers every LIVE container clamp in
  // review.css, so nothing is left unguarded by dropping it.
  it('review.css subscreen clamps reference var(--chq-measure)', () => {
    const css = readFileSync(join(HERE, 'pages/review/review.css'), 'utf-8');
    expect(topLevelRuleBody(css, '.chq-review-summary-grid')).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  it('settings.css content column references var(--chq-measure) and the rail grid is the exact v6 three-track rule', () => {
    const css = readFileSync(join(HERE, 'pages/settings/settings.css'), 'utf-8');
    expect(topLevelRuleBody(css, '.chq-settings-content')).toMatch(/max-width:\s*var\(--chq-measure\)/);
    // DEC-989: the 820 content column stays centred ON THE PAGE, with the
    // rail hanging in the left margin -- not the two centred together as
    // one block. `justify-self:end` keeps the rail from stretching to
    // fill its track.
    const layoutBody = topLevelRuleBody(css, '.chq-settings-layout');
    expect(layoutBody).toMatch(/grid-template-columns:\s*minmax\(196px,\s*1fr\)\s*minmax\(0,\s*820px\)\s*minmax\(0,\s*1fr\)/);
    const railBody = topLevelRuleBody(css, '.chq-settings-rail');
    expect(railBody).toMatch(/justify-self:\s*end/);
  });

  it('.chq-detail-main itself carries no max-width (the page root now clamps at chq-measure-wide instead)', () => {
    const css = readFileSync(join(HERE, 'pages/submissions/detail.css'), 'utf-8');
    const mainBody = topLevelRuleBody(css, '.chq-detail-main');
    expect(mainBody).not.toMatch(/max-width/);
  });

  it('leaves the 52ch prose measure and modal widths untouched', () => {
    const reviewCss = readFileSync(join(HERE, 'pages/review/review.css'), 'utf-8');
    const formsCss = readFileSync(join(HERE, 'pages/forms/forms.css'), 'utf-8');
    expect(reviewCss).toMatch(/max-width:\s*52ch/);
    expect(formsCss).toMatch(/max-width:\s*520px/);
  });

  it('the speaker matrix and pipeline board scroll below their own table-measure minimum', () => {
    const speakersCss = readFileSync(join(HERE, 'pages/speakers/speakers.css'), 'utf-8');
    expect(topLevelRuleBody(speakersCss, '.chq-speakers-grid')).toMatch(/min-width:\s*1060px/);
    const contactsPanelsCss = readFileSync(join(HERE, 'pages/contacts/contacts-panels.css'), 'utf-8');
    expect(topLevelRuleBody(contactsPanelsCss, '.chq-contacts-pipeline-columns')).toMatch(/min-width:\s*1000px/);
  });

  // ENUMERATING scan (DEC-989): every page's own className="chq-page..."
  // literal is read straight off the TSX source text -- no hand-listed
  // manifest of "the pages that need a measure class" to desync the moment
  // someone adds a page. A literal carries the container class token
  // `chq-page` itself (not `chq-page-title`, `chq-page-content` etc, which
  // are different tokens that merely share the string prefix) and must
  // pair it with exactly one of the three measure classes.
  //
  // Two named exemptions, both load-bearing:
  //  - Agenda: the one canvas. Its column count is the event's room count,
  //    which genuinely buys width, so it clamps nothing (README "Only the
  //    agenda grid is a canvas").
  //  - Settings: the reading+rail page. Its width is governed entirely by
  //    `.chq-settings-layout`'s own three-track grid (STEP 3 above), which
  //    keeps the 820 content column centred on the page while the rail
  //    hangs in the left margin -- adding a chq-measure* class to the
  //    outer chq-page shell itself would double-clamp a width the grid
  //    already owns.
  // MergePage's prior exemption expired: DEC-992's merge rebuild landed and
  // MergePage.tsx now reads chq-measure like any other reading page (DEC-989,
  // DEC-985 -- an exclusion list is a promise about the thing's nature, never
  // a parking space, and its reason can expire).
  const NAMED_EXEMPTIONS = new Set(['Agenda.tsx', 'Settings.tsx']);

  // NAMED_EXEMPTIONS must never grow beyond these two STRUCTURAL exemptions:
  // Agenda is the one canvas (its width is bought by the event's room count,
  // not a reading measure); Settings' width is owned entirely by
  // .chq-settings-layout's three-track grid. Neither is a wave-scoped
  // scheduling note -- DEC-989, DEC-985.
  it('NAMED_EXEMPTIONS is exactly the two structural exemptions, never a parking space', () => {
    expect(NAMED_EXEMPTIONS).toEqual(new Set(['Agenda.tsx', 'Settings.tsx']));
  });

  it('every page root className="chq-page" literal carries exactly one measure class', () => {
    const MEASURE_CLASSES = ['chq-measure-wide', 'chq-measure-table', 'chq-measure'];
    let checkedAtLeastOne = false;

    for (const path of PAGE_TSX_FILES) {
      const label = relative(PAGES_ROOT, path);
      const fileName = path.split('/').pop() ?? '';
      const content = readFileSync(path, 'utf-8');
      const classNameLiterals = content.match(/className="chq-page[^"]*"/g) ?? [];

      for (const literal of classNameLiterals) {
        const tokens = literal.slice('className="'.length, -1).split(/\s+/);
        // Only literals carrying the exact `chq-page` token are page-root
        // containers; `chq-page-title`, `chq-page-content` etc are a
        // different class that merely shares the string prefix.
        if (!tokens.includes('chq-page')) continue;
        checkedAtLeastOne = true;

        if (NAMED_EXEMPTIONS.has(fileName)) {
          const measureTokensPresent = MEASURE_CLASSES.filter((c) => tokens.includes(c));
          expect(measureTokensPresent, `${label} literal "${literal}" is a named canvas/rail exemption and must not carry a measure class`).toHaveLength(0);
          continue;
        }

        const measureTokensPresent = MEASURE_CLASSES.filter((c) => tokens.includes(c));
        expect(measureTokensPresent, `${label} literal "${literal}" must carry exactly one of ${MEASURE_CLASSES.join('/')}`).toHaveLength(1);
      }
    }

    expect(checkedAtLeastOne).toBe(true);
  });

  it('SubmissionDetailPage is capped at chq-measure-wide (README "Changed since the previous handoff" #7)', () => {
    const content = readFileSync(join(PAGES_ROOT, 'submissions/SubmissionDetailPage.tsx'), 'utf-8');
    const literals = content.match(/className="chq-page[^"]*"/g) ?? [];
    expect(literals.length).toBeGreaterThan(0);
    for (const literal of literals) {
      expect(literal).toContain('chq-measure-wide');
    }
  });

  it('table-class pages (submissions, contacts, content, speakers, comms, review results/plans) carry chq-measure-table', () => {
    const tablePages = [
      'submissions/SubmissionsTable.tsx',
      'contacts/ContactsApp.tsx',
      'content/ContentApp.tsx',
      'speakers/OnboardingGrid.tsx',
      'Comms.tsx',
      'review/ResultsTable.tsx',
      'review/PlanList.tsx',
    ];
    for (const rel of tablePages) {
      const content = readFileSync(join(PAGES_ROOT, rel), 'utf-8');
      const literals = content.match(/className="chq-page[^"]*"/g) ?? [];
      const rootLiterals = literals.filter((l) => l.slice('className="'.length, -1).split(/\s+/).includes('chq-page'));
      expect(rootLiterals.length, `${rel} should define at least one chq-page root`).toBeGreaterThan(0);
      for (const literal of rootLiterals) {
        expect(literal, `${rel} literal "${literal}"`).toContain('chq-measure-table');
      }
    }
  });

  it('Agenda carries no measure class (the one canvas)', () => {
    const content = readFileSync(join(PAGES_ROOT, 'Agenda.tsx'), 'utf-8');
    const literals = content.match(/className="chq-page[^"]*"/g) ?? [];
    expect(literals.length).toBeGreaterThan(0);
    for (const literal of literals) {
      expect(literal).not.toMatch(/chq-measure/);
    }
  });
});
