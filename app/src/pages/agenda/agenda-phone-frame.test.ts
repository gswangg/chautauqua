// v12 design pack -- the ONE width:390 PHONE frame in
// docs/design/Chautauqua Agenda.dc.html, spanning lines 127-208 ("390",
// line 121, is the frame's own eyebrow label; the frame itself opens at
// :127 `width:390px; height:844px...`). This is the richest frame in the
// pack: a HEAD band (wordmark + unplaced/clash counter, H1, a day-pill
// row, a scrolling room-pill row), a BODY band (one 50px-gutter slot per
// row, three card variants), and a DOCK band (the placing state over the
// Unscheduled/Auto-schedule pair).
//
// jsdom applies no stylesheet and evaluates no @media rule, so -- mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts -- these are
// source-scan pins on the CSS TEXT of agenda.css, not computed style.
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY. A min-width query would make the sheet bidirectional and is a
//     hard failure here.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px, and an interactive
//     element needs min-height PLUS centred flex PLUS horizontal padding.
//
// Desktop is frozen: every assertion below reads only inside a max-width
// block; the desktop agenda pins (agenda-card-geometry.test.ts,
// agenda-armed-contrast.test.ts, DayGrid.render.test.tsx, etc.) run
// unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments are stripped before any brace scanning, mirroring the contacts
 * pins -- a literal `{`/`}` inside a long explanatory comment would
 * desynchronise the depth counter and silently truncate a block. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const AGENDA_CSS = read('agenda.css');
const STYLES_CSS = read('../../styles.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`.
 * Brace-matched rather than regex-bounded, so a nested rule can never end
 * the block early. */
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

/** A single rule's declaration body, by selector, inside the phone layer.
 * Selectors are compared as WHOLE members of the rule's selector list, not
 * by substring. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

/** A selector's rule body OUTSIDE any @media block, for the ONE assertion
 * below that pins a shared cross-page class (.chq-chipstrip) rather than an
 * agenda-local one -- the room-pill row's horizontal scroll is unconditional
 * (every width), not a phone-only override, so it lives at the top level of
 * styles.css, not inside agenda.css's phone layer. */
function stripAnyMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

function topLevelRule(css: string, selector: string): string {
  const withoutMedia = stripAnyMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(withoutMedia);
  if (!m || m[1] === undefined) throw new Error(`no top-level rule for ${selector}`);
  return m[1];
}

describe('DEC-385: the agenda phone layer is single-direction', () => {
  it('agenda.css declares no min-width media query', () => {
    expect(AGENDA_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('agenda.css has at least one max-width phone block', () => {
    expect(phoneLayer(AGENDA_CSS).length).toBeGreaterThan(0);
  });
});

describe('DESIGN-RULINGS: never author a min-height below 44px on a phone token', () => {
  it("agenda.css's phone layer floors every authored min-height at 44px", () => {
    const layer = phoneLayer(AGENDA_CSS);
    const heights = [...layer.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 phone frame "Agenda" (390) -- HEAD band', () => {
  it('docs/design/Chautauqua Agenda.dc.html:128 `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:12px`', () => {
    const head = phoneRule(AGENDA_CSS, '.chq-phone-agenda-head');
    expect(head).toMatch(/border-bottom:\s*1px solid var\(--chq-ink\)/);
    expect(head).toMatch(/padding:\s*14px 16px/);
    expect(head).toMatch(/flex-shrink:\s*0/);
    expect(head).toMatch(/display:\s*flex/);
    expect(head).toMatch(/flex-direction:\s*column/);
    expect(head).toMatch(/gap:\s*12px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:130 `font-family:\'Familjen Grotesk\', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px`', () => {
    const wordmark = phoneRule(AGENDA_CSS, '.chq-phone-agenda-wordmark');
    expect(wordmark).toMatch(/font-size:\s*20px/);
    expect(wordmark).toMatch(/font-weight:\s*700/);
    expect(wordmark).toMatch(/letter-spacing:\s*-0\.03em/);
    expect(wordmark).toMatch(/position:\s*relative/);
    expect(wordmark).toMatch(/top:\s*-2\.5px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:131 `margin-left:auto; font-size:12px; font-weight:600; color:#565A4B` -- the "N unplaced · M clash" counter', () => {
    const counts = phoneRule(AGENDA_CSS, '.chq-phone-agenda-counts');
    expect(counts).toMatch(/margin-left:\s*auto/);
    expect(counts).toMatch(/font-size:\s*12px/);
    expect(counts).toMatch(/font-weight:\s*600/);
    expect(counts).toMatch(/color:\s*var\(--chq-muted\)/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:133 `margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1`', () => {
    const h1 = phoneRule(AGENDA_CSS, '.chq-phone-agenda-h1');
    expect(h1).toMatch(/margin:\s*0/);
    expect(h1).toMatch(/font-size:\s*27px/);
    expect(h1).toMatch(/font-weight:\s*700/);
    expect(h1).toMatch(/letter-spacing:\s*-0\.04em/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:135 `background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600` -- the active "Tue 12" day pill is an ink fill', () => {
    const base = phoneRule(AGENDA_CSS, '.chq-phone-day-chip');
    expect(base).toMatch(/border-radius:\s*99px/);
    expect(base).toMatch(/min-height:\s*44px/);
    expect(base).toMatch(/display:\s*flex/);
    expect(base).toMatch(/align-items:\s*center/);
    expect(base).toMatch(/padding:\s*0 13px/);

    const active = phoneRule(AGENDA_CSS, '.chq-phone-day-chip.active');
    expect(active).toMatch(/background:\s*var\(--chq-ink\)/);
    expect(active).toMatch(/color:\s*var\(--chq-on-ink\)/);
    // The active day pill is an INK fill, distinct from the shared
    // `.chq-pill.active` OLIVE fill (DEC-730) -- a day is a selector among
    // peers, not a confirmed/on toggle.
    expect(active).not.toMatch(/var\(--chq-brand\)/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:136 `border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:500` -- an inactive day pill is bordered, not filled', () => {
    const base = phoneRule(AGENDA_CSS, '.chq-phone-day-chip');
    expect(base).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(base).toMatch(/font-weight:\s*500/);
    expect(base).toMatch(/background:\s*var\(--chq-surface\)/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:139 `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch` -- the room-pill row scrolls horizontally via the shared, unconditional .chq-chipstrip (styles.css)', () => {
    const strip = topLevelRule(STYLES_CSS, '.chq-chipstrip');
    expect(strip).toMatch(/overflow-x:\s*auto/);
    expect(strip).toMatch(/-webkit-overflow-scrolling:\s*touch/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:140 `flex-shrink:0; background:#4E5C31; color:#F7F9F0; border-radius:99px; min-height:44px; display:flex; align-items:center; gap:8px; padding:0 14px; font-size:13px; font-weight:700` (Room 2A) -- the room pill, active = shared .chq-pill.active brand fill', () => {
    const chip = phoneRule(AGENDA_CSS, '.chq-phone-room-chip');
    expect(chip).toMatch(/min-height:\s*44px/);
    expect(chip).toMatch(/padding:\s*0 14px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:140 `<span style="font-size:10px; font-weight:800; letter-spacing:0.08em">CLASH</span>` -- readable against both the bordered and the brand-filled pill', () => {
    const flag = phoneRule(AGENDA_CSS, '.chq-phone-room-chip .chq-flag');
    expect(flag).toMatch(/letter-spacing:\s*0\.08em/);
    const activeFlag = phoneRule(AGENDA_CSS, '.chq-phone-room-chip.active .chq-flag');
    expect(activeFlag).toMatch(/color:\s*var\(--chq-on-brand\)/);
  });
});

describe('v12 phone frame "Agenda" (390) -- BODY band', () => {
  it('docs/design/Chautauqua Agenda.dc.html:148 `display:grid; grid-template-columns:50px 1fr; gap:10px; padding-bottom:8px`', () => {
    const slot = phoneRule(AGENDA_CSS, '.chq-phone-slot');
    expect(slot).toMatch(/display:\s*grid/);
    expect(slot).toMatch(/grid-template-columns:\s*50px 1fr/);
    expect(slot).toMatch(/gap:\s*10px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:149 `font-size:11px; font-weight:600; color:#565A4B; padding-top:13px` -- the 50px time gutter', () => {
    const time = phoneRule(AGENDA_CSS, '.chq-phone-slot-time');
    expect(time).toMatch(/font-size:\s*11px/);
    expect(time).toMatch(/font-weight:\s*600/);
    expect(time).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(time).toMatch(/padding-top:\s*13px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:152 `background:#FAF8F2; border:1px solid #D3CFC0; border-left:3px solid #4E5C31; border-radius:6px; padding:12px` -- the placed card', () => {
    const card = phoneRule(AGENDA_CSS, '.chq-phone-slot-card');
    expect(card).toMatch(/background:\s*var\(--chq-surface\)/);
    expect(card).toMatch(/border:\s*1px solid var\(--chq-rule\)/);
    expect(card).toMatch(/border-left:\s*3px solid var\(--chq-brand\)/);
    expect(card).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    expect(card).toMatch(/padding:\s*12px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:160 `background:#1B1D17; border-radius:6px; padding:13px; display:flex; flex-direction:column; gap:9px; color:#F4F1E8` -- the ink-filled clash card (via the shared .chq-panel)', () => {
    const clash = phoneRule(AGENDA_CSS, '.chq-phone-slot-clash');
    expect(clash).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    expect(clash).toMatch(/padding:\s*13px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:161 `font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase` -- "Two sessions in this slot" reads on-ink, not the shared .chq-flag ink', () => {
    const clashFlag = phoneRule(AGENDA_CSS, '.chq-phone-slot-clash .chq-flag');
    expect(clashFlag).toMatch(/color:\s*var\(--chq-on-ink\)/);
    expect(clashFlag).toMatch(/letter-spacing:\s*0\.1em/);
  });
});

describe('v12 phone frame "Agenda" (390) -- DOCK band', () => {
  it('docs/design/Chautauqua Agenda.dc.html:189 `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:13px 16px 16px; display:flex; flex-direction:column; gap:10px`', () => {
    const footer = phoneRule(AGENDA_CSS, '.chq-phone-footer');
    expect(footer).toMatch(/flex-shrink:\s*0/);
    expect(footer).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);
    expect(footer).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(footer).toMatch(/display:\s*flex/);
    expect(footer).toMatch(/flex-direction:\s*column/);
    expect(footer).toMatch(/gap:\s*10px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:192 `font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#4E5C31` -- the "Placing · tap a free slot" eyebrow reads brand green, not the shared .chq-flag ink', () => {
    const eyebrow = phoneRule(AGENDA_CSS, '.chq-phone-footer-armed-info .chq-flag');
    expect(eyebrow).toMatch(/color:\s*var\(--chq-brand\)/);
    expect(eyebrow).toMatch(/letter-spacing:\s*0\.1em/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:193 `font-family:\'Familjen Grotesk\', sans-serif; font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis` -- the armed title ellipsises rather than wrapping/overflowing', () => {
    const title = phoneRule(AGENDA_CSS, '.chq-phone-footer-armed-title');
    expect(title).toMatch(/white-space:\s*nowrap/);
    expect(title).toMatch(/overflow:\s*hidden/);
    expect(title).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:196 `border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600` -- Cancel meets the 44px floor via the shared .chq-btn + .chq-phone-footer-btn', () => {
    expect(phoneRule(AGENDA_CSS, '.chq-phone-footer-btn')).toMatch(/min-height:\s*44px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:198 `display:flex; gap:8px` -- the Unscheduled/Auto-schedule pair share the row equally', () => {
    const actions = phoneRule(AGENDA_CSS, '.chq-phone-footer-actions');
    expect(actions).toMatch(/display:\s*flex/);
    expect(actions).toMatch(/gap:\s*8px/);
  });

  it('docs/design/Chautauqua Agenda.dc.html:200 `flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700` -- Auto-schedule is flex:1 at the 44px floor', () => {
    expect(phoneRule(AGENDA_CSS, '.chq-phone-footer-actions .chq-phone-footer-btn')).toMatch(/flex:\s*1/);
  });
});
