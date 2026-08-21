// w10-ne (DEC-976 amendment wave 154): the last self-declared open clause
// of docs/probes/metafid-phoneA-2026-08-19.md ("the frame-count clause ...
// was NOT re-measured this wave and stays open") -- a per-frame verdict for
// all nine 390 READ frames (docs/design/Chautauqua Settings.dc.html :275,
// :316, :347, :393, :444, :481, :510, :552, :578), entered through
// Settings.tsx's real panel routing (MemoryRouter + ?section=<key>), the
// same way the app actually reaches each screen -- never by mounting a
// panel directly. Full verdict prose lives in
// docs/design/audit/settings-v12.md; this file is the render RECEIPT each
// verdict row cites. jsdom applies no stylesheet (no @media), so every
// assertion below is about DOM STRUCTURE/ORDER, never computed geometry --
// consistent with every other settings render-test file in this cluster.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './Settings';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * settings-phone-390.frames.test.ts's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-settings-frame-verdicts';

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

function mockAllSections() {
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
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Hall', capacity: 500 }]),
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([
      { id: 'res1', kind: 'wiki', title: 'Travel info', content: 'Fly into AUS.', fileId: null, position: 0 },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [
        { id: 'f1', label: 'Title', locked: true },
        { id: 'f2', label: 'Format', locked: false },
      ],
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 3, speakers: 2, scheduled: 1 },
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
    'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
  });
}

function renderDrilled(section: string) {
  mockAllSections();
  return render(
    <MemoryRouter initialEntries={[`/settings?section=${section}`]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('v12 Settings 390 READ frames: per-frame render verdict receipts (w10-ne, DEC-976)', () => {
  // Frame :275-311 "Settings" -- caption at :272.
  it('frame :275 Settings landing -- MATCHES: index row order is the frame\'s mobileGroups order', async () => {
    verbatimLine(272, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings</span>");
    mockAllSections();
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    const labels = within(rail)
      .getAllByRole('button')
      .map((btn) => btn.getAttribute('aria-label'));
    // Chautauqua Settings.dc.html:61-233 draws the rail groups in this
    // order; Settings.tsx's own DEC-747/DEC-691 comment states the same
    // order (SECTIONS array).
    expect(labels).toEqual([
      'Event',
      'Call for papers',
      'Tracks and rooms',
      'Public pages',
      'Speaker portal',
      'Your data',
      'People and roles',
    ]);
  });

  // Frame :316-337 "Settings · Event".
  it('frame :316 Event -- DIVERGES: read view is head+Change-first (SummarySection), frame draws content+Save/Cancel-footer', async () => {
    verbatimLine(313, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Event</span>");
    renderDrilled('event');
    const section = screen.getByRole('region', { name: 'Event' });
    await waitFor(() => expect(within(section).getByText('DevCon 2026')).toBeInTheDocument());
    // Back-above-H1 register (closed wave 140): the drill title twin sits
    // after the back control in the DOM. jsdom applies no @media rule, so
    // both the top-level page title and its phone-only drill-title twin
    // are present simultaneously -- scope to the twin by its own class.
    const backBtn = screen.getByRole('button', { name: '‹ Settings' });
    const drillTitle = document.querySelector('.chq-settings-drill-title');
    expect(drillTitle).not.toBeNull();
    expect(drillTitle!.textContent).toBe('Event');
    expect(backBtn.compareDocumentPosition(drillTitle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // DEC-728: the 'Change' action heads the section, ahead of every read
    // row -- the frame instead puts its Save/Cancel pair in a footer AFTER
    // every row. No Save/Cancel control renders at all in read mode.
    const changeBtn = within(section).getByRole('button', { name: 'Change' });
    const firstRow = within(section).getByText('DevCon 2026');
    expect(changeBtn.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).queryByText('Save')).not.toBeInTheDocument();
    expect(within(section).queryByText('Cancel')).not.toBeInTheDocument();
  });

  // Frame :347-390 "Settings · Tracks and rooms".
  it('frame :347 Tracks and rooms -- MATCHES: a per-row Edit action and dashed Add-a-track/Add-a-room rows draw in read mode (DEC-919 wave-156)', async () => {
    verbatimLine(344, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Tracks and rooms</span>");
    renderDrilled('tracks-rooms');
    const section = screen.getByRole('region', { name: 'Tracks and rooms' });
    await waitFor(() => expect(within(section).getByText('Keynotes')).toBeInTheDocument());
    // :364/:367 (DEC-919 wave-156 ruling): every track/room row now has
    // its own 'Edit' (a distinct accessible name per row, boxed 44px --
    // phone-only, CSS-gated, jsdom applies no @media so it's present here
    // unconditionally), and a dashed 'Add a track'/'Add a room' row draws
    // below each list, alongside the section-level 'Add' drill that stays.
    expect(within(section).getByRole('button', { name: 'Edit Keynotes' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Edit Main Hall' })).toBeInTheDocument();
    expect(within(section).getByText('Add a track')).toBeInTheDocument();
    expect(within(section).getByText('Add a room')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  // Frame :393-441 "Settings · Your data".
  it('frame :393 Your data -- DIVERGES: no per-row Download/Revoke action in read mode (per-row-action gap, previously documented)', async () => {
    verbatimLine(390, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Your data</span>");
    renderDrilled('your-data');
    const section = screen.getByRole('region', { name: 'Your data' });
    await waitFor(() => expect(within(section).getByText(/API docs/i)).toBeInTheDocument());
    expect(within(section).queryByRole('link', { name: 'Download' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  // Frame :444-477 "Settings · Call for papers".
  it('frame :444 Call for papers -- DIVERGES: per-question list collapsed to one summary row (previously documented, DEC-815)', async () => {
    verbatimLine(441, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Call for papers</span>");
    renderDrilled('cfp');
    const section = screen.getByRole('region', { name: 'Call for papers' });
    await waitFor(() => expect(within(section).getByText('1 — Format')).toBeInTheDocument());
    // Frame :467-475 draws one boxed 'Edit' pill per question; the read
    // view instead renders a single summary row (form-builder delegation).
    expect(within(section).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  // Frame :481-501 "Settings · Public pages".
  it('frame :481 Public pages -- MATCHES: row order (name, path, state, actions) with only the DEVIATIONS-blessed toggle omitted', async () => {
    verbatimLine(478, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Public pages</span>");
    renderDrilled('public-pages');
    const section = screen.getByRole('region', { name: 'Public pages' });
    await waitFor(() => expect(within(section).getByText('Sessions')).toBeInTheDocument());
    const row = within(section).getByText('Sessions').closest('li');
    expect(row).not.toBeNull();
    // DEC-896 (B10 DROP): no head-first 'Change' gate here -- the row
    // itself carries every value and action, matching the frame's own
    // no-edit-view ruling (DESIGN-RULINGS.md B10).
    expect(within(section).queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(within(row!).getByRole('link', { name: 'View' })).toBeInTheDocument();
    expect(within(row!).getByRole('button', { name: 'Embed code' })).toBeInTheDocument();
    // The 09--07 Publish/Unpublish toggle (:495, `{{ p.toggle }}`) is a
    // named DEVIATIONS.md §6 deferral -- never rendered, not even disabled.
    expect(within(row!).queryByText(/^(Turn off|Turn on|Unpublish|Publish)$/)).not.toBeInTheDocument();
  });

  // Frame :510-548 "Settings · Speaker portal".
  it('frame :510 Speaker portal -- DIVERGES: Welcome note collapsed to a computed summary line (previously documented, DEC-815)', async () => {
    verbatimLine(507, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Speaker portal</span>");
    renderDrilled('portal');
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    await waitFor(() =>
      expect(within(section).getByText(/Shown above the task list/)).toBeInTheDocument(),
    );
    // Frame :518 draws a full boxed readout of the welcome text; the read
    // view instead renders a computed one-line summary.
    expect(within(section).queryByText('Welcome, speakers!')).not.toBeInTheDocument();
  });

  // Frame :552-575 "Settings · People and roles".
  it('frame :552 People and roles -- DIVERGES: no per-row Change action, no primary Invite-someone control in read mode', async () => {
    verbatimLine(549, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · People and roles</span>");
    renderDrilled('people');
    const section = screen.getByRole('region', { name: 'People and roles' });
    await waitFor(() => expect(within(section).getByText('self@example.com')).toBeInTheDocument());
    // Frame :560 draws a per-row boxed 'Change' beside each person; :565
    // draws a filled, always-present 'Invite someone' primary button. The
    // read view has neither -- both live behind the section-level 'Change'
    // drill (DEC-815).
    const personRow = within(section).getByText('self@example.com').closest('div');
    expect(personRow).not.toBeNull();
    expect(within(section).queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();
  });

  // Frame :578-598 "Settings · Saved embeds" -- reachable only nested
  // inside the Public pages section, never as its own screen.
  it('frame :578 Saved embeds -- DIVERGES: never renders as its own screen (no own back-link/H1/on-off summary, nested in Public pages)', async () => {
    verbatimLine(575, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Saved embeds</span>");
    renderDrilled('public-pages');
    // The frame draws Saved embeds as its own full screen: back '‹
    // Settings', its own H1 'Saved embeds', and an 'N on · N off' summary
    // line under the H1 (:579). None of those exist when Public pages is
    // drilled -- SavedEmbedsPanel renders as a second section INSIDE the
    // Public pages screen, whose own H1 stays 'Public pages'.
    expect(screen.queryByRole('heading', { name: 'Saved embeds' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Public pages' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^\d+ on · \d+ off$/)).not.toBeInTheDocument();
  });
});
