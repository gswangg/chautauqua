// w29-d: FIRST markup-level verdict for Settings "Public pages · 390"
// (docs/design/Chautauqua Settings.dc.html:481, extent 481-505). Until this
// task, the frame's five drawn strings (`‹ Settings`, `Public pages`,
// `{{ p.name }}`/`{{ p.state }}`/`{{ p.path }}` row template, `View`,
// `Embed code`) were asserted by NOTHING -- w10-frame-verdicts.md's
// `:481 MATCHES` row is a citation, not a receipt.
//
// DEC-651 (wave-29, load-bearing): mounts `SettingsPage` at the drilled
// route (`?section=public-pages`), never `PublicPagesPanel` directly -- the
// frame's `‹ Settings` back link and `Public pages` H1 are rendered by
// Settings.tsx:403 (`.chq-page-title.chq-settings-drill-title`), not by the
// panel. A bare panel mount sees neither.
//
// DEC-967: byte-for-byte `verbatimLine` checks below, copied from
// SummarySection.phone-drill-head.render.test.tsx's own helper.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../Settings';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import { DEC_385, DEC_651, DEC_874, DEC_967, DEC_976 } from '../../../../src/decisions';

void DEC_385; // narrow overrides wide via max-width media queries only
void DEC_651; // mount SettingsPage at the drilled route, never the bare panel
void DEC_874; // scope every phone-frame query to its own frame's region
void DEC_967; // byte-for-byte verbatimLine citations
void DEC_976; // strict frame citations only

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const SETTINGS_CSS_FILE = join(HERE, 'settings.css');

function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Brace-matched extraction of a top-level (or media-nested) rule's body
 * for an EXACT selector string, over comment-stripped CSS. Mirrors the
 * house idiom (settings-controls-390.w5o.test.ts's own brace walkers) but
 * scoped to just "find one selector's body", since this file only needs
 * to prove three already-declared 44px floors, not enumerate the sheet. */
function ruleBody(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`selector not found: ${selector}`);
  const openBrace = css.indexOf('{', idx);
  const closeBrace = css.indexOf('}', openBrace);
  if (openBrace === -1 || closeBrace === -1) throw new Error(`unbalanced rule for: ${selector}`);
  return css.slice(openBrace + 1, closeBrace);
}

const EVENT_ID = 'evt-w29-d-public-pages-390';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

// A superset of every route any of the seven Settings panels fetch on
// mount (SettingsPage's read drill renders ALL seven -- Settings.tsx's
// `sectionsToRender` is only narrowed to one panel while `edit=1` is
// present) -- copied from SettingsSummarySweep.render.test.tsx's own
// `mockEverySettingsRoute` so an unregistered route fails loudly (DEC-843)
// rather than this file re-deriving a stale subset.
function mockEverySettingsRoute(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      location: 'Austin',
      timezone: 'UTC',
      recordPrefix: 'DC',
      branding: {},
    },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: null,
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [],
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'AI Engineering', color: null }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Stage', capacity: 100 }]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 5 }),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 9, speakers: 3, scheduled: 2 },
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      welcomeMessage: null,
      logoUrl: null,
      accentColor: null,
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [] },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
    'GET /api/v1/tokens': listEnvelope([]),
    'GET /api/v1/users': listEnvelope([{ id: 'u1', email: 'a@example.com', role: 'organizer' }]),
    'GET /api/v1/me': { userId: 'u1', email: 'a@example.com', name: null, role: 'organizer', orgId: 'org1' },
    ...overrides,
  });
}

function renderPublicPagesDrill() {
  mockEverySettingsRoute();
  return render(
    <MemoryRouter initialEntries={['/settings?section=public-pages']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('w29-d: frame evidence (byte-for-byte), Chautauqua Settings.dc.html:481-497', () => {
  it('the frame draws exactly the back link, H1, row template and two row actions this test asserts against', () => {
    verbatimLine(
      483,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>',
    );
    verbatimLine(
      484,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Public pages</h1>',
    );
    verbatimLine(
      490,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ p.name }}</span>',
    );
    verbatimLine(491, '              <span style="{{ p.stateStyle }}">{{ p.state }}</span>');
    verbatimLine(
      493,
      '            <span style="font-size:12px; color:#565A4B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">{{ p.path }}</span>',
    );
    // :495 -- {{ p.toggle }} -- DEVIATIONS §6 parks this: no backing data
    // exists for a publish/unpublish switch, so PublicPagesPanel.tsx never
    // renders it, not even disabled. Cited here, not asserted as rendered.
    verbatimLine(
      495,
      '              <span style="flex:1; border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; color:#2E2A24; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">{{ p.toggle }}</span>',
    );
    verbatimLine(
      496,
      '              <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">View</span>',
    );
    verbatimLine(
      497,
      '              <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Embed code</span>',
    );
  });
});

describe('w29-d: real render receipts (SettingsPage mounted at ?section=public-pages)', () => {
  it('draws ONE frame-carrying H1 "Public pages" and a back control ending in "Settings" (:483/:484)', async () => {
    renderPublicPagesDrill();
    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => expect(within(section).getByText('Sessions')).toBeInTheDocument());

    // Settings.tsx renders TWO literal <h1> nodes while a section is
    // drilled (the desktop top-level .chq-page-title and its phone-only
    // .chq-settings-drill-title twin, both carrying the same text) -- CSS
    // (`:has(...) > .chq-page-title { display: none }`, mid-file block)
    // hides the desktop one at phone. jsdom applies no @media, so the
    // frame's ONE visible H1 is proved by querying the drill twin's own
    // class directly, the same technique
    // SummarySection.phone-drill-head.render.test.tsx uses for its dedup
    // selector.
    const drillHeadings = document.querySelectorAll('h1.chq-settings-drill-title');
    expect(drillHeadings).toHaveLength(1);
    expect(drillHeadings[0]!.textContent).toBe('Public pages');

    const plainTopHeading = document.querySelector('h1.chq-page-title:not(.chq-settings-drill-title)');
    expect(plainTopHeading).not.toBeNull();
    expect(plainTopHeading!.textContent).toBe('Public pages');
    // Proof the desktop twin really is the one the phone CSS hides:
    // Settings.tsx's own selector reaches exactly it.
    const desktopHideMatches = document.querySelectorAll(
      ".chq-settings-page:has(.chq-settings-layout[data-drilled='true']) > .chq-page-title",
    );
    expect(desktopHideMatches).toHaveLength(1);
    expect(desktopHideMatches[0]).toBe(plainTopHeading);

    // :483 -- back control ends in "Settings" (Public pages has no nested
    // drill of its own here, unlike Saved embeds -- see the sibling file).
    const back = screen.getByRole('button', { name: /Settings$/ });
    expect(back.textContent).toBe('‹ Settings');
  });

  it('each row carries name, state pill and the frame\'s action pair ["View", "Embed code"] in DOM order (:490-:497)', async () => {
    renderPublicPagesDrill();
    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => expect(within(section).getByText('Sessions')).toBeInTheDocument());
    await waitFor(() => expect(within(section).getByText(/Live · 9 published/)).toBeInTheDocument());

    const row = within(section).getByText('Sessions').closest('li');
    if (!row) throw new Error('Sessions row not found');

    expect(within(row).getByText('Sessions')).toBeInTheDocument();
    expect(within(row).getByText(/Live · 9 published/)).toBeInTheDocument();

    const actionNodes = Array.from(row.querySelectorAll('a, button')).filter((n) =>
      ['View', 'Embed code'].includes(n.textContent ?? ''),
    );
    expect(actionNodes.map((n) => n.textContent)).toEqual(['View', 'Embed code']);
    expect(actionNodes[0]!.tagName).toBe('A');
    expect(actionNodes[1]!.tagName).toBe('BUTTON');

    // {{ p.toggle }} (:495) is never rendered -- DEVIATIONS §6, not a
    // finding. Confirmed absent: the row's only interactive nodes are
    // exactly the two action nodes already asserted above.
    expect(row.querySelectorAll('a, button')).toHaveLength(2);
  });

  it('all six rows render, each carrying a View link and an Embed code button', async () => {
    renderPublicPagesDrill();
    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => expect(within(section).getByText('Sessions')).toBeInTheDocument());

    ['Sessions', 'Speakers', 'Agenda', 'Schedule and ICS', 'Speaker gallery', 'CFP submit page'].forEach((name) => {
      expect(within(section).getByText(name)).toBeInTheDocument();
    });
    expect(within(section).getAllByRole('link', { name: 'View' })).toHaveLength(6);
    expect(within(section).getAllByRole('button', { name: 'Embed code' })).toHaveLength(6);
  });
});

describe('w29-d: the 44px floor on View / Embed code (settings.css terminal @media (max-width: 700px) block)', () => {
  const css = stripCssComments(readFileSync(SETTINGS_CSS_FILE, 'utf-8'));

  it(':496 View -- .chq-settings-public-pages-view-action declares min-height: 44px', () => {
    const body = ruleBody(css, '.chq-settings-public-pages-view-action {');
    expect(body).toContain('min-height: 44px');
  });

  it(':497 Embed code -- the shared .chq-settings-panel .chq-link-button phone rule floors it at 44px', () => {
    // .chq-settings-public-pages-embed-action itself only stretches the
    // button into its grid cell (comment at its declaration site); the
    // 44px floor comes from the generic bordered-inline-action rule every
    // .chq-link-button inside a .chq-settings-panel already carries.
    const genericBody = ruleBody(css, '.chq-settings-panel .chq-link-button {');
    expect(genericBody).toContain('min-height: 44px');

    const embedActionBody = ruleBody(css, '.chq-settings-public-pages-embed-action {');
    expect(embedActionBody).not.toContain('min-height');
    expect(embedActionBody).toContain('align-self: stretch');
  });

  it('both rules live inside the file\'s ONE terminal @media (max-width: 700px) block (DEC-385 single-direction)', () => {
    const mediaOpens = css.match(/@media \(max-width: 700px\) \{/g) ?? [];
    expect(mediaOpens).toHaveLength(1);
    const openIdx = css.indexOf('@media (max-width: 700px) {');
    expect(css.indexOf('.chq-settings-public-pages-view-action {')).toBeGreaterThan(openIdx);
    expect(css.indexOf('.chq-settings-panel .chq-link-button {')).toBeGreaterThan(openIdx);
  });
});
