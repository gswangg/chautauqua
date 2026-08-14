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
  // w1-f, DEC-785: the read row is the frame's four columns -- name | path |
  // state pill | Embed code -- before any Change click. The View link and
  // the embed builder/saved-embeds list still live behind Change.
  it('renders the real four-column row (name, path, state, Embed code) at rest, before any Change click', async () => {
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

    expect(within(section).getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    expect(within(section).getAllByRole('button', { name: 'Embed code' }).length).toBeGreaterThan(0);
    expect(within(section).queryByRole('link', { name: 'View' })).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it("'Embed code' at rest drills into the edit view with the builder already open", async () => {
    mockEvent();
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => {
      expect(within(section).getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    fireEvent.click(within(section).getAllByRole('button', { name: 'Embed code' })[0]!);

    // DEC-728 amendment (wave 15): the section's OWN drill action becomes
    // 'Back' once editing -- it never disappears, since a drill with no
    // back is a 200 with no exit. SavedEmbedsPanel no longer mounts its own
    // local Change/Back toggle, so this is the only such action.
    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
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
    expect(within(section).getByRole('button', { name: 'Back' })).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(6);
    expect(within(rows[0]!).getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/e/devcon-2026/sessions',
    );

    // DEC-785 amendment (wave 15): editing implies the builder mounts --
    // entering the drill (via 'Change' or a bookmarked ?edit=1 URL) is
    // enough to render the embed builder, without a further 'Embed code'
    // click.
    expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    // The list is still there beside the builder.
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  // w4-b/DEC-785 amendment: SavedEmbedsPanel is the SAME component mounted
  // below the public-pages summary AT REST, not only once Change is
  // clicked -- a saved embed is a first-class object and belongs in the
  // read view.
  it('mounts SavedEmbedsPanel below the summary at rest, before any Change click', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      ]),
    });
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const publicPagesSection = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => {
      expect(within(publicPagesSection).getByText('Sessions')).toBeInTheDocument();
    });

    const savedEmbedsSection = await screen.findByRole('region', { name: 'Saved embeds' });
    expect(within(savedEmbedsSection).getByText('Homepage widget')).toBeInTheDocument();
    // The read-view summary never showed the Embeds builder heading.
    expect(screen.queryByRole('heading', { name: 'Embeds' })).not.toBeInTheDocument();
  });

  // w4-b/DEC-785 amendment: when the builder opens it renders BELOW the
  // saved-embeds list, not above it -- the builder is subordinate to the
  // list of named records it edits.
  it('renders the embed builder below the saved-embeds list once opened', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      ]),
    });
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Embed code' })[0]!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    });

    const savedEmbedsSection = screen.getByRole('region', { name: 'Saved embeds' });
    const builderSection = screen.getByRole('region', { name: 'Embeds' });
    const position = savedEmbedsSection.compareDocumentPosition(builderSection);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // DEC-728/DEC-785 amendment (wave 15): landing on the drilled edit URL
  // directly (a bookmark or a reload, not just a click) must render real
  // form controls, not the read-only summary rows -- editing implies the
  // embed builder mounts. There is exactly one 'Back' action for the whole
  // drill, and clicking it returns to the summary rows.
  it('GET ?section=public-pages&edit=1 renders real form controls with exactly one Back action', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      ]),
    });
    render(
      <MemoryRouter initialEntries={['/settings?section=public-pages&edit=1']}>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => {
      expect(within(section).getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    // Real form controls render inside the section without any further
    // click -- the embed builder is already mounted.
    await waitFor(() => {
      const controls = document.querySelectorAll('input, textarea, select');
      expect(controls.length).toBeGreaterThan(0);
    });

    // Exactly one Back action for the whole drill (SummarySection's own),
    // and no second Change/Back nested inside SavedEmbedsPanel.
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
    });
    expect(document.querySelectorAll('input, textarea, select').length).toBe(0);
  });
});
