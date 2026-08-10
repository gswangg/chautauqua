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
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

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
        },
      ]),
      [`GET /api/v1/submissions/sub-1/files`]: { files: {} },
      [`POST /api/v1/submissions/sub-1/content-status`]: contentStatusMock,
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    // Default tab is 'changes_requested' — switch to 'All' to see the row.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));

    await waitFor(() => {
      expect(screen.getByText('A Talk With No Files Yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(contentStatusMock).toHaveBeenCalled();
    });
  });
});
