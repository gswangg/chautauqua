// DEC-989 (wave 42 amendment): gate-3 measured frame 02 at 1600px --
// body rules x=244->944 (700px), rail x=1036->1356 (320px), 92px gutter
// between them, the 1112px pair centred on the page. jsdom does not apply
// an external stylesheet's layout (see page-measure.test.ts / speakers-css
// .test.ts), so this reads the stylesheet's own text and asserts on the
// declarations directly rather than rendering + measuring computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'detail.css');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

describe('detail.css layout geometry (DEC-989, wave 42 amendment)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('splits the two columns 700px body / 320px rail with a 92px gutter (frame 02 measurement)', () => {
    const body = topLevelRuleBody(css, '.chq-detail-layout');
    expect(body).toMatch(/grid-template-columns:\s*700px\s+320px/);
    expect(body).toMatch(/gap:\s*92px/);
  });

  it('centres the 1112px (700 + 92 + 320) pair on the page', () => {
    const body = topLevelRuleBody(css, '.chq-detail-layout');
    expect(body).toMatch(/max-width:\s*1112px/);
    expect(body).toMatch(/margin:\s*0 auto/);
  });

  it('the Decision block carries no card chrome -- no border, radius, or panel fill', () => {
    const body = topLevelRuleBody(css, '.chq-detail-decision');
    expect(body).not.toMatch(/\bborder(-\w+)?:\s*1px/);
    expect(body).not.toMatch(/\bborder-radius:/);
    expect(body).not.toMatch(/background:\s*var\(--chq-surface-sunk\)/);
  });

  it('no rule for .chq-detail-decision-actions remains (the Clone action row is gone)', () => {
    expect(css).not.toMatch(/\.chq-detail-decision-actions\s*\{/);
  });
});
