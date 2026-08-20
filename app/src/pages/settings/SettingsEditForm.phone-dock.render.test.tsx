// w19-b (DEC-576): the second missing dock in the pack -- the shared
// Settings edit-view footer (SettingsEditForm.tsx, all seven panels' own
// `footer` slots) docks at 390. Frame authority: docs/design/Chautauqua
// Settings.dc.html:334-336 draws the band
// `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF;
// padding:12px 16px 16px; display:flex; gap:8px`, holding "Save"
// (`flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px;
// min-height:46px; display:flex; align-items:center; justify-content:center;
// font-size:14px; font-weight:700`) and "Cancel" (`border:1px solid
// #BAB6A6; border-radius:6px; min-height:46px; display:flex;
// align-items:center; padding:0 16px; font-size:13px; font-weight:600`).
// 46px, not the Speakers scaffold's 48px -- DESIGN-RULINGS.md:B10 rules
// the desktop footer frozen as a right-flushed row, which the CSS half of
// this file never touches (jsdom does not evaluate @media, so the CSS half
// is a source-scan of settings.css's own text, mirroring
// comms.css/shell-geometry.test.ts's established idiom; the JS half
// asserts the rendered markup carries the dock's contract attribute).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SettingsEditForm } from './SettingsEditForm';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'settings.css'), 'utf-8');

/** The concatenated bodies of every `@media (max-width: 700px)` block in
 * `css`, brace-matched. Mirrors comms.css's phoneBlocks helper /
 * phone-dock-declares.scan.test.ts's extractPhoneMediaBodies. */
function phoneBlocks(css: string): string {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  const mediaRe = /@media[^{]*max-width:\s*700px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(stripped)) !== null) {
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < stripped.length && depth > 0; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') depth--;
    }
    out.push(stripped.slice(bodyStart, i - 1));
  }
  return out.join('\n');
}

/** A selector's declaration body inside the phone blocks (there may be more
 * than one rule for the same selector across the file; this returns all of
 * them concatenated so assertions can check either). */
function phoneRuleBodies(css: string, selector: string): string {
  const phone = phoneBlocks(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g');
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(phone)) !== null) out += `${m[1]}\n`;
  if (out === '') throw new Error(`no phone-width rule found for ${selector}`);
  return out;
}

afterEach(() => {
  cleanup();
});

describe('SettingsEditForm phone footer dock (DEC-576, frame Chautauqua Settings.dc.html:334-336)', () => {
  it('docks the footer band: sticky/bottom:0, the frame\'s full-bleed border-top + background + padding + gap', () => {
    const body = phoneRuleBodies(CSS, '.chq-settings-edit-footer');
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/bottom:\s*0/);
    // Frame: `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px`
    expect(body).toMatch(/flex-shrink:\s*0/);
    expect(body).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);
    expect(body).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(body).toMatch(/padding:\s*12px 16px 16px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/gap:\s*8px/);
  });

  it('the primary slot takes flex:1, matching the frame\'s "Save" span (`flex:1; ...`)', () => {
    const wrapperBody = phoneRuleBodies(CSS, '.chq-settings-edit-footer-primary');
    expect(wrapperBody).toMatch(/flex:\s*1/);
  });

  it('both slot buttons clear 44px (46px, per the frame) with real horizontal padding and centred flex', () => {
    const body = phoneRuleBodies(CSS, '.chq-settings-edit-footer .chq-btn');
    // Frame Save: `min-height:46px; display:flex; align-items:center; justify-content:center`.
    // Frame Cancel: `min-height:46px; display:flex; align-items:center; padding:0 16px`.
    expect(body).toMatch(/min-height:\s*46px/);
    const minHeight = Number(/min-height:\s*(\d+)px/.exec(body)?.[1]);
    expect(minHeight).toBeGreaterThanOrEqual(44);
    expect(body).toMatch(/padding:\s*0 16px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
  });

  it('renders with data-chq-phone-dock so the dock-declares scan and the tab-bar suppression selector both reach it', () => {
    const { container } = render(
      <SettingsEditForm onSubmit={(e) => e.preventDefault()} footer={{ primary: <button type="button">Save changes</button> }}>
        <div>field</div>
      </SettingsEditForm>,
    );
    const footer = container.querySelector('.chq-settings-edit-footer');
    expect(footer).not.toBeNull();
    expect(footer).toHaveAttribute('data-chq-phone-dock');
  });

  it('desktop stays frozen: no top-level (non-media) rule turns the footer into a full-width bar', () => {
    // DESIGN-RULINGS.md:B10 -- the desktop footer is a right-flushed ROW,
    // never a full-width olive bar with a centred Cancel beneath. The
    // top-level (outside any @media) rule must still read justify-
    // content:flex-end, not the phone override's flex layout intent.
    const withoutMedia = CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const match = withoutMedia.match(/\.chq-settings-edit-footer\s*\{([^}]*)\}/);
    const body = match?.[1];
    if (body === undefined) throw new Error('no top-level rule found for .chq-settings-edit-footer');
    expect(body).toMatch(/justify-content:\s*flex-end/);
    expect(body).not.toMatch(/position:\s*sticky/);
  });
});
