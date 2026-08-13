// DEC-930 client half render smoke: mounts SpeakerDetailPage against a
// mocked GET /api/v1/events/:eventId/speakers/:contactId envelope, asserts
// the deliverable link is named by FILENAME (never 'File'), the session
// row links to /admin/submissions/:submissionId, and the task/session
// counts printed on the page agree with the payload's own arrays.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpeakerDetailPage } from './SpeakerDetailPage';
import { mockApi } from '../../test-utils/mockApi';
import type { SpeakerDetailResponse } from './speakerDetail';

const EVENT_ID = 'evt-speaker-detail';
const CONTACT_ID = 'ct-1';

const DETAIL: SpeakerDetailResponse = {
  contact: {
    id: CONTACT_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Acme',
    title: 'Engineer',
    hasAccount: true,
  },
  participation: {
    participantId: 'p-1',
    submissionId: 'sub-1',
    inviteStatus: 'accepted',
  },
  sessions: [
    {
      submissionId: 'sub-1',
      ref: 'S-001',
      title: 'Analytical Engines',
      status: 'accepted',
      contentStatus: 'pending',
      role: 'speaker',
      scheduled: null,
    },
  ],
  tasks: [
    {
      assignmentId: 'as-1',
      taskId: 'task-1',
      title: 'Upload slides',
      kind: 'file_request',
      required: true,
      dueDate: Date.UTC(2026, 0, 15),
      status: 'complete',
      completedAt: 1700000000000,
      file: { id: 'file-1', filename: 'slides-final.pdf', sizeBytes: 2048, versionNo: 2 },
    },
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
    },
  ],
  counts: { outstandingRequired: 1, overdue: 0 },
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/speakers/${CONTACT_ID}`]}>
      <Routes>
        <Route path="/speakers/:contactId" element={<SpeakerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SpeakerDetailPage render smoke', () => {
  it('renders the filename, session link href, and task/session counts', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: DETAIL,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    // Deliverable named by its own filename -- never the word 'File'.
    const fileLink = screen.getByRole('link', { name: /slides-final\.pdf/ });
    expect(fileLink).toHaveAttribute('href', '/files/file-1');
    expect(screen.queryByText(/^File$/)).not.toBeInTheDocument();

    // Session row links to /admin/submissions/:submissionId (basename-free
    // in this render, since SpeakerDetailPage is rendered without App's
    // <BrowserRouter basename="/admin">).
    const sessionLink = screen.getByRole('link', { name: /Analytical Engines/ });
    expect(sessionLink).toHaveAttribute('href', '/submissions/sub-1');

    // Counts printed on the page agree with the payload's own arrays.
    expect(screen.getByText('Sessions · 1')).toBeInTheDocument();
    expect(screen.getByText('Tasks · 2 · 1 outstanding · 0 overdue')).toBeInTheDocument();
  });
});
