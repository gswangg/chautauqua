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
import { mockApi, errorEnvelope, type MockRouteHandler } from '../../test-utils/mockApi';
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
    slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// DEC-900 (wave 25 amendment): Session details is now a real, always-
// rendered FOURTH numbered section -- no disclosure to open. Callers keep
// this name (rather than a mass find/replace across every call site) and
// it now just waits for the section's own heading to confirm the section
// has mounted before interacting with its controls.
async function openSessionDetails() {
  // DEC-908 (findings wave 5 amendment): the section's h2 now also carries
  // the right-flushed caption text, so the accessible name is matched with
  // a prefix regex rather than an exact string.
  await screen.findByRole('heading', { name: /^Session details/ });
}

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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    // DEC-900 (ruling A6): the abstract's own Edit button is gone -- the
    // header's "Edit title and abstract >" link (deliverable detail) is the
    // one entry point, reached here via the same ?edit=1 URL state DEC-998
    // already gives the editor.
    renderPage(`/submissions/${SUB_ID}?edit=1`);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    // Decision rail states plainly that deciding never emails (house
    // invariant): notification is a separate, explicit action from Comms.
    // DEC-878: caption renders in every rail state.
    expect(screen.getByText('Deciding sends nothing. Notify from Comms.')).toBeInTheDocument();

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
    // DEC-908: the H1 is detail.title ALONE -- the ref moved to the ref row.
    expect(screen.getByRole('heading', { name: 'Updated Title' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^S-001:/ })).not.toBeInTheDocument();
  });

  it('leaves content approval to the content screen via a single tertiary link (DEC-743)', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
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
    expect(contentLink).toHaveAttribute('href', `/content/${SUB_ID}`);
  });

  it('shows the history timeline and restores a prior revision (CNT-11, DEC-158, DEC-892)', async () => {
    let currentDetail = baseDetail();
    let history = [
      { id: 'rev-2', at: 1700000200000, kind: 'edited', label: 'Edited by organizer@example.com', detail: 'Original Title', revisionId: 'rev-2' },
      { id: 'rev-1', at: 1700000100000, kind: 'edited', label: 'Edited by organizer@example.com', detail: 'Original Title', revisionId: 'rev-1' },
      { id: 'submission:sub-1', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null, revisionId: 'rev-0' },
    ];
    const restoreMock = vi.fn(() => {
      currentDetail = { ...currentDetail, description: 'First edit' };
      history = [
        { id: 'rev-3', at: 1700000300000, kind: 'edited', label: 'Edited by organizer@example.com', detail: 'Original Title', revisionId: 'rev-3' },
        ...history,
      ];
      return currentDetail;
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`GET /api/v1/submissions/${SUB_ID}/history`]: () => ({ items: history, total: history.length, page: 1, perPage: history.length }),
      [`POST /api/v1/submissions/${SUB_ID}/revisions/rev-1/restore`]: restoreMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    // DEC-707 section-action grammar: 'History' is a plain label, the
    // show/hide toggle is the section's ONE action. DEC-908 (wave 42
    // amendment): History renders EXPANDED by default, so the toggle
    // already reads 'Hide' with no click needed to reveal the entries.
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Edited by organizer@example.com').length).toBe(2);
    });
    expect(screen.getByText('Submitted')).toBeInTheDocument();

    // DEC-908: each history entry renders on the 96px/1fr 'when | what'
    // grid -- the grid gap is the separator, no literal ' | ' text node.
    expect(screen.queryByText('|')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.chq-submission-history-row').length).toBeGreaterThan(0);
    // History lives in the rail aside, below Speaker/Decision.
    expect(document.querySelector('.chq-detail-aside .chq-submission-history')).not.toBeNull();

    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    // w59-f (DEC-158 amendment): the newest revision-carrying entry (rev-2)
    // IS the current content, so it renders 'Current version' with no
    // button -- the first Restore button belongs to rev-1.
    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    fireEvent.click(restoreButtons[0]!);

    await waitFor(() => {
      expect(restoreMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getAllByText('Edited by organizer@example.com').length).toBe(3);
    });
  });
});

// DEC-998: the editor and the history disclosure are URL state, not local
// useState -- a `?edit=1`/`?history=1` link (e.g. from the Content
// deliverable detail's action row) opens either directly, and closing
// either removes the param.
describe('SubmissionDetailPage render: DEC-998 URL-state editor + history', () => {
  it('opens the editor prefilled from the loaded detail when mounted at ?edit=1', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const titleInput = await screen.findByLabelText('Title');
    expect(titleInput).toHaveValue('Original Title');
    expect(screen.getByLabelText('Abstract')).toHaveValue('Original description');

    // Cancel removes the param and closes the editor.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });
  });

  it('opens AND loads the history timeline when mounted at ?history=1', async () => {
    const detail = baseDetail();
    const history = [
      { id: 'submission:sub-1', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null },
    ];
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`GET /api/v1/submissions/${SUB_ID}/history`]: { items: history, total: 1, page: 1, perPage: 20 },
    });

    renderPage(`/submissions/${SUB_ID}?history=1`);

    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    // Hide removes the param and closes the disclosure.
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => {
      expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });
});

// DEC-596/DEC-723/DEC-736 (tasks w3-f, w2-h): the numbered Reviews section
// header reads 'Reviews · N of M in', each row shows the reviewer name
// (never 'Anonymous reviewer' — DEC-736), the plan's weighted score (1dp
// [DEC-908 wave 42 amendment] / em-dash), full comment text, and criterion
// values under their
// criteria[].label (never the raw criterionId); DEC-878: the decision panel
// is a rail (primary Accept + secondary Decline/Waitlist pair), not a
// segmented button group or a <select>.
describe('SubmissionDetailPage render: Reviews section + decision rail', () => {
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
        // DEC-596: `assigned` is the reviewer-ASSIGNMENT count, not
        // items.length -- a third reviewer is assigned but has not yet
        // submitted an evaluation row at all, so it never appears in items.
        assigned: 3,
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

    // Header: 'Reviews · N of M in' -- 1 of 2 items has a non-null
    // submittedAt, and M is the ASSIGNED reviewer count (3), not
    // items.length (2) -- DEC-596.
    expect(screen.getByRole('heading', { name: /Reviews\s*·\s*1 of 3 in/ })).toBeInTheDocument();

    // DEC-737 (wave 2 amendment): per-criterion detail is behind a quiet,
    // closed-by-default disclosure on each review row -- the resting row
    // never shows criterion labels/values.
    expect(screen.queryByText('Technical depth')).not.toBeInTheDocument();
    const toggles = screen.getAllByRole('button', { name: /criterion/ });
    expect(toggles.length).toBe(2);
    toggles.forEach((toggle) => fireEvent.click(toggle));

    // Criterion values render under their label, never the raw criterionId,
    // once the disclosure is opened.
    expect(screen.getAllByText('Technical depth').length).toBe(2);
    expect(screen.queryByText('c1')).not.toBeInTheDocument();

    // DEC-908 (wave 42 amendment): score renders at 1dp -- every other
    // review surface is already 1dp -- em-dash when null.
    expect(screen.getByText('4.0')).toBeInTheDocument();
    // Alex Reviewer's row has both a null score and a null submittedAt, so
    // formatTimestamp/score both render the em-dash -- assert at least one
    // instance rather than requiring page-wide uniqueness.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    // 'Awaiting triage' micro-label above the decision controls, pending only.
    expect(screen.getByText(/Awaiting triage/)).toBeInTheDocument();

    // Speaker card (name also appears in the Participants table row, so
    // assert at least one instance rather than requiring uniqueness).
    expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    // DEC-908 (wave 42 amendment): 'Company · Role' with a middot.
    expect(screen.getByText('Acme Corp · Principal Engineer')).toBeInTheDocument();
    expect(screen.getAllByText('jamie@example.com').length).toBeGreaterThan(0);

    // DEC-878 pending rail: Accept is the full-width primary, Decline and
    // Waitlist are the secondary pair. No control offers 'Pending' as a
    // choosable status.
    const acceptBtn = screen.getByRole('button', { name: 'Accept' });
    const declineBtn = screen.getByRole('button', { name: 'Decline' });
    const waitlistBtn = screen.getByRole('button', { name: 'Waitlist' });
    expect(acceptBtn).toHaveClass('chq-btn-primary');
    expect(declineBtn).toHaveClass('chq-btn-secondary');
    expect(waitlistBtn).toHaveClass('chq-btn-secondary');
    expect(screen.queryByRole('button', { name: 'Pending' })).not.toBeInTheDocument();
    // No native <select> for status any more (the Participants section's
    // own role <select>, DEC-784, is unrelated and legitimately present
    // elsewhere on the page).
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
  });
});

// DEC-878: once a decision is in force, the rail states it plainly (with a
// date in the event's own timezone), offers only the two decisions NOT in
// force, and exposes exactly one quiet 'Back to pending' un-decide path.
describe('SubmissionDetailPage render: decided-state rail (DEC-878)', () => {
  it('states the decision with a date, offers the other two as the secondary pair, and shows one Back to pending link', async () => {
    const detail = baseDetail({ status: 'accepted', updatedAt: 1700000500000 });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    // Stated decision line, not the bare eyebrow.
    expect(screen.queryByText(/Awaiting triage/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Accepted · /)).toBeInTheDocument();

    // The two decisions NOT in force, never the one already in force.
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Waitlist' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();

    // Exactly one un-decide path, and no button offers 'Pending'.
    expect(screen.getAllByRole('button', { name: 'Back to pending' }).length).toBe(1);
    expect(screen.queryByRole('button', { name: 'Pending' })).not.toBeInTheDocument();

    // The caption renders in the decided state too.
    expect(screen.getByText('Deciding sends nothing. Notify from Comms.')).toBeInTheDocument();
  });

  it('returns to the pending rail via Back to pending, PATCHing status=pending', async () => {
    let currentDetail = baseDetail({ status: 'declined', updatedAt: 1700000500000 });
    const statusMock = vi.fn(() => {
      currentDetail = { ...currentDetail, status: 'pending' };
      return { updated: 1 };
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`POST /api/v1/events/evt-1/submissions/status`]: statusMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/^Declined · /)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to pending' }));

    await waitFor(() => {
      expect(statusMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/Awaiting triage/)).toBeInTheDocument();
    });
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await openSessionDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Frontend').length).toBeGreaterThan(0);
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await openSessionDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Frontend').length).toBeGreaterThan(0);
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: {
        status: 422,
        body: errorEnvelope('invalid', 'Tracks belong to a different event', {
          trackIds: 'Tracks belong to a different event',
        }),
      },
    });

    renderPage();

    await openSessionDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Frontend').length).toBeGreaterThan(0);
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await openSessionDetails();

    await waitFor(() => {
      expect(screen.getByText('Marcus Okafor')).toBeInTheDocument();
    });
    expect(
      screen.getByText('1 speaker on this session are not on the public site yet — tick Visible to publish them.'),
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
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

    // DEC-908 ref row: '<ref> · N of M' as one muted string.
    await waitFor(() => {
      expect(screen.getByText('S-001 · 2 of 47')).toBeInTheDocument();
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`GET /api/v1/events/evt-1/submissions`]: {
        items: [listItem({ id: SUB_ID, ref: 'S-001' }), listItem({ id: 'sub-after', ref: 'S-002' })],
        total: 2,
        page: 1,
        perPage: 20,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('S-001 · 1 of 2')).toBeInTheDocument();
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`GET /api/v1/events/evt-1/submissions`]: { items: [], total: 0, page: 1, perPage: 20 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Awaiting triage/)).toBeInTheDocument();
    });
  });
});

// DEC-780: the organiser's submission detail carries format and placement.
describe('SubmissionDetailPage render: placement + format (DEC-780)', () => {
  it('renders the placement line only when slot is non-null', async () => {
    const detail = baseDetail({
      slot: { day: '2026-05-12', startMin: 600, endMin: 630, roomName: 'Room 2A' },
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    const placementLink = screen.getByText('Tue 12 May · 10:00–10:30 · Room 2A');
    expect(placementLink).toBeInTheDocument();
    expect(placementLink.closest('a')).toHaveAttribute('href', '/agenda');
  });

  it('renders no placement line when slot is null (not yet scheduled)', async () => {
    const detail = baseDetail({ slot: null });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-detail-placement')).not.toBeInTheDocument();
  });

  it('lists the SESSION_FORMAT field options and PATCHes { format } on change', async () => {
    let currentDetail = baseDetail();
    const patchMock = vi.fn(() => {
      currentDetail = { ...currentDetail, answers: { field_session_format: 'Workshop' } };
      return currentDetail;
    });
    const fetchMock = mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_session_format',
            role: 'session_format',
            section: 'session',
            kind: 'dropdown',
            label: 'Format',
            required: false,
            position: 1,
            options: ['Talk', 'Workshop'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    await openSessionDetails();

    const select = await screen.findByLabelText('Format');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Talk' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'Workshop' } });

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });
    const patchCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      return url.includes(`/submissions/${SUB_ID}`) && init?.method === 'PATCH';
    })!;
    expect(JSON.parse(patchCall[1]!.body as string)).toEqual({ format: 'Workshop' });
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
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
    await openSessionDetails();

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

  // DEC-900 (wave 25 amendment): the Role column reads LEAD / CO-PRESENTER
  // -- never the raw stored role key (speaker/co-presenter/moderator/
  // panelist).
  it('renders participant roles as LEAD / CO-PRESENTER, never the raw stored role key', async () => {
    const detail = baseDetail({
      participants: [
        {
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
        },
        {
          id: 'p2',
          contactId: 'c2',
          name: 'Riley Moderator',
          email: 'riley@example.com',
          title: null,
          company: null,
          role: 'moderator',
          order: 1,
          visible: true,
          inviteStatus: 'none',
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });
    await openSessionDetails();
    const table = document.querySelector('.chq-participants-table') as HTMLElement;
    expect(within(table).getByText('LEAD')).toBeInTheDocument();
    expect(within(table).getByText('CO-PRESENTER')).toBeInTheDocument();
    expect(within(table).queryByText('speaker')).not.toBeInTheDocument();
    expect(within(table).queryByText('moderator')).not.toBeInTheDocument();
  });
});

// DEC-908: rebuild to the frame's anatomy (docs/design 'Chautauqua
// Submissions.dc.html' lines 207-299) -- ref row above the grid, an eyebrow
// (tracks + format) above a title-only H1, main column reordered to
// Abstract -> Form Answers -> Reviews -> Session Details, History moved
// into the rail below Speaker, and the Meta section deleted outright.
describe('SubmissionDetailPage render: DEC-908 frame anatomy', () => {
  it('renders the ref-row string, the eyebrow, and a title-only H1', async () => {
    const detail = baseDetail({
      title: 'Docs That Answer Back',
      trackIds: ['t1', 't2'],
      answers: { field_session_format: 'Lightning talk' },
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [
          { id: 't1', name: 'Developer Experience' },
          { id: 't2', name: 'Platform' },
        ],
        total: 2,
        page: 1,
        perPage: 20,
      },
      // DEC-592/DEC-755: the eyebrow's format resolves through the
      // session_format-ROLE field, so the form must carry it -- an event
      // whose form has no such field renders no format at all.
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_session_format',
            role: 'session_format',
            section: 'session',
            kind: 'dropdown',
            label: 'Format',
            required: false,
            position: 1,
            options: ['Lightning talk', 'Talk', 'Workshop'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`GET /api/v1/events/evt-1/submissions`]: { items: [], total: 0, page: 1, perPage: 20 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Docs That Answer Back' })).toBeInTheDocument();
    });
    // H1 does NOT contain the ref -- it now lives on the ref row alone.
    expect(screen.queryByRole('heading', { name: /^S-001:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All submissions/ })).toBeInTheDocument();
    // Eyebrow: track names joined ' · ' plus the session format.
    expect(document.querySelector('.chq-detail-eyebrow')?.textContent).toBe('Developer Experience · Platform · Lightning talk');
  });

  it('omits the eyebrow entirely when neither tracks nor format are present', async () => {
    const detail = baseDetail({ trackIds: [], answers: {} });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    // Scoped to the heading's own eyebrow -- the Session details section
    // below carries its own '.chq-detail-eyebrow' micro-label
    // unconditionally (DEC-900 wave 25 amendment) and must not be confused
    // with the heading's tracks/format eyebrow, which IS conditional.
    const heading = document.querySelector('.chq-detail-heading') as HTMLElement;
    expect(heading.querySelector('.chq-detail-eyebrow')).not.toBeInTheDocument();
  });

  // DEC-900 (wave 25 amendment): V8 draws Session details, so it is a real
  // FOURTH numbered section in the resting main column -- no disclosure,
  // no click required to reveal it.
  it('orders the main column Abstract -> Form Answers -> Reviews -> Session details, with no Meta heading, and Session details renders without any expand click', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    const main = document.querySelector('.chq-detail-main') as HTMLElement;
    const sectionTitles = Array.from(main.querySelectorAll(':scope > section > h2')).map((h) => h.textContent);
    expect(sectionTitles[0]).toBe('Abstract');
    expect(sectionTitles[1]).toBe('Form answers');
    expect(sectionTitles[2]).toMatch(/^Reviews/);
    // DEC-908 (findings wave 5 amendment): the caption now shares the same
    // h2 head row as the label, so the h2's textContent carries both --
    // matched with a prefix regex, same shape as Reviews' own count suffix.
    expect(sectionTitles[3]).toMatch(/^Session details/);
    expect(sectionTitles.length).toBe(4);

    // Session details renders WITHOUT any expand click: its Tracks/Format/
    // Participants content is already in the DOM, and there is no trigger
    // button to click.
    expect(screen.getByRole('heading', { name: /^Session details/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit tracks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Session details/ })).not.toBeInTheDocument();

    // Caption sits on the section head, right-flushed beside the label.
    expect(screen.getByText('Editable until the schedule is published')).toBeInTheDocument();

    // Meta is gone outright -- neither heading nor its Created/Updated/
    // Accepted lines render anywhere on the page.
    expect(screen.queryByRole('heading', { name: 'Meta' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Created:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Accepted:/)).not.toBeInTheDocument();
  });

  it('shows the audience level select beside Format, and Session details participant roles/actions', async () => {
    const detail = baseDetail({
      trackIds: ['t1'],
      participants: [
        {
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
        },
        {
          id: 'p2',
          contactId: 'c2',
          name: 'Riley Panelist',
          email: 'riley@example.com',
          title: null,
          company: null,
          role: 'panelist',
          order: 1,
          visible: true,
          inviteStatus: 'none',
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [{ id: 't1', name: 'Frontend' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_session_format',
            role: 'session_format',
            section: 'session',
            kind: 'dropdown',
            label: 'Format',
            required: false,
            position: 1,
            options: ['Talk', 'Workshop'],
          },
          {
            id: 'field_audience_level',
            role: 'audience_level',
            section: 'session',
            kind: 'dropdown',
            label: 'Audience level',
            required: false,
            position: 2,
            options: ['Beginner', 'Advanced'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit tracks' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Audience level')).toBeInTheDocument();
    expect(screen.getByLabelText('Search contacts')).toBeInTheDocument();

    // Role cells read LEAD / CO-PRESENTER, never the raw stored role key.
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // drop header row
    expect(within(rows[0]!).getByText('LEAD')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('CO-PRESENTER')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('button', { name: 'Make co-presenter' })).toBeInTheDocument();
    // The lead row carries neither tertiary action.
    expect(within(rows[0]!).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(within(rows[0]!).queryByRole('button', { name: 'Make co-presenter' })).not.toBeInTheDocument();

    // Co-presenter note renders verbatim under the search.
    expect(
      screen.getByText('Adding a co-presenter emails them a portal link · the lead presenter is not changed'),
    ).toBeInTheDocument();
  });

  // DEC-908 (findings wave 5 amendment): Session details reads as a
  // label-left definition grid (TRACKS/FORMAT/AUDIENCE LEVEL, never h3
  // sub-headings) with the caption sharing the section head, and the
  // Participants ROLE column is always a chip.
  it('renders the caption on the section head, TRACKS/FORMAT/AUDIENCE LEVEL as grid labels, and role chips for lead + co-presenter', async () => {
    const detail = baseDetail({
      trackIds: ['t1'],
      participants: [
        {
          id: 'p1',
          contactId: 'c1',
          name: 'Jamie Speaker',
          email: 'jamie@example.com',
          title: null,
          company: 'Fieldnote Docs',
          role: 'speaker',
          order: 0,
          visible: true,
          inviteStatus: 'accepted',
        },
        {
          id: 'p2',
          contactId: 'c2',
          name: 'Riley Moderator',
          email: 'riley@example.com',
          title: null,
          company: null,
          role: 'moderator',
          order: 1,
          visible: true,
          inviteStatus: 'none',
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [{ id: 't1', name: 'Frontend' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();
    await openSessionDetails();

    // The caption sits on the section's own head, beside the label -- not
    // in a paragraph below it.
    const sectionHead = document.querySelector('.chq-detail-session-details > .chq-detail-section-title') as HTMLElement;
    expect(within(sectionHead).getByText('Session details')).toBeInTheDocument();
    expect(within(sectionHead).getByText('Editable until the schedule is published')).toBeInTheDocument();

    // TRACKS/FORMAT/AUDIENCE LEVEL render as grid labels, never headings.
    await waitFor(() => {
      expect(screen.getByText('Tracks')).toBeInTheDocument();
    });
    expect(screen.getByText('Tracks').tagName).not.toBe('H3');
    expect(screen.getByText('Format').tagName).not.toBe('H3');
    expect(screen.getByText('Audience level').tagName).not.toBe('H3');
    expect(screen.queryByRole('heading', { name: 'Tracks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Format' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Audience level' })).not.toBeInTheDocument();

    // A lead and a co-presenter each render a role chip in the ROLE column.
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const leadChip = within(rows[0]!).getByText('LEAD');
    expect(leadChip).toHaveClass('chq-role-chip', 'chq-role-chip-lead');
    const coChip = within(rows[1]!).getByText('CO-PRESENTER');
    expect(coChip).toHaveClass('chq-role-chip', 'chq-role-chip-co');
  });

  it('moves History into the rail aside, below Speaker', async () => {
    const detail = baseDetail({
      participants: [
        {
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
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });

    const aside = document.querySelector('.chq-detail-aside') as HTMLElement;
    expect(aside.querySelector('.chq-submission-history')).not.toBeNull();
    const asideSectionTitles = Array.from(aside.querySelectorAll(':scope > section')).map(
      (section) =>
        section.querySelector('h2, .chq-detail-section-title-text')?.textContent?.trim(),
    );
    // DECISION -> SPEAKER -> HISTORY.
    expect(asideSectionTitles).toEqual(['Decision', 'Speaker', 'History']);
    // History never appears in the main column any more.
    const main = document.querySelector('.chq-detail-main') as HTMLElement;
    expect(main.querySelector('.chq-submission-history')).toBeNull();
  });
});

// DEC-920 (task w70-e): a 'file'-kind CFP answer stores an opaque file id
// (DEC-040) -- the organiser's submission detail must render a filename
// link, never the bare id, and 'File removed' text when the id no longer
// resolves to a real attachment row.
describe('SubmissionDetailPage render: DEC-920 file-kind answer', () => {
  const fileFormFields = [{ id: 'f_slides', section: 'session', kind: 'file', label: 'Slides', required: false, position: 1 }];

  it('renders a resolvable file answer as a link named by the filename, with its size', async () => {
    const detail = baseDetail({
      formId: 'form-1',
      answers: { f_slides: 'file-1' },
      answerFiles: [{ id: 'file-1', filename: 'my-slides.pdf', sizeBytes: 2048 }],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: fileFormFields },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Slides')).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: 'my-slides.pdf' });
    expect(link).toHaveAttribute('href', '/files/file-1');
    // Raw id never reaches the DOM.
    expect(screen.queryByText('file-1')).not.toBeInTheDocument();
  });

  it('renders "File removed" (never the bare id) for an unresolvable file answer', async () => {
    const detail = baseDetail({
      formId: 'form-1',
      answers: { f_slides: 'file-gone' },
      answerFiles: [],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: fileFormFields },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('File removed')).toBeInTheDocument();
    });
    expect(screen.queryByText('file-gone')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('file-gone');
    expect(screen.queryByRole('link', { name: /file-gone/ })).not.toBeInTheDocument();
  });
});

// DEC-886 (wave 2 amendment): the bulk delete flow's blast-radius page
// already exists -- this locks in the detail page's own discoverability
// entry point, which reuses the SAME route the bulk path navigates to.
describe('SubmissionDetailPage render: delete entry point (DEC-886)', () => {
  it('links to the delete confirmation page with this submission\'s id', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    const deleteLink = screen.getByRole('link', { name: 'Delete this session' });
    expect(deleteLink).toHaveAttribute('href', `/submissions/delete?ids=${SUB_ID}`);
  });
});

// DEC-900: frame 02 anatomy fixes -- the numbered section counter's spacing
// (a space between the numeral and the em dash), the back link's glyph
// (matching '‹ Previous'/'Next ›', never U+2190), and the speaker rail's
// history line (only the clauses the payload actually carries).
describe('SubmissionDetailPage render: DEC-900 frame 02 anatomy fixes', () => {
  it('renders the section counter with a space between the numeral and the em dash', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    // jsdom doesn't compute ::before content, so this asserts the source
    // rule itself carries the numeral/dash/text as three separate literal
    // pieces (' ', '\2014', ' ') rather than a single glued string -- the
    // exact bug DEC-900 names ('counter(...) " —"' gluing the dash to the
    // numeral).
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.resolve(__dirname, 'detail.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const contentRules = css.match(/content:\s*counter\([^;]+;/g) ?? [];
    expect(contentRules.length).toBeGreaterThan(0);
    for (const rule of contentRules) {
      // The numeral and the em dash must be separate string literals, not
      // a single "01 —" (or worse, "01—") glued token.
      expect(rule).toMatch(/counter\([^)]+\)\s+'[^']*'\s+'\\2014'\s+'[^']*'/);
    }
  });

  it('uses the ‹ glyph (never U+2190) for every back/all-submissions link on the page', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    const backLink = screen.getByRole('link', { name: /All submissions/ });
    expect(backLink.textContent).toContain('\u2039');
    expect(backLink.textContent).not.toContain('\u2190');
    // Sweep the whole page for the old glyph.
    expect(document.body.textContent).not.toContain('\u2190');
  });

  it('renders both history-line clauses when the payload carries both', async () => {
    const detail = baseDetail({
      participants: [
        {
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
          submissionsThisYear: 2,
          lastSpokeYear: 2023,
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });
    expect(document.querySelector('.chq-detail-speaker-history')?.textContent).toBe(
      '2 submissions this year · spoke in 2023',
    );
  });

  it('renders only the carried clause when just one datum is present, singular noun for 1', async () => {
    const detail = baseDetail({
      participants: [
        {
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
          submissionsThisYear: 1,
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });
    expect(document.querySelector('.chq-detail-speaker-history')?.textContent).toBe('1 submission this year');
  });

  it('renders no history line at all when neither datum is present -- never a fabricated figure', async () => {
    const detail = baseDetail({
      participants: [
        {
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
        },
      ],
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Jamie Speaker').length).toBeGreaterThan(0);
    });
    expect(document.querySelector('.chq-detail-speaker-history')).not.toBeInTheDocument();
  });
});

// DEC-958 (wave 64 amendment): the title/abstract editor's PATCH refusal
// renders the server's named-field map instead of collapsing to the
// top-line message alone -- the offending control is marked, and the
// draft text stays in the form (never reset on a refusal).
describe('SubmissionDetailPage: title/abstract edit refusal (DEC-958 wave 64)', () => {
  it('marks the Title control when the server refuses with a title-too-long field error', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail(),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { title: 'Max 200 characters' }),
      },
    });

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'A'.repeat(201) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Max 200 characters')).toBeInTheDocument();
    });

    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    // The ErrorSummary anchors at the top of the form to the SAME control.
    const summary = document.querySelector('.chq-error-summary');
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByRole('link', { name: 'Title' })).toHaveAttribute(
      'href',
      '#submission-edit-title',
    );
    // The draft the user typed is never cleared on a refusal.
    expect((titleInput as HTMLInputElement).value).toBe('A'.repeat(201));
  });
});

// findings wave 14 amendment to DEC-998: the title/abstract editor is a real
// <form> so Enter in the title field (or Cmd/Ctrl+Enter in the abstract
// textarea) commits saveEdit without a click on Save; a bare Enter in the
// textarea stays a newline.
describe('SubmissionDetailPage: title/abstract editor turn diet (findings wave 14 amendment to DEC-998)', () => {
  function editRoutes(patchHandler: MockRouteHandler) {
    return {
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail(),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchHandler,
    };
  }

  it('pressing Enter in the title input commits the edit with exactly one PATCH, no click on Save', async () => {
    const updated = baseDetail({ title: 'New Title' });
    const fetchMock = mockApi(editRoutes({ status: 200, body: updated }));

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const titleInput = await screen.findByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    fireEvent.keyDown(titleInput, { key: 'Enter', code: 'Enter' });
    // jsdom does not implement the browser's native implicit-submission-on-
    // Enter form behaviour, so the keyDown above is paired with the same
    // submit event a real browser's default action would raise on this
    // <form> -- the assertion is on saveEdit firing exactly once, not on
    // simulating the browser's own spec'd behaviour.
    fireEvent.submit((titleInput as HTMLInputElement).closest('form') as HTMLFormElement);

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patchCalls).toHaveLength(1);
    });

    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    const body = JSON.parse(patchCalls[0]![1]!.body as string);
    expect(body.title).toBe('New Title');
  });

  it('a bare Enter in the abstract textarea inserts a newline and issues no request', async () => {
    const fetchMock = mockApi(editRoutes({ status: 200, body: baseDetail() }));

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const abstractField = await screen.findByLabelText('Abstract');
    fireEvent.keyDown(abstractField, { key: 'Enter', code: 'Enter' });

    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patchCalls).toHaveLength(0);
  });

  it('Cmd/Ctrl+Enter in the abstract textarea commits the edit', async () => {
    const updated = baseDetail({ description: 'New description' });
    const fetchMock = mockApi(editRoutes({ status: 200, body: updated }));

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const abstractField = await screen.findByLabelText('Abstract');
    fireEvent.change(abstractField, { target: { value: 'New description' } });
    fireEvent.keyDown(abstractField, { key: 'Enter', code: 'Enter', ctrlKey: true });

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patchCalls).toHaveLength(1);
    });

    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    const body = JSON.parse(patchCalls[0]![1]!.body as string);
    expect(body.description).toBe('New description');
  });

  it('a refusal via Enter still renders through ErrorSummary and keeps the draft text', async () => {
    mockApi(
      editRoutes({
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { title: 'Max 200 characters' }),
      }),
    );

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const titleInput = await screen.findByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'A'.repeat(201) } });
    fireEvent.keyDown(titleInput, { key: 'Enter', code: 'Enter' });
    fireEvent.submit((titleInput as HTMLInputElement).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Max 200 characters')).toBeInTheDocument();
    });

    const summary = document.querySelector('.chq-error-summary');
    expect(summary).not.toBeNull();
    expect((titleInput as HTMLInputElement).value).toBe('A'.repeat(201));
  });

  it('Escape while editing returns to the read view without issuing a request', async () => {
    const fetchMock = mockApi(editRoutes({ status: 200, body: baseDetail() }));

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const titleInput = await screen.findByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Should not be saved' } });
    fireEvent.keyDown(titleInput, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Original description')).toBeInTheDocument();

    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patchCalls).toHaveLength(0);
  });
});

// findings wave 15 amendment (task-w15-a) to DEC-967: the tracks editor is
// also a real <form> so Enter commits saveTracks without a click on Save.
describe('SubmissionDetailPage: tracks editor turn diet (findings wave 15 amendment to DEC-967)', () => {
  it('pressing Enter inside the tracks editor commits the edit with exactly one PATCH', async () => {
    const updated = baseDetail({ trackIds: ['t1'] });
    const fetchMock = mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail({ trackIds: [] }),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [{ id: 't1', name: 'Frontend' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: { status: 200, body: updated },
    });

    renderPage();
    await openSessionDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));

    const editor = document.getElementById('submission-track-editor') as HTMLElement;
    const checkbox = within(editor).getByRole('checkbox', { name: 'Frontend' });
    fireEvent.click(checkbox);
    fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter' });
    // jsdom does not implement native implicit-submission-on-Enter, so the
    // keyDown is paired with the same submit event the browser's default
    // action would raise on this <form>.
    fireEvent.submit(editor);

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patchCalls).toHaveLength(1);
    });

    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    const body = JSON.parse(patchCalls[0]![1]!.body as string);
    expect(body.trackIds).toEqual(['t1']);
  });
});

// DEC-958 (wave 66 amendment): the page's other six write paths -- status,
// tracks, format, audience level, and the three participant-row actions --
// get the SAME by-shape reading saveEdit already has. Each case below
// asserts the server's own named-field message renders AT the control that
// owns it (never as the generic `<verb> failed: ${err.message}` sentence),
// and the trailing case proves a field-less refusal still falls back to
// that sentence.
describe('SubmissionDetailPage: the other six writers read refusals by shape (DEC-958 wave 66)', () => {
  function twoParticipants() {
    return [
      {
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
      },
      {
        id: 'p2',
        contactId: 'c2',
        name: 'Riley Moderator',
        email: 'riley@example.com',
        title: null,
        company: null,
        role: 'moderator',
        order: 1,
        visible: true,
        inviteStatus: 'none',
      },
    ];
  }

  it('marks the decision rail (not the page-level banner) on a named-field status refusal', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail({ status: 'pending' }),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`POST /api/v1/events/evt-1/submissions/status`]: {
        status: 400,
        body: errorEnvelope('invalid', 'status must be one of the DEC-003 submission statuses', {
          status: 'Invalid status',
        }),
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid status')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Status update failed/)).not.toBeInTheDocument();
    const rail = document.getElementById('submission-status-controls');
    expect(rail).not.toBeNull();
    expect(within(rail as HTMLElement).getByText('Invalid status')).toBeInTheDocument();
  });

  it('falls back to the bare sentence on a field-less status refusal', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail({ status: 'pending' }),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`POST /api/v1/events/evt-1/submissions/status`]: {
        status: 500,
        body: errorEnvelope('internal', 'Something went wrong'),
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.getByText('Status update failed: Something went wrong')).toBeInTheDocument();
    });
  });

  it('marks the track editor (not the bare sentence) on a named-field trackIds refusal', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail({ trackIds: ['t1'] }),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: {
        items: [{ id: 't1', name: 'Frontend' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'trackIds must not exceed 1000 entries', { trackIds: 'Max 1000' }),
      },
    });

    renderPage();
    await openSessionDetails();
    await waitFor(() => {
      expect(screen.getAllByText('Frontend').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Max 1000')).toBeInTheDocument();
    });
    const editor = document.getElementById('submission-track-editor');
    expect(editor).not.toBeNull();
    expect(within(editor as HTMLElement).getByText('Max 1000')).toBeInTheDocument();
    expect(document.querySelector('.chq-detail-subsection > .chq-error-banner')).not.toBeInTheDocument();
  });

  it('marks the Format select (not the bare sentence) on a named-field format refusal', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail(),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_session_format',
            role: 'session_format',
            section: 'session',
            kind: 'dropdown',
            label: 'Format',
            required: false,
            position: 1,
            options: ['Talk', 'Workshop'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'format must be one of the field’s options', {
          format: 'Invalid option',
        }),
      },
    });

    renderPage();
    await openSessionDetails();
    const select = await screen.findByLabelText('Format');
    fireEvent.change(select, { target: { value: 'Workshop' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid option')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Format update failed/)).not.toBeInTheDocument();
  });

  it('labels an unrecognised field key on the Audience level writer, never dropping it', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail(),
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_audience_level',
            role: 'audience_level',
            section: 'session',
            kind: 'dropdown',
            label: 'Audience level',
            required: false,
            position: 1,
            options: ['Beginner', 'Advanced'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      // Mirrors src/routes/api/submissions.ts's PATCH /submissions/:id --
      // it names no dedicated audienceLevel key, so the shared 'Provide
      // title, description, trackIds, or format' catch-all (keyed 'title')
      // is exactly what the real route returns here.
      [`PATCH /api/v1/submissions/${SUB_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'At least one of title, description, trackIds, or format is required', {
          title: 'Provide title, description, trackIds, or format',
        }),
      },
    });

    renderPage();
    await openSessionDetails();
    const select = await screen.findByLabelText('Audience level');
    fireEvent.change(select, { target: { value: 'Advanced' } });

    await waitFor(() => {
      expect(screen.getByText('title: Provide title, description, trackIds, or format')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Audience level update failed/)).not.toBeInTheDocument();
  });

  // DEC-941: Remove is irreversible, so it opens the shared ConfirmDialog
  // naming the participant first -- the DELETE only fires from the
  // dialog's own confirm control, never straight off the row button
  // (BreaksPanel.render.test.tsx:165 is the pattern).
  it('Remove asks for confirmation naming the participant, then DELETEs', async () => {
    const detail = baseDetail({ participants: twoParticipants() });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`DELETE /api/v1/submissions/${SUB_ID}/participants/p2`]: { status: 200, body: { deleted: 1 } },
    });

    renderPage();
    await openSessionDetails();
    await waitFor(() => {
      expect(screen.getAllByText('Riley Moderator').length).toBeGreaterThan(0);
    });

    const table = document.getElementById('submission-participants-table') as HTMLElement;
    const row = within(table).getByText('Riley Moderator').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove this participant?' });
    expect(within(dialog).getByText(/Riley Moderator/)).toBeInTheDocument();
    // Still in the table -- no optimistic removal, no DELETE, until confirmed.
    expect(within(table).getByText('Riley Moderator')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove participant' }));

    await waitFor(() => {
      expect(within(table).queryByText('Riley Moderator')).not.toBeInTheDocument();
    });
  });

  it('cancelling the participant Remove confirmation fires no DELETE and keeps the row', async () => {
    const detail = baseDetail({ participants: twoParticipants() });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();
    await openSessionDetails();
    await waitFor(() => {
      expect(screen.getAllByText('Riley Moderator').length).toBeGreaterThan(0);
    });

    const table = document.getElementById('submission-participants-table') as HTMLElement;
    const row = within(table).getByText('Riley Moderator').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove this participant?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Remove this participant?' })).not.toBeInTheDocument();
    expect(within(table).getByText('Riley Moderator')).toBeInTheDocument();
  });

  it('marks the participant row (not the bare sentence) on a named-field remove refusal, labelling an unrecognised key', async () => {
    const detail = baseDetail({ participants: twoParticipants() });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`DELETE /api/v1/submissions/${SUB_ID}/participants/p2`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Cannot remove this participant', {
          participantId: 'Cannot remove this participant',
        }),
      },
    });

    renderPage();
    await openSessionDetails();
    await waitFor(() => {
      expect(screen.getAllByText('Riley Moderator').length).toBeGreaterThan(0);
    });

    const table = document.getElementById('submission-participants-table') as HTMLElement;
    const row = within(table).getByText('Riley Moderator').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    // DEC-941: Remove opens the shared ConfirmDialog naming the participant
    // first -- the DELETE only fires from the dialog's own confirm control.
    const dialog = await screen.findByRole('dialog', { name: 'Remove this participant?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove participant' }));

    await waitFor(() => {
      expect(within(table).getByText('participantId: Cannot remove this participant')).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Remove failed/)).not.toBeInTheDocument();
  });

  it('marks the participant row (not the bare sentence) on a named-field make-co-presenter refusal', async () => {
    const detail = baseDetail({ participants: twoParticipants() });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}/participants/p2`]: {
        status: 400,
        body: errorEnvelope('invalid', 'visible or inviteStatus is required', { visible: 'Required' }),
      },
    });

    renderPage();
    await openSessionDetails();
    await waitFor(() => {
      expect(screen.getAllByText('Riley Moderator').length).toBeGreaterThan(0);
    });

    const table = document.getElementById('submission-participants-table') as HTMLElement;
    const row = within(table).getByText('Riley Moderator').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Make co-presenter' }));

    await waitFor(() => {
      expect(within(table).getByText('Visible: Required')).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Make co-presenter failed/)).not.toBeInTheDocument();
  });

  it('marks the participant row (not the bare sentence) on a named-field visibility refusal', async () => {
    const detail = baseDetail({ participants: twoParticipants() });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`PATCH /api/v1/submissions/${SUB_ID}/participants/p2`]: {
        status: 400,
        body: errorEnvelope('invalid', 'visible must be a boolean', { visible: 'Required' }),
      },
    });

    renderPage();
    await openSessionDetails();
    await waitFor(() => {
      expect(screen.getAllByText('Riley Moderator').length).toBeGreaterThan(0);
    });

    const table = document.getElementById('submission-participants-table') as HTMLElement;
    const row = within(table).getByText('Riley Moderator').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByLabelText('Visible: Riley Moderator'));

    await waitFor(() => {
      expect(within(table).getByText('Visible: Required')).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Visibility update failed/)).not.toBeInTheDocument();
  });

  it('marks the add-co-presenter search field (not the bare sentence) on a named-field contactId refusal', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
      [`GET /api/v1/contacts`]: {
        items: [{ id: 'c-2', firstName: 'Riley', lastName: 'Contact', email: 'riley@example.com' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`POST /api/v1/submissions/${SUB_ID}/participants`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { contactId: 'Already invited' }),
      },
    });

    renderPage();
    await openSessionDetails();

    fireEvent.change(screen.getByLabelText('Search contacts'), { target: { value: 'Riley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Riley Contact (riley@example.com)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Already invited')).toBeInTheDocument();
    });
    // The bare err.message ('Validation failed') never renders once a
    // named-field map is present.
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to add co-presenter')).not.toBeInTheDocument();
  });
});

// DEC-958 (findings wave 13 amendment, task w13-c): the Format/Audience
// level selects are never silently inert -- when the event's form carries
// no field of the matching role, the row still renders (never omitted),
// disabled, with a reason line naming the repair.
describe('SubmissionDetailPage render: DEC-958 (findings wave 13 amendment) Format/Audience level dead-click fix', () => {
  it('renders both selects ENABLED with no reason line when the form carries both role fields', async () => {
    const detail = baseDetail({ answers: { field_session_format: 'Talk', field_audience_level: 'Beginner' } });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_session_format',
            role: 'session_format',
            section: 'session',
            kind: 'dropdown',
            label: 'Format',
            required: false,
            position: 1,
            options: ['Talk', 'Workshop'],
          },
          {
            id: 'field_audience_level',
            role: 'audience_level',
            section: 'session',
            kind: 'dropdown',
            label: 'Audience level',
            required: false,
            position: 2,
            options: ['Beginner', 'Advanced'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();
    await openSessionDetails();

    const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement;
    const audienceSelect = screen.getByLabelText('Audience level') as HTMLSelectElement;
    expect(formatSelect).not.toBeDisabled();
    expect(audienceSelect).not.toBeDisabled();
    expect(formatSelect.value).toBe('Talk');
    expect(audienceSelect.value).toBe('Beginner');
    expect(screen.queryByText("This event's call for papers has no Format question")).not.toBeInTheDocument();
    expect(screen.queryByText("This event's call for papers has no Audience level question")).not.toBeInTheDocument();
  });

  it('renders both selects DISABLED with their own reason line, never absent, when the form carries neither role field', async () => {
    const detail = baseDetail();
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();
    await openSessionDetails();

    // Never absent: the row (select + label) is always in the DOM.
    const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement;
    const audienceSelect = screen.getByLabelText('Audience level') as HTMLSelectElement;
    expect(formatSelect).toBeDisabled();
    expect(audienceSelect).toBeDisabled();
    // The stored answer (none resolvable without a role field on the form)
    // still renders bound to the control rather than the row vanishing --
    // the select keeps its normal 'Not set' value, never swapped for prose.
    expect(formatSelect.value).toBe('');
    expect(audienceSelect.value).toBe('');
    expect(screen.getByText("This event's call for papers has no Format question")).toBeInTheDocument();
    expect(screen.getByText("This event's call for papers has no Audience level question")).toBeInTheDocument();
  });

  it('renders Format disabled+reasoned and Audience level enabled when the form carries only the audience_level field', async () => {
    const detail = baseDetail({ answers: { field_audience_level: 'Advanced' } });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'field_audience_level',
            role: 'audience_level',
            section: 'session',
            kind: 'dropdown',
            label: 'Audience level',
            required: false,
            position: 1,
            options: ['Beginner', 'Advanced'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    });

    renderPage();
    await openSessionDetails();

    const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement;
    const audienceSelect = screen.getByLabelText('Audience level') as HTMLSelectElement;
    expect(formatSelect).toBeDisabled();
    expect(audienceSelect).not.toBeDisabled();
    expect(audienceSelect.value).toBe('Advanced');
    expect(screen.getByText("This event's call for papers has no Format question")).toBeInTheDocument();
    expect(screen.queryByText("This event's call for papers has no Audience level question")).not.toBeInTheDocument();
  });
});
