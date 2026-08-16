// DEC-358 wave-46: falsifiability check for item 3 of docs/eval-findings.md's
// batch-A remainder -- "Overview §01 skips-last-hour caption",
// app/src/pages/Overview.tsx:325. CONFIRMED TRUE at this worker's own
// runtime: `.chq-overview-caption` with the text "Skips anyone reminded in
// the last hour" renders IFF the overdue-tasks section has at least one row,
// gated by `payload.overdueTasks.rows.length > 0` (Overview.tsx:324-326). A
// revert to an unconditional caption, or its outright removal, fails this
// file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from './Overview';
import { mockApi } from '../test-utils/mockApi';
import type { OverviewPayload } from './overview/types';

const EVENT_ID = 'evt-render-caption-w46';
const EVENT_SLUG = 'w46-caption-conf';

function eventsListEnvelope() {
  return {
    items: [{ id: EVENT_ID, slug: EVENT_SLUG, timezone: 'America/Chicago', name: 'W46 Caption Conf' }],
    total: 1,
    page: 1,
    perPage: 20,
  };
}

function basePayload(): OverviewPayload {
  return {
    deadlines: {
      formCloseDate: null,
      nextTaskDueDate: null,
      planCloseDate: null,
      planRound: null,
      eventStartDate: null,
    },
    overdueTasks: { total: 0, rows: [] },
    triage: { total: 0, oldestSubmittedAt: null, rows: [] },
    contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
    agendaWork: { unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [] },
    'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 0, conflicts: 0 },
    comms: { sentLast7Days: 0, lastSentAt: null },
    publishedSessionCount: 0,
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

const CAPTION_TEXT = 'Skips anyone reminded in the last hour';

describe('item 3: Overview §01 skips-last-hour caption (Overview.tsx:325)', () => {
  it('renders the caption when there is at least one overdue task row', async () => {
    const payload = basePayload();
    payload.overdueTasks = {
      total: 1,
      rows: [
        {
          assignmentId: 'as-cap-1',
          contactId: 'c-cap-1',
          contactName: 'Priya Nandakumar',
          company: 'Rift Systems',
          taskId: 'task-cap-1',
          taskTitle: 'Upload headshot',
          dueDate: Date.now() - 4 * 86_400_000,
          daysLate: 4,
        },
      ],
    };
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload,
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Priya Nandakumar')).toBeInTheDocument();
    });

    const caption = screen.getByText(CAPTION_TEXT);
    expect(caption).toHaveClass('chq-overview-caption');
  });

  it('omits the caption entirely when there are zero overdue task rows', async () => {
    // Non-brand-new: keep overdueTasks empty but give the event a nonzero
    // publishedSessionCount so §01 renders its per-row empty state
    // ("No overdue speaker tasks.") instead of the whole-page brand-new
    // empty block (isBrandNewEvent, Overview.tsx:45-57).
    const payload = basePayload();
    payload.publishedSessionCount = 3;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload,
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No overdue speaker tasks.')).toBeInTheDocument();
    });

    expect(screen.queryByText(CAPTION_TEXT)).not.toBeInTheDocument();
  });
});
