// DEC-576: the phone tab bar used to be position:fixed with .chq-main
// compensating via a guessed 84px of bottom padding, which clipped content
// on any page that scrolls its own region or ends in a control (Settings
// sections, Content files pagination, Submissions detail, form builder).
// The fix: .chq-shell is a flex column, header + .chq-tabbar are in-flow
// flex-shrink:0 regions, and .chq-main is the ONLY scrolling region
// (flex:1; min-height:0; overflow-y:auto). jsdom does not evaluate @media
// rules or apply an external stylesheet's layout, so — mirroring this
// project's existing source-scan approach (app/src/lib/
// date-helpers-single-home.test.ts) — this test reads styles.css's own
// text and asserts on the declarations directly rather than on computed
// style, which would silently pass regardless of what the file says.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'styles.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  // Strip every @media {...} block first so a nested override of the same
  // selector doesn't get picked up as the top-level rule.
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

describe('shell geometry (DEC-576)', () => {
  it('.chq-shell is a flex column filling the viewport height', () => {
    const body = topLevelRuleBody(CSS, '.chq-shell');
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-direction:\s*column/);
    expect(body).toMatch(/height:\s*100%/);
  });

  it('.chq-header and .chq-tabbar are in-flow flex-shrink:0 regions', () => {
    const headerBody = topLevelRuleBody(CSS, '.chq-header');
    expect(headerBody).toMatch(/flex-shrink:\s*0/);
    expect(headerBody).not.toMatch(/position:\s*fixed/);

    const tabbarBody = topLevelRuleBody(CSS, '.chq-tabbar');
    expect(tabbarBody).toMatch(/flex-shrink:\s*0/);
    expect(tabbarBody).not.toMatch(/position:\s*fixed/);
  });

  it('.chq-tabbar is never position:fixed, anywhere in the file (including @media blocks)', () => {
    const tabbarRules = CSS.match(/\.chq-tabbar\s*\{[^}]*\}/g) ?? [];
    expect(tabbarRules.length).toBeGreaterThan(0);
    for (const rule of tabbarRules) {
      expect(rule).not.toMatch(/position:\s*fixed/);
    }
  });

  it('.chq-main is the flex:1/min-height:0/overflow-y:auto scroll container, with no guessed bottom-padding compensation', () => {
    const mainBody = topLevelRuleBody(CSS, '.chq-main');
    expect(mainBody).toMatch(/flex:\s*1/);
    expect(mainBody).toMatch(/min-height:\s*0/);
    expect(mainBody).toMatch(/overflow-y:\s*auto/);

    // No rule anywhere (including the @700px block) pads .chq-main's
    // bottom by 84px to clear a fixed bar that no longer exists.
    expect(CSS).not.toMatch(/84px/);
  });
});
