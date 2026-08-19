// DEC-144 layer-2 harness for the Agenda SPA (app/src/pages/Agenda.tsx):
// mounts the real AgendaPage against mocked fetch shaped like the real
// GET .../agenda envelope (DEC-021), with two OVERLAPPING placed sessions in
// the same room -- both must render as separate cards (no de-dup / silent
// drop), plus the unscheduled tray and a conflict chip surfacing the
// room_overlap between them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
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
    summary: { unplaced: 1, conflicts: 1, placed: 2, total: 3 },
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

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();

    // Both overlapping placed sessions render as distinct cards.
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
      expect(screen.getByText('Overlapping Talk B')).toBeInTheDocument();
    });

    // Unscheduled tray with its count and the unplaced session. The count
    // is a right-aligned sibling of the "Unscheduled" label (w41), not
    // folded into a single text node.
    expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled1');
    expect(screen.getByText('Unplaced Talk')).toBeInTheDocument();

    // DEC-742: a same-room clash of exactly two sessions merges into ONE
    // inverted card sharing a single caption, not two separately-captioned
    // cards.
    const captions = screen.getAllByText('Two sessions in one room');
    expect(captions.length).toBe(1);
  });

  // DEC-899/900: the day-tab pill reads like a date ("Mon 1 Jun" for the
  // fixture's 2026-06-01); the page's summary/actions now live on the title
  // row and the summary uses correct singular/plural grammar for the
  // conflict counter, with only the conflict count bolded; the rooms/tracks
  // link is the grid's own empty state, so it's absent while the fixture
  // has a room configured.
  it('renders the day pill as a formatted date and the title-row summary with correct count grammar', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Mon 1 Jun' })).toBeInTheDocument();

    // Fixture is summary: { unplaced: 1, conflicts: 1, placed: 2, total: 3 }
    // -- both count words singular; DEC-899: the percentage is read straight
    // from summary.placed/summary.total (2/3 = 67%), never re-derived
    // client-side from placed.length/unscheduled.length.
    const summary = document.querySelector('.chq-agenda-head .chq-agenda-summary');
    expect(summary?.textContent).toBe('1 unplaced · 1 conflict · 67% placed');
    expect(screen.getByText('1 conflict')).toBeInTheDocument();
    expect(screen.queryByText('1 conflicts')).toBeNull();

    // Fixture has a room configured -- the "Add a room or track" link is
    // the grid's own empty state and must not render as a standing control.
    expect(screen.queryByRole('link', { name: 'Add a room or track' })).toBeNull();

    // w41: the summary sits beside the h1 as a direct child of
    // .chq-agenda-head, not nested inside .chq-agenda-head-actions (which
    // now also carries the Breaks disclosure per DEC-021/DEC-900 wave 72).
    const head = document.querySelector('.chq-agenda-head')!;
    expect(Array.from(head.children).map((el) => el.className)).toEqual([
      'chq-page-title',
      'chq-summary chq-agenda-summary',
      'chq-agenda-head-actions',
    ]);
    const headActions = document.querySelector('.chq-agenda-head-actions')!;
    expect(headActions.querySelector('.chq-agenda-summary')).toBeNull();
    // DEC-021/DEC-900 amendment (wave 72): the fixture has a selected day, so
    // the "Breaks ›" disclosure renders alongside Auto-schedule/Publish.
    expect(headActions.textContent).toBe('Breaks ›Auto-schedulePublish schedule');
  });

  // DEC-899: gate-8 P2 #10 -- a judge saw the header's percentage move
  // 84%->79% with identical counts because it was re-derived client-side
  // from placed.length/(placed.length+unscheduled.length) instead of read
  // from the server's summary. This fixture deliberately makes the two
  // arithmetics disagree (placed.length/unscheduled.length would say 50%,
  // summary.placed/summary.total says 90%) so the test can only pass if
  // the header reads summary.placed/summary.total, never the arrays.
  it('reads the placed percentage from summary.placed/summary.total, never from placed.length/unscheduled.length', async () => {
    const payload = agendaPayload();
    payload.summary = { unplaced: 1, conflicts: 1, placed: 9, total: 10 };
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: payload,
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const summary = document.querySelector('.chq-agenda-head .chq-agenda-summary');
    // placed.length (2) / (placed.length + unscheduled.length) (3) would be
    // 67% -- if this reads 67% the header is re-deriving client-side again.
    expect(summary?.textContent).toBe('1 unplaced · 1 conflict · 90% placed');
  });

  // DEC-791: plural grammar when there are 2+ conflicts.
  it('renders "2 conflicts" (plural) in the summary line when the conflict count is 2', async () => {
    const payload = agendaPayload();
    payload.summary = { unplaced: 0, conflicts: 2, placed: 3, total: 3 };

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: payload,
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(screen.getByText('2 conflicts')).toBeInTheDocument();
    expect(screen.queryByText('2 conflict')).toBeNull();
  });

  // DEC-899/900: with zero rooms configured, the day grid's empty state
  // takes its place and carries the ONLY "Add a room or track" link on the
  // page.
  it('renders the "Add a room or track" link only as the grid empty state when the event has zero rooms', async () => {
    const payload = agendaPayload();
    payload.rooms = [];
    payload.placed = [];
    payload.conflicts = [];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: payload,
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Add a room or track' });
      // DEC-834 / DEC-837: the app mounts under <BrowserRouter basename="/admin">,
      // so the in-app `to` is basename-relative and renders that way here (this
      // MemoryRouter has no basename); a '/admin/...' target would double the
      // prefix to /admin/admin/settings in the real app.
      expect(link).toHaveAttribute('href', '/settings?section=tracks-rooms');
    });

    expect(document.querySelector('.chq-day-grid')).toBeNull();
  });

  it('renders a same-room two-session clash as one merged inverted card with both titles uncropped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
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
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 2, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // sub-3 ("Unplaced Talk") starts in the unscheduled tray.
    expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled1');

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
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled0');
    });
  });

  // DEC-570: every placed session and every unscheduled tray card is a real
  // <button> reachable by role, not an invisible `div[draggable]`.
  it('resolves every placed card and the unscheduled tray card via getAllByRole("button")', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
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
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));

    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();

    // DEC-794: arming never inserts the room-less grid column (the seeded
    // day has no roomless placement) — the roomless-placement capability is
    // instead served by a standalone button below the grid, and its
    // "No room yet" copy (DEC-724) never reads "TBD".
    expect(screen.queryByText('No room yet', { selector: '.chq-day-grid-room-header' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\bTBD\b/);

    const roomlessButton = screen.getByRole('button', { name: 'Place S-003 with no room yet' });

    fireEvent.click(roomlessButton);

    await waitFor(() => {
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled0');
    });
    // Placing bar is dismissed after placement.
    expect(screen.queryByText(/Placing S-003/)).toBeNull();

    // DEC-724: focus moves to the just-placed session's own cell.
    expect(document.activeElement).toBe(document.querySelector('[data-submission-id="sub-3"]'));
  });

  // DEC-853: a successful placement says so — ref, room, start time — in the
  // same toast vocabulary as auto-schedule, with no clash clause when the
  // refreshed conflict count didn't grow.
  it('placement toast names the ref, room and start time with no clash clause when conflicts are unchanged', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place S-003 with no room yet' }));

    await waitFor(() => {
      expect(screen.getByText('Placed S-003 in no room yet at 09:00.')).toBeInTheDocument();
    });
  });

  // DEC-853/SPEC §2.3 warn-never-block: a placement that creates a NEW
  // clash still succeeds (never blocked) but the toast names the delta,
  // computed from the server's own before/after conflict counts.
  it('placement toast appends a new-clash clause only when the refreshed conflict count grows', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 2, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place S-003 with no room yet' }));

    await waitFor(() => {
      expect(
        screen.getByText('Placed S-003 in no room yet at 09:00. 1 new clash — flagged, not blocked.'),
      ).toBeInTheDocument();
    });
  });

  // DEC-853: unschedule states what just happened, naming the ref.
  it('unschedule toast names the ref', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'DELETE /api/v1/submissions/sub-1/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 2, conflicts: 0, placed: 1, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const clashItem = document.querySelector('[data-submission-id="sub-1"].chq-day-grid-clash-item');
    expect(clashItem).not.toBeNull();
    const dt = new FakeDataTransfer();
    dt.setData('text/plain', 'sub-1');
    fireEvent.dragOver(document.querySelector('.chq-unscheduled-tray') as Element, { dataTransfer: dt });
    fireEvent.drop(document.querySelector('.chq-unscheduled-tray') as Element, { dataTransfer: dt });

    await waitFor(() => {
      expect(screen.getByText('Unscheduled S-001.')).toBeInTheDocument();
    });
  });

  // DEC-595: publish toast names all three counts and only mentions
  // held-back sessions when there actually are some (AIA-S2-D1 regression —
  // the old toast lied by reporting the placement count as "public").
  it('publish toast names the held-back count when heldBack > 0', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/publish`]: {
        placed: 14,
        public: 12,
        heldBack: 2,
        heldBackSessions: [
          { submissionId: 'sub-99', title: 'Withheld Talk One' },
          { submissionId: 'sub-98', title: 'Withheld Talk Two' },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Schedule live — 12 of 14 placed sessions are public. 2 held back: content not approved.')).toBeInTheDocument();
    });
    // DEC-595 wave-67 amendment: the receipt names every withheld session,
    // each linking to its content editor.
    const linkOne = screen.getByRole('link', { name: 'Withheld Talk One' });
    expect(linkOne).toHaveAttribute('href', '/content/sub-99');
    const linkTwo = screen.getByRole('link', { name: 'Withheld Talk Two' });
    expect(linkTwo).toHaveAttribute('href', '/content/sub-98');
  });

  it('publish toast omits the held-back sentence when heldBack is 0', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/publish`]: {
        placed: 14,
        public: 14,
        heldBack: 0,
        heldBackSessions: [],
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Schedule live — 14 of 14 placed sessions are public.')).toBeInTheDocument();
    });
    expect(screen.queryByText(/held back/)).toBeNull();
    // DEC-595 wave-67 amendment: no empty container, no zero-state.
    expect(screen.queryByText('Held back — content not approved:')).toBeNull();
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
        summary: { unplaced: 0, conflicts: 1, placed: 3, total: 3 },
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto-schedule' }));

    await waitFor(() => {
      expect(
        screen.getByText('Auto-schedule placed 1 session. 0 unplaced. 1 pre-existing conflict left in place.'),
      ).toBeInTheDocument();
    });
  });

  // DEC-667: when a run places nothing, the toast must name why from the
  // typed unplacedReasons the run computed, never report a bare "0
  // sessions" as though nothing needed explaining.
  it('auto-schedule toast names why when the run places nothing', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/auto-schedule`]: {
        ...agendaPayload(),
        summary: { unplaced: 1, conflicts: 1, placed: 2, total: 3 },
        unplacedReasons: [
          { submissionId: 'sub-3', reason: 'no_rooms_configured', durationMin: 30, detail: 'No rooms configured.' },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto-schedule' }));

    await waitFor(() => {
      expect(
        screen.getByText('Auto-schedule placed no sessions: 1 no rooms configured. 1 pre-existing conflict left in place.'),
      ).toBeInTheDocument();
    });
  });

  // DEC-615 (wave 69 amendment): 'changed_during_run' is a full member of
  // the server UnplacedReason union (src/domain/schedule.ts) that had no
  // label in the SPA's old hand-widened Record, rendering "N undefined" in
  // this toast. It must now render an honest label with no "undefined".
  it('auto-schedule toast names changed_during_run with no "undefined"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`POST /api/v1/events/${EVENT_ID}/agenda/auto-schedule`]: {
        ...agendaPayload(),
        summary: { unplaced: 1, conflicts: 0, placed: 2, total: 3 },
        unplacedReasons: [
          { submissionId: 'sub-3', reason: 'changed_during_run', durationMin: 30, detail: 'Changed mid-run.' },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto-schedule' }));

    await waitFor(() => {
      const toast = screen.getByRole('status');
      expect(toast.textContent).toMatch(/^Auto-schedule placed no sessions: 1 /);
      expect(toast.textContent).not.toMatch(/undefined/i);
    });
  });

  // DEC-701/J9 warn-never-block: an occupied cell must still accept a
  // placement through the accessible (click) path, not just drag-drop --
  // it's a real button whose accessible name states the clash count.
  it('arms a session, exposes an occupied cell as a clash-naming button, and places it there on click', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 3, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();

    // sub-1 (10:00-11:00) and sub-2 (10:30-11:30) both cover 10:30 in
    // Main Hall, so the occupied cell there must name a two-session clash.
    const clashButton = screen.getByRole('button', {
      name: 'Place S-003 at 10:30 in Main Hall — will clash with 2 sessions',
    });
    expect(clashButton).toHaveClass('chq-day-grid-cell-btn-clash');

    fireEvent.click(clashButton);

    await waitFor(() => {
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled0');
    });
    expect(screen.queryByText(/Placing S-003/)).toBeNull();
  });

  // DEC-899/900: any same-room overlap cluster of size >= 2 (not just
  // exactly 2) merges into ONE inverted clash card listing every session in
  // the cluster, with a single caption naming the count — never N separate
  // lane cards.
  it('renders three overlapping placements as one merged clash card with a three-session caption', async () => {
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

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(screen.getByText('Overlapping Talk B')).toBeInTheDocument();
    expect(screen.getByText('Overlapping Talk C')).toBeInTheDocument();

    // One card, one caption — not three separate lane cards.
    const clashCards = document.querySelectorAll('.chq-day-grid-clash-card');
    expect(clashCards.length).toBe(1);
    const captions = screen.getAllByText('Three sessions in one room');
    expect(captions.length).toBe(1);
  });

  // DEC-899/900: a 4-way same-room pile-up merges into the same single
  // clash card shape as a 3-way one, listing all four sessions.
  it('renders a four-way same-room overlap as one merged clash card listing all four titles', async () => {
    const payload = agendaPayload();
    payload.placed.push(
      {
        submissionId: 'sub-4',
        ref: 'S-004',
        title: 'Overlapping Talk C',
        trackIds: [],
        speakers: [],
        roomId: 'room-1',
        day: '2026-06-01',
        startMin: 645,
        endMin: 705,
      },
      {
        submissionId: 'sub-5',
        ref: 'S-005',
        title: 'Overlapping Talk D',
        trackIds: [],
        speakers: [],
        roomId: 'room-1',
        day: '2026-06-01',
        startMin: 650,
        endMin: 710,
      },
    );
    payload.conflicts = [
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-2'], detail: 'A and B overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-4'], detail: 'A and C overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-2', 'sub-4'], detail: 'B and C overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-1', 'sub-5'], detail: 'A and D overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-2', 'sub-5'], detail: 'B and D overlap in Main Hall.' },
      { kind: 'room_overlap', submissionIds: ['sub-4', 'sub-5'], detail: 'C and D overlap in Main Hall.' },
    ];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: payload,
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    for (const title of ['Overlapping Talk A', 'Overlapping Talk B', 'Overlapping Talk C', 'Overlapping Talk D']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    const clashCards = document.querySelectorAll('.chq-day-grid-clash-card');
    expect(clashCards.length).toBe(1);
    expect(screen.getByText('Four sessions in one room')).toBeInTheDocument();
  });

  it('never renders the literal text "undefined" anywhere in the tree', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  // DEC-724: the room-less column is conditional, not a permanent fixture.
  // DEC-794: arming must never insert or remove it — that would reflow
  // every room column mid-placement — so the column count is identical
  // whether or not a session is armed on a day with no roomless placement.
  it('never shows the room-less column while armed on a day with no roomless placement; arming keeps the column count stable', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // Absent: every seeded placement has a real room, nothing is armed.
    expect(screen.queryByText('No room yet')).toBeNull();
    expect(document.querySelectorAll('.chq-day-grid-room-header')).toHaveLength(1);

    // Still absent once armed — the column count never changes.
    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(screen.queryByText('No room yet', { selector: '.chq-day-grid-room-header' })).toBeNull();
    expect(document.querySelectorAll('.chq-day-grid-room-header')).toHaveLength(1);

    // The roomless-placement capability survives via the below-grid button.
    expect(screen.getByRole('button', { name: 'Place S-003 with no room yet' })).toBeInTheDocument();
  });

  // DEC-794: the armed grid root carries a state class the CSS uses to
  // raise cell-button targets above placed/clash cards.
  it('adds the armed state class to the grid root only while a session is armed', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(document.querySelector('.chq-day-grid')).not.toHaveClass('chq-day-grid-armed');

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(document.querySelector('.chq-day-grid')).toHaveClass('chq-day-grid-armed');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.querySelector('.chq-day-grid')).not.toHaveClass('chq-day-grid-armed');
  });

  // DEC-794: the "Placing… Esc to cancel" banner must always occupy its
  // box — only its content and aria-hidden swap — so arming/disarming
  // never shifts the grid vertically.
  it('keeps the armed banner container present (not removed) both before and after arming', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const bar = document.querySelector('.chq-agenda-armed-bar');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));

    const barAfter = document.querySelector('.chq-agenda-armed-bar');
    expect(barAfter).toBe(bar);
    expect(barAfter).not.toHaveAttribute('aria-hidden');
  });

  // Eval D5. A delta-2 amendment made the placing bar a `position:absolute;
  // inset:0` OVERLAY on the day-tab strip, on the premise that the day pills
  // "are not usable mid-placement anyway". That premise is false -- see the
  // cross-day test below -- and the overlay also covered the "Clashes are
  // flagged, not blocked" note. The geometry is only expressible as an
  // overlay while the bar is a CHILD of the strip, so pin it as a SIBLING
  // that precedes the strip: no CSS can re-bury the pills from there.
  it('renders the armed bar as a sibling BEFORE the day-tab strip, never inside it', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const bar = document.querySelector('.chq-agenda-armed-bar')!;
    const dayTabs = document.querySelector('.chq-agenda-day-tabs')!;
    expect(dayTabs.contains(bar)).toBe(false);
    expect(bar.nextElementSibling).toBe(dayTabs);

    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));

    // Still outside the strip once armed, and both of the things the overlay
    // used to cover are still in the tree alongside it.
    expect(dayTabs.contains(document.querySelector('.chq-agenda-armed-bar'))).toBe(false);
    expect(within(dayTabs as HTMLElement).getAllByRole('tab').length).toBe(1);
    expect(within(dayTabs as HTMLElement).getByText('Clashes are flagged, not blocked')).toBeInTheDocument();
  });

  // Eval D5, the falsifier for the overlay's premise: setActiveDay never
  // clears `armed`, and handlePlace reads activeDay at CALL time, so arming
  // a card on day 1 and placing it on day 2 is a supported path -- which is
  // exactly why the day pills must stay clickable while the bar is showing.
  it('places an armed session on a day selected AFTER arming (cross-day placement)', async () => {
    const twoDay = { ...agendaPayload(), days: ['2026-06-01', '2026-06-02'] };
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: twoDay,
      'PUT /api/v1/submissions/sub-3/slot': {
        summary: { unplaced: 0, conflicts: 1, placed: 3, total: 3 },
        conflicts: twoDay.conflicts,
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // Arm on day 1...
    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(document.querySelector('.chq-agenda-armed-bar')).not.toHaveAttribute('aria-hidden');

    // ...switch days while still armed (the pill must be reachable)...
    const dayTabs = document.querySelector('.chq-agenda-day-tabs')! as HTMLElement;
    const secondDay = within(dayTabs).getAllByRole('tab')[1]!;
    fireEvent.click(secondDay);
    expect(secondDay).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.chq-agenda-armed-bar')).not.toHaveAttribute('aria-hidden');

    // ...and place. The PUT must carry the day chosen after arming.
    fireEvent.click(document.querySelector('.chq-day-grid-cell-btn')!);

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(put).toBeDefined();
      expect(JSON.parse((put![1] as RequestInit).body as string).day).toBe('2026-06-02');
    });
  });

  // DEC-724: Cancel (armed cleared without a placement) moves focus to the
  // first cell of the grid that was showing while armed, rather than
  // dropping focus to the document body.
  it('moves focus to the first grid cell after Cancel clears an armed session', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
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
    summary: { unplaced: 0, conflicts: 0, placed: 2, total: 2 },
  };
}

describe('AgendaPage armed self-clash and top-layer click-to-place (DEC-769)', () => {
  it('arming a placed session and clicking a different room occupied cell issues the slot PUT with THAT cell startMin', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: twoRoomPayload(),
      'PUT /api/v1/submissions/sub-1/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1, placed: 2, total: 2 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Solo Talk A')).toBeInTheDocument();
    });

    // Arm sub-1 (Main Hall, 10:00-10:30) by clicking its own placed card.
    fireEvent.click(screen.getByRole('button', { name: 'S-001: Solo Talk A — click to select, then choose a new slot' }));
    expect(screen.getByText(/Placing S-001 — Esc to cancel/)).toBeInTheDocument();

    // sub-5 occupies Room B 10:00-10:30. Click the 10:15 row -- inside
    // sub-5's span, but NOT its own startMin -- to prove the button (not
    // the card underneath it) receives the click and reports the row's
    // own minutes.
    const clashButton = screen.getByRole('button', {
      name: 'Place S-001 at 10:15 in Room B — will clash with 1 session',
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

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Solo Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Solo Talk A — click to select, then choose a new slot' }));

    // sub-1's own slot (Main Hall, 10:00) — excluded from its own
    // occupancy count, so it renders as an ordinary (non-clash) button.
    const ownCellButton = screen.getByRole('button', { name: 'Place S-001 at 10:00 in Main Hall' });
    expect(ownCellButton).not.toHaveClass('chq-day-grid-cell-btn-clash');
    expect(
      screen.queryByRole('button', { name: /Place S-001 at 10:00 in Main Hall — will clash/ }),
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
          summary: { unplaced: 0, conflicts: 1, placed: 2, total: 2 },
        },
      },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Solo Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Solo Talk A — click to select, then choose a new slot' }));
    const clashButton = screen.getByRole('button', {
      name: 'Place S-001 at 10:15 in Room B — will clash with 1 session',
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

// DEC-021 amendment (w55): click/keyboard unschedule — a real <button> in
// the armed bar so a keyboard-only organiser who placed a session can
// remove it again without HTML5 drag-and-drop.
describe('AgendaPage click/keyboard unschedule (DEC-021 amendment)', () => {
  it('reveals the Unschedule button only when the armed session already has a slot', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // Arming a PLACED card reveals the button.
    fireEvent.click(screen.getByRole('button', { name: 'S-001: Overlapping Talk A (conflict)' }));
    expect(screen.getByText(/Placing S-001 — Esc to cancel/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unschedule' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Unschedule' })).toBeNull();

    // Arming an UNSCHEDULED tray card does not — there's nothing to remove.
    fireEvent.click(screen.getByRole('button', { name: 'S-003: Unplaced Talk — click to select, then choose a time slot' }));
    expect(screen.getByText(/Placing S-003 — Esc to cancel/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unschedule' })).toBeNull();
  });

  // DEC-941: clicking Unschedule opens a confirm dialog naming the session
  // and slot first -- the DELETE only fires from the dialog's own confirm
  // control, never straight off the armed-bar button.
  it('clicking Unschedule asks for confirmation first, then DELETEs and toasts its ref', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'DELETE /api/v1/submissions/sub-1/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 2, conflicts: 0, placed: 1, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Overlapping Talk A (conflict)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unschedule' }));

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'Unschedule session' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unschedule session' }));

    await waitFor(() => {
      expect(screen.getByText('Unscheduled S-001.')).toBeInTheDocument();
    });
    // The armed bar clears along with the placement.
    expect(screen.queryByText(/Placing S-001/)).toBeNull();
  });

  it('cancelling the Unschedule confirmation fires no DELETE and keeps the session placed', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Overlapping Talk A (conflict)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unschedule' }));
    const dialog = screen.getByRole('dialog', { name: 'Unschedule this session?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'S-001: Overlapping Talk A (conflict)' })).toBeInTheDocument();
  });

  // No mouse/pointer event anywhere in this test — only .focus() (the
  // mechanism Tab-navigation uses) and a click dispatched at the focused
  // element itself, which is the event a browser fires by default when
  // Space/Enter activates a focused native <button> (jsdom does not
  // synthesize that default action from a raw keydown, so this asserts the
  // two halves a real browser would supply: the button IS reachable by
  // focus, and activating the focused element invokes the handler).
  it('the Unschedule button is keyboard-reachable and activates without any pointer event', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'DELETE /api/v1/submissions/sub-1/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 2, conflicts: 0, placed: 1, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'S-001: Overlapping Talk A (conflict)' }));
    const unscheduleBtn = screen.getByRole('button', { name: 'Unschedule' });

    unscheduleBtn.focus();
    expect(document.activeElement).toBe(unscheduleBtn);

    fireEvent.click(unscheduleBtn);

    // DEC-941: keyboard activation reaches the confirm dialog; the DELETE
    // itself is covered by the confirm-flow tests above.
    expect(screen.getByRole('dialog', { name: 'Unschedule this session?' })).toBeInTheDocument();
  });
});

// DEC-021/DEC-900 amendment (wave 72): the breaks editor is a disclosure on
// the head row that opens in the ONE shared dialog frame (ModalFrame,
// DEC-651) rather than a band between the head and the grid that displaced
// the canvas (gate-4 measured 308px of chrome cost). BreaksPanel's own
// component/props are byte-identical -- these tests exercise the mounting
// change only.
describe('AgendaPage breaks disclosure (DEC-021/DEC-900 amendment, wave 72)', () => {
  it('does not render the breaks editor inline between the day tabs and the grid before the disclosure is opened', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // No inline breaks panel anywhere -- the canvas is never displaced.
    expect(document.querySelector('.chq-breaks-panel')).toBeNull();
    // The day-tab strip sits directly beside the grid layout with nothing
    // between them.
    const dayTabs = document.querySelector('.chq-agenda-day-tabs')!;
    const layout = document.querySelector('.chq-agenda-layout')!;
    expect(dayTabs.nextElementSibling).toBe(layout);

    expect(screen.getByRole('button', { name: 'Breaks ›' })).toBeInTheDocument();
  });

  it('opens BreaksPanel in the shared ModalFrame dialog when the "Breaks ›" disclosure is clicked, and closes it again', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Breaks ›' }));

    const dialog = screen.getByRole('dialog', { name: 'Breaks on Monday' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add the break' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Breaks on Monday' })).toBeNull();
    expect(document.querySelector('.chq-breaks-panel')).toBeNull();
  });

  it("the grid's chrome height (day-tab row -> layout adjacency) is unchanged whether or not the dialog has ever been opened", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    const dayTabs = document.querySelector('.chq-agenda-day-tabs')!;

    fireEvent.click(screen.getByRole('button', { name: 'Breaks ›' }));
    expect(screen.getByRole('dialog', { name: 'Breaks on Monday' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    // After the dialog closes, the day-tab row's sibling is still the grid
    // layout directly -- opening/closing the dialog never left a band behind.
    const layout = document.querySelector('.chq-agenda-layout')!;
    expect(dayTabs.nextElementSibling).toBe(layout);
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

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(document.querySelector('.chq-day-grid')).toBeNull();
    expect(document.querySelector('.chq-phone-agenda')).not.toBeNull();

    const roomChip = screen.getByRole('button', { name: /Main Hall/ });
    expect(roomChip).toHaveClass('active');
    expect(roomChip.querySelector('.chq-flag')?.textContent).toBe('CLASH');

    // Overlapping A/B render as one merged clash run, not two placed cards.
    // DEC-380 amendment (w12-a): derived from slot.sessions.length via the
    // shared countOf helper, not a hardcoded "Two".
    expect(screen.getByText('2 sessions in this slot')).toBeInTheDocument();
  });

  it('arms an unscheduled session from the sheet, places it on tap, and fires the same PUT as desktop drag-drop', async () => {
    stubPhoneMatchMedia();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 1, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
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

  // DEC-380 amendment (w12-a) defect fix: the clash caption is derived from
  // slot.sessions.length via the shared countOf helper, not a hardcoded
  // "Two" — this fixture carries a 3-way same-room overlap.
  it('renders a plural-correct clash caption for a 3-session same-room overlap', async () => {
    stubPhoneMatchMedia();
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

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    expect(screen.getByText('3 sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('Two sessions in this slot')).toBeNull();
  });

  // DEC-380 amendment (w12-a) defect fix: the desktop DayGrid places onto
  // occupied cells and surfaces a clash (SPEC J9/DEC-010, warn-never-block).
  // While armed, every slot row — not just 'free' ones — must render a
  // placement control so the phone doesn't refuse a write the desktop
  // accepts.
  it('while armed, an occupied (clash) slot renders a "Place here anyway" control that places with the armed session\'s own duration', async () => {
    stubPhoneMatchMedia();
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      'PUT /api/v1/submissions/sub-3/slot': { status: 200, body: { conflicts: [], summary: { unplaced: 0, conflicts: 2, placed: 3, total: 3 } } },
    });

    render(
      <MemoryRouter>
        <AgendaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Overlapping Talk A')).toBeInTheDocument();
    });

    // Arm sub-3 (unscheduled, 30-minute default duration) from the sheet.
    fireEvent.click(screen.getByRole('button', { name: /Unscheduled 1/ }));
    fireEvent.click(screen.getByText('Unplaced Talk'));
    expect(screen.getByText('Placing · tap a free slot')).toBeInTheDocument();

    const placeAnyway = screen.getByText('Place here anyway').closest('button')!;
    fireEvent.click(placeAnyway);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unscheduled 0/ })).toBeInTheDocument();
    });

    const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(call).toBeDefined();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    // The clash slot (sub-1/sub-2) starts at 600 -- the armed session
    // (unscheduled, DEFAULT_PLACE_DURATION_MIN=30) is written there with
    // ITS OWN duration, not the occupying run's span.
    expect(body).toMatchObject({ roomId: 'room-1', startMin: 600, endMin: 630 });
  });
});
