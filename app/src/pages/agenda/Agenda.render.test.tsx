// DEC-144 layer-2 harness for the Agenda SPA (app/src/pages/Agenda.tsx):
// mounts the real AgendaPage against mocked fetch shaped like the real
// GET .../agenda envelope (DEC-021), with two OVERLAPPING placed sessions in
// the same room -- both must render as separate cards (no de-dup / silent
// drop), plus the unscheduled tray and a conflict chip surfacing the
// room_overlap between them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AgendaPage } from '../Agenda';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-agenda-render';

/** Minimal jsdom-safe DataTransfer stand-in: jsdom does not implement the
 * real DataTransfer, and the drag-drop handlers under test only ever call
 * getData/setData, so a small Map-backed fake is sufficient. */
class FakeDataTransfer {
  private store = new Map<string, string>();
  effectAllowed = 'move';
  setData(format: string, data: string) {
    this.store.set(format, data);
  }
  getData(format: string) {
    return this.store.get(format) ?? '';
  }
}

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
  // Explicit unmount/cleanup: this suite's ambient test-runner detection of
  // `afterEach` for testing-library's auto-cleanup is not reliably wired up
  // (three tests in this file previously bled DOM trees into each other —
  // stale cards from an earlier test's render made later `getByText`/
  // `getAllByText` queries match duplicates), so cleanup is called
  // explicitly to guarantee test isolation regardless.
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('AgendaPage render smoke', () => {
  it('renders two overlapping slots in one room, the unscheduled tray, and a conflict caption', async () => {
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

    // Conflicted cards invert (ink/on-ink) with the caption, not a chip
    // (DEC-367/369 redesign: no red, lateness/clash are type not colour).
    const captions = screen.getAllByText('Two sessions in one room');
    expect(captions.length).toBe(2);
  });

  it('renders a conflicted cell inverted to ink/on-ink with its caption', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const cardA = document.querySelector('[data-submission-id="sub-1"]');
    const cardB = document.querySelector('[data-submission-id="sub-2"]');
    expect(cardA).toHaveClass('chq-session-card-conflict');
    expect(cardB).toHaveClass('chq-session-card-conflict');
    expect(cardA).toHaveAttribute('data-conflict', 'true');

    expect(cardA?.querySelector('.chq-conflict-caption')?.textContent).toBe('Two sessions in one room');
    expect(cardB?.querySelector('.chq-conflict-caption')?.textContent).toBe('Two sessions in one room');
  });

  // Regression for a live-browser finding (task-w3-e): DayGrid renders
  // placed SessionCards as full-coverage CSS grid items sitting directly on
  // top of their cell(s). Before this fix, those cards had no onDrop
  // handler of their own, so a real mouse drop landing on an
  // already-occupied card's DOM node (which `elementFromPoint` confirmed is
  // what actually receives the drop, not the grid cell underneath) was
  // silently swallowed — an organizer could never drag a session onto an
  // occupied slot to intentionally create a warn-never-block conflict
  // (SPEC J9 / DEC-010). This drops directly on the *card* element (not a
  // `.chq-day-grid-cell`), which only passes with the SessionCard
  // onDragOver/onDrop wiring in place.
  it('accepts a drop directly on an already-occupied placed card (not just the empty cell beneath it)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 2 } } },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // sub-3 ("Unplaced Talk") starts in the unscheduled tray.
    expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled (1)');

    // Drop it directly onto sub-1's already-placed card element.
    const occupiedCard = document.querySelector('[data-submission-id="sub-1"].chq-day-grid-placed-card');
    expect(occupiedCard).not.toBeNull();

    const dt = new FakeDataTransfer();
    dt.setData('text/plain', 'sub-3');
    dt.setData('application/x-chq-duration-min', '30');

    fireEvent.dragOver(occupiedCard as Element, { dataTransfer: dt });
    fireEvent.drop(occupiedCard as Element, { dataTransfer: dt });

    // The drop must have reached DayGrid's handler and fired the PUT — the
    // tray count drops as sub-3 is optimistically placed.
    await waitFor(() => {
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled (0)');
    });
  });
});
