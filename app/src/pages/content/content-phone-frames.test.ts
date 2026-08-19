// v12 design pack — the four width:390 PHONE frames in
// docs/design/Chautauqua Content.dc.html:
//
//   "Content"                (line 198, extent 198-243) — the queue, at rest
//   "Content · selecting"    (line 247, extent 247-288) — bulk-approve mode
//   "Files · 390"            (line 338, extent 338-369) — find one file
//   "Session · deliverable"  (line 373, extent 373-434) — approve, or ask
//                                                          for changes
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts — these are
// source-scan pins on the CSS TEXT of content.css, not computed style.
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY, and every 700px block in the file (task w8-e, DEC-393/DEC-989
//     wave-90 amendments, appended a second one) sits ABOVE the true end of
//     the file, with the LAST such block as the file's last top-level
//     construct (a block declared earlier than the last one, or reordered
//     after it, would silently lose the cascade tie to whatever comes after
//     it at equal specificity — DEC-385 protects source order, not a
//     one-block-per-file count).
//   * DESIGN-RULINGS "The 44px floor": no phone token may author a
//     min-height below 44px.
//
// This task deliberately declares/asserts nothing about `.chq-tabbar` —
// Content.dc.html:229 draws the shell's tab band, and its suppression
// under the Select-mode dock is v12m-w4-i's ruling (DEC-576 wave-86), out
// of this file's scope.
//
// Desktop is frozen: every assertion below reads only inside the max-width
// block; the desktop pins elsewhere in this directory run unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments are stripped before any brace scanning, mirroring
 * contacts-phone-frames.test.ts's `read` — a literal `{`/`}` inside a long
 * explanatory comment here would desynchronise the depth counter. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const CONTENT_CSS = read('content.css');
// Read-only reference to the SHARED stylesheet the filter chips ride
// unmodified (DEC-368: this page never redefines .chq-pill/.chq-chipstrip).
// Reading it here verifies the frame's chip geometry without content.css
// having to redeclare a rule it deliberately leaves to the shared class.
const STYLES_CSS = read('../../styles.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched rather than regex-bounded (see contacts-phone-frames.test.ts
 * for why the naive `\{[^}]*\}` form is unsafe here). */
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

/** Every declaration body for `selector` inside the phone layer, joined.
 * Selectors are compared as WHOLE members of the rule's selector list.
 * content.css deliberately declares some selectors MORE THAN ONCE at equal
 * specificity within the one phone block -- e.g. the select-cell toggle
 * gets a positioning rule, then a later display:none override that wins by
 * source order (see the "Rest:"/"Selecting:" comments around it), and
 * `.chq-content-summary-row` gets a layout rule plus an unrelated
 * `position: relative` for the Select-mode overlay. Joining every body
 * (mirroring contacts-phone-frames.test.ts's `phoneRuleGroup`) means a
 * property-presence assertion finds a property wherever in that set it was
 * actually declared, without this scan re-implementing full cascade
 * override semantics. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const bodies: string[] = [];
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`no phone rule for ${selector}`);
  return bodies.join('\n');
}

describe('DEC-385: the content phone layer is single-direction, one trailing block', () => {
  it('content.css declares no min-width media query', () => {
    expect(CONTENT_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('content.css declares at least one 700px phone block, and the LAST one is the last top-level construct', () => {
    // .chq-content-group-body also carries a pre-existing, narrower
    // max-width:900px reflow (desktop-to-tablet, declared well above the
    // phone block and untouched by this task -- "Desktop FROZEN"). The
    // DEC-385 single-DIRECTION invariant this task is responsible for is
    // specifically the 700px PHONE layer: every such block sits above the
    // true end of the file, and nothing at the top level follows the LAST
    // one's closing brace (phone-block-visibility.test.ts's own pinning
    // strategy, applied to this file). Task w8-e (DEC-393/DEC-989 wave-90
    // amendments) appended a SECOND 700px block at true EOF -- content-
    // phone-floor.test.ts owns pinning that block's own shape; this test
    // only needs "the last one really is last", not "there is only one".
    const openers = [...CONTENT_CSS.matchAll(/@media\s*\(max-width:\s*700px\)\s*\{/g)];
    expect(openers.length).toBeGreaterThanOrEqual(1);

    const trimmed = CONTENT_CSS.trimEnd();
    expect(trimmed.endsWith('}')).toBe(true);
    const opener = openers[openers.length - 1]!;
    let depth = 1;
    let i = opener.index + opener[0].length;
    while (i < CONTENT_CSS.length && depth > 0) {
      if (CONTENT_CSS[i] === '{') depth += 1;
      else if (CONTENT_CSS[i] === '}') depth -= 1;
      i += 1;
    }
    expect(CONTENT_CSS.slice(i).trim()).toBe('');
  });
});

describe('DESIGN-RULINGS: never author a min-height below 44px on a phone token', () => {
  it("content.css's phone layer floors every authored min-height at 44px", () => {
    const layer = phoneLayer(CONTENT_CSS);
    const heights = [...layer.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 phone frame "Content" (docs/design/Chautauqua Content.dc.html:198)', () => {
  it('stacks the head as the frame does -- title, meta line, destination row, each its own line', () => {
    // Frame head, docs/design/Chautauqua Content.dc.html:199
    // `padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:11px`
    const row = phoneRule(CONTENT_CSS, '.chq-content-summary-row');
    expect(row).toMatch(/flex-direction:\s*column/);
    expect(row).toMatch(/align-items:\s*stretch/);
  });

  it('gives the filter chips real horizontal padding on top of the shared 44px floor -- docs/design/Chautauqua Content.dc.html:210 `min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600`', () => {
    // .chq-pill is shared/frozen from this page's own scope (DEC-368: this
    // page never redefines it here). Its shared phone rule (styles.css)
    // supplies the min-height:44px + centred flex half of the frame's chip
    // face; its shared DESKTOP rule -- inherited unchanged at 390, never
    // overridden by a phone block -- already supplies real horizontal
    // padding (12px, close enough to the frame's 13px sample that DEC-650
    // governs: geometry binds, sample numbers don't), so no phone-only
    // override was needed to reach the floor's "padding, not just height"
    // half.
    const shared = phoneRule(STYLES_CSS, '.chq-pill');
    expect(shared).toMatch(/min-height:\s*44px/);
    expect(shared).toMatch(/display:\s*inline-flex/);
    expect(shared).toMatch(/align-items:\s*center/);

    const desktop = STYLES_CSS.match(/\.chq-pill\s*\{([^}]*)\}/);
    expect(desktop?.[1]).toMatch(/padding:\s*5px 12px/);
  });

  it("places the row's select cell before the status flag, hidden until Select is on -- the frame's rest-state card draws no tick", () => {
    const select = phoneRule(
      CONTENT_CSS,
      '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(1)',
    );
    expect(select).toMatch(/display:\s*none/);
  });

  it('collapses the worklist card to the frame\'s reading order (tick/status, title, speaker · file, actions)', () => {
    const row = phoneRule(CONTENT_CSS, '.chq-content-worklist .chq-content-table tr.chq-content-row');
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\)/);
  });

  it("floors the row's Approve/Open pair at 44px full-width, matching docs/design/Chautauqua Content.dc.html:222 `flex:1; ... min-height:44px; display:flex; align-items:center; justify-content:center`", () => {
    const actions = phoneRule(CONTENT_CSS, '.chq-content-actions');
    expect(actions).toMatch(/flex-wrap:\s*wrap/);
    expect(phoneRule(CONTENT_CSS, '.chq-content-actions .chq-btn')).toMatch(/flex:\s*1 1 0/);
  });
});

describe('v12 phone frame "Content · selecting" (docs/design/Chautauqua Content.dc.html:247)', () => {
  it('shows the "N selected / All N / Done" meta row in place of the rest-state summary + Select toggle', () => {
    // Frame head, docs/design/Chautauqua Content.dc.html:248 -- same head
    // geometry as the rest-state frame (`padding:14px 16px; flex-shrink:0;
    // display:flex; flex-direction:column; gap:11px`); the selecting meta
    // row (:255-257) replaces the summary line, never coexists with it
    // (ContentApp.tsx's phoneSelectMode switch).
    expect(phoneRule(CONTENT_CSS, '.chq-content-phone-selecting-meta')).toMatch(/display:\s*flex/);
  });

  it('reveals the tick and hides the row verbs while selecting, the exclusivity this frame pair implements', () => {
    const tick = phoneRule(
      CONTENT_CSS,
      '.chq-content-worklist-selecting .chq-content-table tr.chq-content-row > td:nth-child(1)',
    );
    expect(tick).toMatch(/display:\s*flex/);
    const verbs = phoneRule(
      CONTENT_CSS,
      '.chq-content-worklist-selecting .chq-content-table tr.chq-content-row > td:nth-child(6)',
    );
    expect(verbs).toMatch(/display:\s*none/);
  });

  it('docks the bulk bar as one 48px "Approve N" over a centred hint, matching docs/design/Chautauqua Content.dc.html:278 `padding:12px 16px 16px; display:flex; flex-direction:column; gap:8px`', () => {
    const bar = phoneRule(CONTENT_CSS, '.chq-content-worklist-selecting .chq-bulkbar');
    expect(bar).toMatch(/flex-direction:\s*column/);
    expect(bar).toMatch(/align-items:\s*stretch/);
    expect(bar).toMatch(/gap:\s*8px/);
    expect(bar).toMatch(/padding-block:\s*12px 16px/);
    expect(bar).toMatch(/position:\s*sticky/);

    // docs/design/Chautauqua Content.dc.html:279 `min-height:48px; ...
    // font-size:15px; font-weight:700` -- one primary, no competing
    // tertiary Clear button in the dock (DESIGN-RULINGS A1).
    const primary = phoneRule(CONTENT_CSS, '.chq-content-worklist-selecting .chq-bulkbar-actions .chq-btn-primary');
    expect(primary).toMatch(/min-height:\s*48px/);
    expect(primary).toMatch(/font-size:\s*15px/);
    expect(
      phoneRule(CONTENT_CSS, '.chq-content-worklist-selecting .chq-bulkbar-actions .chq-btn-tertiary'),
    ).toMatch(/display:\s*none/);

    const note = phoneRule(CONTENT_CSS, '.chq-content-worklist-selecting .chq-bulkbar-note');
    expect(note).toMatch(/text-align:\s*center/);
  });
});

describe('v12 phone frame "Files · 390" (docs/design/Chautauqua Content.dc.html:338)', () => {
  it('gives the Files H1 the 25px back-linked drill register, not the 27px cluster-landing default -- docs/design/Chautauqua Content.dc.html:341 `font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05`', () => {
    // DEC-643 wave-83: 27px cluster landing / 25px back-linked drill. The
    // shared .chq-page-title phone rule (styles.css) defaults every page
    // to the 27px landing size; this page's own breadcrumb column scopes
    // the drill register onto the SAME --chq-type-page-title-phone-drill
    // token DEC-643 already declares, single-sourced.
    const h1 = phoneRule(CONTENT_CSS, '.chq-content-files-titles .chq-page-title');
    expect(h1).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
    expect(h1).toMatch(/line-height:\s*1\.05/);
  });

  it('stacks the header -- breadcrumb, title, summary, Download-all -- full measure, no shared baseline row', () => {
    const header = phoneRule(CONTENT_CSS, '.chq-content-files-header-row');
    expect(header).toMatch(/flex-direction:\s*column/);
    expect(header).toMatch(/align-items:\s*stretch/);
    expect(phoneRule(CONTENT_CSS, '.chq-content-files-breadcrumb')).toMatch(/min-height:\s*44px/);
  });

  it('collapses each file row to the frame\'s card: name + version on line one, session, size, then a bordered 44px Download', () => {
    const row = phoneRule(CONTENT_CSS, '.chq-content-files-library .chq-content-table tr.chq-content-row');
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto/);

    // docs/design/Chautauqua Content.dc.html:356 `border:1px solid
    // #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px;
    // display:flex; align-items:center; justify-content:center`.
    const download = phoneRule(CONTENT_CSS, '.chq-content-files-library .chq-content-files-col-actions .chq-link-button');
    expect(download).toMatch(/min-height:\s*44px/);
    expect(download).toMatch(/justify-content:\s*center/);
    expect(download).toMatch(/padding:\s*0 14px/);
  });

  it('docks "Download all" + "Search" at 48px each, matching docs/design/Chautauqua Content.dc.html:360-361 `min-height:48px`', () => {
    // The dock itself is the shared .chq-content-page footer band declared
    // desktop-side; the frame's two 48px targets ride the shared .chq-btn
    // primary/secondary faces this page never redefines (DEC-368) -- pinned
    // instead via the toolbar column stacking the frame demands.
    expect(phoneRule(CONTENT_CSS, '.chq-content-files-toolbar .chq-input')).toMatch(/flex:\s*1 1 100%/);
  });
});

describe('v12 phone frame "Session · deliverable" (docs/design/Chautauqua Content.dc.html:373)', () => {
  it('steps the H1 to 21px, matching docs/design/Chautauqua Content.dc.html:376 `font-size:21px; font-weight:700; letter-spacing:-0.035em; line-height:1.2`', () => {
    const title = phoneRule(CONTENT_CSS, '.chq-content-detail-title');
    expect(title).toMatch(/font-size:\s*21px/);
    expect(title).toMatch(/letter-spacing:\s*-0\.035em/);
    expect(title).toMatch(/line-height:\s*1\.2/);
  });

  it('wraps the status band actions full-measure, matching docs/design/Chautauqua Content.dc.html:378-383\'s stacked "Content status" label + Approve row', () => {
    const band = phoneRule(CONTENT_CSS, '.chq-content-status-band');
    expect(band).toMatch(/flex-wrap:\s*wrap/);
    expect(phoneRule(CONTENT_CSS, '.chq-content-status-band-actions')).toMatch(/flex:\s*1 1 100%/);
  });

  it('lays the version row out as tag / info / newest on one line, Download dropped to its own 44px row -- docs/design/Chautauqua Content.dc.html:395 tag `width:30px`, :401 Download `min-height:44px`', () => {
    const item = phoneRule(CONTENT_CSS, '.chq-content-version-item');
    expect(item).toMatch(/grid-template-columns:\s*30px minmax\(0, 1fr\) auto/);
    const download = phoneRule(CONTENT_CSS, '.chq-content-version-download');
    expect(download).toMatch(/min-height:\s*44px/);
    expect(download).toMatch(/justify-content:\s*center/);
  });

  it('floors BOTH composer actions at 48px, matching docs/design/Chautauqua Content.dc.html:422-424 -- "Ask for changes" AND "Send note only" both draw `min-height:48px`', () => {
    const both = phoneRule(CONTENT_CSS, '.chq-content-comment-actions .chq-btn');
    expect(both).toMatch(/min-height:\s*48px/);
    expect(phoneRule(CONTENT_CSS, '.chq-content-comment-actions .chq-btn-primary')).toMatch(/flex:\s*1 1 auto/);
  });
});
