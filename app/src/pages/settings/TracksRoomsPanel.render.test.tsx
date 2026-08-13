// w3-c/DEC-747 render smoke test: TracksRoomsPanel's read view is two
// columns (tracks with a real submission count per track, rooms with their
// capacity) with one 'Add' action that drills (URL state, DEC-728) into
// the existing add/rename/delete form.
//
// DEC-915/w21-a: the edit view's existing rows are local DRAFTs -- typing a
// track name or a room capacity issues zero writes; an explicit Save issues
// exactly one PATCH; Cancel restores the loaded value; a Done control
// clears the URL's drill state back to the summary.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel, TRACK_SWATCHES } from './TracksRoomsPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

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
      { id: 'rm1', name: 'Main Stage', capacity: 900 },
      { id: 'rm2', name: 'Workshop Lab', capacity: null },
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

  it('drills into the existing add/rename/delete form via the Add action', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    expect(within(section).getByPlaceholderText('New track name')).toBeInTheDocument();
    expect(within(section).getByPlaceholderText('New room name')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
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
    expect(within(actionsCell as HTMLElement).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

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
      within(mainStageRow.querySelector('.chq-settings-edit-row-meta') as HTMLElement).getByDisplayValue('900'),
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
});
