// DEC-941: deleteTrack/deleteRoom are irreversible, so Remove opens the
// shared ConfirmDialog naming the track/room first -- the DELETE only
// fires from the dialog's own confirm control, never straight off the
// row button (BreaksPanel.render.test.tsx:165 is the pattern). DEC-896:
// a track/room with in-use references gets Remove disabled proactively.
//
// Custodian decomposition (contention hotspot): split out of
// TracksRoomsPanel.render.test.tsx -- the Remove/delete-confirmation half
// of that suite. No behavior changed; every `it` below is verbatim from
// the pre-split file. Shared fixtures live in
// TracksRoomsPanel.render-helpers.ts. (The distinct multi-shape 409-wording
// coverage lives in the sibling TracksRoomsPanel-refusal-shapes.render.test.tsx.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel } from './TracksRoomsPanel';
import { listEnvelope } from '../../test-utils/mockApi';
import { EVENT_ID, mockTracksRooms, openEdit } from './TracksRoomsPanel.render-helpers';

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

describe('TracksRoomsPanel remove/delete confirmation', () => {
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
});
