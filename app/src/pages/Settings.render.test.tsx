// DEC-144 layer-2 harness (batch B, task-w3-e; converged w15-e/DEC-691):
// component-render smoke test for the Settings page. Mounts the real
// SettingsPage against mocked fetch routes for every panel it renders
// unconditionally (event settings, tracks/rooms, public pages, speaker
// portal [portal settings + resources], people and roles, your data
// [exports + API tokens]) and asserts each panel's heading renders without
// throwing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './Settings';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const EVENT_ID = 'evt-settings-render';

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
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
    'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
  });
}

describe('SettingsPage render smoke', () => {
  it('mounts every panel without throwing', async () => {
    mockAllSections();

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    // Event settings panel — read-only summary (DEC-728) until drilled.
    await waitFor(() => {
      expect(screen.getByText('DevCon 2026')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Event settings' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('DevCon 2026')).not.toBeInTheDocument();

    // Tracks & rooms panel.
    expect(screen.getByRole('heading', { name: 'Tracks & rooms' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Keynotes')).toBeInTheDocument();
    });
    expect(screen.getByText(/Main Hall/)).toBeInTheDocument();

    // Call for papers panel.
    expect(screen.getByRole('heading', { name: 'Call for papers' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Tell us about your talk.')).toBeInTheDocument();
    });

    // Public pages and embeds panel.
    expect(screen.getByRole('heading', { name: 'Public pages and embeds' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(`/e/devcon-2026/sessions`)).toBeInTheDocument();
    });
    expect(screen.getByText(`/submit/devcon-2026`)).toBeInTheDocument();

    // Speaker portal section (Portal settings + Resources composed).
    expect(screen.getByRole('heading', { name: 'Portal settings' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome, speakers!')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Travel info')).toBeInTheDocument();
    });

    // People and roles panel.
    expect(screen.getByRole('heading', { name: 'People and roles' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('self@example.com')).toBeInTheDocument();
    });

    // Your data section (Exports + API tokens composed).
    expect(screen.getByRole('heading', { name: 'Exports' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Download CSV' })[0]).toHaveAttribute(
      'href',
      `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
    );
    expect(screen.getByRole('heading', { name: 'API Tokens' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('CI pipeline')).toBeInTheDocument();
    });

    // Sessionboard import panel (renders synchronously once eventId
    // resolves; makes no GET requests of its own).
    expect(screen.getByRole('heading', { name: 'Import from Sessionboard' })).toBeInTheDocument();
    expect(screen.getByText(/API token is not implemented in this build/)).toBeInTheDocument();
  });

  // DEC-375: below 700px the rail's section links drill into a single panel
  // via component state only — no URL change, no history entry, no new
  // route. The tertiary back control clears the selection.
  it('drills into a section via the rail and back again without touching the route', async () => {
    mockAllSections();

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('DevCon 2026')).toBeInTheDocument();
    });

    const pathBefore = window.location.pathname + window.location.search + window.location.hash;
    const historyLengthBefore = window.history.length;

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    const peopleLink = within(rail).getByRole('button', { name: 'People and roles' });
    fireEvent.click(peopleLink);

    expect(peopleLink).toHaveClass('chq-settings-rail-link-active');
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe(pathBefore);
    expect(window.history.length).toBe(historyLengthBefore);

    const backButton = screen.getByRole('button', { name: '‹ Settings' });
    fireEvent.click(backButton);

    expect(peopleLink).not.toHaveClass('chq-settings-rail-link-active');
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe(pathBefore);
    expect(window.history.length).toBe(historyLengthBefore);
  });

  // DEC-691: rail converges on the mock's seven sections (docs/design/
  // Chautauqua Settings.dc.html lines 61-215), in this order, plus the
  // honestly-labelled 'Import from Sessionboard' extra.
  it('renders the rail sections in DEC-691 order', async () => {
    mockAllSections();

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('DevCon 2026')).toBeInTheDocument();
    });

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    const labels = within(rail)
      .getAllByRole('button')
      .map((el) => el.textContent);

    expect(labels).toEqual([
      'Event',
      'Call for papers',
      'Tracks and rooms',
      'Public pages and embeds',
      'Speaker portal',
      'People and roles',
      'Your data',
      'Import from Sessionboard',
    ]);
  });

  // DEC-728: the event section's summary/edit drill is URL state, not
  // component state — clicking 'Change' writes ?section=event&edit=1 (and
  // the drilled form is reachable directly via that URL, e.g. via Back).
  it('drills the Event section into its edit form via URL state', async () => {
    mockAllSections();

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('DevCon 2026')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('DevCon 2026')).not.toBeInTheDocument();

    const eventSection = screen.getByRole('region', { name: 'Event settings' });
    fireEvent.click(within(eventSection).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('DevCon 2026')).toBeInTheDocument();
    });
    expect(within(eventSection).queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  it('opens the Event section directly in its edit form when the URL already carries the drill params', async () => {
    mockAllSections();

    render(
      <MemoryRouter initialEntries={['/settings?section=event&edit=1']}>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('DevCon 2026')).toBeInTheDocument();
    });
  });
});
