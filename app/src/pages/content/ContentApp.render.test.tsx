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
      [`GET /api/v1/submissions/sub-1/files`]: { items: [] },
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

// CNT-07b regression: the server envelope is a flat { items: DeliverableFile[] }
// (DEC-247), and deliverable counts on the worklist must count chain roots
// (previousFileId === null) rather than every version in a replace chain.
// Prior mocks matched the server shape but nothing asserted the resulting
// count, so a mismatch (or a wrong count formula) could pass silently.
describe('ContentApp worklist deliverable counts (DEC-247 chain roots)', () => {
  it('counts only the chain root when a presentation file has been replaced', async () => {
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
        },
      ]),
      [`GET /api/v1/submissions/sub-1/files`]: {
        items: [
          {
            id: 'file-2',
            submissionId: 'sub-1',
            kind: 'presentation',
            filename: 'v2.pdf',
            sizeBytes: 100,
            contentType: 'application/pdf',
            previousFileId: 'file-1',
            uploadedByContactId: null,
            createdAt: 1700000001000,
          },
          {
            id: 'file-1',
            submissionId: 'sub-1',
            kind: 'presentation',
            filename: 'v1.pdf',
            sizeBytes: 90,
            contentType: 'application/pdf',
            previousFileId: null,
            uploadedByContactId: null,
            createdAt: 1700000000000,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'All' }));

    const row = (await screen.findByText('A Talk With A Replaced File')).closest('tr');
    if (!row) throw new Error('worklist row not found');

    const headerCells = Array.from(row.closest('table')!.querySelectorAll('thead th'));
    const presentationColIndex = headerCells.findIndex((th) => th.textContent === 'Presentation');
    expect(presentationColIndex).toBeGreaterThanOrEqual(0);

    const rowCells = Array.from(row.querySelectorAll('td'));
    expect(rowCells[presentationColIndex]?.textContent).toBe('1');
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
        },
      ]),
    );
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: submissionsMock,
      [`GET /api/v1/submissions/sub-1/files`]: { items: [] },
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
