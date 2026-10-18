// Speakers · Not in any portal (multi-portal flow 1): ?portal=none swaps the
// onboarding grid for the participations no portal covers, with the reason
// and a link to each person's record; the toolbar's portal filter moves
// between the two views.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SpeakersPage } from '../Speakers';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-not-in-portal';

const UNMATCHED = {
  rows: [
    { key: 'p:1', contactId: 'ct-wei', name: 'Wei Chen', participation: 'Moderator · DFC-052 Observability for LLM Pipelines', reason: 'Session declined' },
    { key: 'r:2', contactId: 'ct-asha', name: 'Asha Menon', participation: 'Press · no session', reason: 'No portal covers press' },
  ],
  total: 2,
};

const GRID = {
  tasks: [],
  rows: [],
  total: 0,
  page: 1,
  perPage: 50,
  counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
  timezone: 'UTC',
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/speakers"
          element={
            <>
              <SpeakersPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Speakers · Not in any portal', () => {
  it('lists each uncovered participation with its reason and a link to the record', async () => {
    mockApi({ [`GET /api/v1/events/${EVENT_ID}/portals/unmatched`]: UNMATCHED });
    renderAt('/speakers?portal=none');

    expect(await screen.findByText('2 not in any portal')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Participations not in any portal' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Wei Chen')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Session declined')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Press · no session')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('link', { name: 'Open record' })).toHaveAttribute('href', '/contacts/ct-asha');
    expect(screen.getByRole('combobox', { name: 'Filter by portal' })).toHaveValue('none');
  });

  it('searches by person or participation, with a way back from an empty search', async () => {
    mockApi({ [`GET /api/v1/events/${EVENT_ID}/portals/unmatched`]: UNMATCHED });
    renderAt('/speakers?portal=none');
    await screen.findByText('2 not in any portal');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search people' }), { target: { value: 'press' } });
    expect(screen.queryByText('Wei Chen')).not.toBeInTheDocument();
    expect(screen.getByText('Asha Menon')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search people' }), { target: { value: 'nobody' } });
    expect(screen.getByText('No one matches "nobody"')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(screen.getByText('Wei Chen')).toBeInTheDocument();
  });

  it('says so when every participation is in a portal', async () => {
    mockApi({ [`GET /api/v1/events/${EVENT_ID}/portals/unmatched`]: { rows: [], total: 0 } });
    renderAt('/speakers?portal=none');
    expect(await screen.findByText('Every participation is in a portal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Settings · Portals' })).toHaveAttribute('href', '/settings/portals');
  });

  it('the grid head links to the sponsor-session queue only while sessions wait', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/sponsorships`]: { tiers: [], sponsors: [], waiting: 2, formats: [] },
    });
    renderAt('/speakers');
    expect(await screen.findByRole('link', { name: '2 sponsor sessions waiting for approval ›' })).toHaveAttribute(
      'href',
      '/speakers/sponsor-sessions',
    );
    cleanup();
    vi.unstubAllGlobals();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/sponsorships`]: { tiers: [], sponsors: [], waiting: 0, formats: [] },
    });
    renderAt('/speakers');
    await screen.findByRole('combobox', { name: 'Filter by portal' });
    expect(screen.queryByText(/waiting for approval/)).not.toBeInTheDocument();
  });

  it('the portal filter moves between the grid and this list', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/portals/unmatched`]: UNMATCHED,
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
    });
    renderAt('/speakers?portal=none');
    await screen.findByText('2 not in any portal');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by portal' }), { target: { value: 'any' } });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/speakers$/));
    const select = await screen.findByRole('combobox', { name: 'Filter by portal' });
    expect(select).toHaveValue('any');

    fireEvent.change(select, { target: { value: 'none' } });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/speakers?portal=none'));
    expect(await screen.findByText('2 not in any portal')).toBeInTheDocument();
  });
});
