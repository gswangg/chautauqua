// DEC-144 layer-2 harness: component-render smoke test for the DEC-370
// Overview worklist page. Mounts the real page against a mocked fetch
// shaped like the v2 payload and asserts named rows render, an action
// fires the right endpoint, and a failed action rolls back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from './Overview';
import { errorEnvelope, mockApi } from '../test-utils/mockApi';
import type { OverviewPayload } from './overview/types';

const EVENT_ID = 'evt-render-2';
const EVENT_SLUG = 'devflow-conf-2027';

function eventsListEnvelope() {
  return {
    items: [{ id: EVENT_ID, slug: EVENT_SLUG }],
    total: 1,
    page: 1,
    perPage: 20,
  };
}

function payload(): OverviewPayload {
  return {
    deadlines: {
      formCloseDate: Date.now() + 6 * 86_400_000,
      nextTaskDueDate: Date.now() + 2 * 86_400_000,
      planCloseDate: Date.now() + 19 * 86_400_000,
      planRound: 2,
      eventStartDate: Date.now() + 94 * 86_400_000,
    },
    overdueTasks: {
      total: 1,
      rows: [
        {
          assignmentId: 'as-1',
          contactId: 'c-1',
          contactName: 'Marcus Okafor',
          company: 'Cloudreach Labs',
          taskId: 'task-1',
          taskTitle: 'Upload headshot',
          dueDate: Date.now() - 4 * 86_400_000,
          daysLate: 4,
        },
      ],
    },
    triage: {
      total: 1,
      oldestSubmittedAt: Date.now() - 6 * 86_400_000,
      rows: [
        {
          submissionId: 'sub-1',
          ref: 'DFC-033',
          title: 'Docs That Answer Back',
          speakerName: 'Dana Whitmore',
          trackName: 'Developer Experience',
          format: 'talk',
          submittedAt: Date.now() - 6 * 86_400_000,
        },
      ],
    },
    contentApproval: {
      total: 1,
      reuploadedCount: 1,
      rows: [
        {
          submissionId: 'sub-2',
          ref: 'DFC-014',
          title: 'Taming 40-Minute CI',
          speakerName: 'Priya Raman',
          fileName: 'slides-v3.pdf',
          uploadedAt: Date.now() - 86_400_000,
          reuploaded: true,
        },
      ],
    },
    agendaWork: {
      unplacedTotal: 0,
      conflictTotal: 2,
      conflicts: [
        {
          day: '2027-03-11',
          startMin: 540,
          endMin: 600,
          roomName: 'Ballroom',
          kind: 'room_overlap',
          entries: [
            { submissionId: 'sub-3', ref: 'DFC-020', title: 'Room Clash Talk A', speakerName: 'Ada Lovelace' },
            { submissionId: 'sub-4', ref: 'DFC-021', title: 'Room Clash Talk B', speakerName: 'Grace Hopper' },
          ],
          resolution: null,
        },
        {
          day: '2027-03-12',
          startMin: 660,
          endMin: 720,
          roomName: 'Studio B',
          kind: 'speaker_overlap',
          entries: [
            { submissionId: 'sub-5', ref: 'DFC-022', title: 'Speaker Clash Talk A', speakerName: 'Katherine Johnson' },
            { submissionId: 'sub-6', ref: 'DFC-023', title: 'Speaker Clash Talk B', speakerName: 'Katherine Johnson' },
          ],
          resolution: null,
        },
      ],
      unplaced: [],
    },
    'triage-counts': { pending: 1, accept_queue: 0, decline_queue: 0 },
    review: { plans: 3, evaluationsSubmitted: 1, evaluationsExpected: 6 },
    speakers: { contactsOwing: 1, overdueAssignments: 1 },
    content: { awaitingApproval: 1 },
    agenda: { unplaced: 0, conflicts: 0 },
    comms: { sentLast7Days: 4, lastSentAt: Date.now() - 2 * 86_400_000 },
  };
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('OverviewPage render smoke (DEC-370)', () => {
  it('renders named rows in every section', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Marcus Okafor')).toBeInTheDocument();
    });

    expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument();
    expect(screen.getByText('Taming 40-Minute CI')).toBeInTheDocument();
    expect(screen.getByText('5 things need your attention')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Comms')).toBeInTheDocument();

    // DEC-589: the conflict caption must render the human wording imported
    // from agenda/ConflictChip.tsx, never the raw wire-vocabulary enum
    // ('room_overlap' / 'speaker_overlap').
    expect(screen.getByText('Two sessions in one room')).toBeInTheDocument();
    expect(screen.getByText('Speaker double-booked')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[A-Z]+_[A-Z]+/);

    // DEC-611: toolbar actions beside the headline.
    const exportLink = screen.getByRole('link', { name: 'Export submissions' });
    expect(exportLink).toHaveAttribute('href', `/api/v1/events/${EVENT_ID}/export/submissions`);
    const newSubmissionLink = screen.getByRole('link', { name: 'New submission' });
    expect(newSubmissionLink).toHaveAttribute('href', '/submissions');

    // DEC-611: Public pages section — one row per surface, linked by the
    // event's real slug (resolved from GET /api/v1/events), never a guessed
    // slugification of the name.
    await waitFor(() => {
      expect(screen.getByText('Public pages')).toBeInTheDocument();
    });
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Speakers')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('CFP form')).toBeInTheDocument();

    // DEC-735: Public pages renders as ONE summary row (not one row per
    // surface) — every surface still links out, named by its own label.
    const sessionsLink = screen.getByRole('link', { name: 'Sessions' });
    const speakersLink = screen.getByRole('link', { name: 'Speakers' });
    const galleryLink = screen.getByRole('link', { name: 'Gallery' });
    const agendaLink = screen.getByRole('link', { name: 'Agenda' });
    const scheduleLink = screen.getByRole('link', { name: 'Schedule' });
    const cfpLink = screen.getByRole('link', { name: 'CFP form' });
    expect(sessionsLink).toHaveAttribute('href', `/e/${EVENT_SLUG}/sessions`);
    expect(speakersLink).toHaveAttribute('href', `/e/${EVENT_SLUG}/speakers`);
    expect(galleryLink).toHaveAttribute('href', `/e/${EVENT_SLUG}/gallery`);
    expect(agendaLink).toHaveAttribute('href', `/e/${EVENT_SLUG}/agenda`);
    expect(scheduleLink).toHaveAttribute('href', `/e/${EVENT_SLUG}/schedule`);
    expect(cfpLink).toHaveAttribute('href', `/submit/${EVENT_SLUG}`);
    // Every surface link lives inside the SAME single row.
    expect(sessionsLink.closest('.chq-overview-row-public')).toBe(cfpLink.closest('.chq-overview-row-public'));
    expect(document.querySelectorAll('.chq-overview-row-public').length).toBe(1);

    // DEC-704: the deadlines strip keeps a FIXED reading order (never
    // reshuffles by nearest date) and names its Review wave round.
    expect(screen.getByText('CFP closes')).toBeInTheDocument();
    expect(screen.getByText('Tasks due')).toBeInTheDocument();
    expect(screen.getByText('Review wave 2')).toBeInTheDocument();
    expect(screen.getByText('Doors open')).toBeInTheDocument();

    // DEC-735: §02's "waiting N days" clause is computed from the row's own
    // submittedAt, never left dangling.
    expect(screen.getByText(/waiting 6 days/)).toBeInTheDocument();
  });

  // DEC-735: the shared-rule regression — §02's triage actions must stay an
  // inline row, §04's conflict actions must stay a column, and the two must
  // never again point at the same layout class.
  it('keeps §02 triage actions and §04 conflict actions on separate layout classes', async () => {
    const p = payload();
    p.agendaWork.conflicts[0]!.resolution = {
      submissionId: 'sub-3',
      ref: 'DFC-020',
      day: '2027-03-11',
      startMin: 690,
      roomId: 'room-2a',
      roomName: 'Ballroom',
      label: 'Move DFC-020 to 11:30',
    };
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: p,
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument());

    const acceptButton = screen.getByRole('button', { name: 'Accept' });
    const triageActions = acceptButton.parentElement!;
    expect(triageActions).toHaveClass('chq-overview-row-actions-inline');

    const conflictActions = document.querySelector('.chq-overview-row-actions-column');
    expect(conflictActions).not.toBeNull();

    expect(triageActions.className.split(' ')).not.toEqual(
      expect.arrayContaining(Array.from(conflictActions!.classList)),
    );
    expect(triageActions).not.toHaveClass('chq-overview-row-actions-column');
    expect(conflictActions).not.toHaveClass('chq-overview-row-actions-inline');
  });

  // DEC-704: "Remind all" must name exactly what it sends — the rendered
  // rows, never the (possibly ROW_CAP'd) server total.
  it('labels Remind all with the rendered row count, not the total, and links the overflow', async () => {
    const p = payload();
    p.overdueTasks = { total: 5, rows: p.overdueTasks.rows };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: p,
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Remind all 1' })).toBeInTheDocument();
    expect(screen.queryByText('Remind all 5')).not.toBeInTheDocument();

    const overflowLink = screen.getByRole('link', { name: '4 more overdue' });
    expect(overflowLink).toHaveAttribute('href', '/speakers');
  });

  it('renders unlinked public-page names with a reason when the slug cannot be resolved', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 20 },
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Public pages')).toBeInTheDocument());
    // DEC-735: a single summary row now carries the unresolved-slug reason
    // once, not once per surface.
    await waitFor(() => {
      expect(screen.getAllByText('Event not found in the events list').length).toBe(1);
    });
    expect(screen.queryByRole('link', { name: 'Sessions' })).not.toBeInTheDocument();
  });

  it('fires the accept endpoint and removes the row optimistically', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
      [`POST /api/v1/events/${EVENT_ID}/submissions/status`]: { updated: 1 },
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.queryByText('Docs That Answer Back')).not.toBeInTheDocument();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/submissions/status');
    });
    expect(call).toBeTruthy();
  });

  // DEC-779: joinSegments must drop a missing track AND a blank format
  // rather than leave a doubled/dangling ' · ' in the triage row meta.
  it('renders the triage row meta with no doubled separator when track and format are absent', async () => {
    const p = payload();
    p.triage.rows[0]!.trackName = null;
    p.triage.rows[0]!.format = '';

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: p,
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument());

    const meta = screen.getByText(/waiting 6 days/);
    expect(meta.textContent).toBe('Dana Whitmore · DFC-033 · waiting 6 days');
    expect(meta.textContent).not.toMatch(/ · · /);
    expect(document.body.textContent).not.toMatch(/ · · /);
  });

  it('rolls back loudly when an action fails', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
      [`POST /api/v1/events/${EVENT_ID}/submissions/status`]: {
        status: 409,
        body: errorEnvelope('conflict', 'Submission already decided'),
      },
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.getByText(/Submission already decided/)).toBeInTheDocument();
    });

    // Row is back — the optimistic removal rolled back.
    expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument();
  });
});
