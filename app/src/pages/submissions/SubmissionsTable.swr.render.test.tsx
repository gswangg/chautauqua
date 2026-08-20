// D21 (DEC_678/DEC_518/DEC_024, v12m-w4-t-r1-b): SubmissionsTable's main
// list read adopts useCachedList. This proves the SWR contract at the page
// level -- cold mount shows PageSkeleton with no empty state; a remount at
// the same eventId+filters paints rows on the FIRST frame with no skeleton
// (the cached payload is on screen immediately); changing filters (a
// different cache key/URL) goes back through the skeleton; and a rejected
// revalidation keeps the stale rows on screen while surfacing the error
// banner (DEC_518: never blank rows the user was reading over a failed
// background refresh).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';

const EVENT_ID = 'evt-swr-1';

const ROW = {
  id: 'sub-1',
  ref: 'S-001',
  title: 'A Talk About Testing',
  status: 'pending',
  contentStatus: 'pending',
  speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
  trackIds: [],
  submittedAt: null,
  createdAt: 1700000000000,
};

function baseRoutes(overrides: Record<string, unknown> = {}) {
  return {
    'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([ROW]),
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  resetApiCacheForTests();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('SubmissionsTable SWR adoption (D21)', () => {
  it('cold mount renders PageSkeleton and no empty state', async () => {
    mockApi(baseRoutes());

    const { container } = render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    // First frame: skeleton, not the empty state, even though there are no
    // rows on screen yet.
    expect(container.querySelector('.chq-skeleton-frame')).not.toBeNull();
    expect(screen.queryByText('No submissions yet')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });
    expect(container.querySelector('.chq-skeleton-frame')).toBeNull();
  });

  it('a remount at the same eventId+filters renders rows with no skeleton on the first frame', async () => {
    mockApi(baseRoutes());

    // First mount seeds the cache.
    const first = render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });
    first.unmount();

    // Second mount at the identical path: the cache is seeded synchronously
    // (useState initializer -> peekCachedRead), so rows paint immediately.
    const { container } = render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    expect(container.querySelector('.chq-skeleton-frame')).toBeNull();
    expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
  });

  it('changing filters (a different URL/cache key) goes back through the skeleton', async () => {
    mockApi(baseRoutes());

    const { container } = render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });
    expect(container.querySelector('.chq-skeleton-frame')).toBeNull();

    // Applying the "Pending" status facet changes the query string, and
    // therefore the cache key -- an uncached path is a cold read again.
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(container.querySelector('.chq-skeleton-frame')).not.toBeNull();

    await waitFor(() => {
      expect(container.querySelector('.chq-skeleton-frame')).toBeNull();
    });
  });

  it('a rejected revalidation keeps the rows on screen AND surfaces the error banner', async () => {
    // The mock ignores query strings (DEC-144), so it cannot distinguish
    // the unfiltered path from the '?status=pending' path by URL alone --
    // this flag stands in for "which cache key is being read right now".
    let failUnfiltered = false;
    mockApi(
      baseRoutes({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: () =>
          failUnfiltered
            ? { status: 500, body: { error: { code: 'internal', message: 'boom' } } }
            : listEnvelope([ROW]),
      }),
    );

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    // Apply the "Pending" facet -- a different cache key, cold read,
    // succeeds and caches its own payload.
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    // Now make the UNFILTERED path's read fail, and revisit it by toggling
    // the facet back off. The unfiltered path is already cached from the
    // very first mount, so useCachedList seeds `data` synchronously from
    // that cache (rows paint on the first frame, no skeleton) while its
    // background revalidation read is the one that is about to fail.
    failUnfiltered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    // Rows never leave the screen -- no skeleton, no empty state in between.
    expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();

    // ApiError carries the server's own message ('boom'), which the hook's
    // catch surfaces verbatim (the 'Failed to load submissions' fallback is
    // only for a non-ApiError/network-shaped failure).
    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument();
    });
    // DEC_518: stale rows stay on screen through a failed revalidation --
    // never blanked, replaced only on a resolving read.
    expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
  });
});
