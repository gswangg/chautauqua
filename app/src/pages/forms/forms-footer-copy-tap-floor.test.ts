// v12m-w10-jj (DEC-393 wave-135 element-qualification amendment): the
// shared `.chq-btn` token floors height only. FormsPage.tsx (:435-437)
// renders the public-link Copy button as `<button className="chq-btn
// chq-btn-tertiary">{...'Copied!' : 'Copy'}</button>` inside
// `.chq-forms-fields-footer`; at 390 it measures 40x44 -- 4px short on
// width. This pins the fix: a phone-only min-width floor on
// `.chq-forms-fields-footer .chq-btn`, appended to the terminal
// `@media (max-width: 700px)` block after `label.chq-forms-strip-label`.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert';
import { DEC_393 } from '../../../../src/decisions';

void DEC_393; // shared token floored on height only is the named failure mode this rule closes

const HERE = __dirname;
const FORMS_CSS = readFileSync(join(HERE, 'forms.css'), 'utf8');
const FORMS_PAGE = readFileSync(join(HERE, 'FormsPage.tsx'), 'utf8');

function lastPhoneBlock(css: string): string {
  const blocks: string[] = [];
  const re = /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const captured = m[1];
    assert(captured !== undefined);
    blocks.push(captured);
  }
  expect(blocks.length, 'expected at least one phone block').toBeGreaterThan(0);
  const last = blocks[blocks.length - 1];
  assert(last !== undefined);
  return last;
}

const FORMS_PHONE_BLOCK = lastPhoneBlock(FORMS_CSS);

function lastRuleBody(block: string, selectorPattern: RegExp): string {
  const matches = [...block.matchAll(selectorPattern)];
  expect(matches.length, `expected at least one match for ${selectorPattern}`).toBeGreaterThan(0);
  const body = matches[matches.length - 1]![1];
  assert(body !== undefined);
  return body;
}

describe('forms.css public-link Copy button tap floor (v12m-w10-jj, DEC-393 wave-135)', () => {
  it('FormsPage.tsx renders the Copy control as a real <button class="chq-btn chq-btn-tertiary"> inside .chq-forms-fields-footer', () => {
    expect(FORMS_PAGE).toMatch(
      /<button type="button" className="chq-btn chq-btn-tertiary" onClick=\{\(\) => void handleCopyPublicLink\(\)\}>/,
    );
  });

  it('the label toggles between "Copy" and "Copied!" on the same element', () => {
    expect(FORMS_PAGE).toMatch(/linkCopyResult\?\.ok \? 'Copied!' : 'Copy'/);
  });

  it('.chq-forms-fields-footer .chq-btn is floored at min-width:44px with centred flex and horizontal padding in the terminal phone block', () => {
    const body = lastRuleBody(FORMS_PHONE_BLOCK, /\.chq-forms-fields-footer \.chq-btn\s*\{([^}]*)\}/g);
    expect(body).toMatch(/min-width:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/justify-content:\s*center/);
    const paddingMatch = body.match(/padding-inline:\s*(-?\d+)px/);
    expect(paddingMatch, 'padding-inline present').not.toBeNull();
    expect(Number(paddingMatch![1])).toBeGreaterThan(0);
  });

  it('the rule sits in the terminal phone block, after label.chq-forms-strip-label (DEC-385 terminal-block append order)', () => {
    const labelIdx = FORMS_PHONE_BLOCK.indexOf('label.chq-forms-strip-label');
    const footerIdx = FORMS_PHONE_BLOCK.indexOf('.chq-forms-fields-footer .chq-btn');
    expect(labelIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(labelIdx);
  });

  it('the desktop .chq-forms-fields-footer .chq-btn rule is untouched (no min-width there -- DEC-385 single-direction responsive)', () => {
    const desktopBody = FORMS_CSS.match(/\.chq-forms-fields-footer \.chq-btn \{([^}]*)\}/);
    expect(desktopBody).not.toBeNull();
    expect(desktopBody![1]).not.toMatch(/min-width/);
  });
});
