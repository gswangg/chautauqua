// w15-e/DEC-691 render smoke test. DEC-896 amendment (wave 26, B10 DROP):
// PublicPagesPanel has NO edit view any more -- the read row already
// carries every value AND every action (name, path, state, View, Embed
// code), so there is no 'Change'/'Back' gate anywhere in this panel, and
// SavedEmbedsPanel renders its full capability set (Edit/Turn on-off/
// Delete/Build) unconditionally instead of behind a drill.
//
// DEC-896 amendment (wave 20): the section head also carries the frame's
// consequence micro-label right-flushed on the h2's rule.
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
  // DEC-896 (B10 DROP): the read row is the frame's full row -- name, path,
  // state pill, View, Embed code -- rendered immediately, with no gate.
  it('renders the full row (name, path, state, View, Embed code) with no Change gate', async () => {
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

    ['Sessions', 'Speakers', 'Agenda', 'Schedule and ICS', 'Speaker gallery', 'CFP submit page'].forEach((name) => {
      expect(within(section).getByText(name)).toBeInTheDocument();
    });

    expect(within(section).getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    expect(within(section).getAllByRole('button', { name: 'Embed code' }).length).toBeGreaterThan(0);
    const viewLinks = within(section).getAllByRole('link', { name: 'View' });
    expect(viewLinks.length).toBe(6);
    expect(viewLinks[0]).toHaveAttribute('href', '/e/devcon-2026/sessions');

    // The gate is gone entirely -- no Change, no Back, anywhere in the panel.
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it("'Embed code' opens the builder directly, with no drill to enter first", async () => {
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

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('DEC-816: Agenda and Schedule read the scheduled count, a DIFFERENT number from Sessions', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 9, speakers: 3, scheduled: 2 },
    });
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem').filter((el) => el.classList.contains('chq-settings-public-pages-row'));
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

  // w4-b/DEC-785: SavedEmbedsPanel is the SAME component mounted below the
  // public-pages rows, and (DEC-896, B10 DROP) it now renders its full
  // Edit/Turn on-off/Delete capability set unconditionally -- there is no
  // drill left to gate it behind.
  it('mounts SavedEmbedsPanel below the rows with its full action set, unconditionally', async () => {
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
    expect(within(savedEmbedsSection).getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(within(savedEmbedsSection).getByRole('button', { name: 'Turn off' })).toBeInTheDocument();
    expect(within(savedEmbedsSection).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(savedEmbedsSection).getByRole('button', { name: 'New embed' })).toBeInTheDocument();
    // The rows render, but the builder heading itself only mounts once opened.
    expect(screen.queryByRole('heading', { name: 'Embeds' })).not.toBeInTheDocument();
  });

  // w4-b/DEC-785: when the builder opens it renders BELOW the saved-embeds
  // list, not above it -- the builder is subordinate to the list of named
  // records it edits.
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

  // DEC-822: SavedEmbedsPanel's own Edit link opens the builder at
  // ?embed=<id> -- that still has to mount the builder even with no drill
  // wrapping it any more.
  it('a bookmarked ?embed=<id> URL renders the builder directly', async () => {
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      ]),
    });
    render(
      <MemoryRouter initialEntries={['/settings?embed=emb1']}>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    });
  });

  // DEC-896 amendment (wave 20): the section head names the consequence of
  // unpublishing, right-flushed on the same rule as the h2.
  it('renders the unpublishing consequence caption on the section head', async () => {
    mockEvent();
    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Public pages' });
    expect(within(section).getByText('Unpublishing returns 404 to anyone holding the link')).toBeInTheDocument();
  });

  // Eval D16 / DEC-700: the writer that creates a saved embed is EmbedsPanel,
  // a sibling of SavedEmbedsPanel. SavedEmbedsPanel's read was a fetch-once
  // effect keyed on eventId alone, so after Save the list and its
  // "N on · M off" count kept describing the state before the organiser's
  // last action until a full page reload. The successful POST bumps the
  // module-level mutation counter in api.ts and the list re-reads.
  it("re-reads the saved-embed list and its count after a save in the sibling builder", async () => {
    let embedGets = 0;
    mockEvent({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: () => {
        embedGets += 1;
        return listEnvelope(
          embedGets === 1
            ? [{ id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true }]
            : [
                { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
                { id: 'emb2', name: 'Sidebar widget', surface: 'sessions', format: 'iframe', options: {}, enabled: false },
              ],
        );
      },
      [`POST /api/v1/events/${EVENT_ID}/embeds`]: {
        status: 201,
        body: { id: 'emb2', name: 'Sidebar widget', surface: 'sessions', format: 'iframe', options: {}, enabled: false },
      },
    });

    render(
      <MemoryRouter>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const savedSection = await screen.findByRole('region', { name: 'Saved embeds' });
    await waitFor(() => {
      expect(within(savedSection).getByText('1 on · 0 off')).toBeInTheDocument();
    });
    expect(within(savedSection).queryByText('Sidebar widget')).not.toBeInTheDocument();

    const publicPagesSection = screen.getByRole('region', { name: 'Public pages' });
    fireEvent.click(within(publicPagesSection).getAllByRole('button', { name: 'Embed code' })[0]!);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. Homepage sessions widget'), {
      target: { value: 'Sidebar widget' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save embed' }));

    // The list re-reads with no reload: the new row and the recomputed
    // count, which is the half a stale list hides most quietly.
    await waitFor(() => {
      expect(within(savedSection).getByText('Sidebar widget')).toBeInTheDocument();
    });
    expect(within(savedSection).getByText('1 on · 1 off')).toBeInTheDocument();
  });
});
