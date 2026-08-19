// v12m-w14-c: `.chq-phone-dock` had NO top-level rule (its only
// declaration lived inside styles.css's `@media (max-width: 700px)` block),
// so above that width it fell back to its element default instead of
// staying hidden — ReviewerQueue.tsx's back-linked drill-in and
// RosterPanel.tsx both mount it as a bare direct child of desktop-visible
// markup, leaking "Scores stay hidden from other reviewers" plus a live
// Sign out band onto frozen desktop. This is a source-scan (jsdom does not
// evaluate @media rules), mirroring phone-block-visibility.test.ts and
// shell-geometry.test.ts's own comment-strip/brace-match helpers.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_PATH = join(HERE, 'styles.css');
const REVIEWER_QUEUE_PATH = join(HERE, 'pages', 'review', 'ReviewerQueue.tsx');

const STYLES_CSS = readFileSync(STYLES_PATH, 'utf-8');
const REVIEWER_QUEUE_TSX = readFileSync(REVIEWER_QUEUE_PATH, 'utf-8');

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every top-level @media {...} block (one level of nested braces
 * inside @media), same helper as phone-block-visibility.test.ts. */
function stripMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
}

/** All declaration bodies of rules whose selector text is immediately
 * followed by `{`, outside any @media block. Empty array means the
 * selector has no top-level rule at all. */
function topLevelRuleBodies(withoutMediaCss: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g');
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMediaCss))) {
    const body = m[1];
    if (body !== undefined) bodies.push(body);
  }
  return bodies;
}

const STYLES_NO_COMMENTS = stripComments(STYLES_CSS);
const STYLES_WITHOUT_MEDIA = stripMedia(STYLES_NO_COMMENTS);

describe('.chq-phone-dock is hidden at desktop (v12m-w14-c)', () => {
  it('has a top-level rule (outside any @media block) in styles.css', () => {
    const bodies = topLevelRuleBodies(STYLES_WITHOUT_MEDIA, '.chq-phone-dock');
    expect(
      bodies.length,
      '.chq-phone-dock has no top-level rule in styles.css -- it renders at its element ' +
        'default (visible) above the max-width:700px breakpoint',
    ).toBeGreaterThan(0);
  });

  it('that top-level rule declares display: none and no other display value', () => {
    const bodies = topLevelRuleBodies(STYLES_WITHOUT_MEDIA, '.chq-phone-dock');
    const combined = bodies.join('\n');
    const displayDeclarations = combined.match(/display:\s*[^;]+/g) ?? [];
    expect(displayDeclarations.length).toBeGreaterThan(0);
    for (const decl of displayDeclarations) {
      expect(decl.trim()).toMatch(/^display:\s*none$/);
    }
  });
});

describe('exactly one Sign out on the reviewer drill-in at 390 (v12m-w14-c)', () => {
  it('the shell carve-out that un-hides .chq-user-identity carries the :not(:has([data-chq-phone-signout])) clause', () => {
    expect(STYLES_CSS).toMatch(
      /\.chq-shell:not\(:has\(\.chq-tabbar\)\):not\(:has\(\[data-chq-phone-signout\]\)\)\s+\.chq-header-identity\s+\.chq-user-identity\s*\{/,
    );
  });

  it("ReviewerQueue's back-linked drill-in page root carries data-chq-phone-signout", () => {
    expect(REVIEWER_QUEUE_TSX).toMatch(
      /<div className="chq-page chq-review-page chq-measure" data-chq-phone-signout="true">/,
    );
  });

  it('the hub (plan-list) page root does NOT carry data-chq-phone-signout -- it keeps the shell\'s one control', () => {
    // The hub's own root: `<div className="chq-page chq-review-page chq-measure">`
    // with no attribute -- must appear at least once verbatim (bare, no
    // data-chq-phone-signout) so the hub is left alone per DEC-874 wave-86.
    expect(REVIEWER_QUEUE_TSX).toMatch(/<div className="chq-page chq-review-page chq-measure">/);
  });
});
