// docs/design/Chautauqua Agenda.dc.html:127-178 -- the pack's only Agenda
// phone frame, extent 127 through the last drawn label ("{{ slot.length }}
// free", :178). This is a REQUEST/render-level verdict (DEC-976 wave-28: an
// SSR/SPA phone-frame verdict is a request, a CSS-text scan is its
// companion, never its substitute) -- it mounts PhoneAgenda directly, the
// same harness PhoneAgenda.dock-membership.render.test.tsx already
// establishes, and must not contradict that file's already-RULED dock
// membership (DEC-576 wave-114 / DEC-380 wave-116 amendments): the dock
// stays exactly Unscheduled + Auto-schedule, Publish schedule and Breaks
// live in the head's full-width action row at the 44px floor. This file
// does not re-adjudicate that; it records the ruling holds (describe block
// at the bottom) and moves on.
//
// Two literals task w29-g's brief asked this file to assert turned out to
// be UNBUILT or MISWORDED against the frame when measured against the
// actual component (app/src/pages/agenda/PhoneAgenda.tsx,
// app/src/pages/agenda/phoneSlots.ts) -- both are out of this lane's file
// ownership (OWNS: this file, the audit doc, agenda.css's terminal
// @media block only) so DEC-385 wave-29's four-condition in-commit-fix bar
// is not met (condition 4: "touches only files the lane OWNS"). Both are
// recorded as DIVERGES rows in docs/design/audit/agenda-390-v12.md and
// asserted here against the BUILT truth, never the frame literal a fix
// would require touching PhoneAgenda.tsx/phoneSlots.ts to satisfy:
//
// BOTH DIVERGENCES HAVE SINCE BEEN CLOSED, by the lanes that DO own
// PhoneAgenda.tsx, and the receipts below move to the frame's shape
// accordingly (they are stale receipts, not a licence to revert product
// work -- the audit rows in docs/design/audit/agenda-390-v12.md record the
// history):
//
//   1. Frame :161 spells "Two sessions in this slot". This file recorded
//      the built disclosure as numeral-based (countOf, DEC-925). DEC-380
//      wave-32 then rebuilt this ONE flag on the pack's spelled-count
//      grammar (capitalizeFirst + spellCount + plural), so it now reads
//      the frame's wording. countOf still owns every data-dense register
//      elsewhere, which is why only this flag is spelled.
//   2. Frame :171 draws an inline one-tap resolution action ("Move DFC-047
//      to 11:30") directly on the clash card. This file recorded that no
//      such control existed. DEC-895 wave-33 then built it
//      (computeClashMove + conflictMoveLabel, one resolution per clash
//      card, rendered as the card's last child exactly as the frame
//      draws it).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { PhoneAgenda } from './PhoneAgenda';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';
// compile-checked provenance markers only (DEC-976 wave-126 idiom, see
// PhoneAgenda.dock-membership.render.test.tsx): the DEC_NNN constants in
// src/decisions.ts are mutable one-liners the scribe overwrites for
// whichever ruling is newest each wave, never the durable ruling text.
import { DEC_385, DEC_874, DEC_967, DEC_976 } from '../../../../src/decisions';
void DEC_385;
void DEC_874;
void DEC_967;
void DEC_976;

afterEach(() => {
  cleanup();
});

const DAY = '2026-08-18'; // a Tuesday
const DAY2 = '2026-08-19'; // Wednesday
const DAY3 = '2026-08-20'; // Thursday
const DAYS = [DAY, DAY2, DAY3];

const ROOMS: AgendaRoom[] = [
  { id: 'r1', name: 'Room 2A' },
  { id: 'r2', name: 'Main Stage' },
  { id: 'r3', name: 'Room 2B' },
];

function placedSession(
  id: string,
  ref: string,
  title: string,
  speakerName: string,
  roomId: string,
  startMin: number,
  endMin: number,
  day = DAY,
): PlacedAgendaSession {
  return {
    submissionId: id,
    ref,
    title,
    trackIds: [],
    speakers: [{ contactId: `c-${id}`, name: speakerName }],
    roomId,
    day,
    startMin,
    endMin,
  };
}

function unscheduledSession(id: string, ref: string, title: string): UnscheduledAgendaSession {
  return { submissionId: id, ref, title, trackIds: [], speakers: [{ contactId: `c-${id}`, name: 'Someone Speaker' }] };
}

function baseProps(overrides: Partial<ComponentProps<typeof PhoneAgenda>> = {}) {
  return {
    day: DAY,
    days: DAYS,
    onDayChange: vi.fn(),
    rooms: ROOMS,
    placed: [] as PlacedAgendaSession[],
    unscheduled: [] as UnscheduledAgendaSession[],
    conflicts: [] as AgendaConflict[],
    summary: { unplaced: 6, conflicts: 2, placed: 10, total: 18 },
    dayStartMin: 480, // 08:00
    dayEndMin: 1020, // 17:00
    gridMin: 15,
    onPlace: vi.fn(),
    onUnschedule: vi.fn(),
    onAutoSchedule: vi.fn(),
    autoScheduling: false,
    ...overrides,
  } satisfies ComponentProps<typeof PhoneAgenda>;
}

describe('Agenda 390 frame :127-133 -- head band (wordmark handled by shell per DEC-919, counter, H1)', () => {
  it('docs/design/Chautauqua Agenda.dc.html:133 -- renders EXACTLY one <h1> reading "Agenda"', () => {
    render(<PhoneAgenda {...baseProps()} />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Agenda');
  });

  it('docs/design/Chautauqua Agenda.dc.html:131 -- "6 unplaced · 2 clash" counter shape (numbers vary, grammar fixed)', () => {
    render(<PhoneAgenda {...baseProps({ summary: { unplaced: 6, conflicts: 2, placed: 10, total: 18 } })} />);
    const counter = document.querySelector('.chq-phone-agenda-counts');
    expect(counter).not.toBeNull();
    expect(counter!.textContent).toMatch(/^\d+ unplaced · \d+ clash(es)?$/);
  });

  it('the counter reflects summary directly (DEC-899): a different unplaced/conflicts pair renders a different, still-shaped, string', () => {
    render(<PhoneAgenda {...baseProps({ summary: { unplaced: 0, conflicts: 1, placed: 5, total: 5 } })} />);
    const counter = document.querySelector('.chq-phone-agenda-counts');
    expect(counter!.textContent).toMatch(/^0 unplaced · 1 clash(es)?$/);
  });
});

describe('Agenda 390 frame :135-137 -- day strip renders one control per event day, in order, "Ddd D" shape', () => {
  it('renders exactly one control per day in DAYS, in the given order, each matching /^[A-Z][a-z]{2} \\d{1,2}$/', () => {
    render(<PhoneAgenda {...baseProps()} />);
    const chips = document.querySelectorAll('.chq-phone-day-chip');
    expect(chips).toHaveLength(DAYS.length);
    const labels = Array.from(chips).map((c) => c.textContent);
    for (const label of labels) {
      expect(label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    }
    // order preserved -- this component never re-sorts `days`. DAYS is
    // three consecutive calendar dates (Tue 18, Wed 19, Thu 20 in the
    // fixture's month), so the rendered order is checked against the
    // literal weekday+day-of-month sequence rather than re-deriving
    // dayPillLabel's date math in the test.
    expect(labels).toEqual(['Tue 18', 'Wed 19', 'Thu 20']);
  });

  it('the active day (matching the `day` prop) is the only chip with aria-pressed="true"', () => {
    render(<PhoneAgenda {...baseProps({ day: DAY2 })} />);
    const chips = Array.from(document.querySelectorAll('.chq-phone-day-chip'));
    const pressed = chips.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });

  it('tapping a day chip calls onDayChange with that day', () => {
    const onDayChange = vi.fn();
    render(<PhoneAgenda {...baseProps({ onDayChange })} />);
    const chips = Array.from(document.querySelectorAll('.chq-phone-day-chip'));
    fireEvent.click(chips[1]!);
    expect(onDayChange).toHaveBeenCalledWith(DAY2);
  });
});

describe('Agenda 390 frame :140-142 -- room strip renders one column head per room, clash marker only on a clashing room', () => {
  it('renders exactly one chip per room (plus the TBD chip), each carrying the room name', () => {
    render(<PhoneAgenda {...baseProps()} />);
    const chips = Array.from(document.querySelectorAll('.chq-phone-room-chip'));
    // ROOMS.length named rooms + the TBD chip this component always adds
    expect(chips).toHaveLength(ROOMS.length + 1);
    const names = chips.map((c) => c.textContent);
    for (const room of ROOMS) {
      expect(names.some((n) => n?.startsWith(room.name))).toBe(true);
    }
  });

  it('docs/design/Chautauqua Agenda.dc.html:140 "Room 2A ... CLASH" -- the CLASH marker renders ONLY on the room that actually clashes, not on Main Stage or Room 2B', () => {
    const a = placedSession('a1', 'DFC-014', 'Taming 40-Minute CI', 'Priya Raman', 'r1', 540, 570);
    const b = placedSession('a2', 'DFC-047', 'Onboarding in 30 Minutes', 'Ruth Adeyemi', 'r1', 555, 585);
    const conflicts: AgendaConflict[] = [
      { kind: 'room_overlap', submissionIds: ['a1', 'a2'], day: DAY, roomId: 'r1', detail: 'Room 2A double-booked' },
    ];
    render(<PhoneAgenda {...baseProps({ placed: [a, b], conflicts })} />);

    const chips = Array.from(document.querySelectorAll('.chq-phone-room-chip'));
    const room2a = chips.find((c) => c.textContent?.startsWith('Room 2A'));
    const mainStage = chips.find((c) => c.textContent?.startsWith('Main Stage'));
    const room2b = chips.find((c) => c.textContent?.startsWith('Room 2B'));

    expect(room2a?.querySelector('.chq-flag')).not.toBeNull();
    expect(room2a?.textContent).toMatch(/CLASH/);
    expect(mainStage?.querySelector('.chq-flag')).toBeNull();
    expect(room2b?.querySelector('.chq-flag')).toBeNull();
  });
});

describe('Agenda 390 frame :149-155 -- a placed slot renders time, ref·length, title, speaker', () => {
  it('renders all four fields for a single placed session', () => {
    const sess = placedSession('p1', 'DFC-020', 'Static Sites at Scale', 'Amir Khoury', 'r1', 600, 630);
    render(<PhoneAgenda {...baseProps({ placed: [sess] })} />);

    const slot = document.querySelector('.chq-phone-slot');
    expect(slot).not.toBeNull();
    expect(within(slot as HTMLElement).getByText('10:00')).toBeInTheDocument(); // {{ slot.time }}
    expect(within(slot as HTMLElement).getByText(/DFC-020 · 30 min/)).toBeInTheDocument(); // {{ slot.ref }} · {{ slot.length }}
    expect(within(slot as HTMLElement).getByText('Static Sites at Scale')).toBeInTheDocument(); // {{ slot.title }}
    expect(within(slot as HTMLElement).getByText('Amir Khoury')).toBeInTheDocument(); // {{ slot.speaker }}
  });
});

describe('Agenda 390 frame :161 -- two-in-a-slot disclosure (the numeral divergence, since CLOSED by DEC-380 wave-32)', () => {
  it('renders a clash disclosure spelling the count exactly as frame :161 draws it, for a seeded 2-session clash', () => {
    const a = placedSession('c1', 'DFC-014', 'Taming 40-Minute CI', 'Priya Raman', 'r1', 660, 690);
    const b = placedSession('c2', 'DFC-047', 'Onboarding in 30 Minutes', 'Ruth Adeyemi', 'r1', 675, 705);
    const conflicts: AgendaConflict[] = [
      { kind: 'room_overlap', submissionIds: ['c1', 'c2'], day: DAY, roomId: 'r1', detail: 'clash' },
    ];
    render(<PhoneAgenda {...baseProps({ placed: [a, b], conflicts })} />);

    const clash = document.querySelector('.chq-phone-slot-clash');
    expect(clash).not.toBeNull();
    const flag = clash!.querySelector('.chq-flag');
    expect(flag).not.toBeNull();
    // Frame :161 draws the literal "Two sessions in this slot" (spelled
    // word), and DEC-380 wave-32 built exactly that. The shape assertion
    // moves with it: spelled head, still count-derived (the three-way
    // falsifier lives in PhoneAgenda.falsifiability.render.test.tsx, which
    // proves "Three" for n=3 and so rules out a hardcoded "Two").
    expect(flag!.textContent).toMatch(/^[A-Z][a-z]+ sessions? in this slot$/);
    expect(flag!.textContent).toBe('Two sessions in this slot');

    // both clashing sessions' title+speaker render inside the disclosure
    expect(within(clash as HTMLElement).getByText('Taming 40-Minute CI')).toBeInTheDocument();
    expect(within(clash as HTMLElement).getByText('Onboarding in 30 Minutes')).toBeInTheDocument();
  });

  it('frame :171\'s inline "Move <ref> to <time>" resolution action now renders on the clash card, naming DFC-047 (divergence CLOSED by DEC-895 wave-33)', () => {
    const a = placedSession('c1', 'DFC-014', 'Taming 40-Minute CI', 'Priya Raman', 'r1', 660, 690);
    const b = placedSession('c2', 'DFC-047', 'Onboarding in 30 Minutes', 'Ruth Adeyemi', 'r1', 675, 705);
    const conflicts: AgendaConflict[] = [
      { kind: 'room_overlap', submissionIds: ['c1', 'c2'], day: DAY, roomId: 'r1', detail: 'clash' },
    ];
    const { container } = render(<PhoneAgenda {...baseProps({ placed: [a, b], conflicts })} />);

    // Exactly ONE resolution per clash card (DEC-895: computed from the
    // card's own sessions, never re-derived per session), carrying the
    // frame's grammar and naming the frame's session -- DFC-047, the later
    // of the two overlapping talks, is the one offered a new slot.
    //
    // The CLOCK is deliberately not pinned here. The suggested time is the
    // first free slot in this file's own day window, so "11:30" would be
    // an artifact of the fixture rather than anything frame :171 fixes.
    // The frame's verbatim sentence "Move DFC-047 to 11:30" is verdicted
    // against its own seeding in PhoneAgenda.clashMove390.render.test.tsx,
    // which quotes frame line :171 in full; duplicating it here with
    // different props would only pin a coincidence.
    const moveButtons = within(container).queryAllByText(/^Move \S+ to \d{1,2}:\d{2}$/);
    expect(moveButtons).toHaveLength(1);
    expect(moveButtons[0]!.textContent).toMatch(/^Move DFC-047 to \d{1,2}:\d{2}$/);
  });
});

describe('Agenda 390 frame :177-178 -- empty-slot placement control reads "Place here" with an "N free" sibling', () => {
  it('renders "Place here" and a "<n> min free" sibling once a session is armed', () => {
    const unscheduled = [unscheduledSession('u1', 'DFC-099', 'A Talk Looking For A Room')];
    render(<PhoneAgenda {...baseProps({ unscheduled })} />);

    // open the sheet and arm the unscheduled session (mirrors the frame's
    // own tap-to-place flow: nothing renders a free target until a session
    // is armed -- PhoneAgenda.tsx's `if (!armed) return null` for 'free').
    fireEvent.click(screen.getByText('Unscheduled 1'));
    fireEvent.click(screen.getByText('A Talk Looking For A Room').closest('button')!);

    const freeButton = document.querySelector('.chq-phone-slot-free');
    expect(freeButton).not.toBeNull();
    expect(within(freeButton as HTMLElement).getByText('Place here')).toBeInTheDocument();
    const lengthLabel = within(freeButton as HTMLElement).getByText(/^\d+ min free$/);
    expect(lengthLabel).toBeInTheDocument();
  });
});

describe('Agenda 390 dock membership ruling holds (DEVIATIONS §3 / DEC-380 wave-116, DEC-576 wave-114) -- recorded, not re-adjudicated', () => {
  it('the dock (.chq-phone-footer-actions) renders exactly Unscheduled + Auto-schedule, no Publish schedule / Breaks control', () => {
    render(<PhoneAgenda {...baseProps()} />);
    const dock = document.querySelector('.chq-phone-footer-actions');
    expect(dock).not.toBeNull();
    const controls = within(dock as HTMLElement).getAllByRole('button');
    expect(controls).toHaveLength(2);
    expect(controls[0]).toHaveAccessibleName(/^Unscheduled \d+$/);
    expect(controls[1]).toHaveAccessibleName(/Auto-schedule/);
    expect(within(dock as HTMLElement).queryByText(/publish/i)).not.toBeInTheDocument();
    expect(within(dock as HTMLElement).queryByText(/breaks/i)).not.toBeInTheDocument();
  });
});
