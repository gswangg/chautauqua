// DEC-744/DEC-808: subscreens hugged the left edge of a 1372px desktop
// frame because each page hand-copied its own px max-width clamp (720px in
// forms.css, 660px in review.css, 760px in settings.css, ...) instead of
// sharing one measure with the token styles.css already defines for
// .chq-measure. The fix moves every single-column page-content clamp onto
// a single --chq-measure custom property so the whole product's reading
// column moves together; a page that carries an aside fills the frame and
// clamps nothing instead.
//
// A hand-listed manifest of "the pages that need checking" desyncs the
// moment someone adds a page (DEC-808), so this test ENUMERATES every CSS
// file under app/src via readdirSync rather than importing a fixed list.
// Mirroring the source-scan approach in shell-geometry.test.ts (jsdom does
// not evaluate an external stylesheet's layout), this test reads the CSS
// files' own text and asserts on the declarations directly.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    // node's recursive readdirent `parentPath` is the directory the entry
    // was found in; join with the file name for the full path.
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CSS_FILES = allCssFiles(HERE);

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
// (-page-content / -content), or a direct consumer of the shared token
// (-measure). Field grids, strips, and other in-column blocks are not page
// containers and are out of this scan's scope.
const CONTAINER_SELECTOR = /-(page|page-content|content|measure)$/;

// Modal widths are governed by the ONE dialog contract, not DEC-744/808.
function isModalSelector(selector: string): boolean {
  return /modal/i.test(selector);
}

describe('page measure (DEC-744/DEC-808)', () => {
  it('found more than one CSS file to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // every assertion below would vacuously pass.
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it('styles.css defines --chq-measure in the :root token block', () => {
    const stylesCss = readFileSync(join(HERE, 'styles.css'), 'utf-8');
    const rootBody = topLevelRuleBody(stylesCss, ':root');
    expect(rootBody).toMatch(/--chq-measure:\s*820px/);
  });

  it('.chq-measure consumes the --chq-measure var, not a hard-coded px', () => {
    const stylesCss = readFileSync(join(HERE, 'styles.css'), 'utf-8');
    const body = topLevelRuleBody(stylesCss, '.chq-measure');
    expect(body).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(body).not.toMatch(/max-width:\s*820px/);
  });

  it('every page/content container clamp uses var(--chq-measure), never a hard-coded px', () => {
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
        expect(pxMatch, `${label} selector "${selector}" hard-codes a max-width instead of var(--chq-measure)`).toBeNull();
        if (/max-width:/.test(body)) {
          expect(body, `${label} selector "${selector}" clamps but not with var(--chq-measure)`).toMatch(
            /max-width:\s*var\(--chq-measure\)/,
          );
        }
      }
    }
  });

  it('forms.css subscreen clamps reference var(--chq-measure)', () => {
    const css = readFileSync(join(HERE, 'pages/forms/forms.css'), 'utf-8');
    expect(topLevelRuleBody(css, '.chq-forms-content')).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(topLevelRuleBody(css, '.chq-forms-settings')).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  it('review.css subscreen clamps reference var(--chq-measure)', () => {
    const css = readFileSync(join(HERE, 'pages/review/review.css'), 'utf-8');
    expect(topLevelRuleBody(css, '.chq-review-editor-dates')).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(topLevelRuleBody(css, '.chq-review-summary-grid')).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  it('settings.css content column references var(--chq-measure)', () => {
    const css = readFileSync(join(HERE, 'pages/settings/settings.css'), 'utf-8');
    expect(topLevelRuleBody(css, '.chq-settings-content')).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  it('submission detail is an aside page and clamps nothing', () => {
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
});
