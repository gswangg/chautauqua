// Coverage-audit item #1 (docs/eval-findings.md): manual placement is
// click-to-arm (DEC-570), but the only affordance copy said "Drag to a
// slot" and the card's accessible name never mentioned selection — both
// official eval runs failed to discover manual placement even though it
// works. These tests pin the discoverable wording: the tray hint names the
// click path, and a selectable card states the action in its accessible
// name (what an accessibility-tree-driven agent actually reads).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { UnscheduledTray } from "./UnscheduledTray";
import { SessionCard } from "./SessionCard";
import { DayGrid } from "./DayGrid";
import type { AgendaRoom, PlacedAgendaSession } from "./types";

const SESSION = {
  submissionId: "sub-1",
  ref: "SES-001",
  title: "Talk One",
  trackIds: [],
  speakers: [],
};

describe("agenda placement discoverability", () => {
  it("tray hint names the click-to-place path, not only dragging", () => {
    render(
      <UnscheduledTray
        sessions={[SESSION as never]}
        tracks={[]}
        conflicts={[]}
        unplacedReasons={[]}
        onDropUnschedule={() => {}}
        armed={null}
        onArm={() => {}}
      />,
    );
    const hint = document.querySelector(".chq-unscheduled-tray-hint");
    expect(hint?.textContent).toMatch(/click a session/i);
    expect(hint?.textContent).toMatch(/click a time slot/i);
  });

  it("selectable card's accessible name states the select-then-place action", () => {
    render(
      <SessionCard session={SESSION as never} conflicts={[]} onSelect={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /SES-001: Talk One — click to select, then choose a time slot/ }),
    ).toBeTruthy();
  });

  it("non-selectable card keeps the plain name", () => {
    render(<SessionCard session={SESSION as never} conflicts={[]} />);
    expect(screen.getByRole("button", { name: "SES-001: Talk One" })).toBeTruthy();
  });

  it("a placed (grid) card's accessible name says the gesture is a move, not a first placement", () => {
    render(
      <SessionCard session={SESSION as never} conflicts={[]} onSelect={() => {}} placed />,
    );
    expect(
      screen.getByRole("button", { name: /SES-001: Talk One — click to select, then choose a new slot/ }),
    ).toBeTruthy();
  });
});

// USER-FILED regression (release night): "the dragging in the agenda no
// longer has visual indicators of where you should place (like highlighting
// the prospective row, calculating free mins)". The DEC-899/900 affordance —
// a highlighted prospective slot plus a "Place here · N MIN FREE" readout —
// was built for the click-to-arm path only, and it hangs off CSS :hover,
// which a browser freezes for the entire duration of an HTML5 drag. So the
// drag gesture, the one the report names, could never show it. These tests
// pin the affordance for BOTH placement gestures.

const AFFORDANCE_ROOMS: AgendaRoom[] = [{ id: 'room-1', name: 'Room One' }];

const AFFORDANCE_GRID_PROPS = {
  day: '2026-08-13',
  rooms: AFFORDANCE_ROOMS,
  tracks: [],
  placed: [] as PlacedAgendaSession[],
  conflicts: [],
  dayStartMin: 540,
  dayEndMin: 660,
  gridMin: 15,
  onDropPlace: () => {},
  onArm: () => {},
  onPlaceAt: () => {},
};

const ARMED = { submissionId: 'sub-9', ref: 'SES-009', title: 'Talk Nine', durationMin: 30 };

/** The occupied slot the free-minutes run must stop at: 10:00–10:30 in the
 * one room, so a 9:00 candidate slot reads exactly 60 minutes free. */
const BLOCKER: PlacedAgendaSession = {
  submissionId: 'sub-blocker',
  ref: 'SES-100',
  title: 'Already Placed',
  trackIds: [],
  speakers: [],
  roomId: 'room-1',
  day: '2026-08-13',
  startMin: 600,
  endMin: 630,
};

describe('agenda placement affordance: prospective slot + free minutes', () => {
  it('ARMED path: the candidate slot carries the free-minutes readout, capped at the next occupied slot', () => {
    const { container } = render(
      <DayGrid {...AFFORDANCE_GRID_PROPS} placed={[BLOCKER]} armed={ARMED} />,
    );
    const cell = container.querySelector('.chq-day-grid-cell-btn[data-start-min="540"]');
    expect(cell).not.toBeNull();
    expect(cell!.querySelector('.chq-day-grid-cell-hover-label')!.textContent).toBe(
      'Place here · 60 MIN FREE',
    );
  });

  it('DRAG path: dragging over a slot marks it as the drop target and shows the same readout', () => {
    const { container } = render(
      <DayGrid {...AFFORDANCE_GRID_PROPS} placed={[BLOCKER]} armed={null} />,
    );
    const cell = container.querySelector('.chq-day-grid-cell[data-start-min="540"]')!;
    // Nothing is armed, so at rest the cell is a plain, unmarked drop zone.
    expect(cell.classList.contains('chq-day-grid-cell-drop-target')).toBe(false);
    expect(cell.querySelector('.chq-day-grid-cell-hover-label')).toBeNull();

    fireEvent.dragOver(cell);

    const target = container.querySelector('.chq-day-grid-cell[data-start-min="540"]')!;
    expect(target.classList.contains('chq-day-grid-cell-drop-target')).toBe(true);
    expect(target.querySelector('.chq-day-grid-cell-hover-label')!.textContent).toBe(
      'Place here · 60 MIN FREE',
    );
    // Exactly one slot is ever the live target.
    expect(container.querySelectorAll('.chq-day-grid-cell-drop-target')).toHaveLength(1);
  });

  it('DRAG path: the highlight follows the pointer and is dropped when the drag leaves the grid', () => {
    const { container } = render(<DayGrid {...AFFORDANCE_GRID_PROPS} armed={null} />);
    fireEvent.dragOver(container.querySelector('.chq-day-grid-cell[data-start-min="540"]')!);
    fireEvent.dragOver(container.querySelector('.chq-day-grid-cell[data-start-min="570"]')!);
    expect(
      container.querySelector('.chq-day-grid-cell-drop-target')!.getAttribute('data-start-min'),
    ).toBe('570');

    fireEvent.dragLeave(container.querySelector('.chq-day-grid')!, { relatedTarget: document.body });
    expect(container.querySelector('.chq-day-grid-cell-drop-target')).toBeNull();
  });

  it('DRAG path over an ARMED grid marks the same slot, so the two gestures never disagree', () => {
    const { container } = render(<DayGrid {...AFFORDANCE_GRID_PROPS} armed={ARMED} />);
    const cell = container.querySelector('.chq-day-grid-cell-btn[data-start-min="570"]')!;
    fireEvent.dragOver(cell);
    expect(
      container.querySelector('.chq-day-grid-cell-drop-target')!.getAttribute('data-start-min'),
    ).toBe('570');
  });

  it('the drop-target slot is actually PAINTED (ring + tint) and reveals its readout', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'agenda.css'),
      'utf-8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const body = css.match(/\.chq-day-grid-cell-drop-target\s*\{([^{}]*)\}/)![1]!;
    expect(body).toMatch(/outline\s*:\s*3px solid var\(--chq-brand\)/);
    expect(body).toMatch(/background\s*:\s*color-mix\(/);
    const labelBody = css.match(
      /\.chq-day-grid-cell-drop-target \.chq-day-grid-cell-hover-label\s*\{([^{}]*)\}/,
    )![1]!;
    expect(labelBody).toMatch(/display\s*:\s*block/);
  });
});
