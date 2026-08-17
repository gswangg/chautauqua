// DEC-505 (wave-55 task-w55-b ledger): proves SpeakerDetailPage's task-row
// status toggle renders the server's own PATCH /task-assignments/:id
// refusal (src/routes/tasks.ts) verbatim (`Update failed: ${err.message}`,
// SpeakerDetailPage.tsx:197 -- already the Agenda.tsx:182 shape, unlike
// the sibling OnboardingGrid.tsx catch blocks this wave fixed), not a
// client-invented sentence.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpeakerDetailPage } from './SpeakerDetailPage';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { SpeakerDetailResponse } from './speakerDetail';

const EVENT_ID = 'evt-speaker-detail-refusals';
const CONTACT_ID = 'ct-1';

function baseDetail(): SpeakerDetailResponse {
  return {
    contact: {
      id: CONTACT_ID,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Acme',
      title: 'Engineer',
      hasAccount: true,
      phone: null,
      notes: '',
      customFields: {},
      headshotFileId: null,
      bio: null,
      socialLinks: [],
    },
    participation: {
      participantId: 'p-1',
      submissionId: 'sub-1',
      inviteStatus: 'accepted',
    },
    participationRollup: {
      status: 'accepted',
      bySubmission: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', inviteStatus: 'accepted' }],
    },
    sessions: [],
    tasks: [
      {
        assignmentId: 'as-2',
        taskId: 'task-2',
        title: 'Sign agreement',
        kind: 'general',
        required: true,
        dueDate: null,
        status: 'pending',
        completedAt: null,
        file: null,
        overdue: false,
      },
    ],
    counts: { outstandingRequired: 1, overdue: 0 },
    otherEvents: [],
    otherEventsCount: 0,
  };
}

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

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/speakers/${CONTACT_ID}`]}>
      <Routes>
        <Route path="/speakers/:contactId" element={<SpeakerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SpeakerDetailPage task-status refusal shapes (DEC-505)', () => {
  it("tasks.ts's 'Task assignment not found' 404 reaches the page's error banner, not a generic sentence", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
      'PATCH /api/v1/task-assignments/as-2': {
        status: 404,
        body: errorEnvelope('not_found', 'Task assignment not found'),
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sign agreement for Ada Lovelace' }));

    expect(await screen.findByText('Update failed: Task assignment not found')).toBeInTheDocument();
  });
});
