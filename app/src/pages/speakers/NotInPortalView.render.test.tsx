// Speakers · Not in any portal (multi-portal flow 1): ?portal=none swaps the
// onboarding grid for the participations no portal covers, with the reason
// and a link to each person's record; the toolbar's portal filter moves
// between the two views, and (multi-portal decision 73) narrows the grid to
// one portal, or (decision 75) to the tasks assigned directly. Bio and
// Headshot columns (decision 75) are read-only.
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

  describe('one portal (multi-portal decision 73)', () => {
    const PORTALS = {
      portals: [
        { id: 'pt-cfp', name: 'CFP speakers', template: null, who: 'Speakers', participations: 12, items: 4, matchesNobody: false, createdAt: 0 },
        { id: 'pt-mods', name: 'Moderators', template: null, who: 'Moderators', participations: 3, items: 2, matchesNobody: false, createdAt: 0 },
      ],
      covered: 15,
      total: 17,
      notInAny: 2,
      overlap: 0,
      templates: [],
    };
    const PORTAL_GRID = {
      ...GRID,
      tasks: [{ id: 'task-prep', kind: 'general', title: 'Panel prep', dueDate: null, required: true, assigned: 1, complete: 0 }],
      rows: [
        {
          contact: {
            id: 'ct-bo',
            name: 'Bo Diaz',
            email: 'bo@example.com',
            company: null,
            hasAccount: true,
            participations: [{ participantId: 'p-bo', submissionId: 'sub-panel', ref: 'SES-033', title: 'Lunch panel', inviteStatus: 'accepted' }],
          },
          cells: [{ taskId: 'task-prep', assignmentId: 'as-bo', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 1,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
    };

    it('lists every portal, and choosing one puts it in the URL', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/portals`]: PORTALS,
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      });
      renderAt('/speakers');
      const select = await screen.findByRole('combobox', { name: 'Filter by portal' });
      await waitFor(() => expect(within(select).getByRole('option', { name: 'Moderators' })).toBeInTheDocument());
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Any portal',
        'CFP speakers',
        'Moderators',
        'Assigned directly',
        'Not in any portal',
      ]);
      fireEvent.change(select, { target: { value: 'pt-mods' } });
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/speakers?portal=pt-mods'));
    });

    it('says a portal with no speakers is a narrowed view, with a way back', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/portals`]: PORTALS,
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      });
      renderAt('/speakers?portal=pt-cfp');
      expect(await screen.findByText('No speakers in this portal.')).toBeInTheDocument();
      expect(screen.queryByText('No speakers on the roster yet.')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Show every portal' }));
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/speakers$/));
    });

    it("Assigned directly reads the direct view, says when there is none, and reminds that scope", async () => {
      const fetchMock = mockApi({
        [`GET /api/v1/events/${EVENT_ID}/portals`]: PORTALS,
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: PORTAL_GRID,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
        [`POST /api/v1/events/${EVENT_ID}/onboarding/remind/preview`]: { drafts: [], skipped: 0, remaining: 0 },
      });
      renderAt('/speakers?portal=direct');
      expect((await screen.findAllByText('Bo Diaz')).length).toBeGreaterThan(0);
      const select = screen.getByRole('combobox', { name: 'Filter by portal' });
      expect(select).toHaveValue('direct');
      expect(within(select).getByRole('option', { name: 'Assigned directly' })).toBeInTheDocument();
      const gridCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('/onboarding?'));
      expect(gridCalls.every((u) => new URL(u, 'http://x').searchParams.get('source') === 'direct')).toBe(true);
      fireEvent.click(screen.getAllByRole('button', { name: 'Remind all outstanding' })[0]!);
      await waitFor(() => {
        const preview = fetchMock.mock.calls.find(([url, init]) => String(url).includes('/onboarding/remind/preview') && init?.method === 'POST');
        expect(JSON.parse(String(preview![1]!.body))).toEqual({ source: 'direct' });
      });
      cleanup();
      vi.unstubAllGlobals();
      mockApi({ [`GET /api/v1/events/${EVENT_ID}/portals`]: PORTALS, [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID });
      renderAt('/speakers?portal=direct');
      expect(await screen.findByText('No tasks are assigned directly.')).toBeInTheDocument();
    });

    it('Bio and Headshot columns are read-only: no task link, no toggle, not in the task filter', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/portals`]: PORTALS,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: {
          ...PORTAL_GRID,
          tasks: [
            { id: 'built-in:bio', kind: 'built_in', title: 'Bio', dueDate: null, required: true, instructions: null, assigned: 1, complete: 0 },
            ...PORTAL_GRID.tasks,
          ],
          rows: PORTAL_GRID.rows.map((r) => ({
            ...r,
            cells: [{ taskId: 'built-in:bio', assignmentId: '', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }, ...r.cells],
          })),
        },
      });
      renderAt('/speakers?portal=pt-mods');
      const table = await screen.findByRole('table');
      const bioHead = within(table).getAllByRole('columnheader')[1]!;
      expect(within(bioHead).getByText('Bio')).toBeInTheDocument();
      expect(within(bioHead).queryByRole('link')).not.toBeInTheDocument();
      expect(within(bioHead).getByText('From the profile · Required')).toBeInTheDocument();
      expect(within(table).queryByRole('button', { name: /Toggle Bio/ })).not.toBeInTheDocument();
      expect(within(table).getByRole('button', { name: /Toggle Panel prep/ })).toBeInTheDocument();
      const taskFilter = screen.getByRole('combobox', { name: 'Filter by task' });
      expect(within(taskFilter).queryByRole('option', { name: 'Bio' })).not.toBeInTheDocument();
    });

    it("reads that portal's grid, and reminds that portal's people", async () => {
      const fetchMock = mockApi({
        [`GET /api/v1/events/${EVENT_ID}/portals`]: PORTALS,
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: PORTAL_GRID,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
        [`POST /api/v1/events/${EVENT_ID}/onboarding/remind/preview`]: { drafts: [], skipped: 0, remaining: 0 },
      });
      renderAt('/speakers?portal=pt-mods');
      expect((await screen.findAllByText('Bo Diaz')).length).toBeGreaterThan(0);
      expect(screen.getByRole('combobox', { name: 'Filter by portal' })).toHaveValue('pt-mods');
      const gridCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('/onboarding?'));
      expect(gridCalls.length).toBeGreaterThan(0);
      expect(gridCalls.every((u) => new URL(u, 'http://x').searchParams.get('portalId') === 'pt-mods')).toBe(true);

      fireEvent.click(screen.getAllByRole('button', { name: 'Remind all outstanding' })[0]!);
      await waitFor(() => {
        const preview = fetchMock.mock.calls.find(([url, init]) => String(url).includes('/onboarding/remind/preview') && init?.method === 'POST');
        expect(preview).toBeTruthy();
        expect(JSON.parse(String(preview![1]!.body))).toEqual({ portalId: 'pt-mods' });
      });
    });
  });
});
