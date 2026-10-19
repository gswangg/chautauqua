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
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
      { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      { id: 'emb2', name: 'Old widget', surface: 'speakers', format: 'iframe', options: {}, enabled: false },
    ]),
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
      // multi-portal (docs/design/multi-portal/, flow 1): Speaker portal is
      // Portals, followed by Sponsorships
      'Portals',
      'Sponsorships',
      'Your data',
      'People and roles',
    ]);
  });

  // Frame :316-337 "Settings · Event".
  it('frame :316 Event -- MATCHES (wave-22, DEC-663 amendment): the phone CSS stands the head\'s "Change" down in favor of the read drill\'s own footer "Save", which opens the identical edit route the frame\'s footer draws; the frame\'s full Save/Cancel pair renders in the edit drill itself, and the read view\'s absent Cancel is DEVIATIONS.md §7-blessed (no form to submit, so nothing is manufactured to fill the band)', async () => {
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
    // row -- the frame ALSO draws a Save/Cancel pair in a footer AFTER
    // every row (:334). settings.css's data-chq-section='event' phone rule
    // stands the head's own 'Change' action down (display:none) because
    // this read drill's own footer primary ('Save', below) already opens
    // the identical ?section=event&edit=1 route -- two on-screen controls
    // reaching the same edit surface is exactly the case DEC-919 permits
    // standing one down for, a re-line onto the footer rather than a
    // capability removal. The read view itself holds no form to submit, so
    // no Cancel is manufactured here to pair with the Save primary --
    // DEVIATIONS.md §7 records this as blessed (the same
    // never-manufactured-to-fill-the-band rule the portal tasks/profile
    // docks apply). The frame's full Save/Cancel pair renders in the EDIT
    // drill instead (EventSettingsPanel.tsx's footer={{ primary, secondary
    // Cancel }}), where a form genuinely exists to submit or discard.
    const changeBtn = within(section).getByRole('button', { name: 'Change' });
    const firstRow = within(section).getByText('DevCon 2026');
    expect(changeBtn.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const saveBtn = within(section).getByRole('button', { name: 'Save' });
    expect(saveBtn).toHaveClass('chq-settings-drillrow-footer-primary');
    expect(firstRow.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).queryByText('Cancel')).not.toBeInTheDocument();
  });

  // Frame :347-390 "Settings · Tracks and rooms".
  it('frame :347 Tracks and rooms -- MATCHES: per-row Edit box and dashed Add-a-track/Add-a-room row now render in read mode (DEC-919 wave-156)', async () => {
    verbatimLine(344, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Tracks and rooms</span>");
    renderDrilled('tracks-rooms');
    const section = screen.getByRole('region', { name: 'Tracks and rooms' });
    await waitFor(() => expect(within(section).getByText('Keynotes')).toBeInTheDocument());
    // qe-tracks-rooms-read-drill (DEC-919 wave-156): the read view now
    // carries a boxed 'Edit' per row (frame :364/:379) and a dashed
    // 'Add a track'/'Add a room' row closing each list (frame :367/:382),
    // both driving the same edit-drill URL transition the section-level
    // 'Add' action already opens (CSS-only phone visibility, DEC-385/919
    // -- jsdom applies no @media rule so both are present in the DOM here).
    expect(within(section).getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    expect(within(section).getByRole('button', { name: 'Add a track' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add a room' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  // Frame :393-441 "Settings · Your data".
  it('frame :393 Your data -- MATCHES: per-row Download/Revoke actions and the New-token primary render in the read drill', async () => {
    verbatimLine(390, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Your data</span>");
    renderDrilled('your-data');
    const section = screen.getByRole('region', { name: 'Your data' });
    await waitFor(() => expect(within(section).getByText(/API docs/i)).toBeInTheDocument());
    // DEC-919 wave-156 (task qb-settings-yourdata-read-drill): the per-row
    // boxed Download (:409) and Revoke (:423) actions and the filled 46px
    // New-token primary (:426) now render in the read drill itself -- CSS
    // (not a second DOM copy) keeps them phone-only, so jsdom (no @media)
    // sees them mounted here regardless of viewport.
    expect(within(section).getAllByRole('link', { name: 'Download' }).length).toBeGreaterThan(0);
    expect(within(section).getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'New token' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  // Frame :444-477 "Settings · Call for papers".
  it('frame :444 Call for papers -- MATCHES: per-question list with a boxed Edit link per row, carrying the question id (DEC-919 wave-157)', async () => {
    verbatimLine(441, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Call for papers</span>");
    renderDrilled('cfp');
    const section = screen.getByRole('region', { name: 'Call for papers' });
    await waitFor(() => expect(within(section).getByText('1 — Format')).toBeInTheDocument());
    // Frame :467-475 draws one row per custom question (label + kind/
    // required) with a boxed 'Edit' pill; QuestionsSection now renders that
    // list unconditionally (CSS gates it to phone), and delegation to the
    // form builder carries the tapped question's own id in the URL rather
    // than always landing on the builder's index (DEC-919 wave-157 clause
    // (b)) -- the locked 'Title' field never gets a row (only 'Format', the
    // one non-locked field in this fixture, does).
    expect(within(section).queryByText('Title')).not.toBeInTheDocument();
    const row = within(section).getByText('Format').closest('li');
    expect(row).not.toBeNull();
    const editLink = within(row!).getByRole('link', { name: 'Edit' });
    expect(editLink).toHaveAttribute('href', '/submissions/forms?fieldId=f2');
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
    // DEC-728 wave-156: the section also carries the Saved-embeds nested
    // screen's own entry point, addressed to the same `view=embeds` URL
    // the screen itself reads (frame :578, below). Scoped to the
    // "Saved embeds" region -- CallForPapersPanel (another always-mounted
    // section) has its own unrelated "Open" link to the same public submit
    // URL Public pages' CFP row also links.
    await waitFor(() => {
      expect(screen.getByText('1 on · 1 off')).toBeInTheDocument();
    });
    const embedsSection = screen.getByRole('region', { name: 'Saved embeds' });
    expect(within(embedsSection).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/settings?section=public-pages&view=embeds',
    );
  });

  // Frame :510-548 "Settings · Speaker portal".
  it("SUPERSEDED (multi-portal decision 74): frame :510 Speaker portal's Welcome note row is gone from Settings", () => {
    // the welcome note is Profile basics' note, edited in its portal editor
    const decisions = readFileSync(join(REPO_ROOT, 'docs', 'design', 'multi-portal', 'DECISIONS.md'), 'utf-8');
    expect(decisions).toMatch(/\| 74 \| Resources live in the library; Settings › Portals is a summary \|/);
    const panel = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'settings', 'PortalSettingsPanel.tsx'), 'utf-8');
    expect(panel).not.toContain('SettingsEditForm');
  });

  // Frame :552-575 "Settings · People and roles".
  it('frame :552 People and roles -- DIVERGES (narrowed, DEC-919 wave-156): no per-row Change action (DEVIATIONS §6, blessed); the primary Invite-someone control now renders in read mode', async () => {
    verbatimLine(549, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · People and roles</span>");
    renderDrilled('people');
    const section = screen.getByRole('region', { name: 'People and roles' });
    await waitFor(() => expect(within(section).getByText('self@example.com')).toBeInTheDocument());
    // Frame :560 draws a per-row boxed 'Change' beside each person --
    // DEVIATIONS.md §6 blesses its omission (users are org-scoped), never
    // re-litigated here. Frame :565 draws a filled, always-present 'Invite
    // someone' primary button, which DOES now render (DEC-919 wave-156),
    // opening the existing invite dialog directly.
    const personRow = within(section).getByText('self@example.com').closest('div');
    expect(personRow).not.toBeNull();
    const invitePrimary = within(section).getByRole('button', { name: 'Invite someone' });
    expect(invitePrimary).toHaveClass('chq-settings-drillrow-footer-primary');
  });

  // Frame :578-598 "Settings · Saved embeds" -- reached as a NESTED drill
  // under Public pages (`?section=public-pages&view=embeds`, DEC-728
  // wave-156), not an eighth SECTIONS entry.
  it('frame :578 Saved embeds -- MATCHES (nested): its own screen carries an own back-link, own H1, and the on-off summary under it', async () => {
    verbatimLine(575, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Saved embeds</span>");
    mockAllSections();
    render(
      <MemoryRouter initialEntries={['/settings?section=public-pages&view=embeds']}>
        <SettingsPage />
      </MemoryRouter>,
    );
    // The frame draws Saved embeds as its own full screen: its own H1
    // 'Saved embeds' (this file's phoneDrillTitle machinery, Settings.tsx),
    // and an 'N on · N off' summary line under it (:582), computed from the
    // embeds SavedEmbedsPanel already loads. Two h1s carry the text in this
    // harness (the fixed top-level one AND its phone-only twin, `.chq-
    // settings-drill-title` -- settings.css shows exactly one of them per
    // width, jsdom applies no stylesheet so both render, same convention as
    // every other test in this file, see the header comment) -- the twin
    // itself is asserted directly.
    expect(screen.getAllByRole('heading', { name: 'Saved embeds', level: 1 }).length).toBeGreaterThan(0);
    expect(document.querySelector('.chq-settings-drill-title')?.textContent).toBe('Saved embeds');
    await waitFor(() => {
      expect(screen.getByText('1 on · 1 off')).toBeInTheDocument();
    });
    // Back leaves this nested screen for the Public pages read drill it
    // nests under (DESIGN-RULINGS:247), not the section index.
    expect(screen.getByRole('button', { name: '‹ Public pages' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '‹ Settings' })).not.toBeInTheDocument();
  });
});
