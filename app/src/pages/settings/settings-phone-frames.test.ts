// Settings at 390 (I), task w3-e / DEC-032 (wave-85 amendment), DEC-385
// (single-direction responsive: narrow overrides wide via max-width media
// queries ONLY). Source-scans the phone layer of settings.css against the
// three frames this task owns:
//   - Settings landing:      docs/design/Chautauqua Settings.dc.html :275-312
//   - Tracks and rooms drill: docs/design/Chautauqua Settings.dc.html :347-389
//   - Your data drill:        docs/design/Chautauqua Settings.dc.html :393-440
//
// One strict citation per describe: a body line (never the label line)
// inside the frame's span, immediately followed by that line's verbatim
// backticked literal, each with an assertion pinning it.
//
// Named .test.ts, not .test.tsx -- vitest.config.ts's include globs only
// pick up app/src/**/*.test.ts and app/src/**/*.render.test.tsx; a
// app/src/**/*.test.tsx sibling would silently never run.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_PATH = resolve(__dirname, 'settings.css');
const css = readFileSync(CSS_PATH, 'utf8');

// The phone layer is the file's one terminal `@media (max-width: 700px)`
// block (this task moved every max-width block to the end of the file and
// consolidated them into one, so a later append -- e.g. w3-f -- lands
// inside the SAME block rather than reopening a second one).
function phoneLayer(): string {
  const mediaBlocks = [...css.matchAll(/@media \(max-width: 700px\) \{/g)];
  expect(mediaBlocks).toHaveLength(1);
  const start = mediaBlocks[0]!.index! + mediaBlocks[0]![0].length;
  let depth = 1;
  let i = start;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

// Pulls the declaration body of one top-level rule out of a media-block's
// text (first match only -- every selector this test reads is declared
// once inside the phone layer).
function rule(layer: string, selector: string): string {
  const escaped = selector.replace(/[.[\]'=]/g, (c) => `\\${c}`);
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = layer.match(re);
  expect(match, `expected to find rule ${selector} in the phone layer`).not.toBeNull();
  return match![1]!;
}

describe('settings.css has exactly one terminal phone media block (DEC-385)', () => {
  it('every max-width block in the file was consolidated into one', () => {
    const mediaBlocks = [...css.matchAll(/@media \(max-width: 700px\) \{/g)];
    expect(mediaBlocks).toHaveLength(1);
  });

  it('has no min-width media query anywhere (DEC-385 single-direction responsive)', () => {
    // min-width:0 (a flex/grid shrink escape hatch) is unrelated and legal;
    // only an `@media (min-width: ...)` query would violate DEC-385.
    expect(css).not.toMatch(/@media[^{]*min-width/);
  });
});

describe('Settings landing: one-column list of panel groups (docs/design/Chautauqua Settings.dc.html:275-312)', () => {
  const layer = phoneLayer();

  it('docs/design/Chautauqua Settings.dc.html:286 `<div style="padding:18px 0; border-bottom:1px solid #E1DDCE; display:flex; flex-direction:column; gap:9px">`', () => {
    const linkRule = rule(layer, '.chq-settings-rail-link');
    expect(linkRule).toMatch(/padding:\s*18px 0/);
    expect(linkRule).toMatch(/border-bottom:\s*1px solid var\(--chq-hairline\)/);
    expect(linkRule).toMatch(/display:\s*flex/);
    expect(linkRule).toMatch(/flex-direction:\s*column/);
  });

  it('docs/design/Chautauqua Settings.dc.html:288 `<span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ g.label }}</span>`', () => {
    const labelRule = rule(layer, '.chq-settings-rail-link-label');
    expect(labelRule).toMatch(/font-size:\s*16px/);
    expect(labelRule).toMatch(/font-weight:\s*600/);
    expect(labelRule).toMatch(/letter-spacing:\s*-0\.015em/);
  });

  it('docs/design/Chautauqua Settings.dc.html:289 `<span style="font-size:13px; font-weight:700; color:#4E5C31">Open</span>`', () => {
    const openRule = rule(layer, '.chq-settings-rail-link-open');
    expect(openRule).toMatch(/font-size:\s*13px/);
    expect(openRule).toMatch(/font-weight:\s*700/);
    expect(openRule).toMatch(/color:\s*var\(--chq-brand\)/);
    // --chq-brand is #4e5c31 (app/src/styles.css) -- the frame's #4E5C31.
  });

  it('docs/design/Chautauqua Settings.dc.html:291 `<span style="font-size:13px; color:#565A4B; line-height:1.5">{{ g.detail }}</span>`', () => {
    const detailRule = rule(layer, '.chq-settings-rail-link-detail');
    expect(detailRule).toMatch(/font-size:\s*13px/);
    expect(detailRule).toMatch(/color:\s*var\(--chq-ink-2\)/);
    expect(detailRule).toMatch(/line-height:\s*1\.5/);
  });

  it('docs/design/Chautauqua Settings.dc.html:295 `<span style="font-size:13px; color:#565A4B; line-height:1.5">Embed codes are easier to copy on a laptop</span>`', () => {
    const noteRule = rule(layer, '.chq-settings-rail-note');
    expect(noteRule).toMatch(/font-size:\s*13px/);
    expect(noteRule).toMatch(/color:\s*var\(--chq-ink-2\)/);
    expect(noteRule).toMatch(/line-height:\s*1\.5/);
    // The frame draws this as plain text, never the disabled token (which
    // has exactly two legal uses: inert control, drag handle -- neither
    // applies here). Confirm the component renders it as a <p>, not a
    // button/link/anything with a disabled affordance.
    const settingsTsx = readFileSync(resolve(__dirname, '../Settings.tsx'), 'utf8');
    expect(settingsTsx).toMatch(/<p className="chq-settings-rail-note">Embed codes are easier to copy on a laptop<\/p>/);
  });

  it('the desktop rail hides the phone-only Open/detail/note furniture by default (DEC-385 narrow overrides wide)', () => {
    const desktopHide = css.match(/\.chq-settings-rail-link-open,\s*\n\s*\.chq-settings-rail-link-detail,\s*\n\s*\.chq-settings-rail-note\s*\{([^}]*)\}/);
    expect(desktopHide, 'expected a top-level (desktop) display:none rule for the phone-only landing furniture').not.toBeNull();
    expect(desktopHide![1]).toMatch(/display:\s*none/);
  });
});

describe('Tracks and rooms drill (docs/design/Chautauqua Settings.dc.html:347-389)', () => {
  const layer = phoneLayer();

  it('docs/design/Chautauqua Settings.dc.html:349 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>`', () => {
    const backRule = rule(layer, "[data-drilled='true'] .chq-settings-back");
    expect(backRule).toMatch(/display:\s*inline-flex/);
    expect(backRule).toMatch(/min-height:\s*44px/);
    expect(backRule).toMatch(/align-items:\s*center/);
  });

  it('docs/design/Chautauqua Settings.dc.html:350 `<h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Tracks and rooms</h1>`', () => {
    const titleRule = rule(layer, "[data-drilled='true'] .chq-page-title");
    expect(titleRule).toMatch(/font-size:\s*26px/);
    expect(titleRule).toMatch(/font-weight:\s*700/);
    expect(titleRule).toMatch(/letter-spacing:\s*-0\.04em/);
    expect(titleRule).toMatch(/line-height:\s*1\b/);
  });
});

describe('Your data drill (docs/design/Chautauqua Settings.dc.html:393-440)', () => {
  const layer = phoneLayer();

  it('docs/design/Chautauqua Settings.dc.html:395 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>`', () => {
    const backRule = rule(layer, "[data-drilled='true'] .chq-settings-back");
    expect(backRule).toMatch(/min-height:\s*44px/);
  });

  it('docs/design/Chautauqua Settings.dc.html:396 `<h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Your data</h1>`', () => {
    // Same drilled-h1 rule as Tracks and rooms -- both frames draw 26px
    // (DEC-643 wave-83 amendment: Settings drills are 26px, cluster-local,
    // not the general 25px drill-in register), off one shared selector.
    const titleRule = rule(layer, "[data-drilled='true'] .chq-page-title");
    expect(titleRule).toMatch(/font-size:\s*26px/);
  });
});

describe("Settings.tsx renders the landing's group data (label/detail) that settings.css styles", () => {
  it('SECTIONS carries a detail line per DEC-032 for every rail entry', async () => {
    const { SECTIONS } = await import('../Settings');
    expect(SECTIONS.length).toBeGreaterThan(0);
    for (const section of SECTIONS) {
      expect(typeof section.detail).toBe('string');
      expect(section.detail.length).toBeGreaterThan(0);
    }
  });
});
