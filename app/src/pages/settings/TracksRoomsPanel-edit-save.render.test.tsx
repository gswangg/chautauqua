// DEC-915/w21-a: the edit view's existing rows are local DRAFTs -- typing a
// track name or a room capacity issues zero writes; an explicit Save issues
// exactly one PATCH; Cancel restores the loaded value; a Done control
// clears the URL's drill state back to the summary.
//
// Custodian decomposition (contention hotspot): split out of
// TracksRoomsPanel.render.test.tsx -- the save/cancel/Done draft-lifecycle
// half of that suite. No behavior changed; every `it` below is verbatim
// from the pre-split file. Shared fixtures live in
// TracksRoomsPanel.render-helpers.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel } from './TracksRoomsPanel';
import { mockTracksRooms, openEdit } from './TracksRoomsPanel.render-helpers';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', 'evt-tracks-rooms');
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('TracksRoomsPanel edit/save lifecycle', () => {
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

  // G13 fix (frame 09--12, DESIGN-RULINGS error rules 8/11): Done must not
  // silently revert a dirty row -- it opens a confirm NAMING what will be
  // discarded; only the dialog's own primary discards and leaves, and its
  // Cancel keeps the draft on screen.
  it('Done with a dirty row opens a discard confirm naming the row; Cancel keeps the draft, the primary discards and leaves', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const nameInput = within(section).getByDisplayValue('AI Engineering');
    fireEvent.change(nameInput, { target: { value: 'AI Engineering v2' } });

    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialog = await screen.findByRole('dialog');
    // Names the row whose unsaved edit is at stake.
    expect(dialog).toHaveTextContent('AI Engineering');
    expect(within(dialog).getByRole('button', { name: 'Discard the edits' })).toBeInTheDocument();

    // Cancel: still editing, draft intact, no silent revert.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(section).getByDisplayValue('AI Engineering v2')).toBeInTheDocument();

    // Done again, this time confirming the discard: drafts reset and the
    // drill closes back to the summary.
    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialog2 = await screen.findByRole('dialog');
    fireEvent.click(within(dialog2).getByRole('button', { name: 'Discard the edits' }));
    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });
    expect(within(section).queryByDisplayValue('AI Engineering v2')).not.toBeInTheDocument();
  });

  // w22-c/DEC-896: tracks and rooms edit rows carry different column
  // counts, so each entity gets its own width hook applied alongside the
  // shared row class.
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

  // DEC-941 wave-107 amendment (a): closing the drill-in retires the whole
  // add-a-track pass -- a refusal raised by submitting the add form empty
  // must not survive a Done/re-enter round trip.
  it('Done retires the add-a-track form: a raised refusal is gone on re-entry', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));

    // Submitting empty raises the field refusal.
    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });

    // Done with nothing dirty and no unsaved add draft: no confirm, closes
    // straight to the summary.
    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    // Re-entering: the add form is closed and shows no refusal.
    fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(within(section).getByDisplayValue('AI Engineering')).toBeInTheDocument();
    });
    expect(within(section).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
    expect(within(section).queryAllByText('Required')).toHaveLength(0);
  });

  // DEC-941 wave-107 amendment (b): a typed-but-not-yet-added new track has
  // no saved name for dirtyRowNames to pick up, so it is its own arming
  // condition for the discard confirm -- the mirror of "a confirm with no
  // arming is the mirror of a delete with no confirm".
  it('typing a new track name with no dirty rows arms the discard confirm, naming the unsaved entry', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    const newTrackInput = within(section).getByPlaceholderText('New track name');
    fireEvent.change(newTrackInput, { target: { value: 'Keynotes' } });

    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Keynotes');
    expect(within(dialog).getByRole('button', { name: 'Discard the edits' })).toBeInTheDocument();

    // Cancel leaves the draft intact.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(section).getByDisplayValue('Keynotes')).toBeInTheDocument();

    // Discard drops the draft and closes the drill-in.
    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialog2 = await screen.findByRole('dialog');
    fireEvent.click(within(dialog2).getByRole('button', { name: 'Discard the edits' }));
    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });
    expect(within(section).queryByDisplayValue('Keynotes')).not.toBeInTheDocument();
  });
});
