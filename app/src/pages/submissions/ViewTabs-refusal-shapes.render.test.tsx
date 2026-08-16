// DEC-505 (wave-55 ledger, wave-13 amendment task-w13-c): the saved-view
// DELETE (DELETE /api/v1/views/:id, src/routes/api/views.ts) throws two
// distinct conflict wordings this proves reach ViewTabs' own error banner
// verbatim (framed, never replaced -- DEC-856): 'Only the organiser who
// created a saved view can delete it' (403, a colleague's shared view) and
// 'Saved view not found' (404, a stale/already-deleted row). The save-view
// create path's own cap refusal is proven elsewhere
// (ViewTabs.render.test.tsx's DEC-422 describe block); this file owns the
// DELETE door only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ViewTabs } from './ViewTabs';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';
import { DEFAULT_FILTER_STATE } from './types';

const EVENT_ID = 'evt-viewtabs-refusal';

// DEC-975/DEC-851 (wave 12, merged alongside this file): ViewTabs calls
// useMe() to gate the per-row Delete control against the saved view's own
// createdByUserId, so every mockApi() call here must serve GET /api/v1/me.
// userId matches savedView()'s createdByUserId, i.e. the viewer IS the
// creator and the client-side gate opens. The 403 below is therefore the
// case DEC-975's gate cannot pre-empt (the server re-checks and refuses
// anyway -- a reassigned or concurrently-edited row), which is exactly the
// refusal this file must prove reaches the DOM verbatim.
const ME_ROUTE = {
  'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
};

function savedView() {
  return {
    id: 'view-1',
    eventId: EVENT_ID,
    name: 'AI track, unread',
    config: { q: '', status: [], trackId: null, sort: 'newest', columns: [] },
    createdByUserId: 'user-1',
    shared: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTabs() {
  return render(
    <ViewTabs
      eventId={EVENT_ID}
      filters={DEFAULT_FILTER_STATE}
      visibleFieldIds={new Set()}
      tracks={[]}
      formFields={[]}
      onApply={() => {}}
    />,
  );
}

async function deleteView() {
  await screen.findByRole('button', { name: 'AI track, unread' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete view AI track, unread' }));
  await screen.findByText(/Only the saved filter "AI track, unread" goes/);
  fireEvent.click(screen.getByRole('button', { name: 'Delete view' }));
}

describe('ViewTabs saved-view delete refusal shapes (DEC-505/DEC-856)', () => {
  it("403 'Only the organiser who created a saved view can delete it' renders framed by the server's own wording, and restores the view", async () => {
    mockApi({
      ...ME_ROUTE,
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([savedView()]),
      'DELETE /api/v1/views/view-1': {
        status: 403,
        body: errorEnvelope('forbidden', 'Only the organiser who created a saved view can delete it'),
      },
    });

    renderTabs();
    await deleteView();

    expect(
      await screen.findByText('Delete view failed: Only the organiser who created a saved view can delete it'),
    ).toBeInTheDocument();
    // Loud rollback: the view is restored to the tab row, not left deleted.
    expect(screen.getByRole('button', { name: 'AI track, unread' })).toBeInTheDocument();
  });

  it("404 'Saved view not found' (stale row) renders framed by the server's own wording", async () => {
    mockApi({
      ...ME_ROUTE,
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([savedView()]),
      'DELETE /api/v1/views/view-1': {
        status: 404,
        body: errorEnvelope('not_found', 'Saved view not found'),
      },
    });

    renderTabs();
    await deleteView();

    expect(await screen.findByText('Delete view failed: Saved view not found')).toBeInTheDocument();
  });
});
