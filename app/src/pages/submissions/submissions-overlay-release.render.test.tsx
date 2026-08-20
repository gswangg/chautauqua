// DEC-265 amendment (wave 126): the `statusOverrides` overlay is released
// by SERVER TRUTH -- once the cache-derived row already carries the
// written status -- never by the write's own promise resolving. Before this
// fix, `applyRowTriage` deleted its overlay entry the instant `apiPost`
// resolved while `submissions.data` still held the pre-write payload (the
// SWR refetch triggered by the mutation bump is asynchronous, and DEC_700
// wave-121 deliberately leaves `data` untouched on a bump-only run), so the
// displayed status fell back to the pre-write value for one round trip --
// a successful write that visibly reverted, indistinguishable from a
// failed one. This pins: (1) on success, the displayed status never
// reverts to the pre-write value between the optimistic flip and the
// settled server value landing; (2) on failure, it DOES revert to the
// pre-write status and the error surfaces.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { resetApiCacheForTests } from '../../lib/api';

const EVENT_ID = 'evt-overlay-release-1';

const PENDING_ROW = {
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

const ACCEPTED_ROW = { ...PENDING_ROW, status: 'accepted' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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

function renderTable() {
  return render(
    <MemoryRouter>
      <SubmissionsPage />
    </MemoryRouter>,
  );
}

// The status cell (`.chq-flag`) is the only unambiguous read of the row's
// displayed status -- 'Pending' and 'Accepted' also appear as FilterBar
// facet-toggle button labels elsewhere on the page.
function statusFlagText(container: HTMLElement): string | null {
  return container.querySelector('.chq-flag')?.textContent ?? null;
}

describe('SubmissionsTable overlay release (DEC-265 amendment, wave 126)', () => {
  it('never reverts to the pre-write status between the optimistic flip and the settled server value (success)', async () => {
    let submissionsCalls = 0;
    let resolveReload!: (value: Response) => void;
    const reloadPromise = new Promise<Response>((resolve) => {
      resolveReload = resolve;
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const url = new URL(rawUrl, 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${url.pathname}`;

      if (key === 'GET /api/v1/me') {
        return jsonResponse({ userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' });
      }
      if (key === `GET /api/v1/events/${EVENT_ID}/tracks`) return jsonResponse({ items: [], total: 0 });
      if (key === `GET /api/v1/events/${EVENT_ID}/forms`) return jsonResponse({ id: 'form-1', fields: [] });
      if (key === `GET /api/v1/events/${EVENT_ID}/views`) return jsonResponse({ items: [], total: 0 });
      if (key === `GET /api/v1/events/${EVENT_ID}/submissions`) {
        submissionsCalls += 1;
        // Call 1: cold mount main list. Call 2: the "N awaiting triage"
        // side fetch (perPage=1, status=pending). Call 3: the unfiltered
        // side fetch (allTotal). Call 4: the post-write refetch of the main
        // list, held open until the test explicitly resolves it.
        if (submissionsCalls <= 3) return jsonResponse({ items: [PENDING_ROW], total: 1 });
        return reloadPromise;
      }
      if (key === `POST /api/v1/events/${EVENT_ID}/submissions/status`) {
        return jsonResponse({ updated: 1 });
      }
      throw new Error(`unhandled route ${key}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderTable();
    await waitFor(() => expect(screen.getByText('A Talk About Testing')).toBeInTheDocument());
    expect(statusFlagText(container)).toBe('Pending');

    // Fire the row-triage Accept action. This resolves the POST immediately
    // (bumping mutationVersion and starting the held-open GET refetch) while
    // `submissions.data` still holds the pre-write PENDING_ROW.
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    // The optimistic overlay flips the display immediately.
    await waitFor(() => expect(statusFlagText(container)).toBe('Accepted'));

    // Let the POST's own promise chain (and the mutation bump it triggers)
    // fully settle via a couple of microtask/macrotask ticks, while the
    // refetch GET is still held open on `reloadPromise`. Old code deleted
    // the overlay here -- on the write's OWN resolution -- which would fall
    // back to `items`' still-pending status.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statusFlagText(container)).toBe('Accepted');

    // Now let the refetch resolve with server truth -- the reconciliation
    // effect releases the overlay, and `items` itself now says Accepted.
    resolveReload(jsonResponse({ items: [ACCEPTED_ROW], total: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statusFlagText(container)).toBe('Accepted');
  });

  it('reverts to the pre-write status and surfaces the error on a rejected write', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const url = new URL(rawUrl, 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${url.pathname}`;

      if (key === 'GET /api/v1/me') {
        return jsonResponse({ userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' });
      }
      if (key === `GET /api/v1/events/${EVENT_ID}/tracks`) return jsonResponse({ items: [], total: 0 });
      if (key === `GET /api/v1/events/${EVENT_ID}/forms`) return jsonResponse({ id: 'form-1', fields: [] });
      if (key === `GET /api/v1/events/${EVENT_ID}/views`) return jsonResponse({ items: [], total: 0 });
      if (key === `GET /api/v1/events/${EVENT_ID}/submissions`) return jsonResponse({ items: [PENDING_ROW], total: 1 });
      if (key === `POST /api/v1/events/${EVENT_ID}/submissions/status`) {
        return jsonResponse({ error: { code: 'internal', message: 'boom' } }, 500);
      }
      throw new Error(`unhandled route ${key}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderTable();
    await waitFor(() => expect(screen.getByText('A Talk About Testing')).toBeInTheDocument());
    expect(statusFlagText(container)).toBe('Pending');

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    // Optimistic flip still shows immediately.
    await waitFor(() => expect(statusFlagText(container)).toBe('Accepted'));

    // The write fails -- the overlay entry is dropped immediately (this IS
    // the rollback for a single id, since nothing changed on the server)
    // and the error surfaces.
    await waitFor(() => expect(statusFlagText(container)).toBe('Pending'));
    await waitFor(() => expect(screen.getByText('Status update failed: boom')).toBeInTheDocument());
  });
});
