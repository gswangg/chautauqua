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
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
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

// w43-f: the chip strip's count reads the chain length for that KIND
// ('Slides · 3 versions' after two replaces), not a per-upload-group tally
// -- three linked versions of one kind must render as ONE chip reading "3
// versions", never split into separate groups or stuck at "1 version".
const threeVersionChain = [
  {
    id: 'file-slides-v3',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v3.pdf',
    sizeBytes: 100,
    contentType: 'application/pdf',
    previousFileId: 'file-slides-v2',
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000300000,
    versionNo: 3,
  },
  {
    id: 'file-slides-v2',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v2.pdf',
    sizeBytes: 95,
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
];

describe('DeliverableDetail render smoke', () => {
  it('w43-f: chip strip reads the chain length for the kind -- three linked replaces render ONE "3 versions" chip', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(threeVersionChain),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail(),
      [`GET /api/v1/files/file-slides-v3/comments`]: listEnvelope([]),
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

    const chip = await screen.findByRole('tab', { name: 'Slides · 3 versions' });
    expect(chip).toBeInTheDocument();
    // No stray per-version or per-upload-group chip for the same kind.
    expect(screen.queryAllByRole('tab', { name: /Slides/ })).toHaveLength(1);
  });

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

    const presentationChip = await screen.findByRole('tab', { name: 'Slides · 2 versions' });
    expect(presentationChip).toBeInTheDocument();
    expect(screen.queryByText(/Slides · 2 versions ·/)).not.toBeInTheDocument();
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

    const chipA = await screen.findByRole('tab', { name: 'Slides · 1 version · keynote-a.pdf' });
    const chipB = screen.getByRole('tab', { name: 'Slides · 1 version · keynote-b.pdf' });
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

    await screen.findByRole('tab', { name: 'Slides · 2 versions' });
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

    const presentationChip = await screen.findByRole('tab', { name: 'Slides · 2 versions' });
    const posterChip = screen.getByRole('tab', { name: 'Poster · 1 version' });
    expect(presentationChip).toHaveClass('is-active');
    expect(posterChip).not.toHaveClass('is-active');
    expect(screen.getByText('Versions and notes below are for the selected deliverable')).toBeInTheDocument();
    expect(screen.getByText('Notes on the slides')).toBeInTheDocument();
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
    // worklistStatusLabel('pending', false) === 'Not reviewed' -- the SAME
    // vocabulary the worklist row's status cell uses (DEC-989 wave 72), not
    // the standalone CONTENT_STATUS_LABELS 'Pending'. w6-e: the value line
    // is one span, '<STATUS> · Updated <date>' -- the existing honest
    // 'Updated <date>' meta supplies the since clause.
    expect(screen.getByText(`Not reviewed · Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
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

  // w41-a (DEC-901 amendment): Approve moved out of the title column's own
  // status bar (deleted) into the CONTENT STATUS band.
  // G13 lane-D fix (05-content--01, reverting w5-i against the frame):
  // "Download all" is a tertiary text link INSIDE the status band, to the
  // right of [Approve]; the title row carries no button at all.
  it('carries Approve and the "Download all" tertiary inside the status band, and drops Approve once approved', async () => {
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
    // "Download all" is the band's tertiary, to the right of Approve.
    expect(downloadInBand).toBeDefined();
    expect(downloadInBand!.className).toContain('chq-btn-tertiary');
    // the frame draws no 'Pending' control in the band.
    expect(Array.from(band!.querySelectorAll('button')).find((b) => b.textContent === 'Pending')).toBeUndefined();
    // the title row carries no button (the w5-i head-actions block is gone).
    expect(container.querySelector('.chq-content-detail-head-actions')).toBeNull();
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

  // DEC-989 amendment (wave 41, widened wave 72): the band is chrome -- no
  // max-width/side margin of its own (wave 41), and now bleeds across
  // .chq-main's own padding by cancelling that SAME token rather than by
  // escaping into viewport units (wave 72: absence alone only reaches the
  // padded parent's content box).
  it('declares no max-width on the status band in content.css, and bleeds through --chq-pub-main-pad-x never vw/cqw', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
    const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
    const match = withoutMedia.match(/\.chq-content-status-band\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).not.toMatch(/max-width/);
    expect(body).not.toMatch(/margin:\s*0\s+auto/);
    // the negative inline margin cancels .chq-main's own horizontal padding
    // through the shared token, never a hand-copied px or a viewport unit.
    expect(body).toMatch(/margin-inline:\s*calc\(var\(--chq-pub-main-pad-x\)\s*\*\s*-1\)/);
    expect(body).toMatch(/padding:\s*[^;]*var\(--chq-pub-main-pad-x\)/);
    expect(body).not.toMatch(/\d+\s*(vw|cqw)/);
    // the bottom edge takes --chq-rule, not the hairline.
    expect(body).toMatch(/border-bottom:\s*1px solid var\(--chq-rule\)/);
    expect(body).not.toMatch(/border-bottom:\s*1px solid var\(--chq-hairline\)/);

    const stylesCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles.css'),
      'utf-8',
    );
    // .chq-main's own horizontal padding is the SAME token, and the token
    // is re-declared (not hand-copied) under the phone breakpoint so the
    // two consumers can never drift.
    const mainMatch = stylesCss.match(/\n\.chq-main\s*\{([^}]*)\}/);
    expect(mainMatch).not.toBeNull();
    expect(mainMatch![1]).toMatch(/padding:[^;]*var\(--chq-pub-main-pad-x\)/);
    const phoneMainMatch = stylesCss.match(/@media[^{]*\{[\s\S]*?\.chq-main\s*\{([^}]*)\}/);
    expect(phoneMainMatch).not.toBeNull();
    expect(phoneMainMatch![1]).toMatch(/--chq-pub-main-pad-x:\s*16px/);
  });

  // DEC-989 amendment (wave 23): the status band's bleed trick above only
  // reaches the true edge if nothing narrower clamps an ancestor -- the
  // defect this wave fixes was ContentApp's chq-page root itself carrying
  // chq-measure-wide (1180) in this state, which the band's margin-inline
  // trick could cancel .chq-main's padding against but never that 1180
  // clamp. DeliverableDetail now wraps everything BELOW the header/band in
  // a .chq-content-page-content sibling that owns the 1180 clamp instead,
  // so the band and header block stay OUTSIDE it -- this asserts that DOM
  // shape directly, not just the band's own bare CSS rule (which would
  // stay green even if a clamped ancestor crept back in above it).
  it('the header block and status band sit OUTSIDE .chq-content-page-content, which wraps only the reading body below them', async () => {
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

    const pageContent = container.querySelector('.chq-content-page-content');
    expect(pageContent).not.toBeNull();

    const topbar = container.querySelector('.chq-content-detail-topbar');
    const head = container.querySelector('.chq-content-detail-head');
    const band = container.querySelector('.chq-content-status-band');
    expect(topbar).not.toBeNull();
    expect(head).not.toBeNull();
    expect(band).not.toBeNull();
    expect(pageContent!.contains(topbar!)).toBe(false);
    expect(pageContent!.contains(head!)).toBe(false);
    expect(pageContent!.contains(band!)).toBe(false);

    // The reading body (deliverables/comments columns) IS inside the
    // delegated-measure sibling.
    const body = container.querySelector('.chq-content-detail-body');
    expect(body).not.toBeNull();
    expect(pageContent!.contains(body!)).toBe(true);

    // content.css: the sibling clamps at the wide (1180) reading measure,
    // never a hard-coded px, and the header block carries the SAME
    // margin-inline/padding bleed treatment as the band (so both flush to
    // the same true edge, not just the band alone).
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
    const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
    const pageContentBody = withoutMedia.match(/\.chq-content-page-content\s*\{([^}]*)\}/)?.[1];
    expect(pageContentBody).toBeDefined();
    expect(pageContentBody).toMatch(/max-width:\s*var\(--chq-measure-wide\)/);
    expect(pageContentBody).not.toMatch(/max-width:\s*\d+px/);

    const headBody = withoutMedia.match(/\.chq-content-detail-head\s*\{([^}]*)\}/)?.[1];
    expect(headBody).toMatch(/margin-inline:\s*calc\(var\(--chq-pub-main-pad-x\)\s*\*\s*-1\)/);
    const topbarBody = withoutMedia.match(/\.chq-content-detail-topbar\s*\{([^}]*)\}/)?.[1];
    expect(topbarBody).toMatch(/margin-inline:\s*calc\(var\(--chq-pub-main-pad-x\)\s*\*\s*-1\)/);
  });

  // DEC-989 amendment (wave 72): the band's copy stacks two lines and reads
  // the status value through worklistStatusLabel -- the ONE vocabulary the
  // worklist row already uses -- rather than a second label set.
  it('renders the status band copy as two stacked lines using worklistStatusLabel', async () => {
    mockBase();
    const { container } = render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="changes_requested"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v2.pdf');
    const band = container.querySelector('.chq-content-status-band');
    expect(band).not.toBeNull();
    const copy = band!.querySelector('.chq-content-status-band-copy');
    expect(copy).not.toBeNull();
    const label = copy!.querySelector('.chq-content-status-band-label');
    expect(label).toHaveTextContent('Content status');
    // worklistStatusLabel('changes_requested', false) === 'Changes requested'
    // -- the SAME string the worklist row shows for this status, not a
    // second CONTENT_STATUS_LABELS lookup.
    expect(copy).toHaveTextContent('Changes requested');
    expect(copy!.children).toHaveLength(2);
  });

  // w6-e (DEC-881): the band's status reads the real reuploaded flag off
  // GET /submissions/:id (SubmissionDetail.reuploaded), the SAME predicate
  // the worklist row/header read -- never a hardcoded `false` literal.
  // Precedence: pending contentStatus + reuploaded=true reads 'Re-uploaded'
  // and stays bold ink (no .chq-content-status-muted), unlike the plain
  // pending case above which reads 'Not reviewed' and sinks to muted.
  it('reads the real reuploaded flag from the detail fetch, not a hardcoded literal', async () => {
    mockBase({
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail({ reuploaded: true }),
    });
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

    const value = await screen.findByText(`Re-uploaded · Updated ${formatDate(1700000300000)}`);
    expect(value).toHaveClass('chq-flag');
    expect(value).not.toHaveClass('chq-content-status-muted');
    expect(container.querySelector('.chq-content-status-band')).not.toBeNull();
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
    expect(commentsCol!.firstElementChild?.textContent).toBe('Notes on the slides');
  });

  // DEC-020 amendment (wave 12): an upload can reopen content review server
  // side (files.ts's reopenContentReview, approved -> pending) -- the header
  // refetch that follows a successful upload is the ONE content-status
  // reader, and it must win over the pre-upload snapshot, re-showing the
  // Approve action the reopen makes actionable again.
  it('re-reads content status after an upload -- a server-side reopen wins over the pre-upload approved pill and re-offers Approve', async () => {
    let headerCallCount = 0;
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: () => {
        headerCallCount += 1;
        return headerCallCount === 1
          ? submissionDetail({ contentStatus: 'approved', reuploaded: false })
          : submissionDetail({ contentStatus: 'pending', reuploaded: true });
      },
      [`GET /api/v1/files/file-slides-v2/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      [`POST /api/v1/submissions/${SUBMISSION_ID}/files`]: { id: 'file-slides-v3' },
      'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    });

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
    expect(screen.getByText(`Approved · Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();

    const input = screen.getByLabelText('Replace presentation') as HTMLInputElement;
    const file = new File(['x'], 'slides-v3.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(`Re-uploaded · Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  // Regression guard for the same fix: the explicit Approve action still
  // shows 'Approved' optimistically (before the server responds) and rolls
  // back to the prior status -- with Approve re-offered -- if the write
  // fails.
  it('shows Approved optimistically on the explicit Approve action and rolls back on failure', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail({ contentStatus: 'pending', reuploaded: false }),
      [`GET /api/v1/files/file-slides-v2/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      [`POST /api/v1/submissions/${SUBMISSION_ID}/content-status`]: {
        status: 500,
        body: errorEnvelope('server_error', 'boom'),
      },
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

    await screen.findByText('slides-v2.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(screen.getByText(`Approved · Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(`Not reviewed · Updated ${formatDate(1700000300000)}`)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Status update failed: boom');
  });

  // DEC-020 wave-58 amendment: the organizer's own upload can reopen content
  // review exactly like the speaker portal's upload does — the 201 must be
  // disclosed with a plain status line, gated strictly on the 201's own
  // contentReviewReopened flag (never on a re-derivation from the refetched
  // pill, which is also 'pending' for a submission that was already pending
  // before this upload).
  it('renders the reopen disclosure line when the upload 201 reports contentReviewReopened:true', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail({ contentStatus: 'pending', reuploaded: true }),
      [`GET /api/v1/files/file-slides-v2/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      [`POST /api/v1/submissions/${SUBMISSION_ID}/files`]: { id: 'file-slides-v3', contentReviewReopened: true, contentStatus: 'pending' },
      'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    });

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
    expect(screen.queryByText(/back with review/)).not.toBeInTheDocument();

    const input = screen.getByLabelText('Replace presentation') as HTMLInputElement;
    const file = new File(['x'], 'slides-v3.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    const notice = await screen.findByText(
      'The new version is back with review and the session is off the public schedule until it is approved again.',
    );
    expect(notice).toHaveAttribute('role', 'status');
  });

  it('renders no reopen disclosure line when the upload 201 reports contentReviewReopened:false', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: submissionDetail({ contentStatus: 'pending', reuploaded: true }),
      [`GET /api/v1/files/file-slides-v2/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      [`POST /api/v1/submissions/${SUBMISSION_ID}/files`]: { id: 'file-slides-v3', contentReviewReopened: false },
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

    await screen.findByText('slides-v2.pdf');

    const input = screen.getByLabelText('Replace presentation') as HTMLInputElement;
    const file = new File(['x'], 'slides-v3.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(
        'The new version is back with review and the session is off the public schedule until it is approved again.',
      ),
    ).not.toBeInTheDocument();
  });
});
