// w3-d/DEC-747 read view; SummarySection adoption w6-e/DEC-815:
// YourDataPanel is a read-only summary (SummarySection) -- Exports, API
// tokens, API docs (link stays visible) and Import from Sessionboard --
// until the 'Change' action drills into (?section=your-data&edit=1) the
// live exports/tokens/import surfaces.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { YourDataPanel } from './YourDataPanel';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-your-data';

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

function mockYourData(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026' },
    'GET /api/v1/tokens': listEnvelope([]),
    ...overrides,
  });
}

describe('YourDataPanel', () => {
  // DEC-815 amendment (wave 4): the read view LISTS its sets at rest
  // (exports as real links, tokens as real rows) rather than describing
  // them in a sentence; only creation/import controls stay behind Change.
  it('renders a read-only summary that lists the real exports and tokens, with no creation/import control before edit', async () => {
    mockYourData({
      'GET /api/v1/tokens': listEnvelope([
        { id: 'tok-1', name: 'CI pipeline', tokenPrefix: 'chq_abc', lastUsedAt: null },
      ]),
    });
    render(
      <MemoryRouter>
        <YourDataPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Your data' });
    expect(within(section).getByRole('heading', { name: 'Your data' })).toBeInTheDocument();
    expect(within(section).getByText('Exports')).toBeInTheDocument();
    expect(within(section).getByText('API tokens')).toBeInTheDocument();
    expect(
      within(section).getByRole('link', { name: `${window.location.host}/docs/api` }),
    ).toHaveAttribute('href', '/docs/api');
    expect(within(section).getByText('Import from Sessionboard')).toBeInTheDocument();

    expect(within(section).getByRole('link', { name: 'Submissions CSV' })).toHaveAttribute(
      'href',
      `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
    );
    expect(within(section).getByRole('link', { name: 'Contacts CSV' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Everything, JSON' })).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'More export formats' })).not.toBeInTheDocument();

    expect(await within(section).findByText('CI pipeline')).toBeInTheDocument();
    expect(within(section).getByText('Last used: Never')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'New token' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();

    expect(
      within(section).queryByRole('button', { name: 'Import from Sessionboard' }),
    ).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('drills into the live exports/tokens/import surfaces via Change', async () => {
    mockYourData();
    render(
      <MemoryRouter>
        <YourDataPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Your data' });
    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(within(section).getByRole('link', { name: 'Submissions CSV' })).toHaveAttribute(
        'href',
        `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
      );
    });
    expect(within(section).getByRole('link', { name: 'Contacts CSV' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Everything, JSON' })).toBeInTheDocument();
    // DEC-728 amendment (wave 15): the section's OWN drill action relabels
    // to 'Back' rather than disappearing. DEC-785 amendment (wave 66): the
    // local summary/edit split ApiTokensPanel used to own is REMOVED --
    // ApiTokensPanel now mounts straight into its full create/revoke
    // surface, with no second 'Change' of its own.
    expect(within(section).getByRole('button', { name: 'Back' })).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Import from Sessionboard' }));
    expect(within(section).getByRole('heading', { name: 'Import from Sessionboard' })).toBeInTheDocument();
  });

  // DEC-815 (wave-41 amendment): 'Everything JSON' fails per kind, not per
  // bundle -- one refused kind must not vanish the other five.
  describe('Everything JSON per-kind failure', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      createObjectURLSpy = vi.fn(() => 'blob:mock-url');
      revokeObjectURLSpy = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });
      // Tag every Blob with the raw parts it was constructed from so the
      // test can read the bundle contents without depending on jsdom's
      // Blob#text() support.
      class TaggedBlob extends Blob {
        __parts: BlobPart[];
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          this.__parts = parts;
        }
      }
      vi.stubGlobal('Blob', TaggedBlob);
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    afterEach(() => {
      clickSpy.mockRestore();
    });

    it('downloads a bundle with the five successful kinds and names the refused kind with the server message', async () => {
      mockYourData({
        [`GET /api/v1/events/${EVENT_ID}/export/submissions`]: { rows: ['s'] },
        [`GET /api/v1/events/${EVENT_ID}/export/speakers`]: { rows: ['sp'] },
        [`GET /api/v1/events/${EVENT_ID}/export/evaluations`]: { rows: ['e'] },
        [`GET /api/v1/events/${EVENT_ID}/export/agenda`]: { rows: ['a'] },
        [`GET /api/v1/events/${EVENT_ID}/export/email-log`]: {
          status: 400,
          body: errorEnvelope('invalid', 'Too many rows to export (cap is 20000)'),
        },
        [`GET /api/v1/events/${EVENT_ID}/export/contacts`]: { rows: ['c'] },
      });
      render(
        <MemoryRouter>
          <YourDataPanel />
        </MemoryRouter>,
      );

      const section = await screen.findByRole('region', { name: 'Your data' });
      fireEvent.click(within(section).getByRole('button', { name: 'Everything, JSON' }));

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalled();
      });

      // A download still happened despite one kind failing.
      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArg = createObjectURLSpy.mock.calls[0]![0] as unknown as { __parts: string[] };
      const text = blobArg.__parts.join('');
      const bundle = JSON.parse(text) as Record<string, unknown>;
      expect(bundle.submissions).toEqual({ rows: ['s'] });
      expect(bundle.speakers).toEqual({ rows: ['sp'] });
      expect(bundle.evaluations).toEqual({ rows: ['e'] });
      expect(bundle.agenda).toEqual({ rows: ['a'] });
      expect(bundle.contacts).toEqual({ rows: ['c'] });
      expect(bundle['email-log']).toBeUndefined();
      expect(bundle._kinds).toEqual(['submissions', 'speakers', 'evaluations', 'agenda', 'contacts']);

      // The refused kind is named on screen with the server's own message.
      const note = within(section).getByText(/Too many rows to export \(cap is 20000\)/);
      expect(note.textContent).toContain('email-log');
      expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows a single error and downloads nothing when every kind refuses', async () => {
      const failBody = { status: 400, body: errorEnvelope('invalid', 'Export refused') };
      mockYourData({
        [`GET /api/v1/events/${EVENT_ID}/export/submissions`]: failBody,
        [`GET /api/v1/events/${EVENT_ID}/export/speakers`]: failBody,
        [`GET /api/v1/events/${EVENT_ID}/export/evaluations`]: failBody,
        [`GET /api/v1/events/${EVENT_ID}/export/agenda`]: failBody,
        [`GET /api/v1/events/${EVENT_ID}/export/email-log`]: failBody,
        [`GET /api/v1/events/${EVENT_ID}/export/contacts`]: failBody,
      });
      render(
        <MemoryRouter>
          <YourDataPanel />
        </MemoryRouter>,
      );

      const section = await screen.findByRole('region', { name: 'Your data' });
      fireEvent.click(within(section).getByRole('button', { name: 'Everything, JSON' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to build the combined export');
      expect(within(section).queryByRole('status')).not.toBeInTheDocument();
      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
});
