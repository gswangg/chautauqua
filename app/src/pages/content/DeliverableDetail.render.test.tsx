// DEC-756 render smoke: the session detail shows ONE deliverable at a
// time -- a chip strip scopes both the version list AND the note thread,
// Approve is absent once the session is approved, and "Download all" posts
// to the same archive endpoint FilesLibrary uses.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DeliverableDetail } from './DeliverableDetail';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { formatDate, formatDayLabel } from '../../lib/dates';

const SUBMISSION_ID = 'sub-detail-1';
const EVENT_ID = 'evt-detail-1';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const files = [
  {
    id: 'file-slides-v2',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v2.pdf',
    sizeBytes: 100,
    contentType: 'application/pdf',
    previousFileId: 'file-slides-v1',
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000200000,
    versionNo: 2,
  },
  {
    id: 'file-slides-v1',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v1.pdf',
    sizeBytes: 90,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000100000,
    versionNo: 1,
  },
  {
    id: 'file-recording-v1',
    submissionId: SUBMISSION_ID,
    kind: 'poster',
    filename: 'poster.pdf',
    sizeBytes: 80,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000050000,
    versionNo: 1,
  },
];

// DEC-901: DeliverableDetail's header (subtitle + CONTENT STATUS band) now
// fetches GET /api/v1/submissions/:id directly, independent of the
// title/contentStatus props ContentApp already passes in.
function submissionDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    ref: 'S-042',
    updatedAt: 1700000300000,
    participants: [{ name: 'Ada Lovelace' }],
    slot: { day: '2026-05-12', startMin: 600, endMin: 630, roomName: 'Main Hall' },
    ...overrides,
  };
}

function mockBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
    [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail(),
    [`GET /api/v1/files/file-slides-v2/comments`]: listEnvelope([]),
    [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
    // w15-e: CommentThread's 'You'-vs-name identity check reads useMe(),
    // which fetches this on mount.
    'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    ...overrides,
  });
}

describe('DeliverableDetail render smoke', () => {
  it('renders one chip per kind-with-files carrying its count, defaulting to the first', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });
    mockBase();

    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    const presentationChip = await screen.findByRole('tab', { name: 'Presentation · 2 versions' });
    const posterChip = screen.getByRole('tab', { name: 'Poster · 1 version' });
    expect(presentationChip).toHaveClass('is-active');
    expect(posterChip).not.toHaveClass('is-active');
    expect(screen.getByText('Versions and notes below are for the selected deliverable')).toBeInTheDocument();
    expect(screen.getByText('Notes on the presentation')).toBeInTheDocument();
    expect(screen.getByText('slides-v2.pdf')).toBeInTheDocument();
    expect(screen.queryByText('poster.pdf')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('switches both the version list and the thread when a chip is clicked', async () => {
    mockBase();

    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    await screen.findByText('slides-v2.pdf');
    fireEvent.click(screen.getByRole('tab', { name: 'Poster · 1 version' }));

    await waitFor(() => {
      expect(screen.getByText('Notes on the poster')).toBeInTheDocument();
    });
    expect(screen.getByText('poster.pdf')).toBeInTheDocument();
    expect(screen.queryByText('slides-v2.pdf')).not.toBeInTheDocument();
  });

  it('renders Approve when the session is not approved and hides it once it is', async () => {
    mockBase();
    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    await screen.findByText('slides-v2.pdf');
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    cleanup();
    mockBase();
    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="approved"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    await screen.findByText('slides-v2.pdf');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('Download all posts to the archive endpoint with the latest version ids', async () => {
    mockBase();

    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    await screen.findByText('slides-v2.pdf');

    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    let capturedBody: unknown = null;
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/files/archive')) {
          capturedBody = init?.body ? JSON.parse(init.body as string) : null;
          return Promise.resolve(
            new Response(new Uint8Array([1, 2, 3]), {
              status: 200,
              headers: { 'content-disposition': 'attachment; filename="a-talk.zip"' },
            }),
          );
        }
        return realFetch(input, init);
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download all' }));

    await waitFor(() => {
      expect(capturedBody).toEqual({ fileIds: ['file-slides-v2', 'file-recording-v1'] });
    });
    expect(screen.getByRole('status')).toHaveTextContent('a-talk.zip downloaded.');
  });

  // DEC-901: back link + H1 + subtitle + sunk CONTENT STATUS band.
  it('renders the "‹ Content" back link, the title as an H1, the Speaker · CODE · slot subtitle, and the status band', async () => {
    mockBase();

    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '‹ Content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A talk' })).toBeInTheDocument();
    await screen.findByText(`Ada Lovelace · S-042 · ${formatDayLabel('2026-05-12')} 10:00–10:30, Main Hall`);
    expect(screen.getByText('Content status')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText(`Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
    expect(screen.getByText('Deliverables')).toBeInTheDocument();
  });

  it('omits the slot/room clause (no trailing separator) when the session is unplaced', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail({ slot: null }),
      [`GET /api/v1/files/file-slides-v2/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    });

    render(
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="A talk"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />,
    );

    await screen.findByText('Ada Lovelace · S-042');
    expect(screen.queryByText(/Ada Lovelace · S-042 ·/)).not.toBeInTheDocument();
  });
});
