// CNT-12: content-approval reachability. Locks in the always-visible
// per-row Approve/Request changes control on the worklist (SessionList),
// which previously required drilling into DeliverableDetail (itself
// reachable only after uploading a file) to reach
// POST /api/v1/submissions/:id/content-status. Mirrors the DEC-144
// layer-2 harness pattern used by Submissions.render.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContentApp } from './ContentApp';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-content-render-1';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('ContentApp / SessionList render smoke: always-visible content-status control', () => {
  it('approves content directly from the worklist row without opening deliverable detail', async () => {
    const contentStatusMock = vi.fn(() => ({ id: 'sub-1', contentStatus: 'approved' }));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With No Files Yet',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
          latestFile: null,
        },
      ]),
      [`POST /api/v1/submissions/sub-1/content-status`]: contentStatusMock,
    });

    const { container } = render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    // w11-e: default tab is 'all' (DEC-665) — the row is visible without
    // switching tabs.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toHaveClass('is-active');
    });

    await waitFor(() => {
      expect(container.querySelector('.chq-content-row-title')).toHaveTextContent('A Talk With No Files Yet');
    });

    // w15-f (DEC-692): the per-row 'Ask for changes' button moved to the
    // deliverable-detail screen — the worklist row keeps only Approve/Open.
    expect(screen.queryByRole('button', { name: 'Ask for changes' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(contentStatusMock).toHaveBeenCalled();
    });
  });
});

// w1-h reskin smoke: page shell uses the shared DEC-367/368 tokens/classes
// rather than the old unstyled chq-page/chq-tab markup.
describe('ContentApp reskin (DEC-366..368)', () => {
  it('renders the page title and view tabs with the shared shell classes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole('heading', { name: 'Content' });
    expect(heading).toHaveClass('chq-page-title');

    const worklistTab = screen.getByRole('tab', { name: 'Worklist' });
    expect(worklistTab).toHaveClass('chq-pill');
    expect(worklistTab).toHaveClass('is-active');
  });
});

// w15-f (DEC-692): the worklist's Latest file column comes straight from
// the DEC-341 list payload's latestFile field (server-hydrated, page-scoped
// per DEC-686) — no per-row files fan-out. A submission with no uploads
// renders the honest 'No files yet' empty cell, never a bare 0/blank.
describe('ContentApp worklist latest file column (DEC-686 page-scoped hydration)', () => {
  it('renders the server-reported latest file name/version for a two-version chain', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With A Replaced File',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          deliverableCounts: { presentation: 1, poster: 0, handout: 0 },
          latestFile: { filename: 'slides-v2.pdf', kind: 'presentation', versionCount: 2, uploadedAt: 1700000100000 },
        },
      ]),
    });

    const { container } = render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'All' }));

    await waitFor(() => {
      expect(container.querySelector('.chq-content-row-title')).toHaveTextContent('A Talk With A Replaced File');
    });

    const row = container.querySelector('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');

    const latestFileCell = row.querySelector('.chq-content-row-latest-file');
    expect(latestFileCell).toHaveTextContent('slides-v2.pdf · v2');
  });

  it("renders the honest 'No files yet' empty cell for a submission with no uploads", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With No Files',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
          latestFile: null,
        },
      ]),
    });

    const { container } = render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'All' }));

    await waitFor(() => {
      expect(container.querySelector('.chq-content-row-title')).toHaveTextContent('A Talk With No Files');
    });

    const row = container.querySelector('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');

    expect(row.querySelector('.chq-content-row-latest-file')).toHaveTextContent('No files yet');
  });
});

// w1-e: staleness fixes — switching Worklist <-> Files refetches, and the
// explicit Refresh button re-fetches whichever list is currently visible.
describe('ContentApp: fresh loads on view switch and explicit refresh', () => {
  it('refetches the worklist when the Refresh button is clicked', async () => {
    const submissionsMock = vi.fn(() =>
      listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
          latestFile: null,
        },
      ]),
    );
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: submissionsMock,
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });
    expect(submissionsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(submissionsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('reloads the Files library when switching from Worklist to Files', async () => {
    const filesMock = vi.fn(() => listEnvelope([]));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: filesMock,
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Files' }));

    await waitFor(() => {
      expect(filesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(filesMock).toHaveBeenCalledTimes(2);
    });
  });
});

// CNT-D1: a submission opened from the Files library is almost never in the
// current worklist page (different sort/tab/page) — the old code silently
// no-opped instead of opening the drill-in. selectSubmission must fetch the
// submission directly when it isn't already present in `items`.
describe('ContentApp: Files-library drill-in fetches an out-of-page submission (CNT-D1)', () => {
  it('renders the deliverable detail for a submissionId not present in the worklist page', async () => {
    const submissionMock = vi.fn(() => ({
      id: 'sub-99',
      eventId: EVENT_ID,
      ref: 'S-099',
      title: 'Off-Page Talk',
      description: null,
      status: 'accepted',
      contentStatus: 'approved',
      trackId: null,
      trackIds: [],
      formId: null,
      acceptedAt: null,
      icsSequence: 0,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      participants: [],
      answers: {},
    }));
    mockApi({
      // The worklist page (default tab) never contains sub-99.
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/submissions/sub-99`]: submissionMock,
    });

    render(
      <MemoryRouter initialEntries={['/?view=files&submissionId=sub-99']}>
        <ContentApp />
      </MemoryRouter>,
    );

    // DEC-678: the loading state is withheld for ~250ms (DelayedLoading),
    // so no "Loading submission..." text renders on the first frame -- the
    // heading below is this test's regression signal instead.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Off-Page Talk' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Back to worklist/ })).toBeInTheDocument();
    expect(submissionMock).toHaveBeenCalledTimes(1);

    // A rerender (e.g. from the worklist poll finishing) must not re-fire
    // the fetch for the same id.
    await waitFor(() => {
      expect(submissionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('renders a loud not-found error instead of the list when the submission fetch 404s', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/submissions/sub-missing`]: { status: 404, body: errorEnvelope('not_found', 'Submission not found') },
    });

    render(
      <MemoryRouter initialEntries={['/?view=files&submissionId=sub-missing']}>
        <ContentApp />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Submission not found.');
    expect(alert).toHaveClass('chq-error');

    // Must never fall through to rendering the Files/worklist views.
    expect(screen.queryByRole('tab', { name: 'Worklist' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('files-library')).not.toBeInTheDocument();
  });

  it('reaches the deliverable detail by clicking a Files-library "Open ... versions and comments" button', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([
        {
          rootFileId: 'file-v1',
          latestFileId: 'file-v2',
          filename: 'slides.pdf',
          kind: 'presentation',
          submissionId: 'sub-99',
          submissionRef: 'S-099',
          submissionTitle: 'Off-Page Talk',
          speakerName: 'Priya Raman',
          uploadedAt: 1700000000000,
          versionCount: 2,
        },
      ]),
      [`GET /api/v1/submissions/sub-99`]: {
        id: 'sub-99',
        eventId: EVENT_ID,
        ref: 'S-099',
        title: 'Off-Page Talk',
        description: null,
        status: 'accepted',
        contentStatus: 'approved',
        trackId: null,
        trackIds: [],
        formId: null,
        acceptedAt: null,
        icsSequence: 0,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        participants: [],
        answers: {},
      },
    });

    render(
      <MemoryRouter initialEntries={['/?view=files']}>
        <ContentApp />
      </MemoryRouter>,
    );

    const openButtons = await screen.findAllByRole('button', { name: 'Open slides.pdf versions and comments' });
    fireEvent.click(openButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Off-Page Talk' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Back to worklist/ })).toBeInTheDocument();
  });
});
