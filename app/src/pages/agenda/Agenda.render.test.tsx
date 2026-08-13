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
    unplacedReasons: [],
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

    // DEC-742: a same-room clash of exactly two sessions merges into ONE
    // inverted card sharing a single caption, not two separately-captioned
    // cards.
    const captions = screen.getAllByText('Two sessions in one room');
    expect(captions.length).toBe(1);
  });

  it('renders a same-room two-session clash as one merged inverted card with both titles uncropped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const cardA = document.querySelector('[data-submission-id="sub-1"]');
    const cardB = document.querySelector('[data-submission-id="sub-2"]');
    expect(cardA).toHaveClass('chq-day-grid-clash-item');
    expect(cardB).toHaveClass('chq-day-grid-clash-item');
    expect(cardA).toHaveAttribute('data-conflict', 'true');

    // DEC-742: ONE merged card (not two), inverted to ink/on-ink, holding
    // both sessions and a single shared caption — no red chip (DEC-367).
    const clashCard = cardA?.closest('.chq-day-grid-clash-card');
    expect(clashCard).not.toBeNull();
    expect(clashCard).toBe(cardB?.closest('.chq-day-grid-clash-card'));
    expect(clashCard?.querySelector('.chq-day-grid-clash-caption')?.textContent).toBe('Two sessions in one room');

    // Both titles render in full within the merged card — not clipped by a
    // line-clamp/overflow rule the way an ordinary short card's content can
    // be.
    expect(clashCard?.textContent).toContain('Overlapping Talk A');
    expect(clashCard?.textContent).toContain('Overlapping Talk B');
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

    // Drop it directly onto sub-1's already-placed card element (DEC-742:
    // sub-1/sub-2 overlap in the same room, so sub-1 now renders as one of
    // the two stacked items inside a merged clash card rather than its own
    // full .chq-day-grid-placed-card — the drop still bubbles up to the
    // merged card's onDrop handler).
    const occupiedCard = document.querySelector('[data-submission-id="sub-1"].chq-day-grid-clash-item');
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
    expect(names).toEqual(expect.arrayContaining(['S-001: Overlapping Talk A (conflict)', 'S-002: Overlapping Talk B (conflict)', 'S-003: Unplaced Talk — click to select, then choose a time slot']));
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

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));

    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();

    // DEC-724: the room-less column only appears while armed here (the
    // seeded day has no roomless placement), and its header/accessible-name
    // copy is "No room yet", never "TBD".
    expect(screen.getByText('No room yet')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bTBD\b/);

    const placeButtons = screen.getAllByRole('button', { name: /^Place S-003 at \d{1,2}:\d{2}[ap]m in /i });
    expect(placeButtons.length).toBeGreaterThan(0);
    const roomlessButton = placeButtons.find((b) => b.getAttribute('aria-label')?.endsWith('in No room yet'));
    expect(roomlessButton).toBeDefined();

    fireEvent.click(roomlessButton!);

    await waitFor(() => {
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled (0)');
    });
    // Placing bar is dismissed after placement.
    expect(screen.queryByText(/Placing S-003/)).toBeNull();

    // DEC-724: focus moves to the just-placed session's own cell.
    expect(document.activeElement).toBe(document.querySelector('[data-submission-id="sub-3"]'));
  });

  // DEC-595: publish toast names all three counts and only mentions
  // held-back sessions when there actually are some (AIA-S2-D1 regression —
  // the old toast lied by reporting the placement count as "public").
  it('publish toast names the held-back count when heldBack > 0', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/publish`]: { placed: 14, public: 12, heldBack: 2 },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Schedule live — 12 of 14 placed sessions are public. 2 held back: content not approved.')).toBeInTheDocument();
    });
  });

  it('publish toast omits the held-back sentence when heldBack is 0', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/publish`]: { placed: 14, public: 14, heldBack: 0 },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Schedule live — 14 of 14 placed sessions are public.')).toBeInTheDocument();
    });
    expect(screen.queryByText(/held back/)).toBeNull();
  });

  // DEC-667/SPEC J9: the scheduler warns, never blocks. The toast must not
  // read as though this run created the reported conflicts, and it must
  // mention a positive placement count only when the run left conflicts
  // pre-existing.
  it('auto-schedule toast states pre-existing conflicts were left in place, not caused by this run', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/auto-schedule`]: {
        ...agendaPayload(),
        unscheduled: [],
        unplacedReasons: [],
        summary: { unplaced: 0, conflicts: 1 },
      },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto-schedule' }));

    await waitFor(() => {
      expect(
        screen.getByText('Auto-schedule placed 1 session(s). 0 unplaced. 1 pre-existing conflict(s) left in place.'),
      ).toBeInTheDocument();
    });
  });

  // DEC-667: when a run places nothing, the toast must name why from the
  // typed unplacedReasons the run computed, never report a bare "0
  // session(s)" as though nothing needed explaining.
  it('auto-schedule toast names why when the run places nothing', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/auto-schedule`]: {
        ...agendaPayload(),
        summary: { unplaced: 1, conflicts: 1 },
        unplacedReasons: [
          { submissionId: 'sub-3', reason: 'no_rooms_configured', durationMin: 30, detail: 'No rooms configured.' },
        ],
      },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto-schedule' }));

    await waitFor(() => {
      expect(
        screen.getByText('Auto-schedule placed no sessions: 1 no rooms configured. 1 pre-existing conflict(s) left in place.'),
      ).toBeInTheDocument();
    });
  });

  // DEC-701/J9 warn-never-block: an occupied cell must still accept a
  // placement through the accessible (click) path, not just drag-drop --
  // it's a real button whose accessible name states the clash count.
  it('arms a session, exposes an occupied cell as a clash-naming button, and places it there on click', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 3 } } },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();

    // sub-1 (10:00-11:00) and sub-2 (10:30-11:30) both cover 10:30am in
    // Main Hall, so the occupied cell there must name a two-session clash.
    const clashButton = screen.getByRole('button', {
      name: 'Place S-003 at 10:30am in Main Hall — will clash with 2 sessions',
    });
    expect(clashButton).toHaveClass('chq-day-grid-cell-btn-clash');

    fireEvent.click(clashButton);

    await waitFor(() => {
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled (0)');
    });
    expect(screen.queryByText(/Placing S-003/)).toBeNull();
  });

  // DEC-701: assignLanes already proves a room can hold N > 2 overlapping
  // sessions -- the conflict caption must count them instead of assuming a
  // pair, and every overlapping card must still render as its own card.
  it('renders three overlapping placements as three cards with a three-session caption', async () => {
    const payload = agendaPayload();
    payload.placed.push({
      submissionId: 'sub-4',
      ref: 'S-004',
      title: 'Overlapping Talk C',
      trackIds: [],
      speakers: [],
      roomId: 'room-1',
      day: '2026-06-01',
      startMin: 645,
      endMin: 705,
    });
    payload.conflicts = [
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-2'], detail: 'A and B overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-4'], detail: 'A and C overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-2', 'sub-4'], detail: 'B and C overlap in Main Hall.' },
    ];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: payload,
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(screen.getByText('Overlapping Talk B')).toBeInTheDocument();
    expect(screen.getByText('Overlapping Talk C')).toBeInTheDocument();

    const captions = screen.getAllByText('Three sessions in one room');
    expect(captions.length).toBe(3);
  });

  // DEC-759: a same-room 3+-way pile-up renders each session as its own
  // lane (1/N width) rather than merging (that's the DEC-742 exactly-2
  // path, covered above) — every lane must render BOTH its own title and
  // its own conflict caption at rest, not hidden behind the inner
  // scrollbar DEC-620 used to put on the card (removed by DEC-759; see
  // agenda-card-geometry.test.ts for the CSS-level regression guard).
  it('renders each lane of a same-room clash with its own title and conflict caption, sized to its lane', async () => {
    const payload = agendaPayload();
    payload.placed.push({
      submissionId: 'sub-4',
      ref: 'S-004',
      title: 'Overlapping Talk C',
      trackIds: [],
      speakers: [],
      roomId: 'room-1',
      day: '2026-06-01',
      startMin: 645,
      endMin: 705,
    });
    payload.conflicts = [
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-2'], detail: 'A and B overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-4'], detail: 'A and C overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-2', 'sub-4'], detail: 'B and C overlap in Main Hall.' },
    ];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: payload,
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    for (const [submissionId, title] of [
      ['sub-1', 'Overlapping Talk A'],
      ['sub-2', 'Overlapping Talk B'],
      ['sub-4', 'Overlapping Talk C'],
    ] as const) {
      const card = document.querySelector(`[data-submission-id="${submissionId}"].chq-day-grid-placed-card`);
      expect(card).not.toBeNull();
      // Each card renders its own title...
      expect(card?.textContent).toContain(title);
      // ...and its own caption, both present in the same card at once (not
      // one obscuring the other behind a scroll region).
      const caption = card?.querySelector('.chq-conflict-caption');
      expect(caption).not.toBeNull();
      expect(caption?.textContent).toBe('Three sessions in one room');
      // Lane sizing: three concurrent lanes each claim 1/3 of the cell
      // width via the inline style DayGrid computes from assignLanes
      // (jsdom normalizes the `calc(100% / 3)` source to a percentage).
      expect((card as HTMLElement).style.width).toBe('calc(33.3333%)');
    }
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

  // DEC-724: the room-less column is conditional, not a permanent fixture.
  it('hides the room-less column when nothing on the day is roomless and nothing is armed, shows it once armed', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // Absent: every seeded placement has a real room, nothing is armed.
    expect(screen.queryByText('No room yet')).toBeNull();
    expect(document.querySelectorAll('.chq-day-grid-room-header')).toHaveLength(1);

    // Present once armed.
    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(screen.getByText('No room yet')).toBeInTheDocument();
    expect(document.querySelectorAll('.chq-day-grid-room-header')).toHaveLength(2);
  });

  // DEC-724: Cancel (armed cleared without a placement) moves focus to the
  // first cell of the grid that was showing while armed, rather than
  // dropping focus to the document body.
  it('moves focus to the first grid cell after Cancel clears an armed session', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Placing S-003/)).toBeNull();

    const firstCell = document.querySelector('[data-room-id="room-1"][data-start-min="540"]');
    expect(firstCell).not.toBeNull();
    expect(document.activeElement).toBe(firstCell);
  });
});

// DEC-769: a placed session's own occupied slot must never count against
// itself once armed (a lone session can't clash with itself), and the
// armed-mode cell buttons must sit ABOVE the placed cards sharing their
// grid area so a click lands at the row the organiser clicked, not at
// whatever startMin the underlying card happened to carry.
function twoRoomPayload() {
  return {
    days: ['2026-06-01'],
    rooms: [
      { id: 'room-1', name: 'Main Hall' },
      { id: 'room-2', name: 'Room B' },
    ],
    tracks: [],
    placed: [
      {
        submissionId: 'sub-1',
        ref: 'S-001',
        title: 'Solo Talk A',
        trackIds: [],
        speakers: [],
        roomId: 'room-1',
        day: '2026-06-01',
        startMin: 600,
        endMin: 630,
      },
      {
        submissionId: 'sub-5',
        ref: 'S-005',
        title: 'Room B Talk',
        trackIds: [],
        speakers: [],
        roomId: 'room-2',
        day: '2026-06-01',
        startMin: 600,
        endMin: 630,
      },
    ],
    unscheduled: [],
    conflicts: [],
    unplacedReasons: [],
    summary: { unplaced: 0, conflicts: 0 },
  };
}

describe('AgendaPage armed self-clash and top-layer click-to-place (DEC-769)', () => {
  it('arming a placed session and clicking a different room occupied cell issues the slot PUT with THAT cell startMin', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: twoRoomPayload(),
      'PUT /api/v1/submissions/sub-1/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1 } } },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Solo Talk A')).toBeInTheDocument();
    });

    // Arm sub-1 (Main Hall, 10:00-10:30) by clicking its own placed card.
    fireEvent.click(screen.getByRole('button', { name: 'S-001: Solo Talk A' }));
    expect(screen.getByText(/Placing S-001 — Esc to cancel/)).toBeInTheDocument();

    // sub-5 occupies Room B 10:00-10:30. Click the 10:15am row -- inside
    // sub-5's span, but NOT its own startMin -- to prove the button (not
    // the card underneath it) receives the click and reports the row's
    // own minutes.
    const clashButton = screen.getByRole('button', {
      name: 'Place S-001 at 10:15am in Room B — will clash with 1 session',
    });
    fireEvent.click(clashButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/submissions/sub-1/slot'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(call).toBeDefined();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body).toMatchObject({ day: '2026-06-01', roomId: 'room-2', startMin: 615, endMin: 645 });
  });

  it('arming a placed session and reading its own cell accessible name shows no clash', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: twoRoomPayload(),
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Solo Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Solo Talk A' }));

    // sub-1's own slot (Main Hall, 10:00am) — excluded from its own
    // occupancy count, so it renders as an ordinary (non-clash) button.
    const ownCellButton = screen.getByRole('button', { name: 'Place S-001 at 10:00am in Main Hall' });
    expect(ownCellButton).not.toHaveClass('chq-day-grid-cell-btn-clash');
    expect(
      screen.queryByRole('button', { name: /Place S-001 at 10:00am in Main Hall — will clash/ }),
    ).toBeNull();
  });

  it('placing onto a genuinely occupied cell still writes and the conflict chip appears afterwards', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: twoRoomPayload(),
      'PUT /api/v1/submissions/sub-1/slot': {
        status: 200,
        body: {
          conflicts: [
            { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-5'], detail: 'Solo Talk A and Room B Talk overlap in Room B.' },
          ],
          summary: { unplaced: 0, conflicts: 1 },
        },
      },
    });

    render(<AgendaPage />);
    await waitFor(() => {
      expect(screen.getByText('Solo Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Solo Talk A' }));
    const clashButton = screen.getByRole('button', {
      name: 'Place S-001 at 10:15am in Room B — will clash with 1 session',
    });
    fireEvent.click(clashButton);

    // sub-1 now overlaps sub-5 in Room B (10:15-10:45 vs 10:00-10:30) --
    // exactly two overlapping sessions in one room merge into DEC-742's
    // single inverted clash card with a caption, proving the write landed
    // and the resulting conflict actually renders (never a silent no-op).
    await waitFor(() => {
      expect(document.querySelector('.chq-day-grid-clash-caption')).not.toBeNull();
    });
    expect(document.querySelector('.chq-day-grid-clash-caption')?.textContent).toBe('Two sessions in one room');
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
