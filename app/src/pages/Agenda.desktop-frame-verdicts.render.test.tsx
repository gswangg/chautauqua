// w24-d (DEC-651 wave-24): the per-frame DESKTOP (1600/560) render verdict
// for Agenda's two desktop frames (docs/design/Chautauqua Agenda.dc.html) --
// Day grid · 1600 (:28) and the Breaks modal (:209). Sibling to
// Agenda.frame-verdicts.render.test.tsx (the single 390 frame), which this
// file does not touch. STRICTLY MEASUREMENT ONLY: desktop is frozen by the
// mandate -- this file moves no desktop byte and edits no component or
// stylesheet, it renders the real route, verdicts what the tree actually
// produces, and files divergences in prose.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) helper pointed at this cluster's own design
// file, same beforeEach/afterEach console guard. jsdom applies no
// stylesheet, so every assertion here is DOM structure/order/text.
//
// AgendaPage splits on useIsPhone() (matchMedia '(max-width: 700px)'); this
// file needs the DESKTOP branch, so it stubs matchMedia to NOT match --
// FakeMediaQueryList/stubPhoneMatchMedia copied from
// Agenda.frame-verdicts.render.test.tsx's own idiom and inverted (matches
// false, per that file's own header comment on the split).
//
// DEC-651 (Amendment wave 24): frame :209 "Breaks" is a Modal frame,
// verdicted by operating the control that opens it on the real route (the
// agenda head's "Breaks ›" disclosure), never by mounting BreaksPanel
// directly. DEVIATIONS §3 / DEC-380 wave-116 already rules the 390 dock's
// membership question for Breaks -- that ruling is phone-only and is not
// touched or extended here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AgendaPage } from './Agenda';
import { mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Agenda.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-agenda-desktop-verdicts';

/** Minimal jsdom-safe MediaQueryList stand-in, copied from
 * Agenda.frame-verdicts.render.test.tsx's own FakeMediaQueryList /
 * stubPhoneMatchMedia -- `matches: false` forces AgendaPage's DESKTOP
 * branch (jsdom's own matchMedia-undefined default already lands there too,
 * but stubbing it explicitly makes the intent an assertion, not an
 * accident of the test environment). */
class FakeMediaQueryList {
  matches = false;
  addEventListener() {}
  removeEventListener() {}
}

function stubDesktopMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function agendaPayload() {
  return {
    days: ['2026-08-11', '2026-08-12', '2026-08-13'],
    rooms: [
      { id: 'room-1', name: 'Main Stage' },
      { id: 'room-2', name: 'Room 2A' },
    ],
    tracks: [],
    placed: [
      {
        submissionId: 'sub-1',
        ref: 'DFC-014',
        title: 'Taming 40-Minute CI',
        trackIds: [],
        speakers: [{ contactId: 'c1', name: 'Priya Raman' }],
        roomId: 'room-2',
        day: '2026-08-11',
        startMin: 600,
        endMin: 645,
      },
    ],
    unscheduled: [
      { submissionId: 'sub-2', ref: 'DFC-033', title: 'Docs That Answer Back', trackIds: [], speakers: [] },
    ],
    conflicts: [],
    unplacedReasons: [],
    // Header numbers match the frame's own :57 illustration (verdicted below).
    summary: { unplaced: 6, conflicts: 2, placed: 74, total: 100 },
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function renderAgenda() {
  stubDesktopMatchMedia();
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    [`GET /api/v1/events/${EVENT_ID}/breaks`]: {
      items: [
        { id: 'brk-1', eventId: EVENT_ID, day: '2026-08-11', label: 'Morning coffee', location: null, startMin: 630, durationMin: 15, createdAt: 0, updatedAt: 0 },
      ],
    },
  });
  return render(
    <MemoryRouter initialEntries={['/agenda']}>
      <AgendaPage />
    </MemoryRouter>,
  );
}

describe('v12 Agenda DESKTOP (1600) frames: per-frame render verdict receipts (w24-d, DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Day grid · 1600"
  // ---------------------------------------------------------------------
  describe('frame :28 "Day grid · 1600"', () => {
    it('MATCHES: the head summary reads "N unplaced · N conflicts · P% placed" verbatim, with only the conflict count bolded', async () => {
      renderAgenda();
      await screen.findByRole('heading', { name: 'Agenda' });
      const summary = document.querySelector<HTMLElement>('.chq-agenda-head .chq-agenda-summary')!;
      // docs/design/Chautauqua Agenda.dc.html:57 --
      // `<span style="font-size:13px; color:#565A4B">6 unplaced · <strong style="color:#1B1D17">2 conflicts</strong> · 74% placed</span>`
      verbatimLine(57, '            <span style="font-size:13px; color:#565A4B">6 unplaced · <strong style="color:#1B1D17">2 conflicts</strong> · 74% placed</span>');
      expect(summary.textContent).toBe('6 unplaced · 2 conflicts · 74% placed');
      expect(within(summary).getByText('2 conflicts').tagName).toBe('STRONG');
    });

    it('RESOLVED-BY-RULING (DEC-902, wave 9): the head action row also carries a "Breaks ›" disclosure the frame draws nowhere in the 1600 header -- a real, later-landed capability the frame\'s canvas predates, blessed', async () => {
      renderAgenda();
      await screen.findByRole('heading', { name: 'Agenda' });
      const actions = document.querySelector<HTMLElement>('.chq-agenda-head-actions')!;
      // docs/design/Chautauqua Agenda.dc.html:60 --
      // `<a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Auto-schedule</a>`
      verbatimLine(60, '            <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Auto-schedule</a>');
      expect(within(actions).getByRole('button', { name: 'Auto-schedule' })).toBeInTheDocument();
      expect(within(actions).getByRole('button', { name: 'Publish schedule' })).toBeInTheDocument();
      // The frame's own head-action row (line 61 is the Publish schedule
      // sibling) holds exactly those two controls -- no drawn Breaks
      // trigger anywhere on the 1600 canvas, only on the separate Modal
      // frame's own canvas (verdicted below).
      expect(within(actions).getByRole('button', { name: 'Breaks ›' })).toBeInTheDocument();
    });

    it('MATCHES: the day-tab row carries a pill per day plus the "Clashes are flagged, not blocked" note', async () => {
      renderAgenda();
      await screen.findByRole('heading', { name: 'Agenda' });
      // docs/design/Chautauqua Agenda.dc.html:69 --
      // `<span style="margin-left:auto; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#565A4B">Clashes are flagged, not blocked</span>`
      verbatimLine(69, '          <span style="margin-left:auto; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#565A4B">Clashes are flagged, not blocked</span>');
      const dayTabs = screen.getAllByRole('tab');
      expect(dayTabs.length).toBe(3);
      expect(screen.getByText('Clashes are flagged, not blocked')).toBeInTheDocument();
    });

    it('MATCHES: the day grid mounts (never the phone tree) with a room-header column per room, and a placed session card carries its ref/title/speaker', async () => {
      renderAgenda();
      await waitFor(() => expect(document.querySelector('.chq-day-grid')).not.toBeNull());
      expect(document.querySelector('.chq-phone-agenda')).toBeNull();
      const headers = document.querySelectorAll('.chq-day-grid-room-header');
      // docs/design/Chautauqua Agenda.dc.html:75 --
      // `<div style="display:grid; grid-template-columns:62px repeat(4, 1fr)">`
      // (a leading time column plus one column per room, matched here by
      // the header count equalling the fixture's room count.)
      verbatimLine(75, '            <div style="display:grid; grid-template-columns:62px repeat(4, 1fr)">');
      expect(headers).toHaveLength(2);
      expect([...headers].map((h) => h.textContent)).toEqual(['Main Stage', 'Room 2A']);
      const card = screen.getByRole('button', { name: /Taming 40-Minute CI/ });
      expect(card).toHaveTextContent('DFC-014');
      expect(card).toHaveTextContent('Priya Raman');
    });

    it('MATCHES: the Unscheduled tray carries the label, a right-aligned count, and the drag hint', async () => {
      renderAgenda();
      await screen.findByRole('heading', { name: 'Agenda' });
      // docs/design/Chautauqua Agenda.dc.html:113 --
      // `<span style="font-size:11px; color:#565A4B; line-height:1.5">Drag to a slot · drag back to unschedule</span>`
      verbatimLine(113, '            <span style="font-size:11px; color:#565A4B; line-height:1.5">Drag to a slot · drag back to unschedule</span>');
      expect(document.querySelector('.chq-unscheduled-tray-header')?.textContent).toBe('Unscheduled1');
      expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument();
      expect(screen.getByText('Drag to a slot · drag back to unschedule')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :209 "Breaks · Tue 12 May" (Modal, DEC-651)
  // ---------------------------------------------------------------------
  describe('frame :209 "Breaks · Tue 12 May"', () => {
    async function openBreaks() {
      renderAgenda();
      await screen.findByRole('heading', { name: 'Agenda' });
      // Real control: the agenda head's own "Breaks ›" disclosure -- never
      // <BreaksPanel ... /> mounted directly (DEC-651).
      fireEvent.click(screen.getByRole('button', { name: 'Breaks ›' }));
      return screen.findByRole('dialog');
    }

    it('MATCHES (DEC-651: opened via the real control): the dialog title is the day-scoped "Breaks on <Weekday>" with "They block every room at once" as its subtitle', async () => {
      const dialog = await openBreaks();
      // docs/design/Chautauqua Agenda.dc.html:216 (the dialog's own title span) --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Breaks on Tuesday</span>`
      // -- line 217 is the sibling subtitle span, "They block every room at once".
      verbatimLine(216, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Breaks on Tuesday</span>');
      expect(within(dialog).getByRole('heading', { name: 'Breaks on Tuesday' })).toBeInTheDocument();
      expect(within(dialog).getByText('They block every room at once')).toBeInTheDocument();
    });

    it('MATCHES: an existing break row states its label, start time and duration', async () => {
      const dialog = await openBreaks();
      // docs/design/Chautauqua Agenda.dc.html:224 (the row's label cell) --
      // `<span style="font-size:15px; font-weight:600">{{ b.label }}</span>`
      // -- lines 225-226 are the sibling start/duration cells, same shape.
      verbatimLine(224, '            <span style="font-size:15px; font-weight:600">{{ b.label }}</span>');
      const row = dialog.querySelector('.chq-breaks-row')!;
      expect(row).toHaveTextContent('Morning coffee');
      expect(row).toHaveTextContent('10:30');
      expect(row).toHaveTextContent('15 min');
    });

    it('RESOLVED-BY-RULING (DEC-902, wave 9): an existing row carries BOTH Edit and Remove; the frame draws only a single "Remove" link per row -- the inline-edit affordance is a real, later-landed capability, blessed', async () => {
      const dialog = await openBreaks();
      // docs/design/Chautauqua Agenda.dc.html:227 -- the frame's own row
      // actions cell is exactly one control, `Remove`.
      verbatimLine(227, '            <a href="#" style="font-size:12px; font-weight:700; color:#565A4B">Remove</a>');
      const row = dialog.querySelector<HTMLElement>('.chq-breaks-row')!;
      expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('MATCHES: the add-break form carries Label / Starts / Minutes fields, the outside-window hint, and Add the break + Done', async () => {
      const dialog = await openBreaks();
      // docs/design/Chautauqua Agenda.dc.html:232/236/240 -- the add form's
      // three field labels, `Label` / `Starts` / `Minutes`.
      verbatimLine(232, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Label</span>');
      expect(within(dialog).getByLabelText('Label')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Starts')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Minutes')).toBeInTheDocument();
      // docs/design/Chautauqua Agenda.dc.html:244 (the outside-window hint) --
      // `A break outside the day's window is kept but flagged`
      verbatimLine(244, '        <span style="font-size:13px; color:#565A4B; line-height:1.55">A break outside the day\'s window is kept but flagged — the grid shows it greyed rather than dropping it.</span>');
      expect(
        within(dialog).getByText(
          "A break outside the day's window is kept but flagged — the grid shows it greyed rather than dropping it.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Add the break' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });
});
