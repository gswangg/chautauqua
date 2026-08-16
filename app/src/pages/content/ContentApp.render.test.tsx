// CNT-12: content-approval reachability. Locks in the always-visible
// per-row Approve/Request changes control on the worklist (SessionList),
// which previously required drilling into DeliverableDetail (itself
// reachable only after uploading a file) to reach
// POST /api/v1/submissions/:id/content-status. Mirrors the DEC-144
// layer-2 harness pattern used by Submissions.render.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

// DEC-935: mirrors App.tsx's own two <Route>s for /content (worklist) and
// /content/:submissionId (deliverable detail) -- both render the SAME
// ContentApp component, so tests mount it under the real route shape
// rather than at a bare "/" (matching SubmissionDetailPage.render.test.tsx's
// renderPage pattern).
function renderContentApp(initialPath = '/content') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/content/:submissionId" element={<ContentApp />} />
        <Route path="/content" element={<ContentApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

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
          latestFile: null,
        },
      ]),
      [`POST /api/v1/submissions/sub-1/content-status`]: contentStatusMock,
    });

    const { container } = renderContentApp();

    // DEC-881: default tab is 'needs_decision' — the row (contentStatus
    // 'pending') is visible without switching tabs.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^Needs a decision/ })).toHaveClass('is-active');
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
  it('renders the page title with the shared shell classes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    renderContentApp();

    const heading = await screen.findByRole('heading', { name: 'Content' });
    expect(heading).toHaveClass('chq-page-title');
  });
});

// w41-b (DEC-902 amendment): Worklist/Files are destinations reached by a
// button in the title row, not a role=tablist pair -- the toolbar band is
// gone.
describe('ContentApp title-row destination buttons (w41-b/DEC-902 amendment)', () => {
  it("shows 'All files' + Refresh on the worklist, and switches to Files on click", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
    });

    renderContentApp();

    await screen.findByRole('button', { name: 'All files' });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Worklist' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Files' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All files' }));

    await screen.findByTestId('files-library');
    expect(screen.getByRole('button', { name: 'Worklist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
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
          latestFile: { filename: 'slides-v2.pdf', kind: 'presentation', versionCount: 2, uploadedAt: 1700000100000 },
          // DEC-965: the version shown is the row's stored identity, which the
          // list payload ships alongside latestFile — never the chain length in
          // latestFile.versionCount.
          // w5-i: per-kind version map the Latest file column's summary reads.
          latestFileByKind: { presentation: 2 },
        },
      ]),
    });

    const { container } = renderContentApp();

    fireEvent.click(await screen.findByRole('tab', { name: 'All accepted sessions' }));

    await waitFor(() => {
      expect(container.querySelector('.chq-content-row-title')).toHaveTextContent('A Talk With A Replaced File');
    });

    const row = container.querySelector('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');

    // w5-i: the Latest file column is a per-kind summary ("Slides v2"), not
    // the raw filename+version.
    const latestFileCell = row.querySelector('.chq-content-row-latest-file');
    expect(latestFileCell).toHaveTextContent('Slides v2');
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
          latestFile: null,
        },
      ]),
    });

    const { container } = renderContentApp();

    fireEvent.click(await screen.findByRole('tab', { name: 'All accepted sessions' }));

    await waitFor(() => {
      expect(container.querySelector('.chq-content-row-title')).toHaveTextContent('A Talk With No Files');
    });

    const row = container.querySelector('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');

    expect(row.querySelector('.chq-content-row-latest-file')).toHaveTextContent('No files yet');
  });
});

// DEC-825 amendment (wave 25, ruling A1): set-based bulk content-approval —
// selecting rows surfaces a .chq-bulkbar (shared vocabulary, DEC-825),
// rendered INSIDE SessionList between the chipstrip and the table, with
// ONE verb ("Approve N") plus the consequence line and a "Clear" tertiary.
// Approve sends one POST carrying every selected id and reloads the
// worklist on success.
describe('ContentApp worklist bulk content-status (DEC-825 amendment)', () => {
  function twoRowEnvelope() {
    return listEnvelope([
      {
        id: 'sub-1',
        ref: 'S-001',
        title: 'Talk One',
        status: 'accepted',
        contentStatus: 'pending',
        speakers: [],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000000000,
      },
      {
        id: 'sub-2',
        ref: 'S-002',
        title: 'Talk Two',
        status: 'accepted',
        contentStatus: 'pending',
        speakers: [],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000001000,
      },
    ]);
  }

  it('shows a selection count and sends one POST carrying every selected id, then reloads', async () => {
    const submissionsMock = vi.fn(() => twoRowEnvelope());
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: submissionsMock,
      [`POST /api/v1/events/${EVENT_ID}/submissions/content-status`]: { updated: 2 },
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    // DEC-825 chip vocabulary: the 'all' tab reads 'All accepted sessions'.
    fireEvent.click(await screen.findByRole('tab', { name: 'All accepted sessions' }));
    await screen.findByText('Talk One');
    await screen.findByText('Talk Two');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all on page' }));

    expect(await screen.findByText('2 selected')).toBeInTheDocument();

    const callsBeforeBulk = submissionsMock.mock.calls.length;

    const bulkbar = screen.getByRole('toolbar', { name: 'Bulk content actions' });
    expect(within(bulkbar).getByText('Sends nothing · the speaker sees it in their portal')).toBeInTheDocument();
    fireEvent.click(within(bulkbar).getByRole('button', { name: 'Approve 2' }));

    await waitFor(() => {
      const bulkCalls = fetchMock.mock.calls.filter(
        ([input]) => String(input).includes('/submissions/content-status'),
      );
      expect(bulkCalls).toHaveLength(1);
    });
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).includes('/submissions/content-status'))!;
    const body = JSON.parse((init as RequestInit).body as string) as { ids: string[]; contentStatus: string };
    expect(body.contentStatus).toBe('approved');
    expect(body.ids.sort()).toEqual(['sub-1', 'sub-2']);

    // Selection clears and the worklist reloads.
    await waitFor(() => {
      expect(submissionsMock.mock.calls.length).toBeGreaterThan(callsBeforeBulk);
    });
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
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
          latestFile: null,
        },
      ]),
    );
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: submissionsMock,
    });

    renderContentApp();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });
    // DEC-913: the chip counts and re-uploaded headline ride the same
    // worklist response — mounting fires exactly ONE /submissions request,
    // not a per-chip fan-out.
    await waitFor(() => {
      expect(submissionsMock).toHaveBeenCalledTimes(1);
    });

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

    renderContentApp();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All files' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'All files' }));

    // DEC-902: the stat line/chip counts are read from the SAME envelope
    // the table renders from (kindCounts + total/totalSizeBytes) — one
    // mount fires exactly 1 request, not a per-kind fan-out.
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

    renderContentApp('/content/sub-99?view=files');

    // DEC-678: the loading state is withheld for ~250ms (DelayedLoading),
    // so no "Loading submission..." text renders on the first frame -- the
    // heading below is this test's regression signal instead.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Off-Page Talk' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '‹ Content' })).toBeInTheDocument();
    // DEC-901: DeliverableDetail's own header fetch (subtitle + CONTENT
    // STATUS band, keyed on submissionId only) hits this same endpoint
    // alongside ContentApp's own CNT-D1 out-of-page lookup -- 2 calls, not
    // 1, but still never more than 2 on a rerender.
    expect(submissionMock).toHaveBeenCalledTimes(2);

    // A rerender (e.g. from the worklist poll finishing) must not re-fire
    // the fetch for the same id.
    await waitFor(() => {
      expect(submissionMock).toHaveBeenCalledTimes(2);
    });
  });

  it('renders a loud not-found error instead of the list when the submission fetch 404s', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/submissions/sub-missing`]: { status: 404, body: errorEnvelope('not_found', 'Submission not found') },
    });

    renderContentApp('/content/sub-missing?view=files');

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
          // EventFileChainItem requires these three: the real endpoint always
          // sends them, and formatBytes (DEC-020 wave-55) throws rather than
          // rendering "NaN B", so an incomplete fixture fails loudly here.
          versionNo: 2,
          sizeBytes: 2048,
          uploaderName: null,
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

    renderContentApp('/content?view=files');

    const openButtons = await screen.findAllByRole('button', { name: 'Open slides.pdf versions and comments' });
    fireEvent.click(openButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Off-Page Talk' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '‹ Content' })).toBeInTheDocument();
  });
});

// DEC-935: the deliverable detail is a real route, /content/:submissionId,
// not ?submissionId= on the worklist route. Mirrors App.tsx's own two
// <Route>s (both rendering ContentApp) via the renderContentApp helper.
describe('ContentApp (DEC-935): /content/:submissionId is a real route', () => {
  it('renders the deliverable detail when mounted directly at /content/:submissionId', async () => {
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
          latestFile: null,
        },
      ]),
    });

    renderContentApp('/content/sub-1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'A Talk With No Files Yet' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '‹ Content' })).toBeInTheDocument();
    // The worklist toolbar (Worklist/Files pills, Refresh) belongs to the
    // /content list view only -- it must not render underneath the detail.
    expect(screen.queryByRole('tab', { name: 'Worklist' })).not.toBeInTheDocument();
  });

  it('navigates the URL to /content/<id> (not ?submissionId=) when a worklist row is opened', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With No Files Yet',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          latestFile: null,
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/content']}>
        <Routes>
          <Route path="/content/:submissionId" element={<ContentApp />} />
          <Route path="/content" element={<ContentApp />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'A Talk With No Files Yet' })).toBeInTheDocument();
    });
    expect(screen.getByTestId('location-search').textContent).not.toContain('submissionId');
  });
});

// DEC-913: the tab strip's chip counts and the 'N need a decision · M
// re-uploaded' headline are ONE grouped aggregate riding the SAME worklist
// list response — no per-chip fetch, and switching tabs never moves the
// numbers because the server strips the tab's own contentStatus narrowing
// before grouping.
describe('ContentApp worklist chips (DEC-913): counts derive from the one list envelope, no per-chip fetch', () => {
  it('renders every chip count and the re-uploaded headline from the envelope, with exactly one list request per load', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], {
        contentStatusCounts: { pending: 2, approved: 5, changes_requested: 3 },
        reuploadedCount: 4,
      }),
    });

    renderContentApp();

    // needs_decision sums pending+changes_requested (2+3=5); approved is its
    // own count (5); all is the full total (2+5+3=10) — each read off the
    // SAME WORKLIST_TAB_CONTENT_STATUS entry the tab's own list filter uses.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Needs a decision · 5' })).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Approved · 5' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All accepted sessions · 10' })).toBeInTheDocument();
    expect(screen.getByText('5 need a decision · 4 re-uploaded')).toBeInTheDocument();

    // Exactly one /submissions request for the initial mount — no per-chip
    // fan-out and no separate re-uploaded headline request.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('tab', { name: /^Approved/ }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^Approved/ })).toHaveClass('is-active');
    });

    // Switching tabs re-fetches the list (its own new contentStatus filter)
    // but the chip numbers themselves stay the SAME server-reported totals
    // — never move just because the active tab changed.
    expect(screen.getByRole('tab', { name: 'Needs a decision · 5' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Approved · 5' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All accepted sessions · 10' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// DEC-825: ?tab= is the URL state for the new (three-tab) vocabulary — a
// direct link into a tab lands on that tab, and clicking a chip writes its
// name back into the URL, so the two never drift apart.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

// DEC-952: exactly one <h1> in every state — ContentApp hands the heading
// off to the child view that owns it (FilesLibrary, DeliverableDetail) and
// only renders its own <h1>Content</h1> where no child view mounts.
describe('ContentApp (DEC-952): exactly one h1 in every state', () => {
  it('renders exactly one h1 reading "Content" on the worklist', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    const { container } = renderContentApp();

    await waitFor(() => {
      const h1s = container.querySelectorAll('h1');
      expect(h1s).toHaveLength(1);
      expect(h1s[0]).toHaveTextContent('Content');
    });
  });

  it('renders exactly one h1 reading "Files" at ?view=files', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
    });

    const { container } = renderContentApp('/content?view=files');

    await waitFor(() => {
      const h1s = container.querySelectorAll('h1');
      expect(h1s).toHaveLength(1);
      expect(h1s[0]).toHaveTextContent('Files');
    });
  });

  it('renders exactly one h1 reading the session title at a resolved /content/:submissionId', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With No Files Yet',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          latestFile: null,
        },
      ]),
    });

    const { container } = renderContentApp('/content/sub-1');

    await waitFor(() => {
      const h1s = container.querySelectorAll('h1');
      expect(h1s).toHaveLength(1);
      expect(h1s[0]).toHaveTextContent('A Talk With No Files Yet');
    });
  });
});

// DEC-825 amendment (wave 25, ruling A1): the page-wide "Approve N ready"
// title-row/section-rule action is GONE — two olive primaries with
// different scopes (every eligible row on the page vs. the ticked rows)
// left a user unable to tell which one they were pressing. Bulk approval
// now has exactly ONE primary: the selection bar's own "Approve N" button
// (see 'ContentApp worklist bulk content-status' above).
describe('ContentApp: no second bulk-approve primary (DEC-825 amendment, ruling A1)', () => {
  it('never renders an "Approve N ready" control, selection or not', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'Talk One',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
        },
        {
          id: 'sub-2',
          ref: 'S-002',
          title: 'Talk Two',
          status: 'accepted',
          contentStatus: 'changes_requested',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000001000,
        },
      ]),
    });

    renderContentApp();

    fireEvent.click(await screen.findByRole('tab', { name: 'All accepted sessions' }));
    await screen.findByText('Talk One');

    expect(screen.queryByRole('button', { name: /^Approve \d+ ready$/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Unapproved sessions stay off the public site.')).not.toBeInTheDocument();
  });
});

describe('ContentApp worklist tab (DEC-825): ?tab= round-trips through the new vocabulary', () => {
  it('reads an explicit ?tab=approved from the URL and marks that chip active', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/content?tab=approved']}>
        <Routes>
          <Route path="/content/:submissionId" element={<ContentApp />} />
          <Route path="/content" element={<ContentApp />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^Approved/ })).toHaveClass('is-active');
    });
    expect(screen.getByRole('tab', { name: /^Needs a decision/ })).not.toHaveClass('is-active');
  });

  it('writes the clicked chip name back into ?tab= (URL state)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/content']}>
        <Routes>
          <Route path="/content/:submissionId" element={<ContentApp />} />
          <Route path="/content" element={<ContentApp />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: /^Approved/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('tab=approved');
    });
  });
});
