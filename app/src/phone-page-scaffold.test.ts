// v12 phone page-scaffold primitives (DEC-576/643/368/616 amendments, wave
// 83, v12 mobile campaign w1) -- the same three-part phone band anatomy
// drawn identically across every 390 frame:
//
//   docs/design/Chautauqua Speakers.dc.html:261-278
//   docs/design/Chautauqua Settings.dc.html:316-337
//   docs/design/Chautauqua Contacts.dc.html:487-509
//   docs/design/Chautauqua Public and Portal.dc.html:476-500
//
// jsdom applies no stylesheet and evaluates no @media rule, so -- mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts and
// app/src/shell-geometry.test.ts -- this is a source-scan on the CSS TEXT
// of app/src/styles.css (and, for the DEC-643 token, src/views/theme.ts),
// not computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

/** Comments are stripped before any brace scanning, mirroring
 * contacts-phone-frames.test.ts's `read` helper: a literal `{`/`}` inside a
 * long explanatory comment must never desynchronise the depth counter. */
function read(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const STYLES_CSS = read(join(REPO_ROOT, 'app/src/styles.css'));
const THEME_TS = read(join(REPO_ROOT, 'src/views/theme.ts'));

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched (not regex-bounded), so a nested rule can never end the
 * block early. Copied verbatim from
 * app/src/pages/contacts/contacts-phone-frames.test.ts's `phoneLayer`. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** Every rule body outside any `@media` block, brace-matched the same way
 * contacts-phone-frames.test.ts's `desktopLayer` strips media blocks. */
function desktopLayer(css: string): string {
  let out = '';
  let i = 0;
  const opener = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    out += css.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    i = j;
    opener.lastIndex = j;
  }
  return out + css.slice(i);
}

/** A single rule's declaration body, by selector, within `layer` (already
 * extracted phone or desktop text). Selectors are compared as WHOLE
 * members of the rule's selector list, mirroring `phoneRule` in
 * contacts-phone-frames.test.ts. */
function ruleIn(layer: string, selector: string): string {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no rule for ${selector} in given layer`);
}

const STYLES_PHONE = phoneLayer(STYLES_CSS);
const STYLES_DESKTOP = desktopLayer(STYLES_CSS);

describe('DEC-385: no min-width media query anywhere in styles.css', () => {
  it('declares no min-width query', () => {
    expect(STYLES_CSS).not.toMatch(/@media[^{]*min-width/);
  });
});

describe('DEC-976: chq-phone-* selectors have no top-level rule (phone-block-visibility contract)', () => {
  it('.chq-phone-head, .chq-phone-body, .chq-phone-dock, .chq-phone-back have no rule outside a max-width block', () => {
    for (const selector of ['.chq-phone-head', '.chq-phone-body', '.chq-phone-dock', '.chq-phone-back']) {
      expect(() => ruleIn(STYLES_DESKTOP, selector)).toThrow();
    }
  });
});

describe('v12 phone page-scaffold: DEC-576 amendment', () => {
  it('.chq-phone-head is a sticky, full-bleed-cancelling header band', () => {
    // docs/design/Chautauqua Speakers.dc.html:261
    // `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:7px`
    const head = ruleIn(STYLES_PHONE, '.chq-phone-head');
    expect(head).toMatch(/position:\s*sticky/);
    expect(head).toMatch(/top:\s*0/);
    expect(head).toMatch(/z-index:\s*5/);
    expect(head).toMatch(/flex-shrink:\s*0/);
    expect(head).toMatch(/margin-inline:\s*-16px/);
    expect(head).toMatch(/padding:\s*14px 16px/);
    expect(head).toMatch(/border-bottom:\s*1px solid var\(--chq-ink\)/);
    expect(head).toMatch(/background:\s*var\(--chq-paper\)/);
    expect(head).toMatch(/display:\s*flex/);
    expect(head).toMatch(/flex-direction:\s*column/);
    expect(head).toMatch(/gap:\s*8px/);
  });

  it('.chq-phone-body is the sole scroll region', () => {
    // docs/design/Chautauqua Speakers.dc.html:266
    // `flex:1; min-height:0; overflow-y:auto; padding:14px 16px 16px`
    const body = ruleIn(STYLES_PHONE, '.chq-phone-body');
    expect(body).toMatch(/flex:\s*1/);
    expect(body).toMatch(/min-height:\s*0/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });

  it('.chq-phone-dock is a sticky, full-bleed-cancelling footer band', () => {
    // docs/design/Chautauqua Speakers.dc.html:278
    // `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px`
    const dock = ruleIn(STYLES_PHONE, '.chq-phone-dock');
    expect(dock).toMatch(/position:\s*sticky/);
    expect(dock).toMatch(/bottom:\s*0/);
    expect(dock).toMatch(/z-index:\s*5/);
    expect(dock).toMatch(/flex-shrink:\s*0/);
    expect(dock).toMatch(/margin-inline:\s*-16px/);
    expect(dock).toMatch(/padding:\s*12px 16px 16px/);
    expect(dock).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);
    expect(dock).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(dock).toMatch(/display:\s*flex/);
    expect(dock).toMatch(/gap:\s*8px/);
  });

  it(".chq-phone-dock's buttons clear the 48px frame footer floor", () => {
    // docs/design/Chautauqua Speakers.dc.html:279
    // `flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700`
    const btn = ruleIn(STYLES_PHONE, '.chq-phone-dock .chq-btn');
    expect(btn).toMatch(/min-height:\s*48px/);
    expect(btn).toMatch(/padding:\s*0 16px/);
    const primary = ruleIn(STYLES_PHONE, '.chq-phone-dock .chq-btn-primary');
    expect(primary).toMatch(/flex:\s*1/);
  });

  it('.chq-phone-back clears the 44px floor with centred flex', () => {
    // docs/design/Chautauqua Speakers.dc.html:262
    // `font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center`
    const back = ruleIn(STYLES_PHONE, '.chq-phone-back');
    expect(back).toMatch(/display:\s*flex/);
    expect(back).toMatch(/align-items:\s*center/);
    expect(back).toMatch(/min-height:\s*44px/);
    const heights = [...back.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 phone page-scaffold: DEC-643 amendment -- the drill-in title token', () => {
  it('--chq-type-page-title-phone-drill is declared in BOTH token files at the same value', () => {
    const stylesMatch = STYLES_CSS.match(/--chq-type-page-title-phone-drill:\s*([^;]+);/);
    const themeMatch = THEME_TS.match(/--chq-type-page-title-phone-drill:\s*([^;]+);/);
    expect(stylesMatch).not.toBeNull();
    expect(themeMatch).not.toBeNull();
    expect(stylesMatch![1]!.trim()).toBe('25px');
    expect(themeMatch![1]!.trim()).toBe('25px');
  });

  it('--chq-type-page-title-phone-size (cluster-landing register) stays 27px in BOTH token files', () => {
    const stylesMatch = STYLES_CSS.match(/--chq-type-page-title-phone-size:\s*([^;]+);/);
    const themeMatch = THEME_TS.match(/--chq-type-page-title-phone-size:\s*([^;]+);/);
    expect(stylesMatch).not.toBeNull();
    expect(themeMatch).not.toBeNull();
    expect(stylesMatch![1]!.trim()).toBe('27px');
    expect(themeMatch![1]!.trim()).toBe('27px');
  });

  it('.chq-phone-head-drill .chq-page-title consumes the drill token', () => {
    // docs/design/Chautauqua Speakers.dc.html:263
    // `font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05`
    const rule = ruleIn(STYLES_PHONE, '.chq-phone-head-drill .chq-page-title');
    expect(rule).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });
});

describe('v12 phone page-scaffold: DEC-368 amendment -- table fill inset collapses at 390', () => {
  it('phone layer zeroes the first/last cell inset', () => {
    const first = ruleIn(STYLES_PHONE, '.chq-table th:first-child');
    expect(first).toMatch(/padding-left:\s*0/);
    const last = ruleIn(STYLES_PHONE, '.chq-table th:last-child');
    expect(last).toMatch(/padding-right:\s*0/);
  });

  it('desktop keeps the 16px inset (frozen)', () => {
    const first = ruleIn(STYLES_DESKTOP, '.chq-table th:first-child');
    expect(first).toMatch(/padding-left:\s*16px/);
    const last = ruleIn(STYLES_DESKTOP, '.chq-table th:last-child');
    expect(last).toMatch(/padding-right:\s*16px/);
  });

  it("comms.css's now-redundant local neutralisation of the same inset is gone", () => {
    const commsCss = readFileSync(join(REPO_ROOT, 'app/src/pages/comms/comms.css'), 'utf-8');
    expect(commsCss).not.toMatch(/chq-comms-templates-table td:first-child/);
  });
});

describe('v12 phone page-scaffold: DEC-616 amendment -- drawer inset / action-bar cancellation pair', () => {
  it('the drawer padding and the action-bar negative margin/padding move together', () => {
    // docs/design/Chautauqua Contacts.dc.html:487
    // `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:7px`
    const drawer = ruleIn(STYLES_PHONE, '.chq-drawer');
    const drawerPad = drawer.match(/padding:\s*(\d+)px/);
    expect(drawerPad).not.toBeNull();
    const drawerInset = Number(drawerPad![1]);

    const actions = ruleIn(STYLES_PHONE, '.chq-contacts-drawer-actions');
    const marginMatch = actions.match(/margin:\s*0 -(\d+)px 0/);
    const paddingMatch = actions.match(/padding:\s*(\d+)px 16px 20px/);
    expect(marginMatch).not.toBeNull();
    expect(paddingMatch).not.toBeNull();
    const negativeMargin = Number(marginMatch![1]);
    const horizontalPadding = Number(paddingMatch![1]);

    // The pin: all three numbers are the SAME value, so none can drift alone.
    expect(negativeMargin).toBe(drawerInset);
    expect(horizontalPadding).toBe(drawerInset);
  });

  it('desktop keeps the drawer at 20px 26px (frozen)', () => {
    const drawer = ruleIn(STYLES_DESKTOP, '.chq-drawer');
    expect(drawer).toMatch(/padding:\s*20px 26px/);
  });
});
