// DEC-936 amendment (task w11-p): the Submissions 390 frame's third status
// chip (docs/design/Chautauqua Submissions.dc.html:150 -- `Accepted</span>` is
// immediately followed on the next frame line by
// `<span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px;
// min-height:44px; display:flex; align-items:center; padding:0 13px;
// font-size:13px; font-weight:500">All 47</span>` -- has no counterpart in
// FilterBar today (the rule's own comment in submissions.css names the gap).
// This pins the chip clears the status facet, carries the unfiltered total
// SubmissionsTable already fetches at perPage=1, and never fabricates a
// number when that fetch fails (DEC-180).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';

const EVENT_ID = 'evt-all-chip-1';

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
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([ROW], { total: 47 }),
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

describe('Submissions "All" status chip (DEC-936 amendment)', () => {
  it('carries the unfiltered total and a real click clears the status facet', async () => {
    mockApi(baseRoutes());

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    // Frame literal (docs/design/Chautauqua Submissions.dc.html:150):
    // `font-size:13px; font-weight:500">All 47</span>` -- the third 390
    // status chip's exact label.
    const allChip = await screen.findByRole('button', { name: 'All 47' });
    expect(allChip).toBeInTheDocument();

    const pending = screen.getByRole('button', { name: 'Pending' });
    pending.click();
    await waitFor(() => {
      expect(pending).toHaveAttribute('aria-pressed', 'true');
    });
    expect(allChip).toHaveAttribute('aria-pressed', 'false');

    allChip.click();
    await waitFor(() => {
      expect(allChip).toHaveAttribute('aria-pressed', 'true');
    });
    expect(pending).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows no number when the unfiltered-total read fails', async () => {
    // A route-per-call fetch stub (mockApi strips query strings, so it
    // can't tell the perPage=1 unfiltered-total fetch apart from the
    // status=pending one -- both hit the same /submissions path). This
    // stub inspects the raw query string directly instead.
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      const routes = baseRoutes();

      if (method === 'GET' && rawUrl.includes(`/events/${EVENT_ID}/submissions`)) {
        if (rawUrl.includes('perPage=1') && !rawUrl.includes('status=')) {
          return new Response(JSON.stringify({ error: { code: 'internal', message: 'boom' } }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(listEnvelope([ROW], { total: 47 })), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      const key = `${method} ${path}`;
      if (!(key in routes)) throw new Error(`unmocked route: ${key}`);
      const body = (routes as Record<string, unknown>)[key];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    const allChip = await screen.findByRole('button', { name: 'All' });
    expect(allChip).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^All \d/ })).not.toBeInTheDocument();
  });
});
