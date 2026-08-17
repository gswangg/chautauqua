// DEC-291 render smoke test: the OnboardingGrid's per-cell "Response"
// control (DEC-662: renamed from "View response", a quiet text link) only
// appears on kind='form' columns AND only once that cell is complete --
// clicking it fetches GET /api/v1/task-assignments/:id/response and opens
// ResponseModal with the fetched fields.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import type { AssignmentResponseDetail, OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-response-render';

const GRID: OnboardingGridResponse = {
  tasks: [
    { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true },
    { id: 'task-2', kind: 'form', title: 'Hotel stay requirement form', dueDate: null, required: true },
  ],
  rows: [
    {
      contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true , participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
      cells: [
        { taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 },
        { taskId: 'task-2', assignmentId: 'as2', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 },
      ],
    },
    {
      // DEC-662: a pending form-kind cell renders no control at all --
      // "Response" only appears once the cell is complete.
      contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false , participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
      cells: [
        { taskId: 'task-1', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        { taskId: 'task-2', assignmentId: 'as4', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
      ],
    },
  ],
  total: 2,
  page: 1,
  perPage: 50,
  counts: { speakers: 2, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
};

const DETAIL: AssignmentResponseDetail = {
  assignmentId: 'as2',
  taskTitle: 'Hotel stay requirement form',
  contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com' },
  status: 'complete',
  completedAt: 1700000000000,
  fields: [
    { label: 'Hotel name', value: 'The Grand' },
    { label: 'Check-out date', value: '' },
  ],
};

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

// DEC-730: complete/pending/overdue are one control family -- all three
// render as real <button>s sharing the chq-speakers-status base class, and
// the grid footer states the one interaction rule.
describe('OnboardingGrid: DEC-730 one status-control family', () => {
  it('renders complete, pending and overdue cells as buttons in the same class family, plus the footer caption', async () => {
    const now = Date.now();
    const overdueGrid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: now - 5 * 86_400_000, required: true }],
      rows: [
        {
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true , participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: now, fileId: null, fileName: null, assignedAt: 0 }],
        },
        {
          contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false , participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 2,
      page: 1,
      perPage: 50,
      counts: { speakers: 2, outstandingRequired: 1, overdue: 1, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: overdueGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    const completeBtn = table.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    const overdueBtn = table.getByRole('button', { name: /^Toggle Sign speaker agreement for Grace Hopper, \d+ days? late$/ });

    expect(completeBtn.tagName).toBe('BUTTON');
    expect(overdueBtn.tagName).toBe('BUTTON');
    // Same control family: both carry the shared base class.
    expect(completeBtn.className.split(/\s+/)).toContain('chq-speakers-status');
    expect(overdueBtn.className.split(/\s+/)).toContain('chq-speakers-status');
    expect(completeBtn.className).toContain('chq-speakers-status-complete');
    expect(overdueBtn.className).toContain('chq-speakers-status-overdue');
    // DEC-789: the visible mark is "OVERDUE" (not "N DAYS LATE"); the day
    // count moves into the accessible name/title instead, so it's not lost.
    expect(overdueBtn).toHaveTextContent('OVERDUE');
    expect(overdueBtn.getAttribute('aria-label')).toMatch(/^Toggle Sign speaker agreement for Grace Hopper, \d+ days? late$/);
    expect(overdueBtn.getAttribute('title')).toMatch(/^\d+ days? late$/);

    // Task header uses the mock's "Due D Mon [· Required]" shape.
    expect(screen.getAllByText(/^Due \d+ \w+ · Required$/).length).toBeGreaterThan(0);

    // Footer caption.
    expect(screen.getByText('Click any status to mark it complete or pending')).toBeInTheDocument();
  });
});

// DEC-662 amendment (wave 55): the title-action row carries a quiet link
// into the Contacts importer, event preselected -- Import is Contacts' job,
// this is just the door in.
describe('OnboardingGrid: DEC-662 import link', () => {
  it('renders NO import link on the grid — ruling A13 places it on the roster (G13 lane-D fix, 04-speakers--00)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    // The frame draws three controls in the title row with the primary
    // flush at the content edge — no CSV link anywhere on the grid; the
    // roster's Add-speaker dialog carries it instead (RosterPanel).
    expect(screen.queryByRole('link', { name: 'Import speakers from a CSV' })).not.toBeInTheDocument();
    const filterRow = screen.getByLabelText('Search speakers').closest('.chq-speakers-filters') as HTMLElement;
    expect(within(filterRow).queryByText(/Import/)).not.toBeInTheDocument();
  });
});

describe('OnboardingGrid: DEC-291/DEC-662 Response control', () => {
  it('shows the control only on a complete form cell (never on a pending one), and opens the modal with fetched fields', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    // Re-skinned OnboardingGrid renders the desktop grid AND the phone-width
    // card list simultaneously in the DOM (they're toggled by a CSS media
    // query, not JS), so a name renders twice -- assert at least one exists.
    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);

    // DEC-662: no email text in the grid row -- emails stay in the contact
    // drawer, the row meta is company + "has account" plain text (wave-4
    // amendment: the .chq-pill chrome was dropped -- plain lowercase meta).
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('grace@example.com')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Acme.*has account/).length).toBeGreaterThan(0);
    expect(document.querySelector('.chq-pill.chq-speakers-has-account')).not.toBeInTheDocument();

    // Ada's task-2 cell is complete -- one "Response" control on the desktop
    // grid and one on the phone card list (toggled by CSS, both in the DOM).
    const responseButtons = screen.getAllByRole('button', { name: 'Response' });
    expect(responseButtons).toHaveLength(2);

    // Grace's task-2 cell is pending -- the toggle still renders (task
    // completion is independent of the form-response control), but no
    // control at all, not even disabled: an affordance with nothing to
    // show renders nothing.
    expect(
      screen.getAllByRole('button', { name: 'Toggle Hotel stay requirement form for Grace Hopper' }).length,
    ).toBeGreaterThan(0);

    responseButtons[0]!.click();

    const dialog = await screen.findByRole('dialog', { name: 'Task response' });
    expect(dialog).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Hotel name')).toBeInTheDocument();
    });
    expect(screen.getByText('The Grand')).toBeInTheDocument();
    // Unanswered field renders an em dash, not omitted.
    expect(screen.getByText('Check-out date')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Close' }).click();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Task response' })).not.toBeInTheDocument();
    });

    // DEC-378: Escape closes the New task dialog too.
    screen.getByRole('button', { name: 'New task' }).click();
    const taskDialog = await screen.findByRole('dialog', { name: 'New task' });
    expect(taskDialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New task' })).not.toBeInTheDocument();
    });
  });
});

// DEC-599/DEC-694 (design v4): the response modal offers exactly ONE
// action, 'Reopen this task', which writes the assignment back to pending
// via the existing PATCH /task-assignments/:id -- reconciled optimistically
// against the grid cell (matching toggleCell), with a loud visible rollback
// if the PATCH fails.
describe('OnboardingGrid: DEC-599/DEC-694 reopen from response modal', () => {
  it('PATCHes status back to pending on Reopen this task and updates the grid cell', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as2': { body: {} },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'Response' })[0]!.click();

    await screen.findByRole('dialog', { name: 'Task response' });
    await waitFor(() => expect(screen.getByText('Hotel name')).toBeInTheDocument());

    const reopen = screen.getByRole('button', { name: 'Reopen this task' });
    const caption = screen.getByText('Sets it back to pending — the next reminder picks it up');
    expect(caption).toBeInTheDocument();
    // v6 frame: the caption sits BELOW the action inside the actions slot.
    expect(
      reopen.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(reopen);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.includes('/task-assignments/as2') && init?.method === 'PATCH';
      });
      expect(calls.length).toBe(1);
      expect(JSON.parse(calls[0]![1]!.body as string)).toEqual({ status: 'pending' });
    });

    // The dialog offers no action once pending -- 'Reopen this task' is the
    // ONE action, only shown against a completed response (design v4).
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reopen this task' })).not.toBeInTheDocument();
    });
  });

  it('rolls back visibly when the reopen PATCH fails', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as2': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'Response' })[0]!.click();

    await screen.findByRole('dialog', { name: 'Task response' });
    await waitFor(() => expect(screen.getByText('Hotel name')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reopen this task' }));

    // Optimistic flip happens first: the action disappears (status is now
    // pending, which renders no action).
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reopen this task' })).not.toBeInTheDocument();
    });

    // ...then rolls back visibly on the failed PATCH: the modal reverts to
    // showing 'Reopen this task' again and a banner names the row and the
    // server-fault cause, not a silent no-op.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reopen this task' })).toBeInTheDocument();
    });
    // DEC-856 (wave-13 amendment): the bound ApiError's own message ('boom')
    // now reaches the banner inside the naming frame -- never collapsed to
    // the generic "didn't save" sentence.
    expect(screen.getByText('Ada Lovelace · Hotel stay requirement form: boom')).toBeInTheDocument();
  });
});

// DEC-694: a per-row 'Remind ‹first name›' quiet tertiary control runs the
// identical preview->confirm->send flow scoped to contactIds:[thatContactId],
// and reports the outcome through the shared describeSendResult -- never a
// locally composed sentence.
describe('OnboardingGrid: DEC-694 per-row remind', () => {
  it('previews and sends scoped to contactIds:[thatContactId], reporting through describeSendResult', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      [`POST /api/v1/events/${EVENT_ID}/onboarding/remind/preview`]: {
        drafts: [{ contactId: 'ct1', email: 'ada@example.com', name: 'Ada Lovelace', subject: 'Action needed', text: 'body' }],
        skipped: 0,
        remaining: 0,
      },
      [`POST /api/v1/events/${EVENT_ID}/onboarding/remind`]: { sent: 1, failed: [], skipped: 0, remaining: 0 },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'Remind Ada' })[0]!.click();

    const dialog = await screen.findByRole('dialog', { name: 'Review reminders' });
    expect(dialog).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText(/Ada Lovelace/).length).toBeGreaterThan(0));

    const previewCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : (input as Request | URL).toString()).includes('/onboarding/remind/preview'),
    );
    expect(previewCall).toBeDefined();
    expect(JSON.parse(previewCall![1]!.body as string)).toEqual({ contactIds: ['ct1'] });

    fireEvent.click(screen.getByRole('button', { name: 'Send 1 reminder' }));

    await waitFor(() => {
      const sendCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.endsWith('/onboarding/remind') && init?.method === 'POST';
      });
      expect(sendCall).toBeDefined();
      expect(JSON.parse(sendCall![1]!.body as string)).toEqual({ contactIds: ['ct1'] });
    });

    // Reported through the shared describeSendResult, never a locally
    // composed "Sent N ..." sentence.
    await waitFor(() => {
      expect(screen.getByText('Sent to 1 contact.')).toBeInTheDocument();
    });
  });
});

// DEC-441 amendment (w52-a): the review dialog opened by "Remind all
// outstanding" must surface the server's batch-cap remainder, not drop it
// on the way from the preview response into RemindPreviewModal's props.
describe('OnboardingGrid: DEC-441 amendment surfaces the preview batch-cap remainder', () => {
  it('renders the "N still outstanding" sentence when the preview response carries remaining: 4', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      [`POST /api/v1/events/${EVENT_ID}/onboarding/remind/preview`]: {
        drafts: [{ contactId: 'ct1', email: 'ada@example.com', name: 'Ada Lovelace', subject: 'Action needed', text: 'body' }],
        skipped: 0,
        remaining: 4,
      },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    fireEvent.click(screen.getByRole('button', { name: 'Remind all outstanding' }));

    await screen.findByRole('dialog', { name: 'Review reminders' });
    await waitFor(() => {
      expect(screen.getByText('4 contacts still outstanding — run it again to continue.')).toBeInTheDocument();
    });
  });
});

// DEC-852: a grace-shifted deadline must be visible before it bites (not
// only once overdue), and a far-dated header column must not read as "this
// year" when it isn't.
describe('OnboardingGrid: DEC-852 due-date visibility', () => {
  function fmt(ts: number, now: number): string {
    const d = new Date(ts);
    const suffix = d.getUTCFullYear() !== new Date(now).getUTCFullYear() ? ` ${d.getUTCFullYear()}` : '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}${suffix}`;
  }

  it('names the due date in the accessible name of a pending, not-yet-overdue cell', async () => {
    const now = Date.now();
    const dueDate = now + 3 * 86_400_000;
    const grid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate, required: true }],
      rows: [
        {
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: now - 86_400_000 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    const expected = fmt(dueDate, now);
    const btn = table.getByRole('button', { name: `Toggle Sign speaker agreement for Ada Lovelace, due ${expected}` });
    expect(btn).toHaveTextContent('Pending');
    expect(btn.getAttribute('title')).toBe(`due ${expected}`);
  });

  it('names the grace-shifted date (not the raw task.dueDate) when the task was assigned after its own due date', async () => {
    const now = Date.now();
    const assignedAt = now;
    const rawDueDate = now - 10 * 86_400_000; // predates assignedAt
    const graceDueDate = assignedAt + 7 * 86_400_000; // effectiveAssignmentDueDate's grace shift
    const grid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: rawDueDate, required: true }],
      rows: [
        {
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    const graceExpected = fmt(graceDueDate, now);
    const rawExpected = fmt(rawDueDate, now);
    expect(graceExpected).not.toBe(rawExpected);

    const btn = table.getByRole('button', { name: `Toggle Sign speaker agreement for Ada Lovelace, due ${graceExpected}` });
    expect(btn).toHaveTextContent('Pending');
    expect(
      table.queryByRole('button', { name: `Toggle Sign speaker agreement for Ada Lovelace, due ${rawExpected}` }),
    ).not.toBeInTheDocument();
  });

  it('shows the year on a header due next year but not on one due this year', async () => {
    const now = Date.now();
    const nowYear = new Date(now).getUTCFullYear();
    const nextYearDue = Date.UTC(nowYear + 1, 5, 15);
    const thisYearDue = Date.UTC(nowYear, 5, 15);
    const grid: OnboardingGridResponse = {
      tasks: [
        { id: 'task-far', kind: 'general', title: 'Far task', dueDate: nextYearDue, required: false },
        { id: 'task-near', kind: 'general', title: 'Near task', dueDate: thisYearDue, required: false },
      ],
      rows: [
        {
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [
            { taskId: 'task-far', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: now },
            { taskId: 'task-near', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: now },
          ],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 2, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    expect(screen.getAllByText(`Due 15 Jun ${nowYear + 1}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Due 15 Jun').length).toBeGreaterThan(0);
    expect(screen.queryByText(`Due 15 Jun ${nowYear}`)).not.toBeInTheDocument();
  });
});

// DEC-830: the roster row's participation control is a MENU of named states
// (not a click-to-cycle control) that writes through
// PATCH /submissions/:submissionId/participants/:participantId (mocked here
// -- this test never imports src/routes/api/submissions.ts), labelled from
// the ONE app/src/pages/speakers/types.ts vocabulary, optimistic with
// rollback on failure.
describe('OnboardingGrid: DEC-830 participation menu', () => {
  it('shows the Not invited / Invited / Confirmed / Declined labels and PATCHes the chosen state on selection', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': { body: {} },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    // GRID's ct1 fixture starts inviteStatus: 'accepted' -> labelled Confirmed.
    const table = within(screen.getByRole('table'));
    const trigger = table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' });
    expect(trigger).toHaveTextContent('Confirmed');

    fireEvent.click(trigger);
    const menu = table.getByRole('menu', { name: 'Participation status for Ada Lovelace' });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Declined/ }));

    // Optimistic: renders the chosen state before the PATCH resolves.
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Declined' })).toBeInTheDocument();
    });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.includes('/submissions/sub-ct1/participants/p-ct1') && init?.method === 'PATCH';
      });
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({ inviteStatus: 'declined' });
    });
  });

  it('rolls back visibly when the PATCH fails', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': {
        status: 500,
        body: { error: { code: 'internal', message: 'boom' } },
      },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' }));
    const menu = table.getByRole('menu', { name: 'Participation status for Ada Lovelace' });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Declined/ }));

    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Declined' })).toBeInTheDocument();
    });

    // ...rolls back visibly on the failed PATCH, and a banner names the
    // speaker and the server-fault cause.
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' })).toBeInTheDocument();
    });
    // DEC-856 (wave-13 amendment): the bound ApiError's own message ('boom')
    // now reaches the banner -- never collapsed to the generic sentence.
    expect(screen.getByText('Ada Lovelace: boom')).toBeInTheDocument();
  });

  it('joins the invite-status selection into the grid request as an additional query param, composing with other filters', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Any participation' }), { target: { value: 'accepted' } });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.includes(`/events/${EVENT_ID}/onboarding?`);
      });
      const call = calls[calls.length - 1];
      expect(call).toBeDefined();
      const raw = typeof call![0] === 'string' ? call![0] : (call![0] as Request | URL).toString();
      const url = new URL(raw.startsWith('http') ? raw : `http://x${raw}`);
      expect(url.searchParams.get('overdueOnly')).toBe('1');
      expect(url.searchParams.get('inviteStatus')).toBe('accepted');
    });
  });
});

// DEC-934 amendment (wave 4): "the roster names the filter it is under" --
// ONE caption under the toolbar, printed only while a taskId/status/
// overdueOnly/inviteStatus predicate narrows the request, reading its
// numbers straight off the payload the grid already fetched (never a second
// query).
describe('OnboardingGrid: DEC-934 amendment names the active narrowing', () => {
  it('prints no caption with no filters active, then names overdueOnly once toggled, then goes quiet again once cleared', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    expect(screen.queryByText(/^Showing \d+ of \d+ speakers/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 2 speakers · overdue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    await waitFor(() => {
      expect(screen.queryByText(/^Showing \d+ of \d+ speakers/)).not.toBeInTheDocument();
    });
  });

  it('names a task-status narrowing by the same "at least one <status> task" phrase DEC-934 specifies', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    fireEvent.change(screen.getByRole('combobox', { name: 'Any task status' }), { target: { value: 'pending' } });

    await waitFor(() => {
      expect(screen.getByText("Showing 2 of 2 speakers · at least one pending task")).toBeInTheDocument();
    });
  });

  it('joins two active filters with "and"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Any participation' }), { target: { value: 'declined' } });

    await waitFor(() => {
      expect(
        screen.getByText('Showing 2 of 2 speakers · overdue and participation declined'),
      ).toBeInTheDocument();
    });
  });
});

// DEC-678 amendment (w3-d): a search that finds nothing is a NARROWING, not
// a fresh/empty roster -- `q` joins hasActiveNarrowing so the search-miss
// empty state renders the 'filtered' voice (never "No speakers on the
// roster yet."), names the term the organiser actually typed, and its
// escape restores the full roster by clearing q too.
describe('OnboardingGrid: DEC-678 amendment -- a search miss renders the filtered voice', () => {
  it('renders the filtered EmptyState naming the search term, and clicking the escape clears q and refetches the full roster', async () => {
    const emptyGrid: OnboardingGridResponse = {
      tasks: GRID.tasks,
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      counts: { speakers: 2, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    // mockApi strips query strings before matching, so it can't return a
    // different body for the q=Zzyx request -- stub fetch directly to
    // branch on the real request URL instead.
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes(`/events/${EVENT_ID}/onboarding`) && url.includes('q=Zzyx')) {
          return Promise.resolve(
            new Response(JSON.stringify(emptyGrid), { status: 200, headers: { 'content-type': 'application/json' } }),
          );
        }
        return realFetch(input, init);
      }),
    );

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const searchInput = screen.getByLabelText('Search speakers');
    fireEvent.change(searchInput, { target: { value: 'Zzyx' } });

    // The search-miss state is FILTERED, not fresh: never the roster's
    // never-had-a-row copy.
    await waitFor(() => {
      expect(screen.queryByText('No speakers on the roster yet.')).not.toBeInTheDocument();
      expect(screen.getByText('No speakers match the current filters.')).toBeInTheDocument();
    });
    // The reason names the actual term, read off filters.q.
    expect(screen.getByText('matching "Zzyx"')).toBeInTheDocument();
    // The narrowing caption above the (now-empty) grid also names it.
    expect(screen.getByText('Showing 0 of 2 speakers · matching "Zzyx"')).toBeInTheDocument();

    // The pager stays visible for a filtered zero-state (chrome is how a
    // filter gets undone) -- unlike the fresh zero-state, which hides it.
    expect(screen.getByText(/^Showing /, { selector: '.chq-summary' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    // The escape clears the search box itself (bound straight to filters.q).
    await waitFor(() => {
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
    // ...and restores the full roster.
    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);
    });
  });
});

// w7-f: the toolbar's constraint caption must name the real skip rule
// planManualReminders applies (src/domain/reminders.ts:20,175 --
// MANUAL_DEDUPE_WINDOW_MS, one hour), and must use the middot separator
// every sibling caption in this product uses, not an ASCII hyphen.
describe('OnboardingGrid: toolbar caption names the actual reminder skip rule', () => {
  it('reads "Skips anyone reminded in the last hour", matching Overview\'s caption for the same rule', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    expect(screen.getByText('Skips anyone reminded in the last hour')).toBeInTheDocument();
  });

  it('separates the narrowing caption clauses with a middot, not an ASCII hyphen', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 2 speakers · overdue')).toBeInTheDocument();
      expect(screen.queryByText(/Showing 2 of 2 speakers - overdue/)).not.toBeInTheDocument();
    });
  });
});

// DEC-920: the roster's file link names the file (was the literal text
// "File" with a generic "Has file" label) -- a cell with an uploaded
// deliverable now reads its accessible name off the filename the server
// joined in (src/server/repo/tasks/grid.ts), never a fixed placeholder.
describe('OnboardingGrid: DEC-920 file link names the file', () => {
  it("renders the cell's file link with the filename as its accessible name and title, not 'Has file'", async () => {
    const fileGrid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'file_request', title: 'Upload headshot', dueDate: null, required: true }],
      rows: [
        {
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [
            {
              taskId: 'task-1',
              assignmentId: 'as1',
              status: 'complete',
              completedAt: 1700000000000,
              fileId: 'file-1',
              fileName: 'ada-headshot-final-v2.jpg',
              assignedAt: 0,
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: fileGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });

    const links = screen.getAllByRole('link', { name: 'Download ada-headshot-final-v2.jpg' });
    // Both the table cell (:552-563) and the card mount (:648-659) render
    // the link, so the DEC-920 guarantee holds at both breakpoints.
    expect(links.length).toBe(2);
    for (const link of links) {
      expect(link).toHaveAttribute('title', 'ada-headshot-final-v2.jpg');
      expect(link).toHaveAttribute('href', '/files/file-1');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link).toHaveTextContent('ada-headshot-final-v2.jpg');
    }
    expect(screen.queryByText('Has file')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Has file' })).not.toBeInTheDocument();
    expect(screen.queryByText('File', { selector: 'a' })).not.toBeInTheDocument();
  });

  it('renders no file link when a cell has no file (fileId/fileName null)', async () => {
    const noFileGrid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'file_request', title: 'Upload headshot', dueDate: null, required: true }],
      rows: [
        {
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [
            {
              taskId: 'task-1',
              assignmentId: 'as1',
              status: 'pending',
              completedAt: null,
              fileId: null,
              fileName: null,
              assignedAt: 0,
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: noFileGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole('link', { name: /Download/ })).not.toBeInTheDocument();
  });
});

// DEC-936: a roster row carries EVERY participation it covers -- when a
// contact has more than one, the identity column renders one menu PER
// session, each labelled with that session's ref, and each PATCHes its own
// participantId/submissionId. A contact with exactly one participation still
// renders the existing single, unlabelled menu (no regression for the
// common case).
describe('OnboardingGrid: one participation menu per session (DEC-936)', () => {
  it('renders two labelled menus for a contact with two participations, each PATCHing its own participantId', async () => {
    const multiGrid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
      rows: [
        {
          contact: {
            id: 'ct-multi',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            company: 'Acme',
            hasAccount: true,
            participations: [
              { participantId: 'p-1', submissionId: 'sub-1', ref: 'SES-001', title: 'Talk One', inviteStatus: 'invited' },
              { participantId: 'p-2', submissionId: 'sub-2', ref: 'SES-002', title: 'Talk Two', inviteStatus: 'accepted' },
            ],
          },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: multiGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-1/participants/p-1': { body: {} },
      'PATCH /api/v1/submissions/sub-2/participants/p-2': { body: {} },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    const table = within(screen.getByRole('table'));

    const menuOne = table.getByRole('button', { name: 'Participation status for Ada Lovelace — SES-001: Invited' });
    const menuTwo = table.getByRole('button', { name: 'Participation status for Ada Lovelace — SES-002: Confirmed' });
    expect(menuOne).toBeInTheDocument();
    expect(menuTwo).toBeInTheDocument();

    // Selecting a new state in SES-001's menu PATCHes ONLY sub-1/p-1.
    fireEvent.click(menuOne);
    fireEvent.click(
      within(table.getByRole('menu', { name: 'Participation status for Ada Lovelace — SES-001' })).getByRole(
        'menuitemradio',
        { name: /^Declined/ },
      ),
    );

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.includes('/submissions/sub-1/participants/p-1') && init?.method === 'PATCH';
      });
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({ inviteStatus: 'declined' });
    });
    // SES-002's menu is untouched -- no PATCH to sub-2/p-2 fired.
    const sub2Call = fetchMock.mock.calls.find(([input]) => String(input).includes('/submissions/sub-2/participants/p-2'));
    expect(sub2Call).toBeUndefined();

    // SES-002's menu still reads Confirmed, unaffected by the SES-001 write.
    expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace — SES-002: Confirmed' })).toBeInTheDocument();
  });

  it('renders one unlabelled menu (no regression) for a contact with a single participation', async () => {
    const singleGrid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
      rows: [
        {
          contact: {
            id: 'ct-single',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            company: 'Navy',
            hasAccount: false,
            participations: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
          },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: singleGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);
    const table = within(screen.getByRole('table'));
    expect(table.getByRole('button', { name: 'Participation status for Grace Hopper: Confirmed' })).toBeInTheDocument();
  });

  // DEC-936: a contact matching the ?inviteStatus=declined filter pill is a
  // row whose (filtered) participation is 'declined' -- the row's menu must
  // reflect that state, not the roster-wide default.
  it('a contact matching the ?inviteStatus=declined pill shows a Declined menu on the row', async () => {
    const declinedFilteredGrid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
      rows: [
        {
          contact: {
            id: 'ct-declined',
            name: 'Rosa Parks',
            email: 'rosa@example.com',
            company: null,
            hasAccount: false,
            participations: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'SES-001', title: 'Talk', inviteStatus: 'declined' }],
          },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: declinedFilteredGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    // Selecting the "Declined" pill in the invite-status filter drives the
    // request that (server-side) narrows to this row -- mockApi ignores the
    // query string, so this exercises the same fixture the ?inviteStatus=
    // declined request would resolve to.
    await waitFor(() => screen.getAllByText('Rosa Parks').length > 0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Any participation' }), { target: { value: 'declined' } });

    await waitFor(() => {
      const table = within(screen.getByRole('table'));
      expect(table.getByRole('button', { name: 'Participation status for Rosa Parks: Declined' })).toBeInTheDocument();
    });
  });
});

// DEC-933/DEC-934 (task-w24-c): task column Edit/Remove controls + the
// DEC-934 not-chasing strip for 'invited'/'declined' rows.
describe('OnboardingGrid: DEC-933/DEC-934 task Edit/Remove + not-chasing rows', () => {
  const TASK_GRID: OnboardingGridResponse = {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
    rows: [
      {
        contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk One', inviteStatus: 'accepted' }] },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false, participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Talk Two', inviteStatus: 'accepted' }] },
        cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        // A stale assignment: the participant was later un-confirmed but the
        // task_assignment row still exists -- counted toward Remove's N/M
        // (DEC-933: "the grid rows already in memory", no extra filter) but
        // its cell must never render in the grid (DEC-934: not-chasing).
        contact: { id: 'ct3', name: 'Marie Curie', email: 'marie@example.com', company: null, hasAccount: false, participations: [{ participantId: 'p-ct3', submissionId: 'sub-ct3', ref: 'SES-003', title: 'Talk Three', inviteStatus: 'invited' }] },
        cells: [{ taskId: 'task-1', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        contact: { id: 'ct4', name: 'Rosalind Franklin', email: 'rosalind@example.com', company: null, hasAccount: false, participations: [{ participantId: 'p-ct4', submissionId: 'sub-ct4', ref: 'SES-004', title: 'Talk Four', inviteStatus: 'declined' }] },
        cells: [],
      },
    ],
    total: 4,
    page: 1,
    perPage: 50,
    // DEC-934: the server-side aggregate already excludes ct3/ct4 (composed
    // from acceptedSpeakerExistsForContact) -- outstandingRequired counts
    // only ct1's pending required assignment, NOT ct3's stray one.
    counts: { speakers: 4, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
  };

  it('DEC-934 amendment (wave 4): a not-chasing row keeps its cell (quiet, non-actionable), captions itself under the identity cell, and the header summary matches the server counts (excluding those rows)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Marie Curie').length > 0);

    const table = within(screen.getByRole('table'));
    // ct3 (invited-only) carries the not-chasing caption, beneath its
    // identity cell -- naming the invite state without the old "invite
    // invited" echo.
    expect(
      table.getAllByText("Invited - not confirmed yet. Confirm participation to assign this event's tasks."),
    ).toHaveLength(1);
    // ct4 (declined-only) carries its own DEC-829 muted-cell treatment
    // instead (covered below), not this caption.
    expect(
      table.queryByText("Declined. Confirm participation to assign this event's tasks."),
    ).not.toBeInTheDocument();

    // ct3's stray assignment still RENDERS (no assign/complete/toggle
    // affordance: a plain status label, not a button) -- it is not hidden.
    expect(
      table.queryByRole('button', { name: /Toggle Sign speaker agreement for Marie Curie/ }),
    ).not.toBeInTheDocument();
    const marieRow = table.getByText('Marie Curie').closest('tr')!;
    expect(within(marieRow).getByText('Pending')).toHaveClass('chq-speakers-status');

    // The row's own participation control stays live -- it IS the fix.
    expect(
      table.getByRole('button', { name: 'Participation status for Marie Curie: Invited' }),
    ).toBeInTheDocument();
    expect(
      table.getByRole('button', { name: 'Participation status for Rosalind Franklin: Declined' }),
    ).toBeInTheDocument();

    // The printed summary reads straight off the server's counts (which
    // already exclude ct3/ct4's stray assignments) -- "1", never "2".
    expect(screen.getByText('1', { selector: 'strong' })).toBeInTheDocument();
    const summary = screen.getByText(/tasks open/).closest('span');
    expect(summary).toHaveTextContent('4 accepted');
    expect(summary).toHaveTextContent('1 tasks open');
    expect(summary).toHaveTextContent('0 overdue');
  });

  // DEC-829 amendment (wave 59): a declined-only row renders its actual
  // cells (muted when incomplete) instead of the DEC-934 strip, keeps
  // completed history visible, shows a quiet "Not chased" marker, and
  // offers no per-row remind control.
  it('DEC-829: a declined-only row renders muted cells + a quiet marker, not the strip, and no Remind control', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Rosalind Franklin').length > 0);

    const table = within(screen.getByRole('table'));
    const row = table.getByText('Rosalind Franklin').closest('tr')!;
    const rowScope = within(row);

    // No strip text for this row.
    expect(rowScope.queryByText(/Not chasing/)).not.toBeInTheDocument();
    // Quiet row-level marker instead of the per-row Remind control.
    expect(rowScope.getByText('Not chased')).toHaveClass('chq-speakers-not-chased-marker');
    expect(rowScope.queryByRole('button', { name: /^Remind/ })).not.toBeInTheDocument();
    // No assignment exists for this row's task (cells: []), so the cell
    // renders the em-dash "no assignment" placeholder, not a toggle.
    expect(
      rowScope.queryByRole('button', { name: /Toggle Sign speaker agreement for Rosalind Franklin/ }),
    ).not.toBeInTheDocument();
  });

  it('Ruling A12: the task column header renders exactly one Edit link and no Remove link, and Remove appears once the editor is open', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const header = within(screen.getByRole('columnheader', { name: /Sign speaker agreement/ }));
    expect(header.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(header.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    fireEvent.click(header.getByRole('button', { name: 'Edit' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit task' });
    expect(within(editDialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('Edit opens TaskModal in edit mode prefilled, and PATCHes only title/dueDate/required (never kind/formId)', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/tasks/task-1': { id: 'task-1', kind: 'general', title: 'Sign the updated agreement', dueDate: null, required: true },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Edit' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
    const titleInput = within(dialog).getByRole('textbox', { name: 'Task' }) as HTMLInputElement;
    expect(titleInput.value).toBe('Sign speaker agreement');
    // Kind is fixed, not an interactive segmented control, in edit mode.
    expect(within(dialog).queryByRole('group', { name: 'Kind' })).not.toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: 'Sign the updated agreement' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.endsWith('/tasks/task-1') && init?.method === 'PATCH';
      });
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({
        title: 'Sign the updated agreement',
        dueDate: null,
        required: true,
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit task' })).not.toBeInTheDocument();
    });
  });

  it('Remove opens a ConfirmDialog that fetches the event-wide tally from the server (not the grid page), then DELETEs and refetches', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'GET /api/v1/tasks/task-1/delete-preview': {
        taskId: 'task-1',
        title: 'Sign speaker agreement',
        counts: { assigned: 812, completed: 401, responses: 118, files: 5 },
      timezone: 'UTC',
      },
      'DELETE /api/v1/tasks/task-1': { ok: true },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    // Ruling A12: Remove now lives inside the editor Edit opens.
    fireEvent.click(table.getByRole('button', { name: 'Edit' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit task' });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove task' });

    // Server-side counts (812/401), never the grid page's -- TASK_GRID only
    // seeds a handful of rows, so a passing assertion here proves the
    // numbers came from the mocked delete-preview response, not visibleRows.
    await waitFor(() => {
      expect(dialog).toHaveTextContent(
        '812 speakers are assigned this task and 401 have completed it. Their uploaded files stay in the files library; their form responses do not — 118 responses will be deleted.',
      );
    });
    expect(within(dialog).getByRole('button', { name: 'Remove task' })).not.toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove task' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.endsWith('/tasks/task-1') && init?.method === 'DELETE';
      });
      expect(call).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Remove task' })).not.toBeInTheDocument();
    });

    // Refetches the grid (not a client-side splice) -- one more GET beyond
    // the initial load.
    const gridCalls = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      return url.includes(`/events/${EVENT_ID}/onboarding?`);
    });
    expect(gridCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('Remove: while the delete-preview is in flight the dialog says so and disables the destructive confirm', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    // mockApi resolves handlers synchronously, which can't model an
    // in-flight request -- stub the delete-preview call directly with a
    // fetch mock we control the resolution timing of.
    let resolvePreview: (value: Response) => void = () => {};
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/tasks/task-1/delete-preview')) {
          return new Promise<Response>((resolve) => {
            resolvePreview = resolve;
          });
        }
        return realFetch(input, init);
      }),
    );

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Edit' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit task' });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove task' });
    expect(dialog).toHaveTextContent('Counting affected speakers');
    expect(within(dialog).getByRole('button', { name: 'Remove task' })).toBeDisabled();

    resolvePreview(
      new Response(
        JSON.stringify({
          taskId: 'task-1',
          title: 'Sign speaker agreement',
          counts: { assigned: 4, completed: 1, responses: 0, files: 0 },
      timezone: 'UTC',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Remove task' })).not.toBeDisabled();
    });
  });

  it('Remove: a failed delete-preview surfaces the error and never offers the destructive confirm', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'GET /api/v1/tasks/task-1/delete-preview': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Edit' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit task' });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove task' });
    await waitFor(() => {
      expect(dialog).toHaveTextContent('Could not load the delete preview');
    });
    expect(within(dialog).getByRole('button', { name: 'Remove task' })).toBeDisabled();
  });
});

// DEC-730 amendment (wave 39): the first column carries a participation
// control (ParticipationMenu) as well as the speaker's identity -- its
// header must name both axes, not just "Speaker".
describe('OnboardingGrid: DEC-730 amendment matrix header names both axes', () => {
  it('renders the first column header as Speaker + Participation', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    const headers = table.getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent(/Speaker/);
    expect(headers[0]).toHaveTextContent(/Participation/);
  });

  it('renders each task title in its own .chq-speakers-task-title element', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    const title = table.getByText('Sign speaker agreement');
    expect(title).toHaveClass('chq-speakers-task-title');
  });
});

// DEC-934 amendment: "Send portal invite" only where inviting is still
// possible -- an account rules it out (DEC-805), and now so does an
// already-invited row, which renders NOTHING in that spot (wave-4 amendment:
// the redundant 'REMINDED' marker was deleted, since the skip caption
// already names this state). The invite state is read straight off
// participations[].inviteStatus, the field the roster row model already
// carries.
describe('OnboardingGrid: DEC-934 amendment "Send portal invite" gates on not-yet-invited too', () => {
  function gridWithRows(rows: OnboardingGridResponse['rows']): OnboardingGridResponse {
    return {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
      rows,
      total: rows.length,
      page: 1,
      perPage: 50,
      counts: { speakers: rows.length, outstandingRequired: rows.length, overdue: 0, outstandingContacts: rows.length },
      timezone: 'UTC',
    };
  }

  function cellFor(assignmentId: string) {
    return { taskId: 'task-1', assignmentId, status: 'pending' as const, completedAt: null, fileId: null, fileName: null, assignedAt: 0 };
  }

  it('has-account: neither the control nor the marker renders', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWithRows([
        {
          contact: {
            id: 'ct-has-account',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            company: 'Navy',
            hasAccount: true,
            participations: [{ participantId: 'p1', submissionId: 'sub1', ref: 'SES-001', title: 'Talk', inviteStatus: 'none' }],
          },
          cells: [cellFor('as1')],
        },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);

    const table = within(screen.getByRole('table'));
    expect(table.queryByRole('button', { name: 'Send portal invite' })).not.toBeInTheDocument();
    expect(table.queryByText('REMINDED')).not.toBeInTheDocument();
  });

  it('no-account, not yet invited: the control renders', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWithRows([
        {
          contact: {
            id: 'ct-not-invited',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            company: 'Acme',
            hasAccount: false,
            participations: [{ participantId: 'p1', submissionId: 'sub1', ref: 'SES-001', title: 'Talk', inviteStatus: 'none' }],
          },
          cells: [cellFor('as1')],
        },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    expect(table.getByRole('button', { name: 'Send portal invite' })).toBeInTheDocument();
    expect(table.queryByText('REMINDED')).not.toBeInTheDocument();
  });

  it('no-account, already invited: neither the control nor a marker renders (wave-4: the extra EMAILED marker was deleted as redundant with the toolbar skip caption)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWithRows([
        {
          contact: {
            id: 'ct-already-invited',
            name: 'Marie Curie',
            email: 'marie@example.com',
            company: null,
            hasAccount: false,
            participations: [{ participantId: 'p1', submissionId: 'sub1', ref: 'SES-001', title: 'Talk', inviteStatus: 'invited' }],
          },
          cells: [cellFor('as1')],
        },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Marie Curie').length > 0);

    const table = within(screen.getByRole('table'));
    expect(table.queryByRole('button', { name: 'Send portal invite' })).not.toBeInTheDocument();
    expect(table.queryByText('REMINDED')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-speakers-invited-marker')).not.toBeInTheDocument();
  });
});

// DEC-829 amendment (wave 59): a declined-only row can carry REAL
// assignment history (tasks assigned while the participant was still
// active) -- the muted-cell treatment must keep completed cells visible and
// only mute the incomplete ones, and a mixed-status row (any active
// participation) must render exactly as before.
describe('OnboardingGrid: DEC-829 amendment muted-cell treatment for a declined-only row', () => {
  function gridFor(rows: OnboardingGridResponse['rows']): OnboardingGridResponse {
    return {
      tasks: [
        { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true },
        { id: 'task-2', kind: 'general', title: 'Upload headshot', dueDate: null, required: true },
      ],
      rows,
      total: rows.length,
      page: 1,
      perPage: 50,
      counts: { speakers: rows.length, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
      timezone: 'UTC',
    };
  }

  it('a declined-only row with real assignment history mutes the incomplete cell but keeps the complete cell live', async () => {
    const grid = gridFor([
      {
        contact: {
          id: 'ct-declined-history',
          name: 'Nina Byte',
          email: 'nina@example.com',
          company: null,
          hasAccount: false,
          participations: [{ participantId: 'p1', submissionId: 'sub1', ref: 'SES-001', title: 'Talk', inviteStatus: 'declined' }],
        },
        cells: [
          { taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 },
          { taskId: 'task-2', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        ],
      },
    ]);

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Nina Byte').length > 0);

    const table = within(screen.getByRole('table'));
    const row = table.getByText('Nina Byte').closest('tr')!;
    const rowScope = within(row);

    expect(rowScope.getByText('Not chased')).toHaveClass('chq-speakers-not-chased-marker');
    expect(rowScope.queryByRole('button', { name: /^Remind/ })).not.toBeInTheDocument();

    // Completed cell renders normally, no muted wrapper.
    const completeBtn = rowScope.getByRole('button', { name: 'Toggle Sign speaker agreement for Nina Byte' });
    expect(completeBtn).toHaveTextContent('Complete');
    expect(completeBtn.closest('.chq-speakers-cell')).not.toHaveClass('chq-speakers-cell-muted');

    // Pending (incomplete) cell renders muted, but the toggle itself still
    // works -- only the visual treatment changes.
    const pendingBtn = rowScope.getByRole('button', { name: 'Toggle Upload headshot for Nina Byte' });
    expect(pendingBtn).toHaveTextContent('Pending');
    expect(pendingBtn.closest('.chq-speakers-cell')).toHaveClass('chq-speakers-cell-muted');
  });

  it('a row with one declined and one accepted participation renders normally (no marker, no muting, Remind control present)', async () => {
    const grid = gridFor([
      {
        contact: {
          id: 'ct-mixed',
          name: 'Otto Base',
          email: 'otto@example.com',
          company: null,
          hasAccount: false,
          participations: [
            { participantId: 'p1', submissionId: 'sub1', ref: 'SES-001', title: 'Talk One', inviteStatus: 'declined' },
            { participantId: 'p2', submissionId: 'sub2', ref: 'SES-002', title: 'Talk Two', inviteStatus: 'accepted' },
          ],
        },
        cells: [
          { taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        ],
      },
    ]);

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Otto Base').length > 0);

    const table = within(screen.getByRole('table'));
    const row = table.getByText('Otto Base').closest('tr')!;
    const rowScope = within(row);

    expect(rowScope.queryByText('Not chased')).not.toBeInTheDocument();
    expect(rowScope.getByRole('button', { name: 'Remind Otto' })).toBeInTheDocument();

    const pendingBtn = rowScope.getByRole('button', { name: 'Toggle Sign speaker agreement for Otto Base' });
    expect(pendingBtn.closest('.chq-speakers-cell')).not.toHaveClass('chq-speakers-cell-muted');
  });
});

// DEC-265 amendment (error-states rule 8): a rolled-back optimistic write on
// the grid's own cell toggle must announce itself -- a banner naming the row
// and the server-fault cause, with Try again (reissues the identical PATCH)
// and Reload the grid (refetches) as the two real recovery actions -- and
// the reverted cell keeps a 'not saved' marker until the banner clears.
describe('OnboardingGrid: DEC-265 rolled-back cell write announces itself', () => {
  it('reverts the cell, renders a banner naming the speaker + task, and marks the cell not saved', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as3': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);

    const table = within(screen.getByRole('table'));
    const cellBtn = table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' });
    fireEvent.click(cellBtn);

    // Optimistic flip first: pending -> complete.
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' })).toHaveTextContent('Complete');
    });

    // Rolls back, banner names the row + task, cause in the server-fault
    // register (never blaming the input), and the cell carries the 'not
    // saved' marker (weight/rule, no colour) until the banner clears.
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' })).toHaveTextContent('Pending · not saved');
    });
    // DEC-856 (wave-13 amendment): the bound ApiError's own message ('boom')
    // now reaches the banner inside the naming frame -- never collapsed to
    // the generic "didn't save" sentence.
    expect(screen.getByText('Grace Hopper · Sign speaker agreement: boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument();
  });

  it('Try again reissues the identical PATCH and clears both the banner and the marker on success', async () => {
    let attempt = 0;
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as3': () => {
        attempt += 1;
        if (attempt === 1) {
          return { status: 500, body: { error: { code: 'internal', message: 'boom' } } };
        }
        return { body: {} };
      },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
    expect(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' })).toHaveTextContent('Pending · not saved');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' })).toHaveTextContent('Complete');
    });
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/didn't save/),
    ).not.toBeInTheDocument();

    const patchCalls = fetchMock.mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      return url.includes('/task-assignments/as3') && init?.method === 'PATCH';
    });
    expect(patchCalls.length).toBe(2);
    expect(JSON.parse(patchCalls[0]![1]!.body as string)).toEqual({ status: 'complete' });
    expect(JSON.parse(patchCalls[1]![1]!.body as string)).toEqual({ status: 'complete' });
  });

  it('Reload the grid refetches from the current filters/page and clears the banner', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as3': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument();
    });

    const gridCallsBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes(`/events/${EVENT_ID}/onboarding`),
    ).length;

    fireEvent.click(screen.getByRole('button', { name: 'Reload the grid' }));

    await waitFor(() => {
      const gridCallsAfter = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes(`/events/${EVENT_ID}/onboarding`),
      ).length;
      expect(gridCallsAfter).toBe(gridCallsBefore + 1);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reload the grid' })).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(/didn't save/),
    ).not.toBeInTheDocument();
  });

  it('renders no banner on a successful cell write', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as3': { body: {} },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' }));

    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' })).toHaveTextContent('Complete');
    });
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.queryByText(/didn't save/)).not.toBeInTheDocument();
  });
});

// DEC-678 amendment (B7, wave 47): a settled zero-row grid renders
// EmptyState instead of the <table>/phone-card list -- never the old
// filtered-voice sentence parked inside a full <thead>.
const EMPTY_GRID: OnboardingGridResponse = {
  tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
  rows: [],
  total: 0,
  page: 1,
  perPage: 50,
  counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
      timezone: 'UTC',
};

describe('OnboardingGrid: B7 empty states (DEC-678 amendment, wave 47)', () => {
  it('renders the fresh EmptyState (no table/thead, no filtered-voice copy) when the roster has never held a row', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: EMPTY_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('No speakers on the roster yet.')).toBeInTheDocument();
    });
    expect(screen.getByText('Speakers appear here once a submission is accepted.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(document.querySelector('thead')).not.toBeInTheDocument();
    expect(screen.queryByText(/match the current filters/)).not.toBeInTheDocument();
    // 'fresh' never renders an escape link -- there is no filter to clear.
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state hides the
    // pager -- 'Showing 0 of 0' with Prev/Next under a block that has never
    // held a row is chrome over nothing.
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByText('Click any status to mark it complete or pending')).not.toBeInTheDocument();
  });

  it('renders the filtered EmptyState, names the active facet, offers the escape, and keeps the filter row mounted', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: EMPTY_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    // The filter row is present from first paint (grid.tasks fed by the
    // empty grid's payload).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Overdue only' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));

    await waitFor(() => {
      expect(screen.getByText('No speakers match the current filters.')).toBeInTheDocument();
    });
    expect(screen.getByText('overdue')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(document.querySelector('thead')).not.toBeInTheDocument();

    // Filter row stays mounted underneath the empty state.
    expect(screen.getByRole('button', { name: 'Overdue only' })).toBeInTheDocument();

    // DEC-678 amendment (B7 rule 5, wave 53): a FILTERED zero-state keeps
    // the pager -- chrome is how a filter gets undone.
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    const escape = screen.getByRole('button', { name: 'Clear filters' });
    expect(escape).toBeInTheDocument();
    fireEvent.click(escape);

    // Clearing resets the narrowing facet, which re-requests the grid
    // without overdueOnly -- the caption above the (still-empty) grid goes
    // quiet again.
    await waitFor(() => {
      expect(screen.queryByText(/^Showing \d+ of \d+ speakers/)).not.toBeInTheDocument();
    });
    expect(screen.getByText('No speakers on the roster yet.')).toBeInTheDocument();
  });

  it('still paints the loading skeleton, not an empty state, while the grid request is in flight', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: EMPTY_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    // mockApi's fetch is an async function -- immediately after render,
    // before its promise chain has resolved, the grid's own `loading` state
    // is still true (set synchronously in the mount effect), so this
    // synchronous assertion catches the skeleton frame before it flips.
    expect(document.querySelector('.chq-skeleton-frame')).not.toBeNull();
    // Post-eval polish: the placeholder rows are announced, not silent, and
    // the label names this region's own noun rather than the generic
    // 'Loading…' fallback -- the same shape ContactsTable already used.
    const status = document.querySelector('.chq-skeleton')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Loading speakers…');
    expect(screen.queryByText('No speakers on the roster yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No speakers match the current filters.')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No speakers on the roster yet.')).toBeInTheDocument();
    });
  });
});

// DEC-829 amendment (w61-e): the per-row "Remind {first}" control now also
// goes quiet when a row has nothing outstanding (every existing cell already
// complete) -- a SECOND, independent reason alongside declinedOnly's marker.
// A fully-complete row carries neither the marker nor the button.
describe('OnboardingGrid: DEC-829 amendment (w61-e) Remind only where something is outstanding', () => {
  const OUTSTANDING_GRID: OnboardingGridResponse = {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
    rows: [
      {
        // Every existing cell already 'complete' -- nothing outstanding.
        contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true, participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        // One pending cell -- outstanding.
        contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false, participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Talk', inviteStatus: 'accepted' }] },
        cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
      },
    ],
    total: 2,
    page: 1,
    perPage: 50,
    counts: { speakers: 2, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
    timezone: 'UTC',
  };

  it('a fully-complete row shows no Remind affordance and no marker; a row with a pending task shows the control', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: OUTSTANDING_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Grace Hopper').length > 0);

    const table = within(screen.getByRole('table'));
    const adaRow = within(table.getByText('Ada Lovelace').closest('tr')!);
    const graceRow = within(table.getByText('Grace Hopper').closest('tr')!);

    // Fully-complete row: no Remind button, no "Not chased" marker either.
    expect(adaRow.queryByRole('button', { name: /^Remind/ })).not.toBeInTheDocument();
    expect(adaRow.queryByText('Not chased')).not.toBeInTheDocument();

    // Row with outstanding work still offers the per-row control.
    expect(graceRow.getByRole('button', { name: 'Remind Grace' })).toBeInTheDocument();
  });
});

// P3 #21 (DEC-678 amendment, wave 59): the taskId facet is a ROW predicate
// server-side -- every surviving row already carries a cell for every task,
// so narrowing by one task must also collapse the rendered COLUMNS, or
// "Showing N of N · task X" narrows nothing a reader can see. grid.tasks
// itself is untouched (the task picker keeps offering every task).
describe('OnboardingGrid: P3 #21 taskId narrowing collapses the rendered columns', () => {
  const THREE_TASK_GRID: OnboardingGridResponse = {
    tasks: [
      { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true },
      { id: 'task-2', kind: 'general', title: 'Submit bio', dueDate: null, required: true },
      { id: 'task-3', kind: 'general', title: 'Upload headshot', dueDate: null, required: false },
    ],
    rows: [
      {
        contact: {
          id: 'ct1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          company: 'Acme',
          hasAccount: true,
          participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
        },
        cells: [
          { taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
          { taskId: 'task-2', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
          { taskId: 'task-3', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        ],
      },
    ],
    total: 1,
    page: 1,
    perPage: 50,
    counts: { speakers: 1, outstandingRequired: 2, overdue: 0, outstandingContacts: 1 },
    timezone: 'UTC',
  };

  it('renders only the filtered task column while the facet is set, restores all three on clear, and never narrows the task picker itself', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: THREE_TASK_GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    // Before filtering: all three task columns render in the pinned table.
    const table = () => within(screen.getByRole('table'));
    expect(table().getByText('Sign speaker agreement')).toBeInTheDocument();
    expect(table().getByText('Submit bio')).toBeInTheDocument();
    expect(table().getByText('Upload headshot')).toBeInTheDocument();

    const taskPicker = screen.getByRole('combobox', { name: 'Filter by task' }) as HTMLSelectElement;
    fireEvent.change(taskPicker, { target: { value: 'task-2' } });

    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 1 speakers · task "Submit bio"')).toBeInTheDocument();
    });

    // Only the filtered task's header cell renders -- the other two columns
    // are gone entirely.
    expect(table().getByText('Submit bio')).toBeInTheDocument();
    expect(table().queryByText('Sign speaker agreement')).not.toBeInTheDocument();
    expect(table().queryByText('Upload headshot')).not.toBeInTheDocument();

    // Exactly one task cell renders in Ada's row (the pinned table body has
    // exactly one data <td> alongside the identity cell).
    const adaRow = table().getByText('Ada Lovelace').closest('tr')!;
    expect(adaRow.querySelectorAll('td')).toHaveLength(2);

    // The card view (phone rendering) agrees: only one task label shown.
    // Scope to the card container specifically -- the task picker <select>
    // still lists all three task titles as <option>s, which is correct
    // (checked separately below) and must not be mistaken for a leftover
    // column.
    const cards = within(document.querySelector('.chq-speakers-cards') as HTMLElement);
    expect(cards.getAllByText('Submit bio').length).toBeGreaterThan(0);
    expect(cards.queryAllByText('Sign speaker agreement')).toHaveLength(0);
    expect(cards.queryAllByText('Upload headshot')).toHaveLength(0);

    // The task picker itself still lists every task -- a filter must be
    // able to name what it is not showing.
    const options = Array.from(taskPicker.options).map((o) => o.textContent);
    expect(options).toEqual(['All tasks', 'Sign speaker agreement', 'Submit bio', 'Upload headshot']);

    // Clearing the facet restores every column.
    fireEvent.change(taskPicker, { target: { value: '' } });
    await waitFor(() => {
      expect(table().getByText('Sign speaker agreement')).toBeInTheDocument();
      expect(table().getByText('Submit bio')).toBeInTheDocument();
      expect(table().getByText('Upload headshot')).toBeInTheDocument();
    });
  });
});
