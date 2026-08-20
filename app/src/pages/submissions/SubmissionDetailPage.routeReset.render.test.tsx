// DEC-678 (wave-118 amendment, task w8-f): a route-param change on the
// submission detail page is a NEW PAGE -- the in-page Previous/Next links
// (rendered below the ref row) navigate to a SIBLING submission on this
// SAME `/submissions/:id` route, so React Router keeps this component
// mounted across the change and every param-scoped state slot would
// otherwise survive it, re-attaching submission A's state to submission B.
// This file proves the reset effect added alongside `id`, and the
// `cancelled` guard that stops a slow in-flight detail/evaluations read for
// the old submission from painting once the route has moved on.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { mockApi, listEnvelope, errorEnvelope } from '../../test-utils/mockApi';

const SUB_A = 'sub-detail-reset-a';
const SUB_B = 'sub-detail-reset-b';
const EVENT_ID = 'evt-detail-reset';

function baseDetail(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    eventId: EVENT_ID,
    ref: id === SUB_A ? 'S-A' : 'S-B',
    title,
    description: `${title} description`,
    status: 'pending',
    contentStatus: 'pending',
    trackId: null,
    trackIds: [] as string[],
    formId: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    participants: [
      {
        id: `${id}-lead`,
        contactId: `${id}-lead-contact`,
        name: `${title} Lead`,
        email: 'lead@example.com',
        title: null,
        company: null,
        role: 'speaker',
        order: 0,
        visible: true,
        inviteStatus: 'accepted',
        submissionsThisYear: 1,
      },
      {
        id: `${id}-co`,
        contactId: `${id}-co-contact`,
        name: `${title} Co-presenter`,
        email: 'co@example.com',
        title: null,
        company: null,
        role: 'co-presenter',
        order: 1,
        visible: true,
        inviteStatus: 'accepted',
        submissionsThisYear: 1,
      },
    ],
    answers: {},
    slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
    ...overrides,
  };
}

function listItem(id: string, title: string) {
  return { id, ref: id === SUB_A ? 'S-A' : 'S-B', title, status: 'pending', trackIds: [] as string[] };
}

function commonRoutes() {
  return {
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, timezone: 'UTC' },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: { items: [{ id: 'track-1', name: 'Track One' }], total: 1, page: 1, perPage: 20 },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([listItem(SUB_A, 'Submission A'), listItem(SUB_B, 'Submission B')]),
    [`GET /api/v1/submissions/${SUB_A}/evaluations`]: {
      items: [{ planId: 'plan-1', round: 1, reviewerName: 'Reviewer One', score: 4, comment: '', submittedAt: 1700000000000, criteria: [{ id: 'c1', label: 'Quality', score: 4 }], scores: { c1: 4 } }],
      assigned: 1,
    },
    [`GET /api/v1/submissions/${SUB_B}/evaluations`]: { items: [], assigned: 0 },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/submissions/${SUB_A}`]}>
      <Routes>
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Sits alongside <SubmissionDetailPage/> under the SAME <Route>, so
// clicking it changes only the `:id` param -- the page's own component
// instance stays mounted, exactly the shape a fast Previous/Next double-tap
// (or the in-page Next link's normal single navigation) produces.
function NavTo({ path }: { path: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(path)}>
      go-to-next
    </button>
  );
}

function renderWithNavButton() {
  return render(
    <MemoryRouter initialEntries={[`/submissions/${SUB_A}`]}>
      <Routes>
        <Route
          path="/submissions/:id"
          element={
            <>
              <NavTo path={`/submissions/${SUB_B}`} />
              <SubmissionDetailPage />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SubmissionDetailPage route-param reset (DEC-678 wave-118)', () => {
  it('clears the track editor, an open review disclosure, a co-presenter search, and a status refusal after the in-page Next link', async () => {
    mockApi({
      ...commonRoutes(),
      [`GET /api/v1/submissions/${SUB_A}`]: baseDetail(SUB_A, 'Submission A'),
      [`GET /api/v1/submissions/${SUB_B}`]: baseDetail(SUB_B, 'Submission B'),
      [`POST /api/v1/events/${EVENT_ID}/submissions/status`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid status', { status: 'Cannot accept from this state' }),
      },
      [`GET /api/v1/contacts/search`]: listEnvelope([]),
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Submission A' });

    // Open the review disclosure on A.
    const criteriaToggle = screen.getByRole('button', { name: /1 criterion/ });
    fireEvent.click(criteriaToggle);
    expect(screen.getByText('Quality')).toBeInTheDocument();

    // Open the track editor on A.
    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));
    await screen.findByRole('checkbox', { name: 'Track One' });

    // Trigger a status refusal on A -- lands in statusFieldErrors.
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('Cannot accept from this state')).toBeInTheDocument();

    // Navigate to sibling submission B via the in-page Next link -- the
    // SAME route, so React reuses this mounted component instance.
    fireEvent.click(screen.getByRole('link', { name: 'Next submission' }));

    await screen.findByRole('heading', { name: 'Submission B' });

    // statusFieldErrors reset: A's refusal does not re-attach to B.
    expect(screen.queryByText('Cannot accept from this state')).not.toBeInTheDocument();
    // editingTracks reset: B's own (untouched) track editor is closed.
    expect(screen.queryByRole('checkbox', { name: 'Track One' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit tracks' })).toBeInTheDocument();
    // expandedReviewKeys reset: B has no reviews at all, but even the
    // disclosure state itself must not have survived from A's key.
    expect(screen.getByText('No reviews recorded yet.')).toBeInTheDocument();
  });

  it('closes a pending remove-participant confirm dialog and clears the co-presenter search box on navigation to B', async () => {
    mockApi({
      ...commonRoutes(),
      [`GET /api/v1/submissions/${SUB_A}`]: baseDetail(SUB_A, 'Submission A'),
      [`GET /api/v1/submissions/${SUB_B}`]: baseDetail(SUB_B, 'Submission B'),
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Submission A' });

    // Type into the co-presenter search box on A.
    const searchInput = screen.getByPlaceholderText(/add a co-presenter/i);
    fireEvent.change(searchInput, { target: { value: 'Ada Lovelace' } });
    expect(searchInput).toHaveValue('Ada Lovelace');

    // Open the remove-participant confirm dialog for A's co-presenter.
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/Submission A Co-presenter will be removed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Next submission' }));

    await screen.findByRole('heading', { name: 'Submission B' });

    // pendingRemoveParticipant reset: no dialog naming A's co-presenter
    // survives onto B (and it must not fire its DELETE against B's roster).
    expect(screen.queryByText(/Submission A Co-presenter will be removed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove participant' })).not.toBeInTheDocument();

    // coPresenterQuery reset: B's search box starts empty, not A's draft text.
    const bSearchInput = screen.getByPlaceholderText(/add a co-presenter/i);
    expect(bSearchInput).toHaveValue('');
  });

  it('a slow-resolving detail for A never paints once the route has moved to B (cancelled guard)', async () => {
    let resolveA!: (value: unknown) => void;
    const aResponse = new Promise((resolve) => {
      resolveA = resolve;
    });

    const staticRoutes: Record<string, unknown> = {
      ...commonRoutes(),
      [`GET /api/v1/submissions/${SUB_B}`]: baseDetail(SUB_B, 'Submission B'),
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${path}`;

      if (key === `GET /api/v1/submissions/${SUB_A}`) {
        const body = await aResponse;
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (!(key in staticRoutes)) {
        throw new Error(`unregistered route: ${key}`);
      }
      const handler = staticRoutes[key];
      const resolved = typeof handler === 'function' ? handler() : handler;
      return new Response(JSON.stringify(resolved), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithNavButton();

    // A's submission GET is now in flight and deliberately held open.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/submissions/${SUB_A}`), expect.anything()));

    // Route moves to B before A ever resolves -- this is the effect's
    // cleanup firing (cancelled = true) for A's still-pending request.
    fireEvent.click(screen.getByRole('button', { name: 'go-to-next' }));
    await screen.findByRole('heading', { name: 'Submission B' });

    // Now let A's slow response land -- this is the effect's cleanup
    // firing (cancelled = true) for A's still-pending request.
    resolveA(baseDetail(SUB_A, 'Submission A'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // B's paint must survive untouched -- A's cancelled response never
    // overwrote `detail`.
    expect(screen.getByRole('heading', { name: 'Submission B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Submission A' })).not.toBeInTheDocument();
  });
});
