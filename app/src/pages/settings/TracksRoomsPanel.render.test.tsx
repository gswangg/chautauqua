// w3-c/DEC-747 render smoke test: TracksRoomsPanel's read view is two
// columns (tracks with a real submission count per track, rooms with their
// capacity) with one 'Add' action that drills (URL state, DEC-728) into
// the existing add/rename/delete form.
//
// DEC-915/w21-a: the edit view's existing rows are local DRAFTs -- typing a
// track name or a room capacity issues zero writes; an explicit Save issues
// exactly one PATCH; Cancel restores the loaded value; a Done control
// clears the URL's drill state back to the summary.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel, TRACK_SWATCHES } from './TracksRoomsPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const SETTINGS_CSS = readFileSync(join(HERE, 'settings.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector -- same helper as FilterRulesPanel.render.test.tsx. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const EVENT_ID = 'evt-tracks-rooms';

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

function mockTracksRooms(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
      { id: 'trk1', name: 'AI Engineering', color: '#4f46e5', submissionCount: 18 },
      { id: 'trk2', name: 'Platform', color: null, submissionCount: 18 },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([
      { id: 'rm1', name: 'Main Stage', capacity: 900, sessionCount: 0 },
      { id: 'rm2', name: 'Workshop Lab', capacity: null, sessionCount: 0 },
    ]),
    ...overrides,
  });
}

async function openEdit() {
  const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
  fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
  await waitFor(() => {
    expect(within(section).getByDisplayValue('AI Engineering')).toBeInTheDocument();
  });
  return section;
}

describe('TracksRoomsPanel', () => {
  it('renders a read-only two-column summary with real per-track submission counts and room capacities', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
    expect(within(section).getByRole('heading', { name: 'Tracks and rooms' })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(section).getAllByText('18 submissions')).toHaveLength(2);
    });
    expect(within(section).getByText('900 seats')).toBeInTheDocument();
    expect(within(section).getByText('No capacity set')).toBeInTheDocument();

    // Read view: no editable inputs yet.
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
  });

  // DEC-747 amendment (wave 53): the caption-less row hosting the two-column
  // grid must carry the full-bleed row modifier -- otherwise the grid's
  // width:100% resolves against the 170px/1fr/auto row's narrower value
  // cell (settings.css:892), not the 820px settings column.
  it('hosts the tracks-and-rooms grid in a single-column full-bleed row', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
    const grid = section.querySelector('.chq-settings-tracks-rooms-grid')!;
    const hostingRow = grid.closest('.chq-settings-row')!;
    expect(hostingRow).toHaveClass('chq-settings-row-full');

    const body = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row-full');
    expect(body).toMatch(/grid-template-columns:\s*1fr\s*;/);
  });

  it('drills into the existing add/rename/delete form via the Add action, with the add rows revealed from each section head', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    expect(within(section).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();

    // w4-e/DEC-815: the add form isn't open by default -- it's revealed by
    // a tertiary action on each section's own head.
    expect(within(section).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
    expect(within(section).queryByPlaceholderText('New room name')).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Add a track' }));
    expect(within(section).getByPlaceholderText('New track name')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Add a room' }));
    expect(within(section).getByPlaceholderText('New room name')).toBeInTheDocument();
  });

  it('gives each section a head with its live count and exactly one filled primary in the whole edit view (DEC-815 amendment)', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    expect(within(section).getByText('Tracks · 2')).toBeInTheDocument();
    expect(within(section).getByText('Rooms · 2')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add a track' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add a room' })).toBeInTheDocument();

    expect(section.querySelectorAll('.chq-btn-primary')).toHaveLength(1);
    expect(within(section).getByRole('button', { name: 'Done' })).toHaveClass('chq-btn-primary');
  });

  it('renders the edit view with the settings vocabulary: no browser bullets, actions never inside a value cell, and a swatch-picker default matching TRACK_SWATCHES[0]', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();

    // Track/room lists carry the list-style:none class rather than bare <ul>.
    const lists = section.querySelectorAll('ul.chq-settings-edit-list');
    expect(lists.length).toBe(2);

    // A row's action (Delete) is a SIBLING of the value cell, never nested
    // inside it -- so it can never collide with the value text.
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')!;
    expect(trackRow).not.toBeNull();
    const valueCell = trackRow.querySelector('.chq-settings-edit-row-value')!;
    const actionsCell = trackRow.querySelector('.chq-settings-edit-row-actions')!;
    expect(valueCell.contains(actionsCell)).toBe(false);
    expect(actionsCell.parentElement).toBe(trackRow);
    expect(within(actionsCell as HTMLElement).getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    // A room's capacity renders as its own input in the meta column, not a
    // parenthetical in the name.
    const roomNameInput = within(section).getByLabelText('Room name for Main Stage');
    const mainStageRow = roomNameInput.closest('.chq-settings-edit-row')!;
    expect(
      within(mainStageRow.querySelector('.chq-settings-edit-row-value') as HTMLElement).getByDisplayValue(
        'Main Stage',
      ),
    ).toBeInTheDocument();
    expect(
      within(mainStageRow.querySelector('.chq-settings-edit-row-seats') as HTMLElement).getByDisplayValue('900'),
    ).toBeInTheDocument();

    // The existing AI Engineering row's own radiogroup reflects its loaded
    // color (#4f46e5 isn't one of the enumerated swatches, so nothing is
    // checked); the Platform row (null color) checks TRACK_SWATCHES[0] --
    // and no bare <input type="color"> remains anywhere.
    const platformInput = within(section).getByLabelText('Track name for Platform');
    const platformRow = platformInput.closest('.chq-settings-edit-row')!;
    const swatchGroup = within(platformRow as HTMLElement).getByRole('radiogroup', {
      name: 'Track color for Platform',
    });
    const options = within(swatchGroup).getAllByRole('radio');
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
    expect(options[0]).toHaveStyle({ background: TRACK_SWATCHES[0].value });
    expect(section.querySelector('input[type="color"]')).not.toBeInTheDocument();
  });

  it('typing five characters into a track name issues zero writes; one Save issues exactly one PATCH', async () => {
    const fetchMock = mockTracksRooms({
      'PATCH /api/v1/tracks/trk1': { name: 'AI Engineering Pro', color: '#4f46e5' },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const callsBeforeTyping = fetchMock.mock.calls.length;

    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    fireEvent.change(trackNameInput, { target: { value: 'AI Engineering Pro' } });

    // Five characters were appended; not one non-GET request was issued.
    const nonGetCallsAfterTyping = fetchMock.mock.calls.filter(([, init]) => {
      const method = (init as RequestInit | undefined)?.method;
      return method && method.toUpperCase() !== 'GET';
    });
    expect(nonGetCallsAfterTyping).toHaveLength(0);
    expect(fetchMock.mock.calls.length).toBe(callsBeforeTyping); // no request at all while typing

    // Dirty row reveals Save/Cancel.
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')!;
    const saveButton = within(trackRow as HTMLElement).getByRole('button', { name: 'Save' });
    within(trackRow as HTMLElement).getByRole('button', { name: 'Cancel' });

    fireEvent.click(saveButton);

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([url, init]) => {
        const path = typeof url === 'string' ? url : (url as URL).toString();
        return path.includes('/api/v1/tracks/trk1') && (init as RequestInit | undefined)?.method === 'PATCH';
      });
      expect(patchCalls).toHaveLength(1);
    });
  });

  it('Cancel restores the loaded track name and hides Save/Cancel', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    fireEvent.change(trackNameInput, { target: { value: 'Something else' } });

    const trackRow = trackNameInput.closest('.chq-settings-edit-row')!;
    fireEvent.click(within(trackRow as HTMLElement).getByRole('button', { name: 'Cancel' }));

    expect((trackNameInput as HTMLInputElement).value).toBe('AI Engineering');
    expect(within(trackRow as HTMLElement).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('a room capacity edit round-trips through exactly one PATCH', async () => {
    const fetchMock = mockTracksRooms({
      'PATCH /api/v1/rooms/rm1': { name: 'Main Stage', capacity: 1200 },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const capacityInput = within(section).getByLabelText('Capacity for Main Stage');
    fireEvent.change(capacityInput, { target: { value: '1200' } });

    const roomRow = capacityInput.closest('.chq-settings-edit-row')!;
    fireEvent.click(within(roomRow as HTMLElement).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([url, init]) => {
        const path = typeof url === 'string' ? url : (url as URL).toString();
        return path.includes('/api/v1/rooms/rm1') && (init as RequestInit | undefined)?.method === 'PATCH';
      });
      expect(patchCalls).toHaveLength(1);
      const [, init] = patchCalls[0]!;
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ name: 'Main Stage', capacity: 1200 });
    });
  });

  it('a blank room capacity sends null on save', async () => {
    const fetchMock = mockTracksRooms({
      'PATCH /api/v1/rooms/rm1': { name: 'Main Stage', capacity: null },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const capacityInput = within(section).getByLabelText('Capacity for Main Stage');
    fireEvent.change(capacityInput, { target: { value: '' } });

    const roomRow = capacityInput.closest('.chq-settings-edit-row')!;
    fireEvent.click(within(roomRow as HTMLElement).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([url, init]) => {
        const path = typeof url === 'string' ? url : (url as URL).toString();
        return path.includes('/api/v1/rooms/rm1') && (init as RequestInit | undefined)?.method === 'PATCH';
      });
      expect(patchCalls).toHaveLength(1);
      const [, init] = patchCalls[0]!;
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ name: 'Main Stage', capacity: null });
    });
  });

  // DEC-896 amendment (wave 26): a track with submissions has its Remove
  // disabled proactively, so this reactive-refusal path (DEC-931) is
  // exercised through a track with zero submissions that is instead
  // referenced by an evaluation plan's track filter -- a second, server-only
  // blocker Remove can't pre-empt client-side.
  it('a delete refusal renders the fields list under the failing row (DEC-931)', async () => {
    mockTracksRooms({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
        { id: 'trk1', name: 'AI Engineering', color: '#4f46e5', submissionCount: 0 },
        { id: 'trk2', name: 'Platform', color: null, submissionCount: 18 },
      ]),
      'DELETE /api/v1/tracks/trk1': {
        status: 409,
        body: {
          error: {
            code: 'conflict',
            message: "Track is referenced by an evaluation plan's track filter",
            fields: { plans: 'AI track review' },
          },
        },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    const removeButton = within(trackRow).getByRole('button', { name: 'Remove' });
    expect(removeButton).not.toBeDisabled();
    fireEvent.click(removeButton);

    // DEC-941: Remove opens the shared ConfirmDialog naming the track
    // first -- the DELETE only fires from the dialog's own confirm control.
    const dialog = screen.getByRole('dialog', { name: 'Remove this track?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove track' }));

    await waitFor(() => {
      expect(within(trackRow).getByText('AI track review')).toBeInTheDocument();
    });
  });

  // DEC-941: deleteTrack/deleteRoom are irreversible, so Remove opens the
  // shared ConfirmDialog naming the track/room first -- the DELETE only
  // fires from the dialog's own confirm control, never straight off the
  // row button (BreaksPanel.render.test.tsx:165 is the pattern).
  it('track Remove asks for confirmation naming the track, then DELETEs and reloads', async () => {
    const fetchMock = mockTracksRooms({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
        { id: 'trk1', name: 'AI Engineering', color: '#4f46e5', submissionCount: 0 },
      ]),
      'DELETE /api/v1/tracks/trk1': { status: 200, body: { deleted: 1 } },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    fireEvent.click(within(trackRow).getByRole('button', { name: 'Remove' }));

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'),
    ).toBe(false);
    const dialog = await screen.findByRole('dialog', { name: 'Remove this track?' });
    expect(within(dialog).getByText(/AI Engineering/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove track' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            (init as RequestInit | undefined)?.method === 'DELETE' && String(url).includes('/tracks/trk1'),
        ),
      ).toBe(true);
    });
  });

  it('cancelling the track Remove confirmation fires no DELETE and keeps the track', async () => {
    const fetchMock = mockTracksRooms({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
        { id: 'trk1', name: 'AI Engineering', color: '#4f46e5', submissionCount: 0 },
      ]),
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    fireEvent.click(within(trackRow).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove this track?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Remove this track?' })).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'),
    ).toBe(false);
    expect(within(section).getByLabelText('Track name for AI Engineering')).toBeInTheDocument();
  });

  it('room Remove asks for confirmation naming the room, then DELETEs and reloads', async () => {
    const fetchMock = mockTracksRooms({
      [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([
        { id: 'rm1', name: 'Main Stage', capacity: 900, sessionCount: 0 },
      ]),
      'DELETE /api/v1/rooms/rm1': { status: 200, body: { deleted: 1 } },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const roomNameInput = within(section).getByLabelText('Room name for Main Stage');
    const roomRow = roomNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    fireEvent.click(within(roomRow).getByRole('button', { name: 'Remove' }));

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'),
    ).toBe(false);
    const dialog = await screen.findByRole('dialog', { name: 'Remove this room?' });
    expect(within(dialog).getByText(/Main Stage/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove room' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            (init as RequestInit | undefined)?.method === 'DELETE' && String(url).includes('/rooms/rm1'),
        ),
      ).toBe(true);
    });
  });

  it('Remove is disabled (not hidden), with a visible reason, on a track that has submissions', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    const removeButton = within(trackRow).getByRole('button', { name: 'Remove' });
    expect(removeButton).toBeDisabled();
    expect(within(trackRow).getByText(/In use/)).toBeInTheDocument();
  });

  it('Remove is disabled (not hidden), with a visible reason, on a room that has scheduled sessions', async () => {
    mockTracksRooms({
      [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([
        { id: 'rm1', name: 'Main Stage', capacity: 900, sessionCount: 3 },
        { id: 'rm2', name: 'Workshop Lab', capacity: null, sessionCount: 0 },
      ]),
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const roomNameInput = within(section).getByLabelText('Room name for Main Stage');
    const roomRow = roomNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    const removeButton = within(roomRow).getByRole('button', { name: 'Remove' });
    expect(removeButton).toBeDisabled();
    expect(within(roomRow).getByText(/scheduled sessions/)).toBeInTheDocument();

    const workshopInput = within(section).getByLabelText('Room name for Workshop Lab');
    const workshopRow = workshopInput.closest('.chq-settings-edit-row')! as HTMLElement;
    expect(within(workshopRow).getByRole('button', { name: 'Remove' })).not.toBeDisabled();
  });

  // DEC-888 (wave 64 amendment): one caption for the tracks edit section
  // naming what the colour is for, not one per row.
  it('renders one caption naming what the track colour is for', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const captions = within(section).getAllByText(/how a track reads on the agenda and the public pages/);
    expect(captions).toHaveLength(1);
  });

  it('renders the consequence line naming what Remove and Seats mean (DEC-896/B10)', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    await openEdit();
    expect(
      screen.getByText(
        'A track in use cannot be removed — retire it. Seats are advisory: the agenda flags over-capacity but never blocks.',
      ),
    ).toBeInTheDocument();
  });

  // DEC-856 (wave 65 amendment): a track/room refusal's fields map is read
  // by shape -- name/color/capacity route to their OWN control, keyed by
  // the row being edited, so a refusal on one row never marks a sibling.
  it('a track save refusal marks only the row being edited, not a sibling row', async () => {
    mockTracksRooms({
      'PATCH /api/v1/tracks/trk1': {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message: 'Invalid track',
            fields: { color: 'Must be a hex color like #336699' },
          },
        },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    fireEvent.change(trackNameInput, { target: { value: 'AI Engineering Pro' } });
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    fireEvent.click(within(trackRow).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(trackRow).getAllByText('Must be a hex color like #336699').length).toBeGreaterThan(0);
    });
    // The color control on the failing row is marked invalid...
    const colorGroup = within(trackRow).getByRole('radiogroup', { name: 'Track color for AI Engineering' });
    expect(colorGroup).toHaveAttribute('id', 'chq-track-color-trk1');

    // ...and the sibling row (Platform) carries no error at all.
    const platformInput = within(section).getByLabelText('Track name for Platform');
    const platformRow = platformInput.closest('.chq-settings-edit-row')! as HTMLElement;
    expect(within(platformRow).queryByText('Must be a hex color like #336699')).not.toBeInTheDocument();
  });

  it('a "Required" refusal on the add-room form marks the name input and anchors from the ErrorSummary', async () => {
    mockTracksRooms({
      'POST /api/v1/events/evt-tracks-rooms/rooms': {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid room', fields: { name: 'Required' } } },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getByRole('button', { name: 'Add a room' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Add room' }));

    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });
    const nameInput = within(section).getByPlaceholderText('New room name');
    expect(nameInput).toHaveAttribute('id', 'chq-new-room-name');
    expect(nameInput).toHaveClass('chq-field-invalid');

    const summaryLink = within(section).getByRole('link', { name: 'Required' });
    expect(summaryLink).toHaveAttribute('href', '#chq-new-room-name');
  });

  // DEC-856 amendment (wave 69): the page-level banner is a REFUSAL, not a
  // sticky log -- a write handler clears it as its first statement, so a
  // successful Add that follows a failed one never renders beside a stale
  // error.
  it('clears the page-level error banner on a write that succeeds after one that failed', async () => {
    let calls = 0;
    const fetchMock = mockTracksRooms({
      [`POST /api/v1/events/${EVENT_ID}/tracks`]: () => {
        calls += 1;
        if (calls === 1) {
          return { status: 500, body: { error: { code: 'internal', message: 'Server exploded' } } };
        }
        return { status: 200, body: { id: 'trk-new', name: 'New Track', color: '#4338ca', submissionCount: 0 } };
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getByRole('button', { name: 'Add a track' }));
    fireEvent.change(within(section).getByPlaceholderText('New track name'), {
      target: { value: 'New Track' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server exploded');
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST'))
        .toHaveLength(2);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // DEC-856 (wave 65): a fields-map refusal never collapses into the
  // page-level banner -- it routes to the per-field control (and the
  // ErrorSummary anchor) instead, so the two error surfaces never fire for
  // the same refusal.
  it('a fields-map refusal routes to the per-field control, never the page-level banner', async () => {
    mockTracksRooms({
      [`POST /api/v1/events/${EVENT_ID}/rooms`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid room', fields: { name: 'Required' } } },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getByRole('button', { name: 'Add a room' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Add room' }));

    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });
    const nameInput = within(section).getByPlaceholderText('New room name');
    expect(nameInput).toHaveClass('chq-field-invalid');
    // The page-level banner (a bare <p role="alert">, distinct from the
    // per-field <span role="alert">s) never fires for a fields-map refusal.
    expect(section.querySelector('p[role="alert"]')).not.toBeInTheDocument();
  });

  it('Done clears the URL drill state and returns to the read-only summary', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });
    expect(within(section).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
  });

  it('the tracks-and-rooms columns split the full 820px measure as two even halves with counts right-flushed (DEC-781)', () => {
    const gridBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-tracks-rooms-grid');
    expect(gridBody).toMatch(/display:\s*grid/);
    expect(gridBody).toMatch(/grid-template-columns:\s*1fr 1fr/);

    const rowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-tracks-rooms-row');
    expect(rowBody).toMatch(/display:\s*grid/);
    // name column flexes, the count/capacity column is auto-sized and
    // right-flushed against the row's own end -- not centered, not left.
    expect(rowBody).toMatch(/grid-template-columns:\s*1fr auto/);
  });

  it('hosts the tracks-and-rooms grid inside a .chq-settings-row that itself collapses to one full-width column (DEC-747/DEC-781)', () => {
    const fullRowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row-full');
    expect(fullRowBody).toMatch(/grid-template-columns:\s*1fr/);
  });

  // w22-c/DEC-896: tracks and rooms edit rows carry different column
  // counts, so the shared .chq-settings-edit-row class no longer owns a
  // grid-template-columns of its own -- each entity gets its own width hook.
  it('.chq-settings-edit-row declares no grid-template-columns of its own (shared chrome only)', () => {
    const rowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-edit-row');
    expect(rowBody).toMatch(/display:\s*grid/);
    expect(rowBody).not.toMatch(/grid-template-columns/);
  });

  it('.chq-settings-track-edit-row reproduces the frame\'s tracks columns minus the non-functional drag handle (1fr 150px auto)', () => {
    const body = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-track-edit-row');
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*150px\s*auto/);
  });

  it('.chq-settings-room-edit-row reproduces the frame\'s rooms columns minus the non-functional drag handle (1fr 110px 150px auto)', () => {
    const body = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-room-edit-row');
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*110px\s*150px\s*auto/);
  });

  it('applies the track and room width hooks alongside the shared row class', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')!;
    expect(trackRow).toHaveClass('chq-settings-track-edit-row');

    const roomNameInput = within(section).getByLabelText('Room name for Main Stage');
    const roomRow = roomNameInput.closest('.chq-settings-edit-row')!;
    expect(roomRow).toHaveClass('chq-settings-room-edit-row');
  });
});

describe('DEC-781: .chq-settings-row is ONE grid row, not a column stack', () => {
  it('settings.css declares .chq-settings-row exactly once at the top level (no dead duplicate a source-scan or the cascade could silently prefer)', () => {
    const withoutMedia = SETTINGS_CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
    const matches = withoutMedia.match(/(^|\n)\.chq-settings-row\s*\{/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the row is a three-column definition grid (label | value | right-flushed meta), not a flex column stack', () => {
    const rowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row');
    expect(rowBody).toMatch(/display:\s*grid/);
    expect(rowBody).not.toMatch(/flex-direction:\s*column/);
    expect(rowBody).toMatch(/grid-template-columns:\s*170px 1fr auto/);
  });

  it('the meta (hint) column right-flushes its content so it collapses to nothing when absent', () => {
    const hintBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row-hint');
    expect(hintBody).toMatch(/text-align:\s*right/);
  });
});
