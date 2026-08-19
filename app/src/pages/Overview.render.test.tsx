// DEC-144 layer-2 harness: component-render smoke test for the DEC-370
// Overview worklist page. Mounts the real page against a mocked fetch
// shaped like the v2 payload and asserts named rows render, an action
// fires the right endpoint, and a failed action rolls back.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    items: [{ id: EVENT_ID, slug: EVENT_SLUG, timezone: 'America/Chicago', name: 'DevFlow Conf 2027' }],
    total: 1,
    page: 1,
    perPage: 20,
  };
}

// DEC-370 amendment (wave 47): the brand-new-event payload -- every
// worklist section, both aggregate flavours of triage, and the published
// count all zero.
function brandNewPayload(): OverviewPayload {
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
    publishedSessionCount: 17,
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

    // DEC-877: the loaded page's root carries the shared measure clamp.
    expect(document.querySelector('.chq-page')).toHaveClass('chq-measure');

    expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument();
    expect(screen.getByText('Taming 40-Minute CI')).toBeInTheDocument();
    expect(screen.getByText('Five things need your attention')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Comms')).toBeInTheDocument();

    // DEC-589: the conflict caption must render the human wording imported
    // from agenda/ConflictChip.tsx, never the raw wire-vocabulary enum
    // ('room_overlap' / 'speaker_overlap').
    expect(screen.getByText('Two sessions in one room')).toBeInTheDocument();
    expect(screen.getByText('Speaker double-booked')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[A-Z]+_[A-Z]+/);

    // DEC-611/DEC-877 amendment: toolbar actions beside the headline. Label
    // shortened to 'Export' so the headline row measures within its cap
    // (h1 + gap + both buttons no longer exceeds `.chq-measure` at desktop
    // widths -- see overview.css .chq-overview-headline-row).
    const exportLink = screen.getByRole('link', { name: 'Export' });
    expect(exportLink).toHaveAttribute('href', `/api/v1/events/${EVENT_ID}/export/submissions`);
    const newSubmissionLink = screen.getByRole('link', { name: 'New submission' });
    expect(newSubmissionLink).toHaveAttribute('href', '/submissions');

    // DEC-877: Public pages is ONE summary sentence naming every live
    // surface, with the event's own public root as the ONLY link (never a
    // chip per surface).
    await waitFor(() => {
      expect(screen.getByText('Public pages')).toBeInTheDocument();
    });
    const publicRootLink = screen.getByRole('link', { name: `/e/${EVENT_SLUG}` });
    expect(publicRootLink).toHaveAttribute('href', `/e/${EVENT_SLUG}`);
    // DEC-611 amendment (wave 2): the Public pages row renders through the
    // SAME quiet-row shape as its "No action needed" siblings, not a
    // bespoke `-public` variant — its value column lands on the siblings'
    // column at their type size.
    const publicRow = publicRootLink.closest('.chq-overview-row-quiet')!;
    // DEC-370 amendment (wave 5): the row states its fact in ONE composed
    // clause (from the server's publishedSessionCount), never an
    // enumerated surface list.
    expect(publicRow.textContent).toBe(`Public pages17 sessions live, with speakers and schedule at /e/${EVENT_SLUG}`);
    // Exactly one link in the row — the public root, not a chip per surface.
    expect(publicRow.querySelectorAll('a').length).toBe(1);
    expect(document.querySelectorAll('.chq-overview-row-public').length).toBe(0);

    // DEC-370 amendment (wave 5): all three quiet rows (Review, Comms,
    // Public pages) share the SAME grid class — one two-column grid, no
    // per-row layout.
    expect(document.querySelectorAll('.chq-overview-row-quiet').length).toBe(3);

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
  it('labels Remind all with the rendered row count, not the total, and shows the overflow summary below the list', async () => {
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

    // DEC-370 amendment (wave 5): small counts are spelled out.
    expect(screen.getByRole('button', { name: 'Remind all one' })).toBeInTheDocument();
    expect(screen.queryByText('Remind all 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Remind all five')).not.toBeInTheDocument();

    // DEC-877: overflow is a below-the-list summary line, never a nav link.
    expect(screen.queryByRole('link', { name: '4 more overdue' })).not.toBeInTheDocument();
    const overflow = screen.getByText('4 more overdue');
    expect(overflow).toHaveClass('chq-overview-overflow');
    const overdueRow = screen.getByText('Marcus Okafor').closest('.chq-overview-row-overdue')!;
    expect(overdueRow.compareDocumentPosition(overflow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  // DEC-370 amendment (wave 47): a brand-new event (every section empty)
  // renders ONE EmptyState block, never the deadline table or the five
  // numbered sections.
  it('renders the brand-new-event block for a fully empty payload, no deadline table, no sections', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: brandNewPayload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Nothing needs you yet')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('DevFlow Conf 2027 · nothing scheduled')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This event has no submissions, no speakers and no schedule. It starts when the call for papers opens.',
      ),
    ).toBeInTheDocument();

    const primary = screen.getByRole('link', { name: 'Set up the call for papers' });
    expect(primary).toHaveAttribute('href', '/settings?section=cfp');
    const secondary = screen.getByRole('link', { name: 'Add a speaker by hand ›' });
    expect(secondary).toHaveAttribute('href', '/speakers');

    // Never the deadline table.
    expect(document.querySelector('.chq-overview-deadlines')).toBeNull();
    // Never any of the five numbered sections.
    expect(screen.queryByText(/01 — Overdue speaker tasks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/02 — Submissions awaiting triage/)).not.toBeInTheDocument();
    expect(screen.queryByText(/03 — Session content awaiting approval/)).not.toBeInTheDocument();
    expect(screen.queryByText('No action needed')).not.toBeInTheDocument();
  });

  // A payload with exactly one non-empty section is NOT brand-new — today's
  // per-section rendering (including the deadline table) stays untouched.
  it('keeps the deadline table and section labels when one section is non-empty', async () => {
    const p = brandNewPayload();
    p.overdueTasks = {
      total: 1,
      rows: [
        {
          assignmentId: 'as-1',
          contactId: 'c-1',
          contactName: 'Marcus Okafor',
          company: null,
          taskId: 'task-1',
          taskTitle: 'Upload headshot',
          dueDate: Date.now() - 4 * 86_400_000,
          daysLate: 4,
        },
      ],
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

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());

    expect(screen.queryByText('Nothing needs you yet')).not.toBeInTheDocument();
    expect(screen.getByText(/01 — Overdue speaker tasks/)).toBeInTheDocument();
    expect(screen.getByText(/02 — Submissions awaiting triage/)).toBeInTheDocument();
    expect(screen.getByText('No action needed')).toBeInTheDocument();
  });

  // DEC-694 amendment (w53-a): the per-row Remind must narrow to exactly
  // that row's contactId and taskId, never a bare taskIds-only payload.
  it('posts the row-scoped contactId and taskId when reminding a single row', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
      [`POST /api/v1/events/${EVENT_ID}/onboarding/remind`]: { sent: 1, skipped: 0, failed: [] },
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Remind' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as Request).toString();
        return url.includes('/onboarding/remind');
      });
      expect(call).toBeTruthy();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/onboarding/remind');
    })!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toEqual({ taskIds: ['task-1'], contactIds: ['c-1'] });
  });

  // DEC-694 amendment (w53-a): the section action must post the deduped
  // contactIds of the listed rows, and its label must spell that count
  // (the distinct people reached), not the row count.
  it('posts the deduped contactIds of the listed rows for the section-level Remind all, and labels it with that count', async () => {
    const p = payload();
    p.overdueTasks = {
      total: 2,
      rows: [
        p.overdueTasks.rows[0]!,
        {
          assignmentId: 'as-2',
          contactId: 'c-1',
          contactName: 'Marcus Okafor',
          company: 'Cloudreach Labs',
          taskId: 'task-2',
          taskTitle: 'Confirm bio',
          dueDate: Date.now() - 2 * 86_400_000,
          daysLate: 2,
        },
      ],
    };

    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: p,
      'GET /api/v1/events': eventsListEnvelope(),
      [`POST /api/v1/events/${EVENT_ID}/onboarding/remind`]: { sent: 1, skipped: 0, failed: [] },
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Marcus Okafor').length).toBe(2));

    // Both rows belong to the same contact (c-1), so the label spells one
    // even though there are two rows.
    const remindAllButton = screen.getByRole('button', { name: 'Remind all one' });
    fireEvent.click(remindAllButton);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as Request).toString();
        return url.includes('/onboarding/remind');
      });
      expect(call).toBeTruthy();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/onboarding/remind');
    })!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.contactIds).toEqual(['c-1']);
    expect(new Set(body.taskIds)).toEqual(new Set(['task-1', 'task-2']));
  });

  // DEC-720 amendment (w53-a): §03's silent 'Ask for changes' column-flip
  // button is gone, replaced by a quiet link to the session's own content
  // screen. Approve keeps posting its explicit content-status decision.
  it('has no "Ask for changes" button; §03 renders an Open link to the content screen, and Approve still posts approved', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
      [`POST /api/v1/submissions/sub-2/content-status`]: { updated: 1 },
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Taming 40-Minute CI')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Ask for changes' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ask for changes')).not.toBeInTheDocument();

    const openLink = screen.getByRole('link', { name: 'Open' });
    expect(openLink).toHaveAttribute('href', '/content/sub-2');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as Request).toString();
        return url.includes('/content-status');
      });
      expect(call).toBeTruthy();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/content-status');
    })!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toEqual({ contentStatus: 'approved' });
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

// DEC-877 amendment: the headline row must not overflow its measure. The
// title is the flexible element (min-width: 0, ellipsis) and the toolbar is
// rigid (flex-shrink: 0) at desktop widths. jsdom does not apply an external
// stylesheet (see page-measure.test.ts / speakers-css.test.ts), so this reads
// the stylesheet's own text rather than rendering + measuring computed style.
describe('overview headline row CSS contract (DEC-877 amendment)', () => {
  it('keeps the title flexible and the toolbar rigid outside @media', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'overview', 'overview.css');
    const css = readFileSync(cssPath, 'utf8');
    const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');

    const headlineMatch = withoutMedia.match(/\.chq-overview-headline\s*\{([^}]*)\}/);
    expect(headlineMatch).not.toBeNull();
    expect(headlineMatch![1]).toMatch(/min-width:\s*0/);

    const toolbarMatch = withoutMedia.match(/\.chq-overview-toolbar\s*\{([^}]*)\}/);
    expect(toolbarMatch).not.toBeNull();
    expect(toolbarMatch![1]).toMatch(/flex-shrink:\s*0/);
  });
});

// Gate-4 wave-6 amendment: pins the five top-third junctions (plus the two
// button/row pitch fixes in the same class) that regressed +86px (+28%)
// against the frame. Reads the raw stylesheet text (jsdom does not apply an
// external stylesheet — see the headline-row contract test above) so the
// declared spacing values themselves can't silently drift back.
describe('overview top-third spacing measure (Gate-4 wave-6 amendment)', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'overview', 'overview.css');
  const css = readFileSync(cssPath, 'utf8');
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');

  function ruleBody(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    const body = match?.[1];
    if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
    return body;
  }

  it('header-rule -> band-rule and band-rule -> toolbar-top: the deadlines strip margin is 8px top / 6px bottom', () => {
    expect(ruleBody('.chq-overview-deadlines')).toMatch(/margin:\s*8px 0 6px/);
  });

  it('stat band: the deadline cell vertical padding is 11px', () => {
    expect(ruleBody('.chq-overview-deadline-cell')).toMatch(/padding:\s*11px 14px/);
  });

  it('h1 ink bottom -> the §01 2px rule: headline-row margin-bottom is 6px and section-header padding-bottom is 3px', () => {
    expect(ruleBody('.chq-overview-headline-row')).toMatch(/margin:\s*0 0 6px/);
    expect(ruleBody('.chq-overview-section-header')).toMatch(/padding-bottom:\s*3px/);
  });

  it('§01 row pitch (DEC-369 amendment, docs/design/Chautauqua Overview.dc.html:79): the overdue row padding matches the shared row padding at 16px', () => {
    expect(ruleBody('.chq-overview-row-overdue')).toMatch(/padding:\s*16px 0/);
    expect(ruleBody('.chq-overview-row')).toMatch(/padding:\s*16px 0/);
  });

  it('toolbar buttons (DEC-369 amendment): vertical padding is 9px (secondary) / 10px (primary), horizontal padding unchanged', () => {
    expect(ruleBody('.chq-overview-toolbar-btn')).toMatch(/padding:\s*9px 16px/);
    expect(ruleBody('.chq-overview-toolbar-btn-primary')).toMatch(/padding:\s*10px 16px/);
  });

  it('"No action needed" quiet-row pitch (DEC-369 amendment, docs/design/Chautauqua Overview.dc.html:172): vertical padding is 14px, value column grid is 200px 1fr', () => {
    expect(ruleBody('.chq-overview-row-quiet')).toMatch(/padding:\s*14px 0/);
    expect(ruleBody('.chq-overview-row-quiet')).toMatch(/grid-template-columns:\s*200px 1fr/);
  });
});

// docs/design/Chautauqua Overview.dc.html:190
// `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
// "Same five sections, one column" (task w2-g): the DOM contract that
// carries the phone reflow -- the deadline strip sits in the shared
// .chq-phone-head sticky scaffold, the rest of the page (headline + all
// five sections) sits in .chq-phone-body, and §02's Waitlist control is
// tagged for phone-only hiding (DEC-610 wave-83 amendment) while Read
// keeps a dedicated hook for its natural-width phone treatment. jsdom
// applies no stylesheet, so this asserts the classes exist on the right
// elements -- the CSS behaviour itself is pinned by the source-scan
// describe block below.
describe('overview phone (390) DOM contract (task w2-g)', () => {
  it('wraps the deadline strip in .chq-phone-head and the rest of the page in .chq-phone-body', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());

    const head = document.querySelector('.chq-phone-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('.chq-overview-deadlines')).not.toBeNull();

    const body = document.querySelector('.chq-phone-body');
    expect(body).not.toBeNull();
    expect(body!.querySelector('.chq-overview-headline')).not.toBeNull();
    expect(body!.textContent).toContain('01 — Overdue speaker tasks');
    expect(body!.textContent).toContain('02 — Submissions awaiting triage');
    expect(body!.textContent).toContain('No action needed');
    // the deadline strip is NOT duplicated into the body
    expect(body!.querySelector('.chq-overview-deadlines')).toBeNull();
  });

  it('tags §02\'s Waitlist control for phone-only hiding and Read for its natural-width phone treatment, without touching Accept/Decline', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument());

    const waitlistBtn = screen.getByText('Waitlist');
    expect(waitlistBtn).toHaveClass('chq-overview-btn-waitlist');

    const readLink = screen.getByText('Read the abstract');
    expect(readLink).toHaveClass('chq-overview-link-btn-read');

    expect(screen.getByText('Accept')).not.toHaveClass('chq-overview-btn-waitlist');
    expect(screen.getByText('Decline')).not.toHaveClass('chq-overview-btn-waitlist');
  });
});

// docs/design/Chautauqua Overview.dc.html:190
// `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
// Source-scan (jsdom applies no @media rule, mirroring the top-third
// spacing describe block above): pins the phone-only behaviour of the two
// new hooks, and that desktop (outside any max-width block) declares no
// rule for either -- "desktop frozen" is a property of the stylesheet
// text, not just of the rendered page.
describe('overview phone (390) CSS contract (task w2-g)', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'overview', 'overview.css');
  const css = readFileSync(cssPath, 'utf8');
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const maxWidthBlocks = [...css.matchAll(/@media\s*\(max-width:\s*700px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
  const phoneCss = maxWidthBlocks.join('\n');

  it('desktop (outside any max-width block) declares no rule for the two phone-only hooks', () => {
    expect(withoutMedia).not.toMatch(/\.chq-overview-btn-waitlist\s*\{/);
    expect(withoutMedia).not.toMatch(/\.chq-overview-link-btn-read\s*\{/);
  });

  it('§02 Waitlist is display:none at phone width (hidden, not removed from the DOM)', () => {
    const match = phoneCss.match(/\.chq-overview-btn-waitlist\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/display:\s*none/);
  });

  it('§02 Read sits at its natural width beside Accept/Decline, not stretched full-width', () => {
    const match = phoneCss.match(/\.chq-overview-link-btn\.chq-overview-link-btn-read\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/width:\s*auto/);
    expect(match![1]).not.toMatch(/width:\s*100%/);
  });
});
