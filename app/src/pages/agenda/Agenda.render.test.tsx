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

  // DEC-570: every placed session and every unscheduled tray card is a real
  // <button> reachable by role, not an invisible `div[draggable]`.
  it('resolves every placed card and the unscheduled tray card via getAllByRole("button")', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const names = buttons.map((b) => b.getAttribute('aria-label')).filter(Boolean);
    expect(names).toEqual(expect.arrayContaining(['S-001: Overlapping Talk A (conflict)', 'S-002: Overlapping Talk B (conflict)', 'S-003: Unplaced Talk']));
  });

  // DEC-570: clicking an unscheduled card arms it, revealing empty-cell
  // click-to-place buttons; clicking one fires the same PUT as drag-drop.
  it('arms a session by click and places it via a keyboard-operable cell button', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1 } } },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk' }));

    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();

    const placeButtons = screen.getAllByRole('button', { name: /^Place S-003 at \d{1,2}:\d{2}[ap]m in /i });
    expect(placeButtons.length).toBeGreaterThan(0);
    // TBD column reads "in TBD" specifically.
    expect(placeButtons.some((b) => b.getAttribute('aria-label')?.endsWith('in TBD'))).toBe(true);

    fireEvent.click(placeButtons[0]!);

    await waitFor(() => {
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled (0)');
    });
    // Placing bar is dismissed after placement.
    expect(screen.queryByText(/Placing S-003/)).toBeNull();
  });

  it('never renders the literal text "undefined" anywhere in the tree', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(document.body.textContent).not.toMatch(/undefined/);
  });
});

/** Minimal jsdom-safe MediaQueryList stand-in so useIsPhone's
 * `window.matchMedia('(max-width: 700px)')` subscription resolves to the
 * phone tree in these tests (DEC-380). jsdom does not implement
 * matchMedia at all, so AgendaPage's default (matchMedia undefined -> the
 * desktop tree) is what every other test in this file exercises; this
 * suite stubs it to force the phone split instead. */
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

describe('AgendaPage phone tap-to-place (DEC-380)', () => {
  it('renders the room chip strip with a CLASH flag and the phone slot list instead of the desktop day grid', async () => {
    stubPhoneMatchMedia();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(document.querySelector('.chq-day-grid')).toBeNull();
    expect(document.querySelector('.chq-phone-agenda')).not.toBeNull();

    const roomChip = screen.getByRole('button', { name: /Main Hall/ });
    expect(roomChip).toHaveClass('active');
    expect(roomChip.querySelector('.chq-flag')?.textContent).toBe('CLASH');

    // Overlapping A/B render as one merged clash run, not two placed cards.
    expect(screen.getByText('Two sessions in this slot')).toBeInTheDocument();
  });

  it('arms an unscheduled session from the sheet, places it on tap, and fires the same PUT as desktop drag-drop', async () => {
    stubPhoneMatchMedia();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1 } } },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Unscheduled 1/ }));
    expect(screen.getByRole('dialog', { name: 'Unscheduled sessions' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Unplaced Talk'));

    // Sheet closes, footer shows the armed session, and a free run is now a
    // tap target (it only renders while armed).
    expect(screen.queryByRole('dialog', { name: 'Unscheduled sessions' })).toBeNull();
    expect(screen.getByText('Placing · tap a free slot')).toBeInTheDocument();
    const freeTargets = screen.getAllByText('Place here');
    expect(freeTargets.length).toBeGreaterThan(0);

    fireEvent.click(freeTargets[0]!);

    await waitFor(() => {
      expect(screen.queryByText('Placing · tap a free slot')).toBeNull();
    });
    // sub-3 moved out of the unscheduled sheet trigger's count.
    expect(screen.getByRole('button', { name: /Unscheduled 0/ })).toBeInTheDocument();
  });
});
