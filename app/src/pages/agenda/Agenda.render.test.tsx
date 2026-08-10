// DEC-144 layer-2 harness for the Agenda SPA (app/src/pages/Agenda.tsx):
// mounts the real AgendaPage against mocked fetch shaped like the real
// GET .../agenda envelope (DEC-021), with two OVERLAPPING placed sessions in
// the same room -- both must render as separate cards (no de-dup / silent
// drop), plus the unscheduled tray and a conflict chip surfacing the
// room_overlap between them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AgendaPage } from '../Agenda';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-agenda-render';

function agendaPayload() {
  return {
    days: ['2026-06-01'],
    rooms: [{ id: 'room-1', name: 'Main Hall' }],
    tracks: [{ id: 'track-1', name: 'Keynotes', color: '#336699' }],
    placed: [
      {
        submissionId: 'sub-1',
        ref: 'S-001',
        title: 'Overlapping Talk A',
        trackIds: ['track-1'],
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
        roomId: 'room-1',
        day: '2026-06-01',
        startMin: 600,
        endMin: 660,
      },
      {
        submissionId: 'sub-2',
        ref: 'S-002',
        title: 'Overlapping Talk B',
        trackIds: [],
        speakers: [],
        roomId: 'room-1',
        day: '2026-06-01',
        startMin: 630,
        endMin: 690,
      },
    ],
    unscheduled: [
      {
        submissionId: 'sub-3',
        ref: 'S-003',
        title: 'Unplaced Talk',
        trackIds: [],
        speakers: [],
      },
    ],
    conflicts: [
      {
        kind: 'room_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        detail: 'Overlapping Talk A and Overlapping Talk B overlap in Main Hall.',
      },
    ],
    summary: { unplaced: 1, conflicts: 1 },
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('AgendaPage render smoke', () => {
  it('renders two overlapping slots in one room, the unscheduled tray, and a conflict chip', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);

    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();

    // Both overlapping placed sessions render as distinct cards.
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
      expect(screen.getByText('Overlapping Talk B')).toBeInTheDocument();
    });

    // Unscheduled tray with its count and the unplaced session.
    expect(screen.getByText('Unscheduled (1)')).toBeInTheDocument();
    expect(screen.getByText('Unplaced Talk')).toBeInTheDocument();

    // Conflict chip surfaces on the overlapping cards (room_overlap -> "Room").
    const chips = screen.getAllByText('⚠ Room conflict');
    expect(chips.length).toBe(2);
  });
});
