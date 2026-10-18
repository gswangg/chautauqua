// Settings · Sponsorships summary (multi-portal flow 1): one line per tier
// with what it entitles a sponsor to, the sponsor count with a link to the
// approval queue when sessions are waiting, and "Manage sponsorships".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SponsorshipsSummaryPanel } from './SponsorshipsSummaryPanel';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-sponsorships-summary';

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

function sponsorships(waiting: number, withData = true) {
  return {
    tiers: withData
      ? [
          { id: 't1', name: 'Gold', position: 0, entitlements: [], summary: 'One 30-minute talk · one 120-minute workshop', sponsors: 2 },
          { id: 't2', name: 'Silver', position: 1, entitlements: [], summary: 'One 30-minute talk', sponsors: 3 },
        ]
      : [],
    sponsors: withData
      ? Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, companyId: `c${i}`, companyName: `Co ${i}`, tierId: 't1', tierName: 'Gold', status: 'active', statusLine: '', contacts: 1, waiting: 0, extras: [] }))
      : [],
    waiting,
    formats: [],
  };
}

describe('SponsorshipsSummaryPanel', () => {
  it('summarises tiers and sponsors, links the waiting sessions to the queue and the section to its page', async () => {
    mockApi({ [`GET /api/v1/events/${EVENT_ID}/sponsorships`]: sponsorships(2) });
    render(
      <MemoryRouter>
        <SponsorshipsSummaryPanel />
      </MemoryRouter>,
    );
    const section = await screen.findByRole('region', { name: 'Sponsorships' });
    expect(await within(section).findByText('Gold — One 30-minute talk · one 120-minute workshop')).toBeInTheDocument();
    expect(within(section).getByText('Silver — One 30-minute talk')).toBeInTheDocument();
    expect(within(section).getByText('5')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: '2 sessions waiting for approval' })).toHaveAttribute('href', '/speakers/sponsor-sessions');
    expect(within(section).getByRole('button', { name: 'Manage sponsorships' })).toBeInTheDocument();
  });

  it('reads plainly with no tiers or sponsors yet, and no queue link when nothing waits', async () => {
    mockApi({ [`GET /api/v1/events/${EVENT_ID}/sponsorships`]: sponsorships(0, false) });
    render(
      <MemoryRouter>
        <SponsorshipsSummaryPanel />
      </MemoryRouter>,
    );
    const section = await screen.findByRole('region', { name: 'Sponsorships' });
    expect(await within(section).findByText('No tiers yet')).toBeInTheDocument();
    expect(within(section).getByText('No sponsors yet')).toBeInTheDocument();
    expect(within(section).queryByText(/waiting for approval/)).not.toBeInTheDocument();
  });
});
