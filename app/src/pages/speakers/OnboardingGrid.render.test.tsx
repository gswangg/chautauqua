// DEC-291 render smoke test: the OnboardingGrid's per-cell "View response"
// control only appears on kind='form' columns, and clicking it fetches
// GET /api/v1/task-assignments/:id/response and opens ResponseModal with the
// fetched fields.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    });

    render(<OnboardingGrid />);

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
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
  });
});
