// w15-e/DEC-691 render smoke test: PublicPagesPanel lists one row per real
// public surface (Sessions, Speakers, Agenda, Schedule, CFP submit page)
// with a real path, a state derived from real data (never a hardcoded
// 'live'), and an Embed code control that opens the existing EmbedsPanel
// builder in place.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PublicPagesPanel } from './PublicPagesPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-public-pages';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

function mockEvent(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', name: 'DevCon 2026' },
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 0, speakers: 0, scheduled: 0 },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form1', eventId: EVENT_ID, openDate: null, closeDate: null },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    ...overrides,
  });
}

describe('PublicPagesPanel', () => {
  it('renders one row per public surface with a real path and a not-published state when there is nothing accepted yet', async () => {
    mockEvent();
    render(<PublicPagesPanel />);

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    const expectedRows: [string, string][] = [
      ['Sessions', '/e/devcon-2026/sessions'],
      ['Speakers', '/e/devcon-2026/speakers'],
      ['Agenda', '/e/devcon-2026/agenda'],
      ['Schedule', '/e/devcon-2026/schedule'],
      ['Speaker gallery', '/e/devcon-2026/gallery'],
      ['CFP submit page', '/submit/devcon-2026'],
    ];

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(expectedRows.length);

    expectedRows.forEach(([name, path], i) => {
      const row = rows[i]!;
      expect(within(row).getByText(name)).toBeInTheDocument();
      expect(within(row).getByText(path)).toBeInTheDocument();
      expect(within(row).getByRole('link', { name: 'View' })).toHaveAttribute('href', path);
    });

    // No accepted submissions yet -> real, not hardcoded, not-published state.
    expect(within(rows[0]!).getByText('Not published yet')).toBeInTheDocument();
    // The gallery derives its state the same way as the other accepted-count surfaces.
    expect(within(rows[4]!).getByText('Not published yet')).toBeInTheDocument();
    // No CFP open/close window configured -> real, not hardcoded 'Open' state.
    expect(within(rows[5]!).getByText('Open')).toBeInTheDocument();
  });

  it('derives a live state from a real public-surface count, never a hardcoded string', async () => {
    mockEvent({ [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 6, speakers: 6, scheduled: 6 } });
    render(<PublicPagesPanel />);

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Live · 6 published')).toBeInTheDocument();
    // DEC-747: state pill tone is a NAMED class, not a copied color literal.
    expect(within(rows[0]!).getByText('Live · 6 published')).toHaveClass('chq-settings-public-pages-state-live');
  });

  it('DEC-767: Speakers and Sessions can show DIFFERENT numbers, sourced from different predicates', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 9, speakers: 3, scheduled: 2 },
    });
    render(<PublicPagesPanel />);

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem');
    // Sessions/Agenda/Schedule read the session count.
    expect(within(rows[0]!).getByText('Live · 9 published')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Live · 9 published')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Live · 9 published')).toBeInTheDocument();
    // Speakers/Gallery read the (different) speaker count.
    expect(within(rows[1]!).getByText('Live · 3 published')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('Live · 3 published')).toBeInTheDocument();
  });

  it('opens the existing EmbedsPanel builder from an Embed code control without replacing the list', async () => {
    mockEvent();
    render(<PublicPagesPanel />);

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { name: 'Embeds' })).not.toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Embed code' }));

    expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    // The list is still there beside the builder.
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});
