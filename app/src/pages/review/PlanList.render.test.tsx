// DEC-706/DEC-707 render regression: the Review landing's plan list has no
// radio input (a row is chosen by clicking the row, quiet active state +
// aria-current), and the embedded progress region's "Remind the N not
// started" tertiary link count equals selectRemindTargets(rows,
// 'not_started').length -- the SAME domain predicate the route imports,
// never a hand-copied count in the SPA.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PlanList } from './PlanList';
import { selectRemindTargets } from '../../../../src/domain/evaluation';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { ProgressRow } from './types';

const EVENT_ID = 'evt-planlist-render';
const PLAN_ID = 'plan-a';

function plan() {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: 'Keynote Track Review',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

const PROGRESS_ROWS: ProgressRow[] = [
  { userId: 'u-1', email: 'started@example.com', name: null, assigned: 4, completed: 2, recused: 0 },
  { userId: 'u-2', email: 'fresh1@example.com', name: null, assigned: 4, completed: 0, recused: 0 },
  { userId: 'u-3', email: 'fresh2@example.com', name: null, assigned: 4, completed: 0, recused: 0 },
  { userId: 'u-4', email: 'done@example.com', name: null, assigned: 4, completed: 4, recused: 0 },
];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('PlanList (DEC-706/DEC-707 render)', () => {
  it('renders a plan row with no radio input, and the remind link names the not-started count', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope(PROGRESS_ROWS),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();

    // DEC-706: no radio input anywhere in a plan row -- selection is the row
    // click itself.
    expect(container.querySelector('input[type="radio"]')).toBeNull();

    // The row itself carries aria-current once selected (default selection
    // is the only/open plan).
    const row = screen.getByText('Keynote Track Review').closest('.chq-review-plan-row');
    expect(row).toHaveAttribute('aria-current', 'true');

    // DEC-707: the tertiary "Remind the N not started" link's count is
    // exactly selectRemindTargets(rows, 'not_started').length -- computed
    // from the SAME rows the row-level state reads, never a hardcoded
    // literal in this test.
    const expectedCount = selectRemindTargets(PROGRESS_ROWS, 'not_started').length;
    await waitFor(() => {
      expect(screen.getByRole('button', { name: `Remind the ${expectedCount} not started` })).toBeInTheDocument();
    });
  });

  it('New plan and Export results CSV live on the title row, not a standalone toolbar band', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    const newPlanLink = await screen.findByRole('link', { name: 'New plan' });
    expect(newPlanLink.closest('.chq-review-title-row')).not.toBeNull();

    const exportLink = screen.getByRole('link', { name: 'Export results CSV' });
    expect(exportLink.closest('.chq-review-title-row')).not.toBeNull();
    expect(exportLink).toHaveAttribute('href', expect.stringContaining(PLAN_ID));
  });
});
