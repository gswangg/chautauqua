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
      [`PATCH /api/v1/submissions/${SUB_ID}`]: patchMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Original description')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    const abstractInput = screen.getByLabelText('Abstract');
    fireEvent.change(abstractInput, { target: { value: 'Updated description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

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
      [`POST /api/v1/submissions/${SUB_ID}/content-status`]: contentStatusMock,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Content: pending')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve content' }));

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
