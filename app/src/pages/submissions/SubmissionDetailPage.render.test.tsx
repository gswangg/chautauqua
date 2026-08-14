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
    slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
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

    // Decision rail states plainly that deciding never emails (house
    // invariant): notification is a separate, explicit action from Comms.
    // DEC-878: caption renders in every rail state.
    expect(screen.getByText('Deciding sends nothing. Notify from Comms.')).toBeInTheDocument();

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
    expect(contentLink).toHaveAttribute('href', `/content/${SUB_ID}`);
  });

  it('shows the history timeline and restores a prior revision (CNT-11, DEC-158, DEC-892)', async () => {
    let currentDetail = baseDetail();
    let history = [
      { id: 'rev-2', at: 1700000200000, kind: 'edited', label: 'Edited by organizer@example.com', detail: 'Original Title' },
      { id: 'rev-1', at: 1700000100000, kind: 'edited', label: 'Edited by organizer@example.com', detail: 'Original Title' },
      { id: 'submission:sub-1', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null },
    ];
    const restoreMock = vi.fn(() => {
      currentDetail = { ...currentDetail, description: 'First edit' };
      history = [
        { id: 'rev-3', at: 1700000300000, kind: 'edited', label: 'Edited by organizer@example.com', detail: 'Original Title' },
        ...history,
      ];
      return currentDetail;
    });
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: () => currentDetail,
      [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    fireEvent.click(restoreButtons[1]!);

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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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

    // DEC-908 (wave 42 amendment): score renders at 1dp -- every other
    // review surface is already 1dp -- em-dash when null.
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    });

    renderPage();

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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
            section: 'session',
            kind: 'dropdown',
            label: 'Format',
            required: false,
            position: 1,
            options: ['Talk', 'Workshop'],
          },
        ],
      },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

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
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-detail-eyebrow')).not.toBeInTheDocument();
  });

  it('orders the main column Abstract -> Form Answers -> Reviews -> Session Details, with no Meta heading', async () => {
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

    const main = document.querySelector('.chq-detail-main') as HTMLElement;
    const sectionTitles = Array.from(main.querySelectorAll(':scope > section > h2')).map((h) => h.textContent);
    expect(sectionTitles[0]).toBe('Abstract');
    expect(sectionTitles[1]).toBe('Form answers');
    expect(sectionTitles[2]).toMatch(/^Reviews/);
    expect(sectionTitles[3]).toBe('Session details');
    expect(sectionTitles.length).toBe(4);

    // Meta is gone outright -- neither heading nor its Created/Updated/
    // Accepted lines render anywhere on the page.
    expect(screen.queryByRole('heading', { name: 'Meta' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Created:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Accepted:/)).not.toBeInTheDocument();
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
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
