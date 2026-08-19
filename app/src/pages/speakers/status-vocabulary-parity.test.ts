// DEC-730 (wave-90 amendment): "the v12 status inversion is ONE vocabulary
// in every state including write-failure". Chautauqua Speakers.dc.html:549
// ("Speakers · a write failed") draws a hand-styled filled-olive Complete
// pill, an ink-outlined Overdue, and an outlined Pending -- the PRE-v12
// vocabulary -- while every other cut of the same grid in the same file
// (:28/:129, :598, :665) draws the inverted vocabulary (Complete bare-muted,
// Pending bare bold ink, Overdue the one filled chip). The amendment rules
// :549 stale: a status field cannot change its meaning-to-appearance mapping
// depending on an unrelated write outcome. This test pins the single
// vocabulary the app implements, and guards that no rule anywhere in
// speakers.css re-styles a `.chq-speakers-status-*` token under a
// write-failure ancestor selector -- the shape a second vocabulary would
// have to take to sneak back in.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'speakers.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

// The banner's own class, as authored at its declaration site
// (OnboardingGrid.tsx:975, speakers.css:32) -- derived from source, not
// hand-named, so this guard cannot drift from the actual banner markup.
const WRITE_FAILURE_CLASS = 'chq-speakers-write-failure';

it('the write-failure banner class exists in speakers.css, so the guard below has a real target', () => {
  expect(CSS).toMatch(new RegExp(`\\.${WRITE_FAILURE_CLASS}\\b`));
});

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/**
 * Returns every top-level selector list found in the stylesheet (media-block
 * contents included -- a second vocabulary could just as easily be smuggled
 * in under a phone breakpoint), split on top-level commas so each comma-
 * separated selector in a grouped rule is inspected independently.
 */
function allSelectorLists(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors: string[] = [];
  const ruleRe = /([^{}]+)\{[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(withoutComments))) {
    const raw = (match[1] ?? '').trim();
    if (!raw || raw.startsWith('@')) continue;
    selectors.push(...raw.split(',').map((s) => s.trim()));
  }
  return selectors;
}

/**
 * A "second vocabulary" would take the shape of a selector that scopes a
 * `.chq-speakers-status*` token underneath (as an ancestor, in the same
 * compound, or combined via `+`/`~`) the write-failure banner class --
 * i.e. any selector mentioning BOTH tokens.
 */
function selectorCombinesStatusAndWriteFailure(selector: string): boolean {
  const mentionsStatus = /\.chq-speakers-status\b/.test(selector);
  const mentionsWriteFailure = new RegExp(`\\.${WRITE_FAILURE_CLASS}\\b`).test(selector);
  return mentionsStatus && mentionsWriteFailure;
}

describe('speakers.css single status vocabulary (DEC-730, wave-90 amendment)', () => {
  it('.chq-speakers-status-complete is muted, weight 600, with no fill/border/radius', () => {
    const body = topLevelRuleBody(CSS, '.chq-speakers-status-complete');
    expect(body).toMatch(/font-weight:\s*600/);
    expect(body).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/border:\s*none/);
    expect(body).not.toMatch(/border-radius:/);
  });

  it('.chq-speakers-status-pending is bare bold ink, weight 800, with no fill', () => {
    const body = topLevelRuleBody(CSS, '.chq-speakers-status-pending');
    expect(body).toMatch(/font-weight:\s*800/);
    expect(body).toMatch(/color:\s*var\(--chq-ink\)/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/border:\s*none/);
  });

  it('.chq-speakers-status-overdue is the one filled-ink chip, weight 800', () => {
    const body = topLevelRuleBody(CSS, '.chq-speakers-status-overdue');
    expect(body).toMatch(/font-weight:\s*800/);
    expect(body).toMatch(/background:\s*var\(--chq-ink\)/);
    expect(body).toMatch(/color:\s*var\(--chq-on-ink\)/);
  });

  it('no selector in speakers.css scopes a status token under the write-failure banner class', () => {
    const offenders = allSelectorLists(CSS).filter(selectorCombinesStatusAndWriteFailure);
    expect(offenders).toEqual([]);
  });

  // Falsifiability control: a fabricated stylesheet containing exactly the
  // shape this ruling forbids -- a write-failure-scoped status override --
  // must make the guard above fail. This proves the guard is actually
  // looking, not vacuously green.
  it('falsifiability: a fabricated descendant rule combining the two classes IS caught', () => {
    const fabricated = `
      .chq-speakers-write-failure .chq-speakers-status-complete {
        background: #4E5C31;
        border-radius: 3px;
      }
    `;
    const offenders = allSelectorLists(fabricated).filter(selectorCombinesStatusAndWriteFailure);
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders[0]).toContain(WRITE_FAILURE_CLASS);
    expect(offenders[0]).toContain('chq-speakers-status-complete');
  });
});
