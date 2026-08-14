// EMB-15 / DEC-289 render smoke test: mounts EmbedsPanel against a mocked
// event fetch and asserts the live snippet reacts to format + knob changes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmbedsPanel } from './EmbedsPanel';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

function renderPanel(initialEntries: string[] = ['/settings']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <EmbedsPanel />
    </MemoryRouter>,
  );
}

const EVENT_ID = 'evt-embeds-render';

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

function mockEvent() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
      { id: 'trk-42', name: 'Keynotes', color: null },
      { id: 'trk-99', name: 'Workshops', color: null },
    ]),
  });
}

describe('EmbedsPanel', () => {
  it('renders the default iframe snippet for the sessions surface', async () => {
    mockEvent();
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/^<iframe/)).toBeInTheDocument();

    // Re-skin (w2-f, DEC-368): one shared .chq-btn-primary per section, and
    // form controls use the shared .chq-select/.chq-input classes.
    // DEC-822: Save is now the section's one primary action; Copy snippet
    // (like Copy URL) is demoted to secondary.
    expect(screen.getByRole('button', { name: 'Save embed' })).toHaveClass('chq-btn-primary');
    expect(screen.getByRole('button', { name: 'Copy snippet' })).toHaveClass('chq-btn-secondary');
    expect(screen.getByLabelText('Surface')).toHaveClass('chq-select');
    expect(screen.getByRole('combobox', { name: 'Track' })).toHaveClass('chq-select');
  });

  it('announces a successful copy via the live status region (DEC-607)', async () => {
    mockEvent();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    // DEC-822: Save's own status region now shares role="status", so scope
    // to the copy-specific one by its class (chq-copy-status).
    const status = screen.getAllByRole('status').find((el) => el.classList.contains('chq-copy-status'))!;
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('');

    fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));

    await waitFor(() => {
      expect(status).toHaveTextContent('Copied');
    });
  });

  it('announces a failed copy and exposes the text in a focusable manual-copy field', async () => {
    mockEvent();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));

    const status = screen.getAllByRole('status').find((el) => el.classList.contains('chq-copy-status'))!;
    await waitFor(() => {
      expect(status).toHaveTextContent('Copy failed — select the text and copy it manually');
    });

    const manualField = screen.getByLabelText('Snippet to copy manually') as HTMLInputElement;
    expect(manualField).toHaveFocus();
  });

  it('updates the snippet when the format changes to link', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Format' }), { target: { value: 'link' } });

    await waitFor(() => {
      expect(screen.getByText(/^<a href=/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^<iframe/)).not.toBeInTheDocument();
  });

  it('reflects a trackId knob in the live URL, and drops it back out when cleared (DEC-659: a select of track names, never a typed ULID)', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    const trackSelect = (await screen.findByRole('combobox', { name: 'Track' })) as HTMLSelectElement;
    expect(Array.from(trackSelect.options).map((o) => o.textContent)).toEqual([
      '(all tracks)',
      'Keynotes',
      'Workshops',
    ]);

    fireEvent.change(trackSelect, { target: { value: 'trk-42' } });
    await waitFor(() => {
      expect(screen.getAllByText(/trackId=trk-42/).length).toBeGreaterThan(0);
    });

    fireEvent.change(trackSelect, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryAllByText(/trackId=/).length).toBe(0);
    });
  });

  // w41-h/DEC-785: FIELDS SHOWN is one row of aria-pressed toggle pills
  // (chq-chipstrip/chq-pill), not six stacked checkbox rows -- the
  // selected-fields state and what it writes into the URL are unchanged.
  it('drops the fields param when a field pill is toggled off then back on to the full default set', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    const speakerPill = screen.getByRole('button', { name: 'Speaker' });
    expect(speakerPill).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(speakerPill);
    await waitFor(() => {
      expect(screen.getAllByText(/fields=track%2Ctime%2Croom%2Cdescription%2Cformat/).length).toBeGreaterThan(0);
    });
    expect(speakerPill).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(speakerPill);
    await waitFor(() => {
      expect(screen.queryAllByText(/fields=/).length).toBe(0);
    });
    expect(speakerPill).toHaveAttribute('aria-pressed', 'true');
  });

  // w41-h/DEC-785: Preview opens the SAME url the snippet embeds (never a
  // second URL builder) in a new tab, beside Save changes and Copy snippet.
  it('offers a Preview link that opens the same URL the snippet embeds, in a new tab', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    const preview = screen.getByRole('link', { name: 'Preview' });
    expect(preview).toHaveAttribute('target', '_blank');
    expect(preview).toHaveAttribute('rel', 'noreferrer');
    const [urlText] = screen.getAllByText(/embed\/devcon-2026\/sessions/);
    expect(preview.getAttribute('href')).toBe(urlText!.textContent);
  });

  it('offers ics only for agenda/schedule surfaces', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    const formatSelect = screen.getByRole('combobox', { name: 'Format' }) as HTMLSelectElement;
    expect(Array.from(formatSelect.options).map((o) => o.value)).not.toContain('ics');

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'agenda' } });
    await waitFor(() => {
      expect(Array.from(formatSelect.options).map((o) => o.value)).toContain('ics');
    });
  });

  // DEC-490/DEC-634: the builder only renders controls for knobs the
  // selected surface actually honors, per DEC-489's surface->knob table
  // (DEC-634 made `day` a real predicate on sessions too).
  it('shows the Day control for sessions (DEC-634) but hides it for speakers', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText('Day')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'speakers' } });
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/speakers/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Day')).not.toBeInTheDocument();
  });

  // DEC-851: agenda honors trackId as a real SQL predicate now (the server
  // no longer silently ignores it), so its knob table keeps the Track
  // control alongside Day rather than hiding it.
  it('keeps the Track control for the agenda surface, alongside Day', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('combobox', { name: 'Track' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'agenda' } });
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/agenda/).length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('combobox', { name: 'Track' })).toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
  });

  // DEC-851: agenda/schedule now honor trackId too (they no longer belong to
  // the "ignores it" group) — speakers/gallery are the surfaces whose knob
  // table still drops trackId, so this leak check moves to one of those.
  // DEC-990 (wave-67 amendment): trackId is now a real facet on speakers/
  // gallery too (not sessions-only), so switching sessions -> speakers must
  // KEEP a set trackId rather than drop it. roomId remains sessions-only
  // (DEC-774), so it is the knob that must still be dropped on that switch.
  it('never leaks a stale roomId into the URL after switching to a surface that ignores it, but keeps trackId', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    fireEvent.change(await screen.findByRole('combobox', { name: 'Track' }), { target: { value: 'trk-42' } });
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-1' } });
    await waitFor(() => {
      expect(screen.getAllByText(/trackId=trk-42/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/roomId=room-1/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'speakers' } });
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/speakers/).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/roomId=/).length).toBe(0);
    expect(screen.getAllByText(/trackId=trk-42/).length).toBeGreaterThan(0);
  });

  it('reflects a q knob in the live URL for sessions', async () => {
    mockEvent();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ai ethics' } });
    await waitFor(() => {
      expect(screen.getAllByText(/q=ai\+ethics/).length).toBeGreaterThan(0);
    });
  });

  // DEC-822: Save writes the FULL current knob set as the embed's options
  // via POST when there's no ?embed= in the URL (a brand-new saved embed).
  it('Save posts the full current knob set as options when creating a new embed', async () => {
    mockEvent();
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', name: 'DevCon 2026' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-42', name: 'Keynotes', color: null }]),
      [`POST /api/v1/events/${EVENT_ID}/embeds`]: { id: 'emb-new', name: 'Homepage widget' },
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Homepage widget' } });
    fireEvent.change(await screen.findByRole('combobox', { name: 'Track' }), { target: { value: 'trk-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save embed' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) =>
        String(input).includes(`/api/v1/events/${EVENT_ID}/embeds`),
      );
      expect(call).toBeDefined();
      const [, init] = call!;
      expect(init).toMatchObject({ method: 'POST' });
      const body = JSON.parse(String(init!.body));
      expect(body).toMatchObject({
        name: 'Homepage widget',
        surface: 'sessions',
        format: 'iframe',
        options: { trackId: 'trk-42' },
      });
    });
  });

  // DEC-822: opened at ?embed=<id>, the builder loads that row's saved
  // recipe, heads itself 'Editing · <name>', and Save PATCHes it.
  it('loads a saved embed at ?embed=<id>, heads itself "Editing · <name>", and Save PATCHes it', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', name: 'DevCon 2026' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-42', name: 'Keynotes', color: null }]),
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
        {
          id: 'emb-1',
          name: 'Homepage widget',
          surface: 'speakers',
          format: 'json',
          options: { q: 'ai', limit: 5 },
          enabled: true,
        },
      ]),
      [`PATCH /api/v1/embeds/emb-1`]: { id: 'emb-1', name: 'Homepage widget' },
    });
    renderPanel([`/settings?embed=emb-1`]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Editing · Homepage widget' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Homepage widget');
    expect(screen.getByLabelText('Surface')).toHaveValue('speakers');
    expect(screen.getByLabelText('Search')).toHaveValue('ai');

    // DEC-822/DEC-839: in edit mode the primary action is 'Save changes'
    // and Copy snippet stays secondary.
    const saveButton = screen.getByRole('button', { name: 'Save changes' });
    expect(saveButton).toHaveClass('chq-btn-primary');
    expect(screen.getByRole('button', { name: 'Copy snippet' })).toHaveClass('chq-btn-secondary');

    fireEvent.click(saveButton);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => String(input).includes('/api/v1/embeds/emb-1'));
      expect(call).toBeDefined();
      const [, init] = call!;
      expect(init).toMatchObject({ method: 'PATCH' });
      const body = JSON.parse(String(init!.body));
      // DEC-839: PATCH carries the FULL current knob set (surface, format,
      // options) alongside name -- never just name/enabled.
      expect(body).toMatchObject({
        name: 'Homepage widget',
        surface: 'speakers',
        format: 'json',
        options: { q: 'ai', limit: 5 },
      });
    });
  });
});
