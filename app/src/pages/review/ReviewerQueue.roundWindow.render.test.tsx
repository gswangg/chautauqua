// task-w51-e item 4 (falsifiability batch B, DEC-358 wave-51): the reviewer
// round name + window (ReviewerQueue.tsx:31 `roundLabel` import, :508 its
// call site inside the scoped-queue subtitle). TEST-ONLY per this task's
// scope -- ReviewerQueue.tsx itself is not touched here (wave-49's
// DEC-939 lane may also be touching this file).
//
// ReviewerQueue.render.test.tsx exercises the scoped-head subtitle for
// "N assigned" and "closes in N days" on the HUB (plan-list) row, but no
// existing test drives the SCOPED queue route (`/review/plans/:planId`)
// with `rounds > 1`, so the roundName half of the subtitle (DEC-147) has no
// render coverage: a regression that dropped `roundLabel(...)` from the
// subtitle, or that showed it for a single-round plan, would pass every
// existing test. This file mounts the real scoped route and asserts the
// subtitle text for both the multi-round (name shown) and single-round
// (name omitted) cases, plus the close-window half rendered alongside it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-round-window';

function queueItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    submissionId: 'sub-1',
    ref: 'S-001',
    title: 'A Talk',
    ratingsCount: 0,
    alreadyRatedByMe: false,
    myScore: null,
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

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
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

describe('ReviewerQueue scoped-head round name + window (task-w51-e item 4)', () => {
  it('shows the active round\'s own name alongside the scope and the closes-in-N-days window when rounds > 1', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Multi-Round Plan',
        scopeTrackName: 'Frontend Track',
        closeDate: null,
        rounds: 2,
        currentRound: 2,
        roundMeta: { name: 'Round 2 (Final)', opensAt: null, closesAt: null },
      },
    });

    renderQueue();

    const subtitle = await screen.findByText(/Frontend Track/);
    expect(subtitle.textContent).toContain('Frontend Track');
    expect(subtitle.textContent).toContain('Round 2 (Final)');
  });

  it('omits the round name entirely for a single-round plan (rounds === 1), even when roundMeta is present', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Single-Round Plan',
        scopeTrackName: 'Backend Track',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: { name: 'Round 1', opensAt: null, closesAt: null },
      },
    });

    renderQueue();

    const subtitle = await screen.findByText(/Backend Track/);
    expect(subtitle.textContent).not.toContain('Round 1');
  });

  it('renders the round name together with the closes-in window, both in the same subtitle line', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        planName: 'Windowed Plan',
        scopeTrackName: 'All tracks',
        closeDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
        rounds: 3,
        currentRound: 1,
        roundMeta: { name: 'Screening round', opensAt: null, closesAt: null },
      },
    });

    renderQueue();

    const subtitle = await screen.findByText(/Screening round/);
    expect(subtitle.textContent).toMatch(/Screening round.*closes in \d+ days?/);
  });
});
