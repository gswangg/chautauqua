// DEC-291 render smoke test: the OnboardingGrid's per-cell "Response"
// control (DEC-662: renamed from "View response", a quiet text link) only
// appears on kind='form' columns AND only once that cell is complete --
// clicking it fetches GET /api/v1/task-assignments/:id/response and opens
// ResponseModal with the fetched fields.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
      contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true , participantId: 'p-ct1', submissionId: 'sub-ct1', inviteStatus: 'accepted' },
      cells: [
        { taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, lastRemindedAt: null, assignedAt: 0 },
        { taskId: 'task-2', assignmentId: 'as2', status: 'complete', completedAt: 1700000000000, fileId: null, lastRemindedAt: null, assignedAt: 0 },
      ],
    },
    {
      // DEC-662: a pending form-kind cell renders no control at all --
      // "Response" only appears once the cell is complete.
      contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false , participantId: 'p-ct2', submissionId: 'sub-ct2', inviteStatus: 'accepted' },
      cells: [
        { taskId: 'task-1', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null, assignedAt: 0 },
        { taskId: 'task-2', assignmentId: 'as4', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null, assignedAt: 0 },
      ],
    },
  ],
  total: 2,
  page: 1,
  perPage: 50,
  counts: { speakers: 2, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
};

const DETAIL: AssignmentResponseDetail = {
  assignmentId: 'as2',
  taskTitle: 'Hotel stay requirement form',
  taskKind: 'form',
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
          contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true , participantId: 'p-ct1', submissionId: 'sub-ct1', inviteStatus: 'accepted' },
          cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: now, fileId: null, lastRemindedAt: null, assignedAt: 0 }],
        },
        {
          contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false , participantId: 'p-ct2', submissionId: 'sub-ct2', inviteStatus: 'accepted' },
          cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null, assignedAt: 0 }],
        },
      ],
      total: 2,
      page: 1,
      perPage: 50,
      counts: { speakers: 2, outstandingRequired: 1, overdue: 1, outstandingContacts: 1 },
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: overdueGrid,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);

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

// DEC-827: the toolbar carries a quiet link into the Contacts importer,
// event preselected -- Import is Contacts' job, this is just the door.
describe('OnboardingGrid: DEC-827 import link', () => {
  it('renders a quiet link into the Contacts importer with the event preselected', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const link = screen.getByRole('link', { name: 'Import speakers from a CSV' });
    expect(link).toHaveAttribute('href', '/admin/contacts?import=1');
    // Not a button, not a second importer -- a real <a>, quiet toolbar link.
    expect(link.tagName).toBe('A');
  });
});

describe('OnboardingGrid: DEC-291/DEC-662 Response control', () => {
  it('shows the control only on a complete form cell (never on a pending one), and opens the modal with fetched fields', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);

    // Re-skinned OnboardingGrid renders the desktop grid AND the phone-width
    // card list simultaneously in the DOM (they're toggled by a CSS media
    // query, not JS), so a name renders twice -- assert at least one exists.
    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);

    // DEC-662: no email text in the grid row -- emails stay in the contact
    // drawer, the row meta is company + a Has account pill only.
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('grace@example.com')).not.toBeInTheDocument();

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

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'Response' })[0]!.click();

    await screen.findByRole('dialog', { name: 'Task response' });
    await waitFor(() => expect(screen.getByText('Hotel name')).toBeInTheDocument());

    const reopen = screen.getByRole('button', { name: 'Reopen this task' });
    expect(screen.getByText('Reopening does not email the speaker.')).toBeInTheDocument();
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

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);

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
    // showing 'Reopen this task' again and an error surfaces, not a silent
    // no-op.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reopen this task' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Update failed/)).toBeInTheDocument();
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

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);

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

// DEC-789: the roster row's invite-status control writes through
// PATCH /submissions/:submissionId/participants/:participantId (mocked here
// -- this test never imports src/routes/api/submissions.ts), labelled from
// the ONE app/src/pages/speakers/types.ts vocabulary, optimistic with
// rollback on failure.
describe('OnboardingGrid: DEC-789 invite status control', () => {
  it('shows the Not invited / Invited / Confirmed / Declined labels and PATCHes through on click, cycling to the next status', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': { body: {} },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    // GRID's ct1 fixture starts inviteStatus: 'accepted' -> labelled Confirmed.
    const table = within(screen.getByRole('table'));
    const btn = table.getByRole('button', { name: 'Invite status for Ada Lovelace: Confirmed' });
    expect(btn).toHaveTextContent('Confirmed');

    fireEvent.click(btn);

    // Optimistic: cycles accepted -> declined before the PATCH resolves.
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Invite status for Ada Lovelace: Declined' })).toBeInTheDocument();
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

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Invite status for Ada Lovelace: Confirmed' }));

    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Invite status for Ada Lovelace: Declined' })).toBeInTheDocument();
    });

    // ...rolls back visibly on the failed PATCH, and surfaces the error.
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Invite status for Ada Lovelace: Confirmed' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Update failed/)).toBeInTheDocument();
  });

  it('joins the invite-status pill into the grid request as an additional query param, composing with other filters', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} />);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }));

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
