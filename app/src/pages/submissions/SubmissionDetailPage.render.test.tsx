// CNT-09 (admin session editing) + CNT-12 (content-approval reachability)
// render regression: locks in the inline title/abstract editor (PATCH
// /api/v1/submissions/:id) and the always-visible content-status control
// (POST /api/v1/submissions/:id/content-status) on the submission detail
// page, mirroring the DEC-144 layer-2 harness pattern used by
// Submissions.render.test.tsx.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';

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

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/submissions/${SUB_ID}`]}>
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

  it('approves content via the always-visible control (no files required)', async () => {
    const detail = baseDetail();
    const contentStatusMock = vi.fn(() => ({ id: SUB_ID, contentStatus: 'approved' }));
    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: detail,
      [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
      [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      [`POST /api/v1/submissions/${SUB_ID}/content-status`]: contentStatusMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Content: pending')).toBeInTheDocument();
    });

    const approveButton = screen.getByRole('button', { name: 'Approve content' });
    expect(approveButton).toHaveClass('chq-btn-primary');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(contentStatusMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Content: approved')).toBeInTheDocument();
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Show history' }));

    await waitFor(() => {
      expect(screen.getAllByText('Edited by organizer@example.com').length).toBe(2);
    });
    expect(screen.getByText('Submitted')).toBeInTheDocument();

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

// DEC-596/DEC-577 (task w3-f): the numbered Reviews section renders every
// recorded evaluation's scores + full comment text, hiding the reviewer name
// for an anonymized plan; the decision panel is a segmented button group,
// not a <select>.
describe('SubmissionDetailPage render: Reviews section + segmented decision buttons', () => {
  it('renders each evaluation, hides the reviewer name for an anonymized plan, and shows the Speaker card', async () => {
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
            comment: 'Solid proposal, would love more detail on the demo.',
            submittedAt: 1700000000000,
          },
          {
            planId: 'plan-2',
            planName: 'Blind review',
            round: 1,
            reviewerName: null,
            scores: { c1: 2 },
            comment: 'Scope is too broad for the slot.',
            submittedAt: 1700000100000,
          },
        ],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Solid proposal, would love more detail on the demo.')).toBeInTheDocument();
    });
    expect(screen.getByText('Jamie Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Anonymous reviewer')).toBeInTheDocument();
    expect(screen.getByText('Scope is too broad for the slot.')).toBeInTheDocument();

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
    // No native <select> for status any more.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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
