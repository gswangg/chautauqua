// DEC-921 (client half): the delete confirmation page reads ONE plan
// (GET /events/:eventId/submissions/delete-plan?ids=...) rather than a
// Promise.all waterfall of per-id detail fetches, and names each eligible
// session's blast radius -- including 'leaves the agenda' and 'N task
// responses reopen' -- before the organiser can press anything. Refused
// rows arrive pre-named in the same response. The server half lands on its
// own branch, so this test mocks the delete-plan endpoint against the
// contract fixed by DEC-921 rather than depending on a real implementation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DeleteSubmissionsPage } from './DeleteSubmissionsPage';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-delete-1';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function renderPage(ids: string[]) {
  return render(
    <MemoryRouter initialEntries={[`/submissions/delete?ids=${ids.join(',')}`]}>
      <DeleteSubmissionsPage />
    </MemoryRouter>,
  );
}

describe('DeleteSubmissionsPage', () => {
  it('reads a single delete-plan request (no per-id waterfall) and names each session blast radius', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions/delete-plan`]: {
        eligible: [
          {
            submissionId: 'sub-1',
            ref: 'S-001',
            title: 'A Talk About Testing',
            counts: {
              files: 2,
              comments: 0,
              participants: 1,
              answers: 3,
              tracks: 1,
              recusals: 1,
              revisions: 2,
              taskResponses: 1,
            },
            scheduled: true,
          },
          {
            submissionId: 'sub-2',
            ref: 'S-002',
            title: 'Another Talk',
            counts: {
              files: 0,
              comments: 0,
              participants: 0,
              answers: 0,
              tracks: 0,
              recusals: 0,
              revisions: 0,
              taskResponses: 0,
            },
            scheduled: false,
          },
        ],
        refused: [],
      },
    });

    renderPage(['sub-1', 'sub-2']);

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    // Exactly one GET hit the delete-plan endpoint -- not one per id.
    const deletePlanCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/submissions/delete-plan'),
    );
    expect(deletePlanCalls).toHaveLength(1);
    const firstCall = deletePlanCalls[0];
    if (!firstCall) throw new Error('expected a delete-plan call');
    const requestedUrl = String(firstCall[0]);
    expect(requestedUrl).toContain('ids=sub-1,sub-2');

    // Intro sentence states the two facts DEC-921 requires it to state.
    expect(screen.getByText(/A scheduled session leaves the agenda/i)).toBeInTheDocument();
    expect(screen.getByText(/reopened, not destroyed/i)).toBeInTheDocument();

    // Row-level blast radius: files, co-presenter, answers, revisions,
    // reviewer recusal, agenda, and task response all named with correct
    // singular/plural agreement, in the per-row blast-radius line.
    const blastLine = screen.getByText(/2 files, 1 co-presenter, 3 answers/);
    expect(blastLine).toBeInTheDocument();
    expect(blastLine.textContent).toContain('2 files');
    expect(blastLine.textContent).toContain('1 co-presenter');
    expect(blastLine.textContent).toContain('3 answers');
    expect(blastLine.textContent).toContain('2 revisions');
    expect(blastLine.textContent).toContain('1 reviewer recusal');
    expect(blastLine.textContent).toContain('leaves the agenda');
    expect(blastLine.textContent).toContain('1 task response reopen');

    expect(screen.getByRole('button', { name: 'Delete 2 sessions' })).toBeInTheDocument();
  });

  it('renders refused rows with their reason before any delete is attempted', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions/delete-plan`]: {
        eligible: [
          {
            submissionId: 'sub-1',
            ref: 'S-001',
            title: 'Eligible Talk',
            counts: {
              files: 0,
              comments: 0,
              participants: 0,
              answers: 0,
              tracks: 0,
              recusals: 0,
              revisions: 0,
              taskResponses: 0,
            },
            scheduled: false,
          },
        ],
        refused: [{ id: 'sub-3', ref: 'S-003', reason: 'Has a submitted evaluation' }],
      },
    });

    renderPage(['sub-1', 'sub-3']);

    await waitFor(() => {
      expect(screen.getByText('Eligible Talk')).toBeInTheDocument();
    });

    expect(screen.getByText(/1 session can't be deleted:/)).toBeInTheDocument();
    expect(screen.getByText(/Has a submitted evaluation/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete 1 session' })).toBeInTheDocument();
  });

  // DEC-886 (wave 2 amendment): this page already names what goes and what
  // it refuses before anything is pressed, so the primary deletes directly
  // -- no stacked ConfirmDialog restating the same decision a second time.
  it('deletes directly on the primary click, with no second confirmation dialog', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions/delete-plan`]: {
        eligible: [
          {
            submissionId: 'sub-1',
            ref: 'S-001',
            title: 'A Talk About Testing',
            counts: {
              files: 0,
              comments: 0,
              participants: 0,
              answers: 0,
              tracks: 0,
              recusals: 0,
              revisions: 0,
              taskResponses: 0,
            },
            scheduled: false,
          },
        ],
        refused: [],
      },
      [`POST /api/v1/events/${EVENT_ID}/submissions/delete`]: { deleted: 1, refused: [] },
    });

    renderPage(['sub-1']);

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: 'Delete 1 session' });
    fireEvent.click(deleteBtn);

    // No stacked confirmation dialog restating the decision a second time.
    expect(screen.queryByText('Delete these sessions?')).not.toBeInTheDocument();
    expect(screen.queryByText(/Everything they own is removed permanently/)).not.toBeInTheDocument();

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([input]) => String(input).includes('/submissions/delete') && !String(input).includes('delete-plan'),
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });
});
