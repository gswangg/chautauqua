// DEC-505/DEC-931 (wave-55 task-w55-b): src/server/repo/events.ts's
// deleteTrack (:461-547) throws FIVE distinct 409 wordings -- "Track is
// referenced by one or more submissions" (:461), "...by a form's track
// selection" (:477), "...by an evaluation plan's track filter" (:483),
// "...by a reviewer's track scope" (:500), "...by a saved embed" (:526) --
// and deleteRoom (:710-748) throws TWO -- "Room is referenced by one or
// more schedule slots" (:710), "...by a saved embed" (:741). Each carries a
// `fields` map (submissions/form/plans/reviewers/embeds/slots) whose value
// names the blocking rows the producer needs in order to act. This proves
// every one of the seven server wordings actually reaches the failing
// row's DOM (never collapsed to the generic panel-level err.message), not
// just the one shape (plans) TracksRoomsPanel.render.test.tsx already
// covers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel } from './TracksRoomsPanel';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-tracks-rooms-refusals';

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

function mockBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
      { id: 'trk1', name: 'AI Engineering', color: '#4f46e5', submissionCount: 0 },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Stage', capacity: 900, sessionCount: 0 }]),
    ...overrides,
  });
}

async function openEdit() {
  const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
  fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
  await screen.findByDisplayValue('AI Engineering');
  return section;
}

// DEC-941: Remove opens the shared ConfirmDialog naming the track/room
// first -- these helpers also drive the dialog's own confirm control so
// the DELETE this suite's mocks expect actually fires.
async function removeTrack(section: HTMLElement) {
  const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
  const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
  fireEvent.click(within(trackRow).getByRole('button', { name: 'Remove' }));
  const dialog = await screen.findByRole('dialog', { name: 'Remove this track?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
  return trackRow;
}

async function removeRoom(section: HTMLElement) {
  const roomNameInput = within(section).getByLabelText('Room name for Main Stage');
  const roomRow = roomNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
  fireEvent.click(within(roomRow).getByRole('button', { name: 'Remove' }));
  const dialog = await screen.findByRole('dialog', { name: 'Remove this room?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
  return roomRow;
}

describe('TracksRoomsPanel track-delete refusal shapes (DEC-931/DEC-505)', () => {
  it("'referenced by one or more submissions' names each blocking submission, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/tracks/trk1': {
        status: 409,
        body: errorEnvelope('conflict', 'Track is referenced by one or more submissions', {
          submissions: 'S1 - Intro to Rust',
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const trackRow = await removeTrack(section);

    expect(await within(trackRow).findByText('S1 - Intro to Rust')).toBeInTheDocument();
    expect(within(trackRow).queryByText('Track is referenced by one or more submissions')).not.toBeInTheDocument();
  });

  it("'referenced by a form's track selection' names the form, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/tracks/trk1': {
        status: 409,
        body: errorEnvelope('conflict', "Track is referenced by a form's track selection", {
          form: '2026 Call for Papers',
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const trackRow = await removeTrack(section);

    expect(await within(trackRow).findByText('2026 Call for Papers')).toBeInTheDocument();
    expect(within(trackRow).queryByText("Track is referenced by a form's track selection")).not.toBeInTheDocument();
  });

  it("'referenced by an evaluation plan's track filter' names the plan, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/tracks/trk1': {
        status: 409,
        body: errorEnvelope('conflict', "Track is referenced by an evaluation plan's track filter", {
          plans: 'AI track review',
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const trackRow = await removeTrack(section);

    expect(await within(trackRow).findByText('AI track review')).toBeInTheDocument();
    expect(
      within(trackRow).queryByText("Track is referenced by an evaluation plan's track filter"),
    ).not.toBeInTheDocument();
  });

  it("'referenced by a reviewer's track scope' names the reviewer, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/tracks/trk1': {
        status: 409,
        body: errorEnvelope('conflict', "Track is referenced by a reviewer's track scope", {
          reviewers: "pat@example.com in 'AI track review'",
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const trackRow = await removeTrack(section);

    expect(await within(trackRow).findByText("pat@example.com in 'AI track review'")).toBeInTheDocument();
    expect(within(trackRow).queryByText("Track is referenced by a reviewer's track scope")).not.toBeInTheDocument();
  });

  it("'referenced by a saved embed' (track) names the embed, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/tracks/trk1': {
        status: 409,
        body: errorEnvelope('conflict', 'Track is referenced by a saved embed', {
          embeds: 'Homepage widget',
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const trackRow = await removeTrack(section);

    expect(await within(trackRow).findByText('Homepage widget')).toBeInTheDocument();
    expect(within(trackRow).queryByText('Track is referenced by a saved embed')).not.toBeInTheDocument();
  });
});

describe('TracksRoomsPanel room-delete refusal shapes (DEC-931/DEC-505)', () => {
  it("'referenced by one or more schedule slots' names each blocking session, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/rooms/rm1': {
        status: 409,
        body: errorEnvelope('conflict', 'Room is referenced by one or more schedule slots', {
          slots: 'S1 - Intro to Rust (Wed 12, 10:00, Main Stage)',
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const roomRow = await removeRoom(section);

    expect(await within(roomRow).findByText('S1 - Intro to Rust (Wed 12, 10:00, Main Stage)')).toBeInTheDocument();
    expect(within(roomRow).queryByText('Room is referenced by one or more schedule slots')).not.toBeInTheDocument();
  });

  it("'referenced by a saved embed' (room) names the embed, not the sentence", async () => {
    mockBase({
      'DELETE /api/v1/rooms/rm1': {
        status: 409,
        body: errorEnvelope('conflict', 'Room is referenced by a saved embed', {
          embeds: 'Homepage widget',
        }),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    const roomRow = await removeRoom(section);

    expect(await within(roomRow).findByText('Homepage widget')).toBeInTheDocument();
    expect(within(roomRow).queryByText('Room is referenced by a saved embed')).not.toBeInTheDocument();
  });

  it('a field-less delete ApiError still renders the generic sentence', async () => {
    mockBase({
      'DELETE /api/v1/tracks/trk1': {
        status: 500,
        body: errorEnvelope('internal', 'Failed to delete track'),
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );
    const section = await openEdit();
    await removeTrack(section);

    expect(await screen.findByText('Failed to delete track')).toBeInTheDocument();
  });
});
