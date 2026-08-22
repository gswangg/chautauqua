// w29-d: FIRST markup-level verdict for Settings "Saved embeds · 390"
// (docs/design/Chautauqua Settings.dc.html:578, extent 578-605). Until this
// task, the frame's six drawn strings (`‹ Settings`, `Saved embeds`,
// `3 on · 1 off`, the `{{ e.name }}`/`{{ e.state }}`/`{{ e.recipe }}`/
// `{{ e.used }}` row template, `Get code`, the laptop caption at :599) were
// asserted by NOTHING -- w10-frame-verdicts.md's `:578 MATCHES (nested)`
// row is a citation, not a receipt.
//
// DEC-651 (wave-29, load-bearing): mounts `SettingsPage` at the nested
// Saved-embeds drill (`?section=public-pages&view=embeds`), never
// `SavedEmbedsPanel` directly -- the frame's H1 and back link are rendered
// by Settings.tsx (`phoneDrillTitle`/`viewingEmbeds`), not by the panel; a
// bare panel mount sees neither.
//
// DIVERGENCE (recorded, not invented around): the frame draws the SAME
// back-link literal "‹ Settings" on both its Public pages (:483) and Saved
// embeds (:580) screens -- but Settings.tsx's own wave-156 DEC-728 nested-
// drill ruling (docs/design/audit/settings-v12/w10-frame-verdicts.md's
// `:578` row, citing DESIGN-RULINGS:247 "a drill still always has a way
// out, it's just the one the frame draws instead of a second one this
// component minted") deliberately re-lines Saved embeds' back control onto
// "‹ Public pages" instead, since the nested drill's real destination is
// the Public pages read-drill, not the section index. That is an existing,
// already-shipped, already-cited decision -- not a gap this task's OWNS
// list (test files + docs append only) is positioned to relitigate. This
// file asserts the ACTUAL back-link text and records the frame/product
// divergence in docs/design/audit/settings-v12.md below, rather than
// asserting a literal "Settings" suffix the shipped router does not
// produce here.
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

function ruleBody(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`selector not found: ${selector}`);
  const openBrace = css.indexOf('{', idx);
  const closeBrace = css.indexOf('}', openBrace);
  if (openBrace === -1 || closeBrace === -1) throw new Error(`unbalanced rule for: ${selector}`);
  return css.slice(openBrace + 1, closeBrace);
}

const EVENT_ID = 'evt-w29-d-saved-embeds-390';

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

const SAVED_EMBEDS = [
  { id: 'em1', name: 'Sessions grid', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
  { id: 'em2', name: 'Speaker wall', surface: 'speakers', format: 'iframe', options: {}, enabled: true },
  { id: 'em3', name: 'Agenda strip', surface: 'agenda', format: 'iframe', options: {}, enabled: true },
  { id: 'em4', name: 'Old schedule widget', surface: 'schedule', format: 'iframe', options: {}, enabled: false },
];

// Copied from SettingsSummarySweep.render.test.tsx's own
// `mockEverySettingsRoute` -- SettingsPage's read drill mounts all seven
// panels (Settings.tsx's `sectionsToRender` only narrows to one while
// `edit=1` is present), so every panel's own routes must be registered or
// mockApi throws loudly (DEC-843) on the first unregistered fetch.
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
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope(SAVED_EMBEDS),
    'GET /api/v1/tokens': listEnvelope([]),
    'GET /api/v1/users': listEnvelope([{ id: 'u1', email: 'a@example.com', role: 'organizer' }]),
    'GET /api/v1/me': { userId: 'u1', email: 'a@example.com', name: null, role: 'organizer', orgId: 'org1' },
    ...overrides,
  });
}

function renderSavedEmbedsDrill() {
  mockEverySettingsRoute();
  return render(
    <MemoryRouter initialEntries={['/settings?section=public-pages&view=embeds']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('w29-d: frame evidence (byte-for-byte), Chautauqua Settings.dc.html:578-599', () => {
  it('the frame draws exactly the back link, H1, count line, row template and Get code this test asserts against', () => {
    // docs/design/Chautauqua Settings.dc.html:580 -- pays for this file's
    // own header-block scope declaration above (DEC-998): a fully-
    // receipted in-body citation into the same frame, not just a naming
    // reference.
    verbatimLine(
      580,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>',
    );
    verbatimLine(
      581,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Saved embeds</h1>',
    );
    verbatimLine(582, '        <span style="font-size:13px; color:#565A4B; line-height:1.5">3 on · 1 off</span>');
    verbatimLine(
      588,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ e.name }}</span>',
    );
    verbatimLine(589, '              <span style="{{ e.stateStyle }}">{{ e.state }}</span>');
    verbatimLine(591, '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ e.recipe }}</span>');
    verbatimLine(592, '            <span style="font-size:12px; color:#565A4B">{{ e.used }}</span>');
    verbatimLine(
      595,
      '              <span style="flex:1; border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#2E2A24">Get code</span>',
    );
    verbatimLine(
      599,
      '        <span style="display:block; padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.5">Editing an embed\'s filters is easier on a laptop</span>',
    );
  });
});

describe('w29-d: real render receipts (SettingsPage mounted at ?section=public-pages&view=embeds)', () => {
  it('draws ONE frame-carrying H1 "Saved embeds" (:581)', async () => {
    renderSavedEmbedsDrill();
    const section = await screen.findByRole('region', { name: 'Saved embeds' });
    await waitFor(() => expect(within(section).getByText('Sessions grid')).toBeInTheDocument());

    // Same duplicate-H1 shape as the Public pages sibling file: Settings.tsx
    // renders both the desktop .chq-page-title and its phone-only
    // .chq-settings-drill-title twin (same text) while any drill is
    // active; the drill twin is the one the frame's H1 corresponds to.
    const drillHeadings = document.querySelectorAll('h1.chq-settings-drill-title');
    expect(drillHeadings).toHaveLength(1);
    expect(drillHeadings[0]!.textContent).toBe('Saved embeds');

    const desktopHideMatches = document.querySelectorAll(
      ".chq-settings-page:has(.chq-settings-layout[data-drilled='true']) > .chq-page-title",
    );
    expect(desktopHideMatches).toHaveLength(1);
    // docs/design/Chautauqua Settings.dc.html:581 draws the H1 verbatim as
    // `Saved embeds` -- proven rendered exactly that text by the expect()
    // immediately below (in-body receipt, pays for this file's
    // header-block scope citation at :2).
    expect(desktopHideMatches[0]!.textContent).toBe('Saved embeds');
  });

  it('back control (:580) -- DIVERGES from the frame\'s literal "‹ Settings": renders "‹ Public pages" instead, a wave-156 DEC-728 nested-drill re-line (DESIGN-RULINGS:247), not a new finding', async () => {
    renderSavedEmbedsDrill();
    const section = await screen.findByRole('region', { name: 'Saved embeds' });
    await waitFor(() => expect(within(section).getByText('Sessions grid')).toBeInTheDocument());

    // Scoped to the .chq-settings-back class -- a bare accessible-name
    // regex would also match the rail's own "Public pages" link
    // (aria-label="Public pages", no leading "‹").
    const back = document.querySelector('.chq-settings-back');
    expect(back).not.toBeNull();
    expect(back!.textContent).toBe('‹ Public pages');
    // Confirms the frame's own literal is NOT what renders -- the
    // divergence is real, not a typo in this test.
    expect(back!.textContent).not.toBe('‹ Settings');
  });

  it('the count line (:582) matches the shape /^\\d+ on · \\d+ off$/ against real row data (3 enabled, 1 disabled)', async () => {
    renderSavedEmbedsDrill();
    const section = await screen.findByRole('region', { name: 'Saved embeds' });
    await waitFor(() => expect(within(section).getByText('Sessions grid')).toBeInTheDocument());

    const countLine = within(section).getByText(/^\d+ on · \d+ off$/);
    expect(countLine.textContent).toMatch(/^\d+ on · \d+ off$/);
    expect(countLine.textContent).toBe('3 on · 1 off');
  });

  it('each row carries name, state pill and "Get code" (:588-:595); the laptop caption (:599) renders once', async () => {
    renderSavedEmbedsDrill();
    const section = await screen.findByRole('region', { name: 'Saved embeds' });
    await waitFor(() => expect(within(section).getByText('Sessions grid')).toBeInTheDocument());

    const row = within(section).getByText('Sessions grid').closest('li');
    if (!row) throw new Error('Sessions grid row not found');
    expect(within(row).getByText('On')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Get code' })).toBeInTheDocument();

    const offRow = within(section).getByText('Old schedule widget').closest('li');
    if (!offRow) throw new Error('Old schedule widget row not found');
    expect(within(offRow).getByText('Off')).toBeInTheDocument();
    expect(within(offRow).getByRole('button', { name: 'Get code' })).toBeInTheDocument();

    // :599 -- the list-closing laptop hint renders exactly once (this
    // panel's own body, not duplicated per row).
    expect(within(section).getAllByText("Editing an embed's filters is easier on a laptop")).toHaveLength(1);
  });

  it('all four saved-embed rows render with a "Get code" action each', async () => {
    renderSavedEmbedsDrill();
    const section = await screen.findByRole('region', { name: 'Saved embeds' });
    await waitFor(() => expect(within(section).getByText('Sessions grid')).toBeInTheDocument());

    ['Sessions grid', 'Speaker wall', 'Agenda strip', 'Old schedule widget'].forEach((name) => {
      expect(within(section).getByText(name)).toBeInTheDocument();
    });
    expect(within(section).getAllByRole('button', { name: 'Get code' })).toHaveLength(4);
  });
});

describe('w29-d: the 44px floor on "Get code" (settings.css terminal @media (max-width: 700px) block)', () => {
  const css = stripCssComments(readFileSync(SETTINGS_CSS_FILE, 'utf-8'));

  it(':595 Get code -- .chq-settings-saved-embed-actions .chq-link-button declares min-height: 44px', () => {
    const body = ruleBody(css, '.chq-settings-saved-embed-actions .chq-link-button {');
    expect(body).toContain('min-height: 44px');
  });

  it('the rule lives inside the file\'s ONE terminal @media (max-width: 700px) block (DEC-385 single-direction)', () => {
    const mediaOpens = css.match(/@media \(max-width: 700px\) \{/g) ?? [];
    expect(mediaOpens).toHaveLength(1);
    const openIdx = css.indexOf('@media (max-width: 700px) {');
    expect(css.indexOf('.chq-settings-saved-embed-actions .chq-link-button {')).toBeGreaterThan(openIdx);
  });
});
