// w5-t: docs/design/`Chautauqua Speakers.dc.html`:442-483 -- the 'Speakers ·
// search found nothing' frame draws the shell header, the H1 aggregate line
// ("12 accepted · 3 overdue"), the filter strip, then ONE empty block (a
// 26px/700 headline, a max-width:52ch 16px sentence naming the excluding
// facet, and a single 14px/700 escape action). After that block the card
// ends -- there is NO `<thead>`, no legend row and no pager anywhere below
// it. DEC-678 wave-109 amendment: OnboardingGrid.tsx kept the table's
// footer chrome (legend + pager) mounted under the empty block, B7 rule 6's
// own retired pattern one level out. This file pins the fix: a zero-row
// grid replaces the WHOLE table region including its footer chrome, while
// the H1 aggregate and filter strip (which the frame also draws, and which
// is how the visitor undoes the exclusion) stay mounted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { GRID_STATUS_LEGEND, OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-filtered-empty-w5t';

const TASKS: OnboardingGridResponse['tasks'] = [
  { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true },
];

const GRID_WITH_ROWS: OnboardingGridResponse = {
  tasks: TASKS,
  rows: [
    {
      contact: {
        id: 'ct1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Acme',
        hasAccount: true,
        participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
      },
      cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
  counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
  timezone: 'UTC',
};

const GRID_EMPTY: OnboardingGridResponse = {
  tasks: TASKS,
  rows: [],
  total: 0,
  page: 1,
  perPage: 50,
  counts: { speakers: 1, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
  timezone: 'UTC',
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('OnboardingGrid: DEC-678 wave-109 amendment -- filtered zero-row grid drops the table footer chrome', () => {
  it('with rows: renders the legend and the pager alongside the table', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_WITH_ROWS,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    });

    // Negative control: with rows present, the footer chrome IS mounted --
    // proving the fix removes a CONDITION around the chrome, not the
    // chrome's markup itself.
    expect(screen.getByText(GRID_STATUS_LEGEND)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(document.querySelector('table.chq-speakers-grid')).not.toBeNull();
  });

  it('filtered zero-row grid: renders the empty block, the H1 aggregate and the filter strip, but NO legend and NO pager', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_EMPTY,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    // The filter strip mounts from first paint.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Overdue only' })).toBeInTheDocument();
    });

    // docs/design/`Chautauqua Speakers.dc.html`:442-483 -- filtering by
    // "Overdue only" against a roster with nothing overdue is the frame's
    // own excluding facet.
    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));

    await waitFor(() => {
      expect(screen.getByText('No speakers match the current filters.')).toBeInTheDocument();
    });

    // The empty block itself (frame :442-483): headline, reason naming the
    // excluding facet, and the single escape action -- untouched by this
    // fix, so still present.
    expect(
      screen.getByText('No speakers have anything overdue. Clearing "Overdue only" finds the rest.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear the overdue filter ›' })).toBeInTheDocument();

    // The filter strip (how the visitor undoes the exclusion) stays mounted.
    expect(screen.getByRole('button', { name: 'Overdue only' })).toBeInTheDocument();

    // The frame also draws the H1 aggregate line above the filter strip --
    // this fix touches only the table region and its footer chrome.
    expect(screen.getByRole('heading', { name: 'Speakers' })).toBeInTheDocument();
    expect(screen.getByText(/accepted/).textContent).toMatch(/overdue/);

    // No table region, and no footer chrome beneath the empty block: the
    // frame's card ends at the escape action.
    expect(document.querySelector('table.chq-speakers-grid')).toBeNull();
    expect(document.querySelector('thead')).toBeNull();
    expect(screen.queryByText(GRID_STATUS_LEGEND)).not.toBeInTheDocument();
    expect(screen.queryByText('Click any status to mark it complete or pending')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
