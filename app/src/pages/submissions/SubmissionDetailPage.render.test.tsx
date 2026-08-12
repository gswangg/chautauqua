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
import { mockApi } from '../../test-utils/mockApi';

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
    trackIds: [],
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

    fireEvent.click(screen.getByRole('button', { name: 'Show history' }));

    await waitFor(() => {
      expect(screen.getAllByText('organizer@example.com').length).toBe(2);
    });

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
