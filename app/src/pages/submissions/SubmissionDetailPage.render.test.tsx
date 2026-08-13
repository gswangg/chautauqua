// CNT-09 (admin session editing) render regression: locks in the inline
// title/abstract editor (PATCH /api/v1/submissions/:id) on the submission
// detail page, mirroring the DEC-144 layer-2 harness pattern used by
// Submissions.render.test.tsx. DEC-743: content approval left this page for
// the content screen -- see the 'Review the content' link tests below.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import { PARTICIPANT_ROLE_OPTIONS } from '../../../../src/domain/participant-roles';

const SUB_ID = 'sub-render-1';

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SUB_ID,
    eventId: 'evt-1',
    ref: 'S-001',
    title: 'Original Title',
    description: 'Original description',
    status: 'pending',
    contentStatus: 'pending',
    trackId: null,
    trackIds: [] as string[],
    formId: null,
    acceptedAt: null,
    icsSequence: 0,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    participants: [],
    answers: {},
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(initialPath = `/submissions/${SUB_ID}`) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubmissionDetailPage render smoke: inline edit + content-status control', () => {
  it('edits title/description via PATCH and shows the saved value', async () => {
    let currentDetail = baseDetail();
    const patchMock = vi.fn(() => {
      currentDetail = { ...currentDetail, title: 'Updated Title', description: 'Updated description' };
      return currentDetail;
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    // Decision panel states plainly that deciding never emails (house
    // invariant): notification is a separate, explicit action from Comms.
    expect(screen.getByText('Deciding never sends email. Notify the speaker from Comms.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByLabelText('Title');
    expect(titleInput).toHaveClass('chq-input');
    const abstractInput = screen.getByLabelText('Abstract');
    expect(abstractInput).toHaveClass('chq-textarea');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    fireEvent.change(abstractInput, { target: { value: 'Updated description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // DEC-406: every rendered button carries a shell chq- class.
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toEqual(expect.stringContaining('chq-'));
    }

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Updated description')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'S-001: Updated Title' })).toBeInTheDocument();
  });

  it('leaves content approval to the content screen via a single tertiary link (DEC-743)', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    // No content-status controls remain on this page.
    expect(screen.queryByRole('button', { name: 'Approve content' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request changes' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Content:/)).not.toBeInTheDocument();

    const contentLink = screen.getByRole('link', { name: /Review the content/ });
    expect(contentLink).toHaveAttribute('href', `/content?submissionId=${SUB_ID}`);
  });

  it('shows history panel and restores a prior revision (CNT-11, DEC-158)', async () => {
    let currentDetail = baseDetail();
    const revisions = [
      { id: 'rev-2', editorName: 'organizer@example.com', title: 'Original Title', description: 'Second edit', createdAt: 1700000200000 },
      { id: 'rev-1', editorName: 'organizer@example.com', title: 'Original Title', description: 'First edit', createdAt: 1700000100000 },
    ];
    const restoreMock = vi.fn(() => {
      currentDetail = { ...currentDetail, description: 'First edit' };
      return currentDetail;
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/submissions/${SUB_ID}/revisions`]: { items: revisions, total: 2, page: 1, perPage: 2 },
      [`POST /api/v1/submissions/${SUB_ID}/revisions/rev-1/restore`]: restoreMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    // DEC-707 section-action grammar: 'History' is a plain label, 'Show'
    // is the section's ONE action -- no more 'Show history' bare toggle.
    expect(screen.getByText('History')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    await waitFor(() => {
      expect(screen.getAllByText('organizer@example.com').length).toBe(2);
    });

    // Each history entry renders as a `when | what` row.
    expect(screen.getAllByText('|').length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    fireEvent.click(restoreButtons[1]!);

    await waitFor(() => {
      expect(restoreMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('First edit')).toBeInTheDocument();
    });
  });
});

// DEC-596/DEC-577/DEC-723/DEC-736 (tasks w3-f, w2-h): the numbered Reviews
// section header reads 'Reviews · N of M in', each row shows the reviewer
// name (never 'Anonymous reviewer' — DEC-736), the plan's weighted score
// (2dp / em-dash), full comment text, and criterion values under their
// criteria[].label (never the raw criterionId); the decision panel is a
// segmented button group, not a <select>.
describe('SubmissionDetailPage render: Reviews section + segmented decision buttons', () => {
  it('renders each evaluation under its criteria labels, the weighted score, and the Speaker card', async () => {
    const detail = baseDetail({
      status: 'pending',
      participants: [
        {
          id: 'p1',
          contactId: 'c1',
          name: 'Jamie Speaker',
          email: 'jamie@example.com',
          title: 'Principal Engineer',
          company: 'Acme Corp',
          role: 'speaker',
          order: 0,
          visible: true,
          inviteStatus: 'accepted',
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: {
        items: [
          {
            planId: 'plan-1',
            planName: 'Round 1 review',
            round: 1,
            reviewerName: 'Jamie Reviewer',
            scores: { c1: 4 },
            criteria: [{ id: 'c1', label: 'Technical depth', kind: 'scale', weight: 1 }],
            score: 4,
            comment: 'Solid proposal, would love more detail on the demo.',
            submittedAt: 1700000000000,
          },
          {
            planId: 'plan-2',
            planName: 'Blind review',
            round: 1,
            reviewerName: 'Alex Reviewer',
            scores: { c1: 2 },
            criteria: [{ id: 'c1', label: 'Technical depth', kind: 'scale', weight: 1 }],
            score: null,
            comment: 'Scope is too broad for the slot.',
            submittedAt: null,
          },
        ],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Solid proposal, would love more detail on the demo.')).toBeInTheDocument();
    });
    expect(screen.getByText('Jamie Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Alex Reviewer')).toBeInTheDocument();
    expect(screen.queryByText('Anonymous reviewer')).not.toBeInTheDocument();
    expect(screen.getByText('Scope is too broad for the slot.')).toBeInTheDocument();

    // Header: 'Reviews · N of M in' -- 1 of 2 items has a non-null submittedAt.
    expect(screen.getByRole('heading', { name: /Reviews\s*·\s*1 of 2 in/ })).toBeInTheDocument();

    // Criterion values render under their label, never the raw criterionId.
    expect(screen.getAllByText('Technical depth').length).toBe(2);
    expect(screen.queryByText('c1')).not.toBeInTheDocument();

    // Weighted score: 2dp when present, em-dash when null.
    expect(screen.getByText('4.00')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    // 'Awaiting triage' micro-label above the decision controls, pending only.
    expect(screen.getByText(/Awaiting triage/)).toBeInTheDocument();

    // Speaker card (name also appears in the Participants table row, so
    // assert at least one instance rather than requiring uniqueness).
    expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    expect(screen.getByText('Principal Engineer, Acme Corp')).toBeInTheDocument();
    expect(screen.getAllByText('jamie@example.com').length).toBeGreaterThan(0);

    // Segmented decision buttons: three buttons, one filled primary
    // (the current status), the other two secondary/outline.
    const pendingBtn = screen.getByRole('button', { name: 'Pending' });
    const acceptedBtn = screen.getByRole('button', { name: 'Accepted' });
    const declinedBtn = screen.getByRole('button', { name: 'Declined' });
    expect(pendingBtn).toHaveClass('chq-btn-primary');
    expect(acceptedBtn).toHaveClass('chq-btn-secondary');
    expect(declinedBtn).toHaveClass('chq-btn-secondary');
    // No native <select> for status any more (scoped to the decision
    // panel -- the Participants section's own role <select>, DEC-784, is
    // unrelated and legitimately present elsewhere on the page).
    const decisionStatusGroup = screen.getByRole('group', { name: 'Status' });
    expect(within(decisionStatusGroup).queryByRole('combobox')).not.toBeInTheDocument();
  });
});

// DEC-638/DEC-598: the Tracks section becomes an editable multi-select
// (checkbox list, not radios per DEC-579) with a Save action that PATCHes
// the FULL trackIds set, including the legal empty-array clear.
describe('SubmissionDetailPage render: editable Tracks section', () => {
  it('adds a track by PATCHing the full id set and renders the result', async () => {
    let currentDetail = baseDetail({ trackIds: ['t1'] });
    // mockApi route handlers take no arguments (the fetch stub does not
    // parse the request body into them), so the response is hardcoded to
    // the expected next state; the actual PATCH body is asserted separately
    // below via the raw fetchMock call.
    const patchMock = vi.fn(() => {
      currentDetail = { ...currentDetail, trackIds: ['t1', 't2'] };
      return currentDetail;
    });
    const fetchMock = mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [
          { id: 't1', name: 'Frontend' },
          { id: 't2', name: 'Backend' },
        ],
        total: 2,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));

    const backendCheckbox = screen.getByRole('checkbox', { name: 'Backend' });
    fireEvent.click(backendCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });
    const patchCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      return url.includes(`/submissions/${SUB_ID}`) && init?.method === 'PATCH';
    })!;
    expect(JSON.parse(patchCall[1]!.body as string)).toEqual({ trackIds: ['t1', 't2'] });
    await waitFor(() => {
      expect(screen.getAllByText('Backend').length).toBeGreaterThan(0);
    });
  });

  it('clears every track by PATCHing an empty array and renders the empty state', async () => {
    let currentDetail = baseDetail({ trackIds: ['t1'] });
    // See note above: the handler's response is hardcoded to the expected
    // next state; the actual PATCH body is asserted via fetchMock below.
    const patchMock = vi.fn(() => {
      currentDetail = { ...currentDetail, trackIds: [] };
      return currentDetail;
    });
    const fetchMock = mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [{ id: 't1', name: 'Frontend' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Frontend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });
    const patchCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      return url.includes(`/submissions/${SUB_ID}`) && init?.method === 'PATCH';
    })!;
    expect(JSON.parse(patchCall[1]!.body as string)).toEqual({ trackIds: [] });
    await waitFor(() => {
      expect(screen.getByText('No tracks assigned.')).toBeInTheDocument();
    });
  });

  it('surfaces a failed PATCH and restores the server set', async () => {
    const currentDetail = baseDetail({ trackIds: ['t1'] });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [
          { id: 't1', name: 'Frontend' },
          { id: 't2', name: 'Backend' },
        ],
        total: 2,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: {
        status: 422,
        body: errorEnvelope('invalid', 'Tracks belong to a different event', {
          trackIds: 'Tracks belong to a different event',
        }),
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Backend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Tracks belong to a different event')).toBeInTheDocument();
    });
    // Rolled back to the server's actual (refetched) set: only Frontend is
    // checked, Backend reverts to unchecked -- the editor stays open (same
    // pattern as the title/description editor) so the organiser sees the
    // error and can retry.
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Frontend' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Backend' })).not.toBeChecked();
    });
  });
});

// DEC-656: a speaker-added co-presenter lands visible=false — the
// Participants table caption names the count and the fix (tick Visible),
// derived from the already-loaded detail.participants (no new endpoint).
describe('SubmissionDetailPage render: unpublished-participant caption (DEC-656)', () => {
  function participant(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'p1',
      contactId: 'c1',
      name: 'Jamie Speaker',
      email: 'jamie@example.com',
      title: null,
      company: null,
      role: 'speaker',
      order: 0,
      visible: true,
      inviteStatus: 'accepted',
      ...overrides,
    };
  }

  it('shows the caption naming the count when a participant is not yet visible', async () => {
    const detail = baseDetail({
      participants: [
        participant({ id: 'p1', name: 'Jamie Speaker', visible: true }),
        participant({ id: 'p2', name: 'Marcus Okafor', email: 'marcus@example.com', visible: false, inviteStatus: 'none' }),
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Marcus Okafor')).toBeInTheDocument();
    });
    expect(
      screen.getByText('1 speaker(s) on this session are not on the public site yet — tick Visible to publish them.'),
    ).toBeInTheDocument();
  });

  it('renders no caption when every participant is already visible', async () => {
    const detail = baseDetail({
      participants: [participant({ id: 'p1', name: 'Jamie Speaker', visible: true })],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/not on the public site yet/)).not.toBeInTheDocument();
  });
});

// DEC-761: position in the list you came from, re-derived from THIS page's
// own search params (the same ones the table sends), never router state.
// DEC-733: prev/next are absent at either end, not disabled.
describe('SubmissionDetailPage render: list position + neighbour navigation (DEC-761)', () => {
  function listItem(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: SUB_ID,
      ref: 'S-003',
      title: 'Middle Submission',
      status: 'pending',
      contentStatus: 'pending',
      speakers: [],
      trackIds: [],
      submittedAt: 1700000000000,
      createdAt: 1700000000000,
      ...overrides,
    };
  }

  it('shows "N of M" and both arrows for a middle row under the table\'s own filter query', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/events/evt-1/submissions`]: {
        items: [
          listItem({ id: 'sub-before', ref: 'S-002' }),
          listItem({ id: SUB_ID, ref: 'S-003' }),
          listItem({ id: 'sub-after', ref: 'S-004' }),
        ],
        total: 47,
        page: 1,
        perPage: 20,
      },
    });

    renderPage(`/submissions/${SUB_ID}?status=pending&sort=oldest`);

    await waitFor(() => {
      expect(screen.getByText('2 of 47')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Previous submission' })).toHaveAttribute(
      'href',
      '/submissions/sub-before?status=pending&sort=oldest',
    );
    expect(screen.getByRole('link', { name: 'Next submission' })).toHaveAttribute(
      'href',
      '/submissions/sub-after?status=pending&sort=oldest',
    );
  });

  it('omits the Previous control when the submission is first in its page', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/events/evt-1/submissions`]: {
        items: [listItem({ id: SUB_ID, ref: 'S-001' }), listItem({ id: 'sub-after', ref: 'S-002' })],
        total: 2,
        page: 1,
        perPage: 20,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Previous submission' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next submission' })).toBeInTheDocument();
  });

  it('renders no position controls when the id is not on the returned page (stale link)', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/events/evt-1/submissions`]: {
        items: [listItem({ id: 'someone-else', ref: 'S-009' })],
        total: 1,
        page: 1,
        perPage: 20,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Position in list')).not.toBeInTheDocument();
  });
});

// DEC-761: the AWAITING TRIAGE banner is a restatement of status, never a
// second source of truth -- present only while status is 'pending'.
describe('SubmissionDetailPage render: awaiting-triage banner (DEC-761)', () => {
  it('renders no banner for an accepted submission', async () => {
    const detail = baseDetail({ status: 'accepted' });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/events/evt-1/submissions`]: { items: [], total: 0, page: 1, perPage: 20 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Awaiting triage/)).not.toBeInTheDocument();
  });

  it('renders the banner for a pending submission', async () => {
    const detail = baseDetail({ status: 'pending' });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/events/evt-1/submissions`]: { items: [], total: 0, page: 1, perPage: 20 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Awaiting triage/)).toBeInTheDocument();
    });
  });
});

// DEC-784 (+ server half of DEC-789): the co-presenter picker offers
// exactly the imported PARTICIPANT_ROLE_OPTIONS vocabulary, defaults to its
// first option, sends the chosen role in the POST body, and renders an
// existing participant's role through participantRoleLabel (never the raw
// stored value).
describe('SubmissionDetailPage render: co-presenter role picker (DEC-784)', () => {
  it('offers exactly the imported role vocabulary, defaults to the first option, and carries the selection in the POST body', async () => {
    const detail = baseDetail();
    const createdParticipant = {
      id: 'p-new',
      contactId: 'c-2',
      name: 'Riley Contact',
      email: 'riley@example.com',
      title: null,
      company: null,
      role: 'moderator',
      order: 0,
      visible: false,
      inviteStatus: 'invited',
    };
    const postMock = vi.fn(() => createdParticipant);
    const fetchMock = mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`GET /api/v1/contacts`]: {
        items: [{ id: 'c-2', firstName: 'Riley', lastName: 'Contact', email: 'riley@example.com' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`POST /api/v1/submissions/${SUB_ID}/participants`]: postMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    const optionValues = Array.from(roleSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(PARTICIPANT_ROLE_OPTIONS.map((opt) => opt.value));
    expect(roleSelect.value).toBe(PARTICIPANT_ROLE_OPTIONS[0]!.value);

    fireEvent.change(roleSelect, { target: { value: 'moderator' } });

    fireEvent.change(screen.getByLabelText('Search contacts'), { target: { value: 'Riley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Riley Contact (riley@example.com)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    const postCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      return url.includes(`/submissions/${SUB_ID}/participants`) && init?.method === 'POST';
    })!;
    expect(JSON.parse(postCall[1]!.body as string)).toEqual({ contactId: 'c-2', role: 'moderator' });
  });

  it('renders a participant role through participantRoleLabel, never the raw stored value', async () => {
    const detail = baseDetail({
      participants: [
        {
          id: 'p1',
          contactId: 'c1',
          name: 'Jamie Speaker',
          email: 'jamie@example.com',
          title: null,
          company: null,
          role: 'co-presenter',
          order: 0,
          visible: true,
          inviteStatus: 'accepted',
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });
    const table = document.querySelector('.chq-participants-table') as HTMLElement;
    expect(within(table).getByText('Co-presenter')).toBeInTheDocument();
    expect(within(table).queryByText('co-presenter')).not.toBeInTheDocument();
  });
});
