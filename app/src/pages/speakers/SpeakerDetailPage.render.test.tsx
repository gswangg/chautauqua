// DEC-930 client half render smoke (wave 26 amendment: the 1180 pair --
// header actions, main column, rail). Mounts SpeakerDetailPage against a
// mocked GET /api/v1/events/:eventId/speakers/:contactId envelope and
// asserts: the participation control sits INSIDE the header row (not a
// body paragraph); the rail region carries notes + the other-events list;
// a null headshot renders no broken image and no dead Download link; and
// otherEvents is capped at 5 even if the server ever sent more.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpeakerDetailPage } from './SpeakerDetailPage';
import { mockApi } from '../../test-utils/mockApi';
import type { SpeakerDetailResponse } from './speakerDetail';

const EVENT_ID = 'evt-speaker-detail';
const CONTACT_ID = 'ct-1';

function baseDetail(overrides: Partial<SpeakerDetailResponse> = {}): SpeakerDetailResponse {
  return {
    contact: {
      id: CONTACT_ID,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Acme',
      title: 'Engineer',
      hasAccount: true,
      phone: '+1 415 555 0134',
      notes: 'Prefers a morning slot.',
      headshotFileId: null,
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
        scheduled: { day: '2026-05-13', startMin: 600, endMin: 645, roomName: 'Hall A' },
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
    otherEvents: [{ eventId: 'evt-2025', name: 'DevFlow 2025' }],
    otherEventsCount: 1,
    ...overrides,
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

describe('SpeakerDetailPage render smoke', () => {
  it('renders the filename, session link href, and task/session counts', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    // Deliverable named by its own filename in the Files section -- never
    // the word 'File' -- with a separate Download action beside it.
    expect(screen.getByText('slides-final.pdf')).toBeInTheDocument();
    const fileLink = screen.getAllByRole('link', { name: 'Download' }).find((a) => a.getAttribute('href') === '/files/file-1');
    expect(fileLink).toBeDefined();

    // Session row links to /admin/submissions/:submissionId (basename-free
    // in this render, since SpeakerDetailPage is rendered without App's
    // <BrowserRouter basename="/admin">).
    const sessionLink = screen.getByRole('link', { name: /Analytical Engines/ });
    expect(sessionLink).toHaveAttribute('href', '/submissions/sub-1');

    // Counts printed on the page agree with the payload's own arrays.
    expect(screen.getByText('Sessions · 1')).toBeInTheDocument();
    expect(screen.getByText('Tasks · 2 · 1 outstanding · 0 overdue')).toBeInTheDocument();

    // Page root carries chq-measure-table (two-plus scanned tables), never
    // the plain chq-measure reading-page class.
    expect(document.querySelector('.chq-speaker-detail-page')).toHaveClass('chq-measure-table');
    expect(document.querySelector('.chq-speaker-detail-page')).not.toHaveClass('chq-measure');

    // Exact slot string for a placed session: day formatted via
    // formatDayLabel + zero-padded clock times, never the raw ISO day.
    expect(screen.getByText('Wed 13 May 10:00–10:45, Hall A')).toBeInTheDocument();
  });

  it('promotes the participation control into the header row, not a body paragraph', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    // The old body-paragraph restatement is gone entirely.
    expect(document.querySelector('.chq-speaker-detail-participation')).not.toBeInTheDocument();

    // The live participation control (ParticipationMenu's trigger button)
    // lives inside the header actions row, beside Email and Remind.
    const actions = document.querySelector('.chq-speaker-detail-actions');
    expect(actions).not.toBeNull();
    const trigger = actions?.querySelector('.chq-participation-menu-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger).toHaveTextContent('Confirmed');
    expect(actions).toHaveTextContent(/Email Ada/);
    expect(actions).toHaveTextContent(/Remind Ada/);

    // The header row itself is the ONE place the control renders.
    const head = document.querySelector('.chq-speaker-detail-head');
    expect(head?.contains(actions)).toBe(true);
  });

  it('the rail carries both Notes and the other-events list', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const rail = document.querySelector('.chq-speaker-detail-rail');
    expect(rail).not.toBeNull();
    expect(rail).toHaveTextContent('Prefers a morning slot.');
    expect(rail).toHaveTextContent('DevFlow 2025');
    expect(rail?.querySelector('.chq-speaker-detail-notes')).not.toBeNull();
    expect(rail?.querySelector('.chq-speaker-detail-other-events')).not.toBeNull();
    // Contact block (email/phone) also lives in the rail.
    expect(rail).toHaveTextContent('ada@example.com');
    expect(rail).toHaveTextContent('+1 415 555 0134');
  });

  it('a null headshot renders no broken image and no dead Download link', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        contact: { ...baseDetail().contact, headshotFileId: null },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const identity = document.querySelector('.chq-speaker-detail-identity');
    expect(identity?.querySelector('img.chq-speaker-detail-headshot')).not.toBeInTheDocument();
    expect(identity?.querySelector('.chq-speaker-detail-headshot-download')).not.toBeInTheDocument();
    // A neutral placeholder still occupies the slot.
    expect(identity?.querySelector('.chq-speaker-detail-headshot-placeholder')).toBeInTheDocument();
  });

  it('a present headshot renders an image plus a tertiary Download link carrying the download attribute', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        contact: { ...baseDetail().contact, headshotFileId: 'file-hs-1' },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const identity = document.querySelector('.chq-speaker-detail-identity');
    const img = identity?.querySelector('img.chq-speaker-detail-headshot');
    expect(img).toHaveAttribute('src', '/headshots/file-hs-1');

    const downloadLink = identity?.querySelector('.chq-speaker-detail-headshot-download');
    expect(downloadLink).toHaveAttribute('href', '/headshots/file-hs-1');
    expect(downloadLink).toHaveAttribute('download');
  });

  // DEC-678 (w55-c): sessions/tasks/files/other-events zero-row states
  // render through EmptyState's fresh anatomy (no filter axis on any of
  // these four sub-collections); the notes field's own `.chq-empty` line
  // is NOT a collection and stays untouched.
  it('renders EmptyState fresh anatomy for zero sessions/tasks/files/other-events, and leaves the notes chq-empty line untouched', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        sessions: [],
        tasks: [],
        otherEvents: [],
        otherEventsCount: 0,
        contact: { ...baseDetail().contact, notes: null },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const main = document.querySelector('.chq-speaker-detail-main');
    const rail = document.querySelector('.chq-speaker-detail-rail');

    const freshBlocks = document.querySelectorAll('.chq-empty-block-fresh');
    // Sessions, Tasks, Files (tasks with no file), Other events -- four.
    expect(freshBlocks).toHaveLength(4);
    expect(main).toHaveTextContent('No sessions.');
    expect(main).toHaveTextContent('No tasks.');
    expect(main).toHaveTextContent('No files.');
    expect(rail).toHaveTextContent('No other events.');
    for (const block of Array.from(freshBlocks)) {
      expect(block.querySelector('.chq-empty-escape')).not.toBeInTheDocument();
    }

    // The notes field's bare `.chq-empty` paragraph is the ONE surviving
    // non-collection site and is left exactly as it was.
    const notesSection = rail?.querySelector('.chq-speaker-detail-notes');
    const notesEmpty = notesSection?.querySelector('p.chq-empty');
    expect(notesEmpty).toHaveTextContent('No notes.');
    expect(document.querySelectorAll('p.chq-empty')).toHaveLength(1);
  });

  it('caps otherEvents at 5 even if the server sends more', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ eventId: `evt-${i}`, name: `Conf ${i}` }));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({ otherEvents: many, otherEventsCount: 7 }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const items = document.querySelectorAll('.chq-speaker-detail-other-events-list li');
    expect(items).toHaveLength(5);
    // The count line still reports the true total, not the capped list length.
    expect(screen.getByText('Across your events · 7')).toBeInTheDocument();
  });
});
