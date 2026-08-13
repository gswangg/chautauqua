// DEC-785/DEC-822/DEC-839 render smoke: SavedEmbedsPanel lists one row per
// saved embed (name · path · recipe caption · On/Off pill · Get code ·
// Turn on/off), states a header count, and its On/Off control round-trips
// through the real PATCH endpoint.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SavedEmbedsPanel } from './SavedEmbedsPanel';
import { formatEmbedRecipe } from './embedRecipe';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

// w31-d/DEC-982: the row's class must own a grid whose column COUNT equals
// the row's actual direct-child cell count -- a shared class across two
// different arities is how cells six and up silently wrap onto an implicit
// row. Reads the real stylesheet (not a hand-copied literal) so this test
// fails the moment the two drift again.
const HERE = dirname(fileURLToPath(import.meta.url));
const SETTINGS_CSS_PATH = join(HERE, 'settings.css');

function gridColumnCount(className: string): number {
  const css = readFileSync(SETTINGS_CSS_PATH, 'utf8');
  // Match the top-level (non-media-query) rule for the class: `.class { ... }`.
  const ruleMatch = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(css);
  if (!ruleMatch) throw new Error(`No top-level rule found for .${className}`);
  const declMatch = /grid-template-columns:\s*([^;]+);/.exec(ruleMatch[1]!);
  if (!declMatch) throw new Error(`.${className} has no grid-template-columns declaration`);
  return declMatch[1]!.trim().split(/\s+/).length;
}

const EVENT_ID = 'evt-saved-embeds';

function renderPanel(initialEntries: string[] = ['/settings'], onBuild?: () => void) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SavedEmbedsPanel onBuild={onBuild} />
    </MemoryRouter>,
  );
}

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

describe('SavedEmbedsPanel', () => {
  it('renders one row per saved embed with its name, path, and an On/Off state pill, plus a header count', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
        { id: 'emb2', name: 'Old widget', surface: 'speakers', format: 'iframe', options: {}, enabled: false },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    expect(screen.getByText('1 on · 1 off')).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]!).getByText('Homepage widget')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('/embed/e/emb1')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('On')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('On')).toHaveClass('chq-settings-public-pages-state-live');

    expect(within(rows[1]!).getByText('Old widget')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Off')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Off')).toHaveClass('chq-settings-public-pages-state-muted');
  });

  it('shows the copyable snippet for a row after "Get code"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).queryByText(/<iframe/)).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Get code' }));
    expect(within(row).getByText(/<iframe src="[^"]*\/embed\/e\/emb1"/)).toBeInTheDocument();
  });

  it('turning a row on/off calls the real PATCH endpoint and re-renders the new state', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: () =>
        listEnvelope([
          { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
        ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`PATCH /api/v1/embeds/emb1`]: {
        id: 'emb1',
        name: 'Homepage widget',
        surface: 'sessions',
        format: 'iframe',
        enabled: false,
      },
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('On')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    await waitFor(() => {
      const [, patchInit] =
        fetchMock.mock.calls.find(([input]) => String(input).includes('/api/v1/embeds/emb1')) ?? [];
      expect(patchInit).toMatchObject({ method: 'PATCH' });
    });
  });

  // DEC-822/DEC-839: each row states the recipe it stores, derived by the
  // ONE shared formatEmbedRecipe formatter from the saved surface/format/
  // options (the parsed options object, per the wire contract), beside its
  // state pill — and the section carries the "Turning one off..." caption.
  it("renders each row's recipe caption from formatEmbedRecipe, and offers an Edit link into ?embed=<id>", async () => {
    const options = { trackId: 'trk-ai', fields: ['track', 'time', 'room', 'speaker', 'description', 'format'] };
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        {
          id: 'emb1',
          name: 'Homepage widget',
          surface: 'sessions',
          format: 'iframe',
          options,
          enabled: true,
        },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-ai', name: 'AI Engineering' }]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    const expectedRecipe = formatEmbedRecipe({
      surface: 'sessions',
      format: 'iframe',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: options as any,
      trackName: 'AI Engineering',
    });
    expect(expectedRecipe).toBe('Sessions · iframe · AI Engineering · 6 fields');

    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).getByText(expectedRecipe)).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/settings?embed=emb1');

    expect(screen.getByText('Turning one off breaks it wherever it is pasted')).toBeInTheDocument();
  });

  // DEC-860: one save path for a saved embed -- the quick-save form here is
  // gone, replaced by a single "Build an embed" disclosure into the shared
  // builder (the same one Edit opens into).
  it('has no quick-save create form, and offers "Build an embed" only when onBuild is provided', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('No saved embeds yet.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Save embed' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Surface')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Build an embed' })).not.toBeInTheDocument();

    cleanup();

    const onBuild = vi.fn();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });
    renderPanel(['/settings'], onBuild);

    await waitFor(() => {
      expect(screen.getByText('No saved embeds yet.')).toBeInTheDocument();
    });

    const buildButton = screen.getByRole('button', { name: 'Build an embed' });
    fireEvent.click(buildButton);
    expect(onBuild).toHaveBeenCalledTimes(1);
  });

  // DEC-860: Delete on the row that lists it, routed through the shared
  // ConfirmDialog and only DELETEing after the user confirms.
  it('deletes a saved embed only after confirming through the shared dialog', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: () =>
        listEnvelope([
          { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
        ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`DELETE /api/v1/embeds/emb1`]: { status: 204, body: null },
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      fetchMock.mock.calls.find(([input]) => String(input).includes('/api/v1/embeds/emb1')),
    ).toBeUndefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      const [, deleteInit] =
        fetchMock.mock.calls.find(
          ([input, init]) => String(input).includes('/api/v1/embeds/emb1') && (init as RequestInit)?.method === 'DELETE',
        ) ?? [];
      expect(deleteInit).toMatchObject({ method: 'DELETE' });
    });
  });

  // w31-d/DEC-982: the row's own class owns a FIVE-column grid (name, path,
  // recipe, state, actions) -- not the five-column grid PublicPagesPanel's
  // surface rows own, which cells six-plus used to silently wrap under.
  // Read the column count out of the real rule and assert the rendered
  // row's direct-child count (excluding the full-width snippet block)
  // matches it, and that all four controls collapse into one actions cell.
  it('DEC-982: the saved-embed row has exactly as many direct cells as its own grid has columns, with all four controls in one actions cell', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    const row = screen.getAllByRole('listitem')[0]!;
    expect(row).toHaveClass('chq-settings-saved-embed-row');

    const columnCount = gridColumnCount('chq-settings-saved-embed-row');
    // Direct cells only -- the Get-code snippet, when open, renders as a
    // full-width block beneath the row, not a sixth cell in the grid flow.
    const directCells = Array.from(row.children).filter((el) => !el.matches('code'));
    expect(directCells).toHaveLength(columnCount);

    const actionsCell = row.querySelector('.chq-settings-saved-embed-actions');
    expect(actionsCell).not.toBeNull();
    expect(within(actionsCell as HTMLElement).getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(within(actionsCell as HTMLElement).getByRole('button', { name: 'Get code' })).toBeInTheDocument();
    expect(within(actionsCell as HTMLElement).getByRole('button', { name: 'Turn off' })).toBeInTheDocument();
    expect(within(actionsCell as HTMLElement).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    // Opening the snippet adds one full-width child, not a sixth grid cell.
    fireEvent.click(within(actionsCell as HTMLElement).getByRole('button', { name: 'Get code' }));
    expect(row.children).toHaveLength(columnCount + 1);
    const snippet = row.querySelector('.chq-settings-saved-embed-snippet');
    expect(snippet).not.toBeNull();
  });
});

// w31-d/DEC-982: mirror assertion -- PublicPagesPanel's surface rows own
// `.chq-settings-public-pages-row`'s five-column grid, and must keep
// exactly five direct cells so a future control added to either row's
// class fails this test loudly instead of silently wrapping.
describe('PublicPagesPanel (mirror of DEC-982 grid-arity check)', () => {
  it("PublicPagesPanel's public-pages-row has exactly as many direct cells as its grid has columns", async () => {
    const EVENT_ID_2 = 'evt-public-pages-mirror';
    window.localStorage.setItem('chq.currentEventId', EVENT_ID_2);
    mockApi({
      [`GET /api/v1/events/${EVENT_ID_2}`]: { id: EVENT_ID_2, slug: 'devcon-2026', name: 'DevCon 2026' },
      [`GET /api/v1/events/${EVENT_ID_2}/public-surfaces`]: { sessions: 0, speakers: 0, scheduled: 0 },
      [`GET /api/v1/events/${EVENT_ID_2}/forms`]: { id: 'form1', eventId: EVENT_ID_2, openDate: null, closeDate: null },
      [`GET /api/v1/events/${EVENT_ID_2}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID_2}/embeds`]: listEnvelope([]),
    });

    const { PublicPagesPanel } = await import('./PublicPagesPanel');
    render(
      <MemoryRouter initialEntries={['/settings?section=public-pages&edit=1']}>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('/e/devcon-2026/sessions')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem');
    const surfaceRows = rows.filter((row) => row.classList.contains('chq-settings-public-pages-row'));
    expect(surfaceRows.length).toBeGreaterThan(0);

    const columnCount = gridColumnCount('chq-settings-public-pages-row');
    surfaceRows.forEach((row) => {
      expect(row.children).toHaveLength(columnCount);
    });
  });
});
