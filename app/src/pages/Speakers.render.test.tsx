// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke test
// for the Speakers page (OnboardingGrid). Mounts the real page against a
// mocked GET .../onboarding envelope with a mix of pending/complete/overdue
// task-assignment cells, confirms the due date renders through the DEC-146/
// DEC-153 UTC date helper (formatDateOnly), and opens the "New task" modal
// (TaskModal).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SpeakersPage } from './Speakers';
import { mockApi } from '../test-utils/mockApi';
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
      contact: { id: 'ct1', name: 'Ada Lovelace', email: 'ada@example.com', company: 'Acme', hasAccount: true , participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
      cells: [
        { taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 },
        { taskId: 'task-2', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
      ],
    },
    {
      contact: { id: 'ct2', name: 'Grace Hopper', email: 'grace@example.com', company: 'Navy', hasAccount: false , participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }] },
      cells: [
        // 1970 due date -> deep in the past, so this pending cell renders overdue.
        { taskId: 'task-1', assignmentId: 'as3', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        { taskId: 'task-2', assignmentId: 'as4', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
      ],
    },
  ],
  total: 2,
  page: 1,
  perPage: 50,
  counts: { speakers: 2, outstandingRequired: 1, overdue: 1, outstandingContacts: 2 },
      timezone: 'UTC',
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

describe('SpeakersPage render smoke (OnboardingGrid)', () => {
  it('renders mixed task-assignment states with a UTC-formatted due date, and opens the New task modal', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        forms: [
          { id: 'form-1', title: 'Speaker agreement form', isDefault: true },
          { id: 'form-2', title: 'Hotel stay requirement form', isDefault: false },
        ],
      },
    });

    render(<MemoryRouter><SpeakersPage /></MemoryRouter>);

    // DEC-662: exactly one <h1> on the page -- RosterPanel no longer owns
    // its own header band.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Speakers' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);

    // Due date header, design v4's "Due 15 Jan · Required" shape (DEC-730) --
    // reads DUE_DATE_MS's UTC calendar date directly (never toISOString).
    expect(screen.getByText('Due 15 Jan · Required')).toBeInTheDocument();

    // The re-skinned OnboardingGrid renders the desktop grid AND the
    // phone-width card list simultaneously in the DOM (toggled by a CSS
    // media query, not JS), so every toggle button renders twice -- scope
    // assertions to the (single) <table>.
    const table = within(screen.getByRole('table'));

    // Mixed cell states: complete (filled), pending (outline), overdue (the
    // same control family, ink-outlined bold caps, "OVERDUE" -- DEC-789
    // replaces the old "N DAYS LATE" copy; the day count moves into the
    // button's accessible name/title instead of the visible text -- never a
    // plain "Overdue" word alone with no count anywhere, never colour
    // alone, never red -- DEC-367/730/789).
    expect(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })).toHaveTextContent('Complete');
    expect(table.getByRole('button', { name: 'Toggle Upload headshot for Ada Lovelace' })).toHaveTextContent('Pending');
    const overdueBtn = table.getByRole('button', { name: /^Toggle Sign speaker agreement for Grace Hopper, \d+ days? late$/ });
    expect(overdueBtn).toHaveTextContent('OVERDUE');

    // TaskModal open.
    screen.getByRole('button', { name: 'New task' }).click();
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    expect(dialog).toBeInTheDocument();
  });

  // DEC-662: the roster's "Add speaker" trigger moved from RosterPanel's own
  // header band into OnboardingGrid's single title action row, reachable from
  // the same row as "New task"/"Remind all outstanding". DEC-746 dropped the
  // desktop "Import CSV" trigger from that row to match the mock's title row
  // (docs/design/Chautauqua Speakers.dc.html:59-63 -- Add speaker / New task /
  // Remind all outstanding); CSV import is the Contacts page's job.
  it('opens Add speaker from the single title action row, which carries no Import CSV', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(<MemoryRouter><SpeakersPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });

    screen.getByRole('button', { name: 'Add speaker' }).click();
    expect(await screen.findByLabelText('First name')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Cancel' }).click();
    await waitFor(() => {
      expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
  });
});
