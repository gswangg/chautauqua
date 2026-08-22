// DEC-380 wave-32 (w32-f): docs/design/Chautauqua Agenda.dc.html:161 draws
// the phone clash card's flag SPELLED -- "Two sessions in this slot" -- not
// the numeral `countOf()` form PhoneAgenda.tsx used before this task. This
// file is the frame-anchored receipt for the fix: mounts the real
// PhoneAgenda with a 2-session clash slot and a 3-session clash slot and
// asserts the spelled flag text for each, re-reading the .dc.html line at
// assert time (DEC-967: a citation is not an assertion until it is checked
// against the actual line).
//
// countOf/src/domain/count-copy.ts is UNCHANGED and stays read-only -- it
// remains the numeral helper for this pack's data-dense registers. This one
// flag composes capitalizeFirst(spellCount(n)) + plural(n, 'session'), the
// pack's own spelled-count grammar already shipping in
// app/src/pages/overview/AgendaWorkSection.tsx, app/src/pages/overview/rows.ts
// and src/domain/scorecardLogic.ts, all re-exported from app/src/lib/plural.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PhoneAgenda } from './PhoneAgenda';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';

afterEach(() => {
  cleanup();
});

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Agenda.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const ROOM: AgendaRoom = { id: 'room-1', name: 'Ballroom' };
const DAY = '2026-09-01';
const NO_CONFLICTS: AgendaConflict[] = [];

function session(id: string, ref: string, title: string, startMin: number, endMin: number): PlacedAgendaSession {
  return {
    submissionId: id,
    ref,
    title,
    trackIds: [],
    speakers: [],
    roomId: ROOM.id,
    day: DAY,
    startMin,
    endMin,
  };
}

function baseProps(placed: PlacedAgendaSession[]) {
  return {
    day: DAY,
    days: [DAY],
    onDayChange: () => {},
    rooms: [ROOM],
    placed,
    unscheduled: [] as UnscheduledAgendaSession[],
    conflicts: NO_CONFLICTS,
    summary: { unplaced: 0, conflicts: 0, placed: placed.length, total: placed.length },
    dayStartMin: 540,
    dayEndMin: 600,
    gridMin: 15,
    onPlace: () => {},
    onUnschedule: () => {},
    onAutoSchedule: () => {},
    autoScheduling: false,
  };
}

describe('v12 frame: Agenda 390 clash card flag spells its count (DEC-380 wave-32)', () => {
  it('a 2-session clash reads "Two sessions in this slot", not the numeral', () => {
    // In-body receipt (DEC-998 wave-17, task w17-c): docs/design/Chautauqua Agenda.dc.html:161 draws `                <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Two sessions in this slot</span>`, checked byte-for-byte by verbatimLine() immediately below.
    verbatimLine(
      161,
      `                <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Two sessions in this slot</span>`,
    );
    const placed = [
      session('s1', 'SES-1', 'Talk One', 540, 570),
      session('s2', 'SES-2', 'Talk Two', 545, 575),
    ];
    render(<PhoneAgenda {...baseProps(placed)} />);
    expect(screen.getByText('Two sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('2 sessions in this slot')).not.toBeInTheDocument();
  });

  it('a 3-session clash reads "Three sessions in this slot" -- the count is derived, not a fixed spelled string', () => {
    verbatimLine(
      161,
      `                <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Two sessions in this slot</span>`,
    );
    const placed = [
      session('s1', 'SES-1', 'Talk One', 540, 570),
      session('s2', 'SES-2', 'Talk Two', 545, 575),
      session('s3', 'SES-3', 'Talk Three', 550, 580),
    ];
    render(<PhoneAgenda {...baseProps(placed)} />);
    expect(screen.getByText('Three sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('3 sessions in this slot')).not.toBeInTheDocument();
    expect(screen.queryByText('Two sessions in this slot')).not.toBeInTheDocument();
  });
});
