// DEC-505 (wave-55 task-w55-b ledger) / DEC-856 (wave-13 amendment): fixes
// the three bare `catch {` blocks in OnboardingGrid.tsx (applyCellStatus,
// applyInviteStatus, applyResponseStatus) that discarded the caught
// ApiError and replaced every distinct server refusal on a task-assignment
// or participation write with one client-composed sentence
// (cellFailureMessage/participationFailureMessage's old
// "didn't save. Someone else may have edited this speaker." text).
// This proves the bound error's own `message` -- as PATCH /task-assignments/:id
// (src/routes/tasks.ts:575) and PATCH /submissions/:id/participants/:participantId
// (src/routes/api/submissions.ts:811) actually throw -- now reaches the
// pendingFailure banner, inside the existing "speaker · task" naming frame
// (never collapsed to the generic sentence), matching Agenda.tsx:182's
// `Placement failed: ${err.message}` shape.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-onboarding-refusals';

const GRID: OnboardingGridResponse = {
  tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
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
      cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
  counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
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

function mockBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    ...overrides,
  });
}

describe('OnboardingGrid task-cell refusal shapes (DEC-505/DEC-856)', () => {
  it("a task-assignment PATCH 404 ('Task assignment not found') names the server wording, not the generic sentence", async () => {
    mockBase({
      'PATCH /api/v1/task-assignments/as1': {
        status: 404,
        body: errorEnvelope('not_found', 'Task assignment not found'),
      },
    });
    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    const table = within(await screen.findByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' }));

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText(/Task assignment not found/)).toBeInTheDocument();
    expect(within(banner).queryByText(/Someone else may have edited this speaker\./)).not.toBeInTheDocument();
  });
});

describe('OnboardingGrid participation-status refusal shapes (DEC-505/DEC-856)', () => {
  it("a participant PATCH 404 ('Participant not found on this submission') names the server wording, not the generic sentence", async () => {
    mockBase({
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': {
        status: 404,
        body: errorEnvelope('not_found', 'Participant not found on this submission'),
      },
    });
    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    const table = within(await screen.findByRole('table'));
    fireEvent.click(table.getByRole('button', { name: /Participation status for Ada Lovelace/ }));
    const menu = await screen.findByRole('menu', { name: /Participation status for Ada Lovelace/ });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Not invited/ }));

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText(/Participant not found on this submission/)).toBeInTheDocument();
    expect(within(banner).queryByText(/Someone else may have edited this speaker\./)).not.toBeInTheDocument();
  });
});
