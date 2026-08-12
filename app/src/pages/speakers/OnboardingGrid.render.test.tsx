// DEC-291 render smoke test: the OnboardingGrid's per-cell "View response"
// control only appears on kind='form' columns, and clicking it fetches
// GET /api/v1/task-assignments/:id/response and opens ResponseModal with the
// fetched fields.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  ],
  total: 1,
  page: 1,
  perPage: 50,
  counts: { speakers: 1, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
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
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('OnboardingGrid: DEC-291 view-response control', () => {
  it('shows the control only on form columns, and opens the modal with fetched fields', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      'GET /api/v1/task-assignments/as2/response': DETAIL,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<OnboardingGrid />);

    // Re-skinned OnboardingGrid renders the desktop grid AND the phone-width
    // card list simultaneously in the DOM (they're toggled by a CSS media
    // query, not JS), so a name renders twice -- assert at least one exists.
    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });

    const viewResponseButtons = screen.getAllByRole('button', { name: 'View response' });
    expect(viewResponseButtons).toHaveLength(1);

    viewResponseButtons[0]!.click();

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

    render(<OnboardingGrid />);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'View response' })[0]!.click();

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

    render(<OnboardingGrid />);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    screen.getAllByRole('button', { name: 'View response' })[0]!.click();

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
