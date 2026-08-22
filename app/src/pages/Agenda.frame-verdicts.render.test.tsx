// w14-sc (DEC-976 wave-157): per-frame 390 render-verdict receipt for
// docs/design/Chautauqua Agenda.dc.html :127 "Agenda" (the phone tap-to-place
// tree, DEC-380). Entered through AgendaPage's real mount (the same
// component /agenda routes to), never by mounting agenda/PhoneAgenda
// directly -- AgendaPage's own useIsPhone() split (matchMedia
// '(max-width: 700px)') decides which tree renders, so this file stubs
// window.matchMedia to force the phone branch, copying the
// `FakeMediaQueryList`/`stubPhoneMatchMedia` idiom
// pages/agenda/Agenda.render.test.tsx already uses for the identical split.
// jsdom applies no stylesheet, so every assertion below is about DOM
// STRUCTURE/ORDER, never computed geometry. Agenda has no audit doc (DEC-976
// wave-105: a cluster with a single-item verdict files it in the test file's
// own header rather than a near-empty docs/design/audit/*.md) -- this
// comment IS that verdict:
//
// VERDICT -- frame :127 Agenda -- MATCHES: the phone head repeats the frame's
// wordmark+counts row (:130-131), then an H1 "Agenda" (:133), then a day-pill
// row (:135-137, "Tue 12"/"Wed 13"/"Thu 14" shape), then a room-chip row
// carrying a CLASH flag on a conflicted room (:140) -- the same four-band
// order docs/design/Chautauqua Agenda.dc.html's 390 frame draws, and the same
// order agenda/PhoneAgenda.tsx renders them in (wordmark/counts row, h1, day
// chips, room chips).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { AgendaPage } from './Agenda';
import { mockApi } from '../test-utils/mockApi';
import { stripCssComments } from '../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Agenda.dc.html');
const AGENDA_CSS = join(HERE, 'agenda', 'agenda.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** w15-v (DEC-808/DEC-994): jsdom evaluates no `@media` block, so the DOM
 * order asserted below (counts row -> h1 -> day chips -> room chips) is
 * really just element source order -- it says nothing about whether the
 * frame's stacked column layout is what actually PAINTS at 390px. Extract
 * agenda.css's terminal `@media (max-width: 700px)` block by brace-depth --
 * same idiom as Contacts.frame-verdicts.render.test.tsx's own
 * `readContactsPhoneLayer`. */
function readAgendaPhoneLayer(): string {
  const css = stripCssComments(readFileSync(AGENDA_CSS, 'utf-8'));
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const openMatch = opener.exec(css);
  if (openMatch === null) throw new Error('agenda.css has no @media (max-width: 700px) block');
  let depth = 1;
  let i = openMatch.index + openMatch[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error('agenda.css phone block never closes');
  return css.slice(start, i - 1);
}

const EVENT_ID = 'evt-agenda-frame-verdicts';

/** Minimal jsdom-safe MediaQueryList stand-in, copied verbatim from
 * pages/agenda/Agenda.render.test.tsx's own `FakeMediaQueryList` /
 * `stubPhoneMatchMedia` -- jsdom implements no matchMedia at all, so
 * AgendaPage's default (matchMedia undefined -> desktop tree) is never the
 * phone frame this test targets. */
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function agendaPayload() {
  return {
    days: ['2026-08-11', '2026-08-12', '2026-08-13'],
    rooms: [
      { id: 'room-1', name: 'Room 2A' },
      { id: 'room-2', name: 'Room 2B' },
    ],
    tracks: [],
    placed: [
      {
        submissionId: 'sub-1',
        ref: 'S-001',
        title: 'Clashing Talk A',
        trackIds: [],
        speakers: [],
        roomId: 'room-1',
        day: '2026-08-11',
        startMin: 600,
        endMin: 660,
      },
      {
        submissionId: 'sub-2',
        ref: 'S-002',
        title: 'Clashing Talk B',
        trackIds: [],
        speakers: [],
        roomId: 'room-1',
        day: '2026-08-11',
        startMin: 630,
        endMin: 690,
      },
    ],
    unscheduled: [],
    conflicts: [
      {
        kind: 'room_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        detail: 'Clashing Talk A and Clashing Talk B overlap in Room 2A.',
      },
    ],
    unplacedReasons: [],
    summary: { unplaced: 6, conflicts: 2, placed: 2, total: 8 },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('v12 Agenda 390 frame: per-frame render verdict receipt (w14-sc, DEC-976)', () => {
  it('frame :127 Agenda -- MATCHES: wordmark+counts row, then H1 "Agenda", then day pills, then a room-chip row carrying a CLASH flag, in that order', async () => {
    stubPhoneMatchMedia();
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
      [`GET /api/v1/events/${EVENT_ID}/breaks`]: { items: [] },
    });

    render(
      <MemoryRouter initialEntries={['/agenda']}>
        <AgendaPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.querySelector('.chq-phone-agenda')).not.toBeNull());
    expect(document.querySelector('.chq-day-grid')).toBeNull();

    const phoneAgenda = document.querySelector('.chq-phone-agenda')!;
    const head = phoneAgenda.querySelector('.chq-phone-agenda-head')!;

    // jsdom's DOM-order assertions below (counts row -> h1 -> day chips ->
    // room chips) only prove source order, not the frame's stacked
    // single-column band -- agenda.css's terminal phone block is what
    // actually makes `.chq-phone-agenda-head` a top-to-bottom flex column
    // instead of the desktop row it would otherwise be.
    const phoneLayer = readAgendaPhoneLayer();
    expect(phoneLayer).toMatch(/\.chq-phone-agenda-head\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);

    // docs/design/Chautauqua Agenda.dc.html:131 `          <span style="margin-left:auto; font-size:12px; font-weight:600; color:#565A4B">6 unplaced · 2 clash</span>`
    verbatimLine(131, '          <span style="margin-left:auto; font-size:12px; font-weight:600; color:#565A4B">6 unplaced · 2 clash</span>');
    const countsRow = head.querySelector('.chq-phone-agenda-head-top')!;
    expect(countsRow.textContent).toBe('chautauqua6 unplaced · 2 clash');

    const h1 = head.querySelector('.chq-phone-agenda-h1')!;
    // docs/design/Chautauqua Agenda.dc.html:133 `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Agenda</h1>`
    verbatimLine(133, '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Agenda</h1>');
    expect(h1.textContent).toBe('Agenda');
    expect(countsRow.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const dayChips = head.querySelector('.chq-phone-day-chips')!;
    expect(h1.compareDocumentPosition(dayChips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dayChips.textContent).toContain('Tue 11');

    const roomChips = head.querySelector('.chq-chipstrip')!;
    expect(dayChips.compareDocumentPosition(roomChips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // docs/design/Chautauqua Agenda.dc.html:140 `          <span style="flex-shrink:0; background:#4E5C31; color:#F7F9F0; border-radius:99px; min-height:44px; display:flex; align-items:center; gap:8px; padding:0 14px; font-size:13px; font-weight:700">Room 2A <span style="font-size:10px; font-weight:800; letter-spacing:0.08em">CLASH</span></span>`
    verbatimLine(140, '          <span style="flex-shrink:0; background:#4E5C31; color:#F7F9F0; border-radius:99px; min-height:44px; display:flex; align-items:center; gap:8px; padding:0 14px; font-size:13px; font-weight:700">Room 2A <span style="font-size:10px; font-weight:800; letter-spacing:0.08em">CLASH</span></span>');
    const clashChip = screen.getByRole('button', { name: /Room 2A/ });
    expect(clashChip.querySelector('.chq-flag')?.textContent).toBe('CLASH');
    expect(roomChips.contains(clashChip)).toBe(true);
  });
});
