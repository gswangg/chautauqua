// DEC-756 render smoke: the session detail shows ONE deliverable at a
// time -- a chip strip scopes both the version list AND the note thread,
// Approve is absent once the session is approved, and "Download all" posts
// to the same archive endpoint FilesLibrary uses.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    participants: [{ name: 'Ada Lovelace', contactId: 'contact-ada' }],
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

// DEC-971: two independent v1 uploads of one kind are two documents, not
// two versions of one -- the chip strip is built from orderVersionChains,
// not from grouped[kind].
const twoChainFiles = [
  {
    id: 'file-slides-a',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'keynote-a.pdf',
    sizeBytes: 100,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000200000,
  },
  {
    id: 'file-slides-b',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'keynote-b.pdf',
    sizeBytes: 90,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000100000,
  },
];

function mockTwoChains(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(twoChainFiles),
    [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail(),
    [`GET /api/v1/files/file-slides-a/comments`]: listEnvelope([
      { id: 'c-a', fileId: 'file-slides-a', versionNumber: 1, body: 'note on a', authorName: 'Org User', authorRole: 'organizer', authorUserId: 'user-1', createdAt: 1700000210000 },
    ]),
    [`GET /api/v1/files/file-slides-b/comments`]: listEnvelope([
      { id: 'c-b', fileId: 'file-slides-b', versionNumber: 1, body: 'note on b', authorName: 'Org User', authorRole: 'organizer', authorUserId: 'user-1', createdAt: 1700000110000 },
    ]),
    'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    ...overrides,
  });
}

describe('DeliverableDetail render smoke', () => {
  it('renders one chip (no filename suffix) for a kind with a single 2-file chain', async () => {
    mockBase();

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    const presentationChip = await screen.findByRole('tab', { name: 'Presentation · 2 versions' });
    expect(presentationChip).toBeInTheDocument();
    expect(screen.queryByText(/Presentation · 2 versions ·/)).not.toBeInTheDocument();
  });

  it('renders two chips (each filename-suffixed) for a kind with two independent chains, and selecting the second scopes its own version and thread', async () => {
    mockTwoChains();

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    const chipA = await screen.findByRole('tab', { name: 'Presentation · 1 version · keynote-a.pdf' });
    const chipB = screen.getByRole('tab', { name: 'Presentation · 1 version · keynote-b.pdf' });
    expect(chipA).toHaveClass('is-active');
    expect(chipB).not.toHaveClass('is-active');
    expect(screen.getByText('keynote-a.pdf')).toBeInTheDocument();
    expect(screen.queryByText('keynote-b.pdf')).not.toBeInTheDocument();
    // The note thread is a second request fired only once the selected chain
    // is known, so it lands a tick after the chip strip -- await it rather
    // than racing the chip render (this assertion was intermittently flaky).
    expect(await screen.findByText('note on a')).toBeInTheDocument();

    fireEvent.click(chipB);

    await waitFor(() => {
      expect(screen.getByText('keynote-b.pdf')).toBeInTheDocument();
    });
    expect(screen.queryByText('keynote-a.pdf')).not.toBeInTheDocument();
    expect(await screen.findByText('note on b')).toBeInTheDocument();
    expect(screen.queryByText('note on a')).not.toBeInTheDocument();
  });

  it('renders no chip for an empty kind', async () => {
    mockBase();

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByRole('tab', { name: 'Presentation · 2 versions' });
    expect(screen.queryByRole('tab', { name: /Recording/ })).not.toBeInTheDocument();
  });

  it('renders one chip per kind-with-files carrying its count, defaulting to the first', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });
    mockBase();

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
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
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
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
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v2.pdf');
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    cleanup();
    mockBase();
    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="approved"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v2.pdf');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('Download all posts to the archive endpoint with the latest version ids', async () => {
    mockBase();

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
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
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '‹ Content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A talk' })).toBeInTheDocument();
    // DEC-998: the shown speaker name is a link into their contact record;
    // the rest of the DEC-901 subtitle string is unchanged.
    const speakerLink = await screen.findByRole('link', { name: 'Ada Lovelace' });
    expect(speakerLink).toHaveAttribute('href', '/contacts?openContact=contact-ada');
    expect(speakerLink.closest('p')).toHaveTextContent(
      `Ada Lovelace · S-042 · ${formatDayLabel('2026-05-12')} 10:00–10:30, Main Hall`,
    );
    expect(screen.getByText('Content status')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText(`Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
    expect(screen.getByText('Deliverables')).toBeInTheDocument();
  });

  // DEC-998: quiet action row into the submission's editor, its history and
  // (via the speaker link above) the speaker's contact record.
  it('renders the DEC-998 action row linking to the open editor and open history', async () => {
    mockBase();

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v2.pdf');
    const editLink = screen.getByRole('link', { name: 'Edit title and abstract ›' });
    expect(editLink).toHaveAttribute('href', `/submissions/${SUBMISSION_ID}?edit=1`);
    const historyLink = screen.getByRole('link', { name: 'Revision history ›' });
    expect(historyLink).toHaveAttribute('href', `/submissions/${SUBMISSION_ID}?history=1`);
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
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    const speakerLink = await screen.findByRole('link', { name: 'Ada Lovelace' });
    expect(speakerLink.closest('p')).toHaveTextContent('Ada Lovelace · S-042');
    expect(speakerLink.closest('p')).not.toHaveTextContent(/Ada Lovelace · S-042 ·/);
  });

  // w41-a (DEC-901 amendment): Approve and "Download all" moved out of the
  // title column's own status bar (deleted) into the CONTENT STATUS band.
  it('carries both Approve and "Download all" inside the status band, and drops Approve once approved', async () => {
    mockBase();

    const { container } = render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v2.pdf');
    const band = container.querySelector('.chq-content-status-band');
    expect(band).not.toBeNull();
    expect(band!.querySelector('button')).not.toBeNull();
    const approveInBand = Array.from(band!.querySelectorAll('button')).find((b) => b.textContent === 'Approve');
    const downloadInBand = Array.from(band!.querySelectorAll('button')).find((b) => b.textContent === 'Download all');
    expect(approveInBand).toBeDefined();
    expect(downloadInBand).toBeDefined();
    // the old parallel .chq-content-status-bar box is gone entirely.
    expect(container.querySelector('.chq-content-status-bar')).toBeNull();

    cleanup();
    mockBase();
    const { container: approvedContainer } = render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="approved"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );
    await screen.findByText('slides-v2.pdf');
    const approvedBand = approvedContainer.querySelector('.chq-content-status-band');
    expect(Array.from(approvedBand!.querySelectorAll('button')).find((b) => b.textContent === 'Approve')).toBeUndefined();
    expect(Array.from(approvedBand!.querySelectorAll('button')).find((b) => b.textContent === 'Download all')).toBeDefined();
  });

  // DEC-989 amendment (wave 41): the band is chrome -- no max-width/side
  // margin of its own, the same bare-rule idiom
  // .chq-review-editor-title-row uses (review.css:995-1007).
  it('declares no max-width on the status band in content.css', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
    const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
    const match = withoutMedia.match(/\.chq-content-status-band\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/max-width/);
    expect(match![1]).not.toMatch(/margin:\s*0\s+auto/);
  });

  // w41-a: "Deliverables" and "Notes on the <kind>" are peers -- each the
  // first child of its own column wrapper -- so they share one top edge.
  it('renders the Deliverables and Notes headings as first children of their own column wrappers', async () => {
    mockBase();
    const { container } = render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v2.pdf');
    const filesCol = container.querySelector('.chq-content-files-col');
    const commentsCol = container.querySelector('.chq-content-comments-col');
    expect(filesCol).not.toBeNull();
    expect(commentsCol).not.toBeNull();
    expect(filesCol!.firstElementChild?.tagName).toBe('H2');
    expect(filesCol!.firstElementChild?.textContent).toBe('Deliverables');
    expect(commentsCol!.firstElementChild?.tagName).toBe('H3');
    expect(commentsCol!.firstElementChild?.textContent).toBe('Notes on the presentation');
  });
});
