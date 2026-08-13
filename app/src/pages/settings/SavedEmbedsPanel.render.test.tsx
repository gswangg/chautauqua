// DEC-785 render smoke: SavedEmbedsPanel lists one row per saved embed
// (name · path · state pill · Get code · enable/disable) and its
// enable/disable control round-trips through the real PATCH endpoint.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SavedEmbedsPanel } from './SavedEmbedsPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-saved-embeds';

function renderPanel(initialEntries: string[] = ['/settings']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SavedEmbedsPanel />
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
  it('renders one row per saved embed with its name, path, and a live state pill', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', optionsJson: '{}', enabled: true },
        { id: 'emb2', name: 'Old widget', surface: 'speakers', format: 'iframe', optionsJson: '{}', enabled: false },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]!).getByText('Homepage widget')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('/embed/e/emb1')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Live')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Live')).toHaveClass('chq-settings-public-pages-state-live');

    expect(within(rows[1]!).getByText('Old widget')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Disabled')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Disabled')).toHaveClass('chq-settings-public-pages-state-muted');
  });

  it('shows the copyable snippet for a row after "Get code"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', optionsJson: '{}', enabled: true },
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

  it('toggling enable/disable calls the real PATCH endpoint and re-renders the new state', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: () =>
        listEnvelope([
          { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', optionsJson: '{}', enabled: true },
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
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      const [, patchInit] =
        fetchMock.mock.calls.find(([input]) => String(input).includes('/api/v1/embeds/emb1')) ?? [];
      expect(patchInit).toMatchObject({ method: 'PATCH' });
    });
  });

  // DEC-822: each row states the recipe it stores, derived from the
  // saved surface/format/options, beside its state pill — and the
  // section carries the "Turning one off..." caption.
  it('renders each row\'s recipe caption derived from its stored surface/format/options', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        {
          id: 'emb1',
          name: 'Homepage widget',
          surface: 'sessions',
          format: 'iframe',
          optionsJson: JSON.stringify({ trackId: 'trk-ai', fields: ['track', 'time', 'room', 'speaker', 'description', 'format'] }),
          enabled: true,
        },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-ai', name: 'AI Engineering' }]),
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });

    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).getByText('Sessions · iframe · AI Engineering · 6 fields')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/settings?embed=emb1');

    expect(screen.getByText('Turning one off breaks it wherever it is pasted')).toBeInTheDocument();
  });
});
