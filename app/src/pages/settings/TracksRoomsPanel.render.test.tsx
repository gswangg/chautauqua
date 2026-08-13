// w3-c/DEC-747 render smoke test: TracksRoomsPanel's read view is two
// columns (tracks with a real submission count per track, rooms with their
// capacity) with one 'Add' action that drills (URL state, DEC-728) into
// the existing add/rename/delete form.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel } from './TracksRoomsPanel';
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
      { id: 'trk1', name: 'AI Engineering', color: '#4f46e5' },
      { id: 'trk2', name: 'Platform', color: null },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([
      { id: 'rm1', name: 'Main Stage', capacity: 900 },
      { id: 'rm2', name: 'Workshop Lab', capacity: null },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 18 }),
    ...overrides,
  });
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

    const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
    await waitFor(() => {
      expect(within(section).getByText('AI Engineering')).toBeInTheDocument();
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(within(section).getByDisplayValue('AI Engineering')).toBeInTheDocument();
    });
    expect(within(section).getByPlaceholderText('New track name')).toBeInTheDocument();
    expect(within(section).getByPlaceholderText('New room name')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });
});
