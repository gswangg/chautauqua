// DEC-380 wave-140 (re-adjudication of the wave-130 amendment's clause (d)):
// docs/design/Chautauqua Comms.dc.html:574-578 draws the never-sent Comms
// landing's fresh empty state with a decided-submission count ("23
// submissions have a decision and nobody has been told." / "Tell the 23
// accepted speakers"). This file pins that Comms.tsx loads the accepted-
// submission count on the SAME fresh branch its "No sends on this event"
// head subtitle already detects (all-time batch list empty AND both
// seven-day totals zero), hands it down to RecentSends, and never fabricates
// a number when the count fails to load.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from '../Comms';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-comms-untold-count';

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

describe('CommsPage fresh empty state decided-untold count', () => {
  it('loads the accepted-submission count on the fresh branch and interpolates it into both the sentence and the primary', async () => {
    mockApi({
      // Every /submissions request (the count fetch, and ComposeWizard's own
      // list + per-status pill reads) answers with the same envelope here --
      // mockApi matches by path only. total:23 is the figure under test.
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 23 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      // Empty batch list AND (via the same path) zero for both seven-day
      // status=sent/status=failed reads -- the existing "fresh" signal.
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No sends on this event')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('23 submissions have a decision and nobody has been told. Every send is logged here afterwards.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Tell the 23 accepted speakers' })).toHaveAttribute(
      'href',
      '/comms?tab=compose',
    );
    expect(screen.queryByText('Tell your accepted speakers')).not.toBeInTheDocument();
  });

  it('renders the static count-free copy (never a fabricated number) when the submissions read fails', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No sends on this event')).toBeInTheDocument();
    expect(screen.getByText('Every send is logged here afterwards.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tell your accepted speakers' })).toBeInTheDocument();
    expect(screen.queryByText(/submissions? have a decision/)).not.toBeInTheDocument();
  });

  // A non-fresh event (a real batch already exists) never reaches the fresh
  // empty state at all -- RecentSends renders its batch rows instead, and
  // the count-bearing copy has nowhere to appear. (ComposeWizard's own
  // step-1 status pills independently query status=accepted regardless of
  // freshness, so this is asserted through the rendered empty-state text,
  // not through absence of a particular query string.)
  it('never shows the fresh empty state (or its count copy) when a real batch already exists', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 23 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { batchKey: 'b1', subject: 'You are in!', sentAt: 1700000000000, statusCounts: { sent: 3 }, templateId: null },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('You are in!').length).toBeGreaterThan(0));
    expect(screen.queryByText('No sends on this event')).not.toBeInTheDocument();
    expect(screen.queryByText('You have not emailed anyone yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/submissions? have a decision/)).not.toBeInTheDocument();
  });
});
