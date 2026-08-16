// DEC-505 (wave-55 ledger, wave-13 amendment task-w13-c): DeleteSubmissionsPage
// owns a destructive bulk write (POST /events/:eventId/submissions/delete).
// deleteError already reads err.message straight through with no client
// framing to strip (DEC-856), so this proves a server refusal on the
// destructive write itself -- not the per-row `refused` reasons, which
// DeleteSubmissionsPage.render.test.tsx already proves arrive pre-named in
// the delete-plan response -- surfaces the server's own conflict wording
// verbatim, never the generic 'Delete failed' fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DeleteSubmissionsPage } from './DeleteSubmissionsPage';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-delete-refusal';

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

describe('DeleteSubmissionsPage delete refusal shapes (DEC-505/DEC-856)', () => {
  it("a 409 on the destructive write itself surfaces the server's own conflict wording, not a generic banner", async () => {
    mockApi({
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
      [`POST /api/v1/events/${EVENT_ID}/submissions/delete`]: {
        status: 409,
        body: errorEnvelope('conflict', 'One or more selected sessions have a submitted evaluation'),
      },
    });

    renderPage(['sub-1']);

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 session' }));

    expect(
      await screen.findByText('One or more selected sessions have a submitted evaluation'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Delete failed')).not.toBeInTheDocument();
  });
});
