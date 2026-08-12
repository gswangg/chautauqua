// DEC-291 render smoke test: the OnboardingGrid's per-cell "Response"
// control (DEC-662: renamed from "View response", a quiet text link) only
// appears on kind='form' columns AND only once that cell is complete --
// clicking it fetches GET /api/v1/task-assignments/:id/response and opens
// ResponseModal with the fetched fields.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
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
      contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true },
      cells: [
        { taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, lastRemindedAt: null },
        { taskId: 'task-2', assignmentId: 'as2', status: 'complete', completedAt: 1700000000000, fileId: null, lastRemindedAt: null },
      ],
    },
    {
      // DEC-662: a pending form-kind cell renders no control at all --
      // "Response" only appears once the cell is complete.
      contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false },
      cells: [
        { taskId: 'task-1', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
        { taskId: 'task-2', assignmentId: 'as4', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
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

describe('OnboardingGrid: DEC-291/DEC-662 Response control', () => {
  it('shows the control only on a complete form cell (never on a pending one), and opens the modal with fetched fields', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} onImportCsv={vi.fn()} />);

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

// DEC-599: the response modal's 'Ask for more' writes the assignment back
// to pending via the existing PATCH /task-assignments/:id -- reconciled
// optimistically against the grid cell (matching toggleCell), with a loud
// visible rollback if the PATCH fails.
describe('OnboardingGrid: DEC-599 reopen from response modal', () => {
  it('PATCHes status back to pending on Ask for more and updates the grid cell', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as2': { body: {} },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} onImportCsv={vi.fn()} />);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'Response' })[0]!.click();

    await screen.findByRole('dialog', { name: 'Task response' });
    await waitFor(() => expect(screen.getByText('Hotel name')).toBeInTheDocument());

    const askForMore = screen.getByRole('button', { name: 'Ask for more' });
    expect(screen.getByText('Reopening does not email the speaker.')).toBeInTheDocument();
    fireEvent.click(askForMore);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.includes('/task-assignments/as2') && init?.method === 'PATCH';
      });
      expect(calls.length).toBe(1);
      expect(JSON.parse(calls[0]![1]!.body as string)).toEqual({ status: 'pending' });
    });

    // The dialog now offers 'Mark complete' instead -- the modal's own
    // status flipped in lockstep with the PATCH.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Ask for more' })).not.toBeInTheDocument();
  });

  it('rolls back visibly when the reopen PATCH fails', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as2': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    render(<OnboardingGrid onAddSpeaker={vi.fn()} onImportCsv={vi.fn()} />);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'Response' })[0]!.click();

    await screen.findByRole('dialog', { name: 'Task response' });
    await waitFor(() => expect(screen.getByText('Hotel name')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ask for more' }));

    // Optimistic flip happens first...
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument();
    });

    // ...then rolls back visibly on the failed PATCH: the modal reverts to
    // 'Ask for more' and an error surfaces, not a silent no-op.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ask for more' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Update failed/)).toBeInTheDocument();
  });
});
