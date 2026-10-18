// Portals overview render tests (Portals frame, flow 1, frame 01): the
// coverage strip and its Speakers link, the portals table with its
// template and matches-nobody sub-lines, creating a blank or template
// portal (then opening its editor), the zero-portal and no-participation
// states, and copying from another event (CopyFromEventModal) including
// what it skipped and a refused copy.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PortalsOverviewPage } from './PortalsOverviewPage';
import { errorEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { PortalOverview } from './types';

const EVENT_ID = 'evt-portals-overview';
const BASE = `/api/v1/events/${EVENT_ID}/portals`;

function overview(overrides: Partial<PortalOverview> = {}): PortalOverview {
  return {
    portals: [
      { id: 'p-profile', name: 'Profile basics', template: 'profile_basics', who: 'Session status is accepted', participations: 91, items: 2, matchesNobody: false, createdAt: 1 },
      { id: 'p-cfp', name: 'CFP speakers', template: null, who: 'Speakers on accepted sessions that came through the call for papers', participations: 31, items: 5, matchesNobody: false, createdAt: 1 },
      { id: 'p-vol', name: 'Volunteers', template: null, who: 'Role is Volunteer', participations: 0, items: 1, matchesNobody: true, createdAt: Date.now() },
      { id: 'p-press', name: 'Press', template: null, who: 'Role is Press', participations: 0, items: 0, matchesNobody: true, createdAt: Date.UTC(2020, 0, 1) },
    ],
    covered: 91,
    total: 96,
    notInAny: 5,
    overlap: 38,
    templates: [
      { key: 'profile_basics', name: 'Profile basics', blurb: 'Profile and headshot for speakers and sponsor contacts' },
      { key: 'sponsors', name: 'Sponsors', blurb: 'Logo, booth details, session design' },
    ],
    ...overrides,
  };
}

function EditorStub() {
  const location = useLocation();
  const state = location.state as { notice?: string; created?: boolean } | null;
  return (
    <p>
      Editor at {location.pathname} · {state?.notice} · {state?.created ? 'name it' : 'live'}
    </p>
  );
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/settings/portals']}>
      <Routes>
        <Route path="/settings/portals" element={<PortalsOverviewPage />} />
        <Route path="/settings/portals/:portalId" element={<EditorStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

type Calls = ReturnType<typeof mockApi>['mock']['calls'];

function bodiesOf(calls: Calls, method: string, path: string): Record<string, unknown>[] {
  return calls
    .filter(([url, init]) => String(url).split('?')[0] === path && (init?.method ?? 'GET').toUpperCase() === method)
    .map(([, init]) => JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  resetApiCacheForTests();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('PortalsOverviewPage', () => {
  it('renders coverage, the portals table and the starter templates', async () => {
    mockApi({ [`GET ${BASE}`]: overview() });
    renderPage();

    const coverage = await screen.findByRole('group', { name: 'Coverage' });
    expect(within(coverage).getByText('91 of 96')).toBeInTheDocument();
    expect(within(coverage).getByText('participations match at least one portal')).toBeInTheDocument();
    expect(within(coverage).getByText('5')).toBeInTheDocument();
    expect(within(coverage).getByRole('link', { name: 'Open in Speakers ›' })).toHaveAttribute('href', '/speakers?portal=none');
    expect(within(coverage).getByText('38')).toBeInTheDocument();
    expect(within(coverage).getByText('in two or more portals')).toBeInTheDocument();

    expect(screen.getByText('Portals · 4')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(within(rows[1]!).getByText('From a starter template')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('91')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('link', { name: 'Edit Profile basics' })).toHaveAttribute('href', '/settings/portals/p-profile');
    expect(within(rows[2]!).getByText('Speakers on accepted sessions that came through the call for papers')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Added today · matches nobody yet')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('Matches nobody yet')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Libraries' })).toHaveAttribute('href', '/settings/portals/library');
    expect(screen.getByRole('button', { name: 'Use the Sponsors template' })).toBeInTheDocument();
    expect(screen.getByText('Logo, booth details, session design')).toBeInTheDocument();
  });

  it('says everyone is covered when no participation is left out', async () => {
    mockApi({ [`GET ${BASE}`]: overview({ covered: 96, notInAny: 0 }) });
    renderPage();
    expect(await screen.findByText('Everyone gets at least one portal')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in Speakers ›' })).not.toBeInTheDocument();
  });

  it('New portal creates a blank portal and opens it to be named', async () => {
    const fetchMock = mockApi({ [`GET ${BASE}`]: overview(), [`POST ${BASE}`]: { status: 201, body: { id: 'p-new' } } });
    renderPage();
    await screen.findByRole('group', { name: 'Coverage' });
    fireEvent.click(screen.getByRole('button', { name: 'New portal' }));
    expect(await screen.findByText(/Editor at \/settings\/portals\/p-new/)).toHaveTextContent('name it');
    expect(bodiesOf(fetchMock.mock.calls, 'POST', BASE)[0]).toEqual({});
  });

  it('a starter template creates its portal and opens it', async () => {
    const fetchMock = mockApi({ [`GET ${BASE}`]: overview(), [`POST ${BASE}`]: { status: 201, body: { id: 'p-sponsors' } } });
    renderPage();
    await screen.findByRole('group', { name: 'Coverage' });
    fireEvent.click(screen.getByRole('button', { name: 'Use the Sponsors template' }));
    expect(await screen.findByText(/Editor at \/settings\/portals\/p-sponsors/)).toHaveTextContent('Sponsors added. It is live already; nobody was emailed.');
    expect(bodiesOf(fetchMock.mock.calls, 'POST', BASE)[0]).toEqual({ template: 'sponsors' });
  });

  it('a refused create shows the server’s reason', async () => {
    mockApi({
      [`GET ${BASE}`]: overview(),
      [`POST ${BASE}`]: { status: 400, body: errorEnvelope('invalid', 'An event can have at most 40 portals.') },
    });
    renderPage();
    await screen.findByRole('group', { name: 'Coverage' });
    fireEvent.click(screen.getByRole('button', { name: 'New portal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An event can have at most 40 portals.');
    expect(screen.getByRole('button', { name: 'New portal' })).toBeEnabled();
  });

  it('with no portals yet, offers to make one', async () => {
    mockApi({ [`GET ${BASE}`]: overview({ portals: [], covered: 0, notInAny: 96, overlap: 0 }) });
    renderPage();
    expect(await screen.findByText('No portals yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New portal' })).toHaveLength(2);
  });

  it('with no participations yet, explains instead of showing zeros', async () => {
    mockApi({ [`GET ${BASE}`]: overview({ covered: 0, total: 0, notInAny: 0, overlap: 0 }) });
    renderPage();
    expect(await screen.findByText(/No participations yet/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Coverage' })).not.toBeInTheDocument();
  });

  it('shows a load failure', async () => {
    mockApi({ [`GET ${BASE}`]: { status: 500, body: errorEnvelope('internal', 'Something broke on our side.') } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke on our side.');
  });

  it('CopyFromEventModal: copies portals and tiers from another event and reports what was skipped', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: overview(),
      [`GET ${BASE}/copy-sources`]: { events: [{ id: 'evt-2026', name: 'DevFlow Conf 2026', portals: 4, tiers: 2 }] },
      [`POST ${BASE}/copy`]: { portals: 2, tiers: 1, tasks: 5, skipped: ['Portal Profile basics already exists', 'Tier Gold already exists'] },
    });
    renderPage();
    await screen.findByRole('group', { name: 'Coverage' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy from another event' }));
    const dialog = await screen.findByRole('dialog', { name: 'Copy from another event' });
    const copy = within(dialog).getByRole('button', { name: 'Copy' });
    expect(copy).toBeDisabled();
    fireEvent.change(await within(dialog).findByLabelText('Event'), { target: { value: 'evt-2026' } });
    fireEvent.click(within(dialog).getByLabelText('Sponsor tiers · 2'));
    fireEvent.click(within(dialog).getByLabelText('Portals · 4'));
    expect(within(dialog).getByText('Choose portals, tiers, or both.')).toBeInTheDocument();
    expect(copy).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText('Sponsor tiers · 2'));
    fireEvent.click(within(dialog).getByLabelText('Portals · 4'));
    fireEvent.click(copy);
    const done = await screen.findByRole('dialog', { name: 'Copied' });
    expect(within(done).getByText('Copied 2 portals, 1 sponsor tier, 5 library items.')).toBeInTheDocument();
    expect(within(done).getByText('Portal Profile basics already exists')).toBeInTheDocument();
    expect(within(done).getByText('Tier Gold already exists')).toBeInTheDocument();
    expect(bodiesOf(fetchMock.mock.calls, 'POST', `${BASE}/copy`)[0]).toEqual({ sourceEventId: 'evt-2026', portals: true, tiers: true });
    fireEvent.click(within(done).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('CopyFromEventModal: says so when there is no other event, and shows a refused copy', async () => {
    mockApi({
      [`GET ${BASE}`]: overview(),
      [`GET ${BASE}/copy-sources`]: { events: [] },
    });
    renderPage();
    await screen.findByRole('group', { name: 'Coverage' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy from another event' }));
    expect(await screen.findByText('No other events to copy from.')).toBeInTheDocument();
    cleanup();
    vi.unstubAllGlobals();
    resetApiCacheForTests();

    mockApi({
      [`GET ${BASE}`]: overview(),
      [`GET ${BASE}/copy-sources`]: { events: [{ id: 'evt-2026', name: 'DevFlow Conf 2026', portals: 4, tiers: 2 }] },
      [`POST ${BASE}/copy`]: { status: 404, body: errorEnvelope('not_found', 'Event not found') },
    });
    renderPage();
    await screen.findByRole('group', { name: 'Coverage' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy from another event' }));
    const dialog = await screen.findByRole('dialog', { name: 'Copy from another event' });
    fireEvent.change(await within(dialog).findByLabelText('Event'), { target: { value: 'evt-2026' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Event not found');
  });

  it('shows the notice a deleted portal leaves behind', async () => {
    mockApi({ [`GET ${BASE}`]: overview() });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/settings/portals', state: { notice: 'Press deleted' } }]}>
        <Routes>
          <Route path="/settings/portals" element={<PortalsOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Press deleted')).toHaveClass('chq-toast');
  });
});
