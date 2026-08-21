// v12 phone-frame receipts for the Settings cluster, w4-e lane (DEC-375).
//
// Split into its own file at megabatch integration time: this suite and
// settings-phone-frames.test.ts were written independently by two lanes in
// the same wave and both landed. They assert DIFFERENT receipts over the same
// stylesheet, so both are kept -- but their module-level helpers collide by
// name (each defines its own `phoneLayer` with a different signature), so they
// cannot share a module. Neither suite was altered.

// v12 design pack -- the four PHONE frames this lane (w4-e, DEC-375/967)
// owns: the Settings index and its three list drills.
//
//   "Settings"                          (frame line 275, extent 275-313 -- receipted in its `it()` below)
//   "Settings · Tracks and rooms"       (frame line 347, extent 347-390 -- receipted in its `it()` below)
//   "Settings · Your data"              (frame line 393, extent 393-441 -- receipted in its `it()` below)
//   "Settings · People and roles"       (frame line 552, extent 552-575 -- receipted in its `it()` below)
//
// DEC-967 ("a citation is not an assertion"): every frame below is claimed
// with a strict citation landing inside its extent, a verbatim backticked
// literal READ from the frame file itself (never retyped from memory --
// see `verbatimLine`, which throws if the literal doesn't match byte for
// byte), and a real assertion about the tree beneath it -- either about
// settings.css's phone layer or about Settings.tsx's own source, never a
// bare `expect(citation).toBeTruthy()`.
//
// jsdom applies no stylesheet and evaluates no @media rule, so -- mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts -- the CSS
// assertions below are source-scan pins on the CSS TEXT of settings.css,
// not computed style. Desktop is frozen: every settings.css assertion
// reads only inside a max-width block (or the desktop-hiding rule that
// sits just outside one, asserted separately below), and the existing
// desktop-facing settings render tests are untouched.
//
// This lane owns ONLY the index/drill switch and the three list drills'
// body anatomy -- CLAIMED_FLOOR in test/phone-frame-ledger.scan.test.ts is
// never edited here (DEC-808: the ratchet is a merge-train act).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ApiTokensPanel } from './ApiTokensPanel';
import { SettingsPage } from '../Settings';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { installConsoleErrorGuard, mockPeople, renderPanel, OTHER } from './PeopleRolesPanel.test-helpers';

// DEC-919 wave-155/156: the "reads the frame's ... action" it()s below render
// the real read-drill primaries -- the panel in isolation (wave-155), the whole
// SettingsPage read drill (wave-156, qb) and People-and-roles via the shared
// test-helpers (wave-156, qc). Everything else here is a pure source/CSS scan.
installConsoleErrorGuard();
afterEach(() => cleanup());

/** Exposes `location.search` for a `MemoryRouter`-wrapped render, without
 * reaching into router internals -- same idiom as
 * ApiTokensPanel.render.test.tsx / PeopleRolesPanel.test-helpers.tsx. */
function LocationSearchProbe() {
  return createElement('div', { 'data-testid': 'location-search' }, useLocation().search);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const SETTINGS_TSX = readFileSync(join(HERE, '..', 'Settings.tsx'), 'utf-8');
const TRACKS_ROOMS_TSX = readFileSync(join(HERE, 'TracksRoomsPanel.tsx'), 'utf-8');

/** Comments stripped before any brace scanning, mirroring
 * contacts-phone-frames.test.ts's `read` helper. */
function readCss(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const SETTINGS_CSS = readCss(join(HERE, 'settings.css'));

/** Concatenated bodies of every `@media (max-width: …)` block, brace-
 * matched (copied verbatim from contacts-phone-frames.test.ts's
 * `phoneLayer` -- a nested rule can never end the block early). */
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

/** Every rule body OUTSIDE any @media block, brace-matched the same way
 * phone-page-scaffold.test.ts's `desktopLayer` strips media blocks. */
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

/** A single rule's declaration body, by selector, within `layer` --
 * selectors compared as WHOLE members of the rule's selector list
 * (mirrors contacts-phone-frames.test.ts's `phoneRule`). */
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

const SETTINGS_PHONE = phoneLayer(SETTINGS_CSS);
const SETTINGS_DESKTOP = desktopLayer(SETTINGS_CSS);

/** Reads line `lineNo` (1-based) of `file` and asserts it equals `literal`
 * exactly -- the DEC-967 "verbatim backticked literal", checked against
 * the real file rather than retyped from memory. Returns the line so
 * callers can chain a further assertion on it if useful. */
function verbatimLine(file: string, lineNo: number, literal: string): string {
  const lines = readFileSync(file, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`${file} has no line ${lineNo}`);
  expect(line).toBe(literal);
  return line;
}

describe('DEC-385: settings.css declares no min-width media query', () => {
  it('has no min-width query anywhere', () => {
    expect(SETTINGS_CSS).not.toMatch(/@media[^{]*min-width/);
  });
});

describe('v12 phone frame "Settings" (390)', () => {
  it('draws the index row as `{{ g.label }}` beside an olive "Open" on one baseline', () => {
    verbatimLine(
      DESIGN_FILE,
      289,
      '              <span style="font-size:13px; font-weight:700; color:#4E5C31">Open</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:289 `              <span style="font-size:13px; font-weight:700; color:#4E5C31">Open</span>`
    const row = ruleIn(SETTINGS_PHONE, '.chq-settings-rail-link-row');
    expect(row).toMatch(/justify-content:\s*space-between/);
    const open = ruleIn(SETTINGS_PHONE, '.chq-settings-rail-link-open');
    expect(open).toMatch(/color:\s*var\(--chq-brand\)/);
    expect(open).toMatch(/font-weight:\s*700/);
    // Desktop never draws the badge: it has no rule outside the phone
    // layer, and the base (non-media) rule hides it explicitly.
    expect(() => ruleIn(SETTINGS_DESKTOP, '.chq-settings-rail-link-open')).not.toThrow();
    expect(ruleIn(SETTINGS_DESKTOP, '.chq-settings-rail-link-open')).toMatch(/display:\s*none/);
  });

  it('closes the index with the mock\'s own hint copy, hidden at desktop', () => {
    verbatimLine(
      DESIGN_FILE,
      295,
      '          <span style="font-size:13px; color:#565A4B; line-height:1.5">Embed codes are easier to copy on a laptop</span>',
    );
    expect(SETTINGS_TSX).toContain('Embed codes are easier to copy on a laptop');
    const hint = ruleIn(SETTINGS_PHONE, '.chq-settings-rail-note');
    expect(hint).toMatch(/display:\s*block/);
    expect(ruleIn(SETTINGS_DESKTOP, '.chq-settings-rail-note')).toMatch(/display:\s*none/);
  });

  it('floors every phone-layer min-height at 44px (DESIGN-RULINGS "the 44px floor")', () => {
    const heights = [...SETTINGS_PHONE.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 phone frame "Settings · Tracks and rooms" (390)', () => {
  it('opens with the 44px `‹ Settings` link over the 26px cluster-local title', () => {
    verbatimLine(
      DESIGN_FILE,
      349,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>',
    );
    verbatimLine(
      DESIGN_FILE,
      350,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Tracks and rooms</h1>',
    );
    // docs/design/Chautauqua Settings.dc.html:350 `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Tracks and rooms</h1>`
    const title = ruleIn(SETTINGS_PHONE, '.chq-settings-drill-title');
    expect(title).toMatch(/font-size:\s*26px/);
    // Never the OTHER drill-in register (Roster/Import CSV/etc's shared
    // 25px token) -- DEC-643 wave-83's cluster-local carve-out.
    expect(title).not.toMatch(/--chq-type-page-title-phone-drill/);
    expect(ruleIn(SETTINGS_DESKTOP, '.chq-settings-drill-title')).toMatch(/display:\s*none/);
    const back = ruleIn(SETTINGS_PHONE, '.chq-settings-back');
    expect(back).toMatch(/justify-content:\s*flex-start/);
  });

  it('heads Tracks and Rooms with the shared 2px-ruled 11px/700/0.1em uppercase caption', () => {
    verbatimLine(
      DESIGN_FILE,
      355,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Tracks</span>',
    );
    expect(TRACKS_ROOMS_TSX).toContain('chq-settings-tracks-rooms-phone-caption');
    const caption = ruleIn(SETTINGS_PHONE, '.chq-settings-tracks-rooms-phone-caption');
    expect(caption).toMatch(/border-bottom:\s*2px solid var\(--chq-ink\)/);
    expect(caption).toMatch(/font-size:\s*11px/);
    expect(caption).toMatch(/font-weight:\s*700/);
    expect(caption).toMatch(/letter-spacing:\s*0\.1em/);
    expect(caption).toMatch(/text-transform:\s*uppercase/);
    expect(ruleIn(SETTINGS_DESKTOP, '.chq-settings-tracks-rooms-phone-caption')).toMatch(/display:\s*none/);
  });
});

describe('v12 phone frame "Settings · Your data" (390)', () => {
  it('boxes each export/token row action at 44px, bordered, sunk-fill -- "Download"/"Revoke"', () => {
    verbatimLine(
      DESIGN_FILE,
      409,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Download</span>',
    );
    verbatimLine(
      DESIGN_FILE,
      423,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Revoke</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:409 `            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Download</span>`
    const action = ruleIn(SETTINGS_PHONE, '.chq-settings-panel .chq-link-button');
    expect(action).toMatch(/min-height:\s*44px/);
    expect(action).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(action).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(action).toMatch(/padding:\s*0 14px/);
    const pill = ruleIn(SETTINGS_PHONE, '.chq-settings-summary-pills .chq-pill');
    expect(pill).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(pill).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
  });

  it('renders the frame\'s 46px filled full-width "New token" action in the read drill too, opening the edit drill with intent=new', async () => {
    const line = verbatimLine(
      DESIGN_FILE,
      426,
      '        <span style="display:flex; align-items:center; justify-content:center; margin-top:12px; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; font-size:14px; font-weight:700">New token</span>',
    );
    expect(line).toMatch(/min-height:46px/);
    expect(line).toMatch(/background:#4E5C31/);

    mockApi({ 'GET /api/v1/tokens': listEnvelope([]) });
    render(
      createElement(
        MemoryRouter,
        null,
        createElement(ApiTokensPanel, { readOnly: true }),
        createElement(LocationSearchProbe),
      ),
    );

    const buttons = await screen.findAllByRole('button', { name: 'New token' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveClass('chq-settings-phone-action');

    fireEvent.click(buttons[0]!);

    expect(screen.getByTestId('location-search').textContent).toBe('?section=your-data&edit=1&intent=new');
  });

  it('mounts the "New token" primary in the read drill via the full SettingsPage', async () => {
    // DEC-919 wave-156: a real render receipt against the tree, not a
    // second citation of the frame -- ApiTokensPanel.tsx's `readOnly`
    // branch mounts this button (task qb-settings-yourdata-read-drill).
    const EVENT_ID = 'evt-390-your-data-new-token';
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: {
        id: EVENT_ID,
        slug: 'devcon-2026',
        name: 'DevCon 2026',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        location: 'Austin, TX',
        timezone: 'America/Chicago',
        recordPrefix: 'DC26',
        branding: { logoUrl: '', accentColor: '' },
      },
      'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
      'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    });
    render(createElement(MemoryRouter, { initialEntries: ['/settings?section=your-data'] }, createElement(SettingsPage)));
    const section = await screen.findByRole('region', { name: 'Your data' });
    const newTokenBtn = await within(section).findByRole('button', { name: 'New token' });
    expect(newTokenBtn).toHaveClass('chq-settings-phone-action');
    window.localStorage.clear();
    cleanup();
  });

  it('YourDataPanel read drill (?section=your-data, no edit=1) mounts both per-row actions and the New-token primary', async () => {
    const EVENT_ID = 'evt-390-your-data-read-drill';
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: {
        id: EVENT_ID,
        slug: 'devcon-2026',
        name: 'DevCon 2026',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        location: 'Austin, TX',
        timezone: 'America/Chicago',
        recordPrefix: 'DC26',
        branding: { logoUrl: '', accentColor: '' },
      },
      'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
      'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    });
    // No `edit=1` -- this is the READ drill, not the edit drill: the
    // per-row actions and the create primary must all be reachable without
    // ever opening 'Change' (DEC-919 wave-156).
    render(createElement(MemoryRouter, { initialEntries: ['/settings?section=your-data'] }, createElement(SettingsPage)));
    const section = await screen.findByRole('region', { name: 'Your data' });
    // Exports row: per-row boxed "Download" (frame :409), reused from
    // renderExportRowsPhone -- three real hrefs (submissions/contacts CSV,
    // schedule ICS) render as links; "Everything, JSON" has no href so it
    // renders as a button, asserted separately below.
    expect(within(section).getAllByRole('link', { name: 'Download' }).length).toBeGreaterThan(0);
    // "Everything, JSON" has no href -- it's the one Download rendered as a
    // <button> rather than a link, same handler as the desktop pill.
    expect(within(section).getAllByText('Download').some((el) => el.tagName === 'BUTTON')).toBe(true);
    // API tokens row: per-row boxed "Revoke" (frame :423).
    expect(within(section).getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    // The filled 46px full-width "New token" primary (frame :426).
    expect(within(section).getByRole('button', { name: 'New token' })).toBeInTheDocument();
    // Still the read drill: no Change-drill-only content leaked in.
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
    window.localStorage.clear();
    cleanup();
  });
});

describe('v12 phone frame "Settings · People and roles" (390)', () => {
  it('boxes the per-person "Change" action at 44px, bordered, sunk-fill, and stacks the 14px rows', () => {
    verbatimLine(
      DESIGN_FILE,
      565,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Change</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:565 `            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Change</span>`
    const action = ruleIn(SETTINGS_PHONE, '.chq-settings-panel .chq-link-button');
    expect(action).toMatch(/min-height:\s*44px/);
    const row = ruleIn(SETTINGS_PHONE, '.chq-settings-people-row');
    expect(row).toMatch(/flex-direction:\s*column/);
  });

  it('renders the frame\'s 46px filled full-width "Invite someone" action in the READ drill, opening the existing invite dialog directly (DEC-919 wave-156)', async () => {
    const line = verbatimLine(
      DESIGN_FILE,
      568,
      '        <span style="display:flex; align-items:center; justify-content:center; margin-top:14px; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; font-size:14px; font-weight:700">Invite someone</span></div>',
    );
    expect(line).toMatch(/min-height:46px/);
    expect(line).toMatch(/background:#4E5C31/);

    // The receipt above proves the frame's geometry; this proves the tree
    // beneath it actually renders that control in the READ drill (no
    // ?edit=1) rather than only inside the edit drill's form.
    mockPeople();
    renderPanel(['/settings?section=people']);
    // OTHER carries no `name`, so the read row's label falls back to its
    // email (SELF's row instead shows its name -- personLabel's fallback).
    await waitFor(() => {
      expect(screen.getByText(OTHER.email)).toBeInTheDocument();
    });
    const footerPrimary = screen.getByRole('button', { name: 'Invite someone' });
    expect(footerPrimary).toHaveClass('chq-settings-drillrow-footer-primary');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(footerPrimary);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
  });
});

describe('DEC-375: the index/drill switch never stacks the rail above its content', () => {
  it('hides the page-level h1 at phone whenever a section is drilled (read OR edit), and swaps in the section-local title', () => {
    // DEC-393/DESIGN-RULINGS:247 amendment (w13-i): the edit-drill case
    // swaps too now -- back must paint above the H1 there as well, so the
    // selector no longer carries [data-editing='false'].
    const hideRule = ruleIn(
      SETTINGS_PHONE,
      ".chq-settings-page:has(.chq-settings-layout[data-drilled='true']) > .chq-page-title",
    );
    expect(hideRule).toMatch(/display:\s*none/);
  });

  it("Settings.tsx computes a phone-only drill title from `active`, not just the edit=1 case", () => {
    expect(SETTINGS_TSX).toMatch(/phoneDrillTitle/);
    expect(SETTINGS_TSX).toContain('chq-settings-drill-title');
  });

  it('never asserts .chq-tabbar -- the shell band is a different lane\'s (v12m-w4-i)', () => {
    expect(SETTINGS_CSS).not.toMatch(/\.chq-tabbar/);
  });
});
