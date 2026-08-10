// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke test
// for the Speakers page (OnboardingGrid). Mounts the real page against a
// mocked GET .../onboarding envelope with a mix of pending/complete/overdue
// task-assignment cells, confirms the due date renders through the DEC-146/
// DEC-153 UTC date helper (formatDateOnly), and opens the "New task" modal
// (TaskModal).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SpeakersPage } from './Speakers';
import { mockApi } from '../test-utils/mockApi';
import { formatDateOnly } from '../lib/dates';
import type { OnboardingGridResponse } from './speakers/types';

const EVENT_ID = 'evt-speakers-render';

// Jan 15 2026, UTC-midnight epoch-ms -- a date-only value per DEC-153.
const DUE_DATE_MS = Date.UTC(2026, 0, 15);

const GRID: OnboardingGridResponse = {
  tasks: [
    { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: DUE_DATE_MS, required: true },
    { id: 'task-2', kind: 'file_request', title: 'Upload headshot', dueDate: null, required: false },
  ],
  rows: [
    {
      contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true },
      cells: [
        { taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, lastRemindedAt: null },
        { taskId: 'task-2', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
      ],
    },
    {
      contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false },
      cells: [
        // 1970 due date -> deep in the past, so this pending cell renders overdue.
        { taskId: 'task-1', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
        { taskId: 'task-2', assignmentId: 'as4', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
      ],
    },
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

describe('SpeakersPage render smoke (OnboardingGrid)', () => {
  it('renders mixed task-assignment states with a UTC-formatted due date, and opens the New task modal', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
    });

    render(<SpeakersPage />);

    expect(screen.getByRole('heading', { name: 'Speakers' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();

    // Due date rendered via the DEC-146/153 UTC date helper -- assert against
    // the same helper's own output rather than a hardcoded locale string.
    expect(screen.getByText(formatDateOnly(DUE_DATE_MS))).toBeInTheDocument();

    // Mixed cell states: complete, pending, overdue.
    expect(screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })).toHaveTextContent('Complete');
    expect(screen.getByRole('button', { name: 'Toggle Upload headshot for Ada Lovelace' })).toHaveTextContent('Pending');
    expect(screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' })).toHaveTextContent('Overdue');

    // TaskModal open.
    screen.getByRole('button', { name: 'New task' }).click();
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    expect(dialog).toBeInTheDocument();
  });
});
