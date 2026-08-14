// DEC-144 layer-2 harness (batch B, task-w3-e; converged w15-e/DEC-691;
// w3-d/DEC-747 folds 'Your data' into one section and drops the eighth
// rail entry): component-render smoke test for the Settings page. Mounts
// the real SettingsPage against mocked fetch routes for every panel it
// renders unconditionally (event settings, tracks/rooms, public pages,
// speaker portal [portal settings + resources], people and roles, your
// data [export pills + API tokens, with the full export table and the
// Sessionboard importer reachable via drill]) and asserts each panel's
// heading renders without throwing.
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
      fields: [
        { id: 'f1', label: 'Title', locked: true },
        { id: 'f2', label: 'Format', locked: false },
      ],
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
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
    expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('DevCon 2026')).not.toBeInTheDocument();

    // Tracks & rooms panel — read-only summary (DEC-747) until drilled.
    const tracksRoomsSection = screen.getByRole('region', { name: 'Tracks and rooms' });
    expect(within(tracksRoomsSection).getByRole('heading', { name: 'Tracks and rooms' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(tracksRoomsSection).getByText('Keynotes')).toBeInTheDocument();
    });
    expect(within(tracksRoomsSection).getByText(/Main Hall/)).toBeInTheDocument();

    // Call for papers panel — read-only summary (DEC-781) until drilled.
    const cfpSection = screen.getByRole('region', { name: 'Call for papers' });
    expect(within(cfpSection).getByRole('heading', { name: 'Call for papers' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(cfpSection).getByText(`${window.location.origin}/submit/devcon-2026`)).toBeInTheDocument();
    });
    expect(within(cfpSection).getByText('1 — Format')).toBeInTheDocument();
    expect(within(cfpSection).queryByDisplayValue('Tell us about your talk.')).not.toBeInTheDocument();

    // Public pages panel — read-only summary (DEC-815) until drilled: one
    // row per public surface, now the frame's four columns (w1-f, DEC-785:
    // name, path, state pill, Embed code), with the View link/embed
    // builder/saved-embeds list behind the section's 'Change'.
    const publicPagesSection = screen.getByRole('region', { name: 'Public pages' });
    expect(within(publicPagesSection).getByRole('heading', { name: 'Public pages' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(publicPagesSection).getByText('Sessions')).toBeInTheDocument();
    });
    expect(within(publicPagesSection).getByText('CFP submit page')).toBeInTheDocument();
    expect(within(publicPagesSection).getByText(`/e/devcon-2026/sessions`)).toBeInTheDocument();
    expect(within(publicPagesSection).queryByRole('link', { name: 'View' })).not.toBeInTheDocument();

    // Speaker portal section — read-only summary (DEC-815); the one real
    // edit surface (ResourcesPanel) lives behind the section's 'Change',
    // so the resource titles themselves are not on the landing view.
    const portalSection = screen.getByRole('region', { name: 'Speaker portal' });
    expect(within(portalSection).getByRole('heading', { name: 'Speaker portal' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(portalSection).getByText(/Shown above the task list · 1 paragraph/)).toBeInTheDocument();
    });
    expect(
      within(portalSection).getByText('Wiki pages and files speakers can access from their portal'),
    ).toBeInTheDocument();
    expect(within(portalSection).queryByText('Travel info')).not.toBeInTheDocument();

    // People and roles panel — read-only summary (DEC-815) whose rows are
    // now the real per-person rows (w1-f, DEC-785: name + role), not a
    // count -- the interactive directory (invite, reset password) still
    // lives behind 'Change'.
    const peopleSection = screen.getByRole('region', { name: 'People and roles' });
    expect(within(peopleSection).getByRole('heading', { name: 'People and roles' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(peopleSection).getByText('self@example.com')).toBeInTheDocument();
    });
    expect(within(peopleSection).queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();

    // Your data section (DEC-747: ONE section -- Exports, API tokens, API
    // docs and Import from Sessionboard). DEC-815: summary rows on landing;
    // the export pills, token flow and importer stay reachable behind
    // 'Change' (FINDINGS w21: chrome fidelity never deletes a capability).
    const yourDataSection = screen.getByRole('region', { name: 'Your data' });
    expect(within(yourDataSection).getByRole('heading', { name: 'Your data' })).toBeInTheDocument();
    expect(within(yourDataSection).getByRole('link', { name: 'chautauqua.cc/docs/api' })).toHaveAttribute(
      'href',
      '/docs/api',
    );
    expect(within(yourDataSection).queryByRole('link', { name: 'Submissions CSV' })).not.toBeInTheDocument();

    fireEvent.click(within(yourDataSection).getByRole('button', { name: 'Change' }));
    await waitFor(() => {
      expect(within(yourDataSection).getByRole('link', { name: 'Submissions CSV' })).toHaveAttribute(
        'href',
        `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
      );
    });
    expect(within(yourDataSection).getByRole('link', { name: 'Contacts CSV' })).toHaveAttribute(
      'href',
      `/api/v1/events/${EVENT_ID}/export/contacts?format=csv`,
    );
    expect(within(yourDataSection).getByRole('link', { name: 'Schedule ICS' })).toHaveAttribute(
      'href',
      `/e/devcon-2026/agenda.ics`,
    );
    expect(within(yourDataSection).getByRole('button', { name: 'Everything JSON' })).toBeInTheDocument();

    expect(within(yourDataSection).getByRole('heading', { name: 'API Tokens' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(yourDataSection).getByText('CI pipeline')).toBeInTheDocument();
    });

    // The full multi-kind export table stays reachable, not deleted, behind
    // a "More export formats" drill (FINDINGS w21) -- ExportsPanel owns its
    // own local read/edit split (w1-f, DEC-785), so a second 'Change'
    // reveals the download table.
    expect(within(yourDataSection).queryByRole('heading', { name: 'Exports' })).not.toBeInTheDocument();
    fireEvent.click(within(yourDataSection).getByRole('button', { name: 'More export formats' }));
    const exportsSubsection = within(yourDataSection)
      .getByRole('heading', { name: 'Exports' })
      .closest('section') as HTMLElement;
    fireEvent.click(within(exportsSubsection).getByRole('button', { name: 'Change' }));
    expect(within(yourDataSection).getAllByRole('link', { name: 'Download CSV' })[0]).toHaveAttribute(
      'href',
      `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
    );

    // Import from Sessionboard is a row inside 'Your data' that drills into
    // the same three-step panel, not an eighth rail entry.
    expect(within(yourDataSection).queryByRole('heading', { name: 'Import from Sessionboard' })).not.toBeInTheDocument();
    fireEvent.click(within(yourDataSection).getByRole('button', { name: 'Import from Sessionboard' }));
    expect(within(yourDataSection).getByRole('heading', { name: 'Import from Sessionboard' })).toBeInTheDocument();
    expect(within(yourDataSection).getByText(/API token is not implemented in this build/)).toBeInTheDocument();
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

  // DEC-747/DEC-691: rail converges on exactly the mock's seven sections
  // (docs/design/Chautauqua Settings.dc.html lines 61-233), in this order --
  // 'Import from Sessionboard' is a row inside 'Your data', not an eighth
  // rail entry.
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
      'Public pages',
      'Speaker portal',
      'People and roles',
      'Your data',
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

    const eventSection = screen.getByRole('region', { name: 'Event' });
    fireEvent.click(within(eventSection).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('DevCon 2026')).toBeInTheDocument();
    });
    expect(within(eventSection).queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  // DEC-896: the rail follows the reader. An explicit click is
  // authoritative immediately; once the observer reports a DIFFERENT
  // section as most visible (simulating a scroll, since jsdom doesn't
  // actually scroll), the rail's active link -- and its aria-current --
  // moves to that section without any further click.
  it('the rail active link follows the section reported in view by IntersectionObserver', async () => {
    mockAllSections();

    let observerCallback: IntersectionObserverCallback | undefined;
    const observedElements: Element[] = [];
    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe(el: Element) {
        observedElements.push(el);
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('DevCon 2026')).toBeInTheDocument();
    });

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    const eventLink = within(rail).getByRole('button', { name: 'Event' });
    const peopleLink = within(rail).getByRole('button', { name: 'People and roles' });

    // Nothing clicked yet: no rail link claims active/aria-current.
    expect(eventLink).not.toHaveClass('chq-settings-rail-link-active');
    expect(peopleLink).not.toHaveAttribute('aria-current', 'true');

    expect(observerCallback).toBeDefined();
    expect(observedElements.length).toBeGreaterThan(0);

    const peopleEl = observedElements.find((el) => el.id === 'chq-settings-section-people')!;
    expect(peopleEl).toBeTruthy();

    // Simulate the reader having scrolled the "People and roles" section
    // into view -- no click involved.
    observerCallback!(
      [{ target: peopleEl, intersectionRatio: 0.9 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    await waitFor(() => {
      expect(peopleLink).toHaveClass('chq-settings-rail-link-active');
    });
    expect(peopleLink).toHaveAttribute('aria-current', 'true');
    expect(eventLink).not.toHaveClass('chq-settings-rail-link-active');
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
