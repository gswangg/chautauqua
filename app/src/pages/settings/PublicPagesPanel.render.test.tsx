// w15-e/DEC-691 render smoke test, updated w6-e/DEC-815/DEC-816:
// PublicPagesPanel is now a read-only summary (SummarySection) -- one row
// per public surface with just its name and live state -- until the
// 'Change' action drills into (?section=public-pages&edit=1) the full row
// list (path, View link, Embed code control opening the existing
// EmbedsPanel builder, plus the saved-embeds list). DEC-816: Agenda and
// Schedule read counts.scheduled (not counts.sessions), so they can show a
// DIFFERENT number from the Sessions row.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
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
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
    ...overrides,
  });
}

describe('PublicPagesPanel', () => {
  it('renders a read-only summary row per public surface, with no path/View/Embed control before edit', async () => {
    mockEvent();
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => {
      expect(within(section).getByText('Sessions')).toBeInTheDocument();
    });

    ['Sessions', 'Speakers', 'Agenda', 'Schedule', 'Speaker gallery', 'CFP submit page'].forEach((name) => {
      expect(within(section).getByText(name)).toBeInTheDocument();
    });

    expect(within(section).queryByText('/e/devcon-2026/sessions')).not.toBeInTheDocument();
    expect(within(section).queryByRole('link', { name: 'View' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Embed code' })).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('DEC-816: Agenda and Schedule read the scheduled count, a DIFFERENT number from Sessions', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 9, speakers: 3, scheduled: 2 },
    });
    render(
      <MemoryRouter initialEntries={['/settings?section=public-pages&edit=1']}>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem');
    // Sessions reads the session count.
    expect(within(rows[0]!).getByText('Live · 9 published')).toBeInTheDocument();
    // Agenda/Schedule read the (different, and smaller) scheduled count --
    // never the session count, which would over-claim what a visitor sees.
    expect(within(rows[2]!).getByText('Live · 2 published')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Live · 2 published')).toBeInTheDocument();
    // Speakers/Gallery read the speaker count.
    expect(within(rows[1]!).getByText('Live · 3 published')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('Live · 3 published')).toBeInTheDocument();
  });

  it('drills into the full row list and Embed code control via the Change action', async () => {
    mockEvent();
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => {
      expect(within(section).getByText('Sessions')).toBeInTheDocument();
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(within(section).getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });
    expect(within(section).queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(6);
    expect(within(rows[0]!).getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/e/devcon-2026/sessions',
    );

    expect(screen.queryByRole('heading', { name: 'Embeds' })).not.toBeInTheDocument();
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Embed code' }));
    expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    // The list is still there beside the builder.
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});
