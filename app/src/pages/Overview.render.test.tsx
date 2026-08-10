// DEC-144 layer-2 harness: component-render smoke test for the Overview
// worklist dashboard. Mounts the real page against a mocked fetch shaped
// like the real GET .../overview envelope and asserts every worklist card
// renders without throwing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from './Overview';
import { mockApi } from '../test-utils/mockApi';
import type { OverviewPayload } from './overview/cards';

const EVENT_ID = 'evt-render-2';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('OverviewPage render smoke', () => {
  it('mounts without throwing and renders the six worklist cards', async () => {
    const payload: OverviewPayload = {
      triage: { pending: 2, accept_queue: 1, decline_queue: 0 },
      review: { plans: 3, evaluationsSubmitted: 1 },
      speakers: { contactsOwing: 4, overdueAssignments: 1 },
      content: { awaitingApproval: 2 },
      agenda: { unplaced: 1, conflicts: 0 },
      comms: { sentLast7Days: 5, lastSentAt: null },
    };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload,
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Triage')).toBeInTheDocument();
    });

    for (const title of ['Triage', 'Review', 'Speakers', 'Content', 'Agenda', 'Comms']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });
});
