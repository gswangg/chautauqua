// Chautauqua Review.dc.html:413 -- Reviewer queue · /review/plans/:id, the
// ONE frame owned by w2-j. Receipted below (the frame's opening-container
// citation and quote sit beside the assertion they back).
//
// Two things the task itself flagged as easy to get wrong, both asserted
// here: (1) "Scores stay hidden from other reviewers" is a STANDING hint
// that renders in the phone dock alongside Sign out whether or not
// anything is scored -- not a state message gated on `totalRows > 0` like
// PlanSection's own desktop footer note; (2) the scoped-queue head uses the
// scaffold's drill-in classes (chq-phone-head/-head-drill), not the
// cluster-landing register, since this route is a back-linked drill-in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-phone-frame';

function queueItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    submissionId: 'sub-1',
    ref: 'S-001',
    title: 'A Talk',
    ratingsCount: 0,
    alreadyRatedByMe: true,
    myScore: 4,
    ...overrides,
  };
}

function queueEnvelope(
  items: ReturnType<typeof queueItem>[],
  overrides: { total?: number; unscoredTotal?: number } = {},
) {
  return {
    ...listEnvelope(items),
    total: overrides.total ?? items.length,
    unscoredTotal:
      overrides.unscoredTotal ??
      items.filter((i) => !(i as { alreadyRatedByMe?: boolean }).alreadyRatedByMe).length,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalLocation = window.location;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
      </Routes>
    </MemoryRouter>,
  );
}

// jsdom's window.location.assign is non-configurable on the Location
// instance -- mirrors App.signout.render.test.tsx's stub.
function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}

describe('ReviewerQueue phone frame (Chautauqua Review.dc.html:413)', () => {
  it('the scoped head band uses the drill-in scaffold classes, not the cluster-landing register', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ alreadyRatedByMe: false })]),
        open: true,
        recused: [],
        planName: 'Phone Frame Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
      },
    });

    const { container } = renderQueue();
    await screen.findByText('1 left to score');

    // docs/design/Chautauqua Review.dc.html:413
    // `width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)`
    // -- the device frame's page; receipt is the scoped head mounting in it.
    const head = container.querySelector('.chq-review-scoped-head');
    expect(head).not.toBeNull();
    expect(head!.className).toMatch(/\bchq-phone-head\b/);
    expect(head!.className).toMatch(/\bchq-phone-head-drill\b/);
  });

  // DEC-874 wave-159 amendment: the frame draws NO back control on this
  // subscreen at all, so the app's own "‹ Your plans" link now only renders
  // when `plans` (read off this same component instance, no second fetch)
  // proves a hub actually exists -- a bare deep link to `/review/plans/:id`
  // never populates `plans` and correctly renders none. This test now
  // drills in via a two-plan hub (the case where the link legitimately
  // exists) so it can still assert the scaffold's back/body classes.
  it('the back link and the queue body carry the scaffold\'s back/body classes', async () => {
    const OTHER_PLAN_ID = 'plan-phone-frame-other';
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_ID, eventId: 'evt-1', name: 'Phone Frame Plan', timezone: 'America/New_York' },
        { id: OTHER_PLAN_ID, eventId: 'evt-1', name: 'Other Plan', timezone: 'America/New_York' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Phone Frame Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
      },
      [`GET /api/v1/review/plans/${OTHER_PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Other Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
      },
    });

    render(
      <MemoryRouter initialEntries={['/review']}>
        <Routes>
          <Route path="/review" element={<ReviewerQueue />} />
          <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Phone Frame Plan');
    const links = screen.getAllByRole('link', { name: /Score the next one|Start scoring/ });
    const link = links.find((l) => l.getAttribute('href') === `/review/plans/${PLAN_ID}`)!;
    fireEvent.click(link);

    const backLink = await screen.findByRole('link', { name: /Your plans/ });
    expect(backLink.className).toMatch(/\bchq-phone-back\b/);

    const body = backLink.closest('.chq-page')!.querySelector('.chq-section');
    expect(body).not.toBeNull();
    expect(body!.className).toMatch(/\bchq-phone-body\b/);
  });

  it('the standing reassurance and Sign out render together in the phone dock even when nothing is left to score', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ alreadyRatedByMe: true })], { unscoredTotal: 0 }),
        open: true,
        recused: [],
        planName: 'Phone Frame Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
      },
    });

    const { container } = renderQueue();

    await screen.findByText('Nothing left in your queue. Nicely done.');

    const dock = container.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    expect(dock!.textContent).toContain('Scores stay hidden from other reviewers');
    expect(dock!.querySelector('button')?.textContent).toBe('Sign out');
  });

  it('the standing dock also renders with an empty queue (zero rows, nothing capped out)', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: true,
        recused: [],
        planName: 'Phone Frame Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
        cappedOut: 0,
      },
    });

    const { container } = renderQueue();
    await screen.findByText('Scores stay hidden from other reviewers');

    const dock = container.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    expect(dock!.textContent).toContain('Scores stay hidden from other reviewers');
  });

  it('the dock\'s Sign out button POSTs /logout and navigates to /login on success (DEC-154 contract)', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Phone Frame Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
      },
      'POST /logout': { status: 200, body: {} },
    });
    const assignSpy = stubLocationAssign();

    renderQueue();

    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    signOutButton.click();

    // v12m-w14-si (DEC-154): signOut() navigates to the server-named redirect
    // target, keeping ?signed-out=1 rather than the bare '/login' it used to
    // hardcode. The mocked /logout Response carries no url, so the fallback
    // literal applies.
    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('/login?signed-out=1');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/logout',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-chq-csrf': '1' }) }),
    );
  });

  it('the dock\'s Sign out does NOT navigate when /logout fails, and surfaces the failure on screen (fail loudly)', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Phone Frame Plan',
        scopeTrackName: 'All tracks',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
      },
      'POST /logout': { status: 400, body: {} },
    });
    const assignSpy = stubLocationAssign();

    renderQueue();

    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    signOutButton.click();

    // v12m-w14-c: a failed sign-out no longer just rejects into the void --
    // it lands in the drill-in's existing routePlanError state, rendered as
    // a chq-error alert the operator can actually see, instead of an
    // unhandled promise rejection with no on-screen message.
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-out failed: /logout responded 400');
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
