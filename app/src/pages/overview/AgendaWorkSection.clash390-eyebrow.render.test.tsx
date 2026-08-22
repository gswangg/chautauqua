// DEC-919 wave-32 amendment (task w11-ta): Overview §04's 390 clash row
// eyebrow is ONE joined span (Chautauqua Overview.dc.html:274 — weekday +
// day-of-month, start time, and room joined with " · "). This file is the
// render receipt for that node — mounts AgendaWorkSection with a two-entry
// conflict, asserts exactly one `.chq-overview-clash-eyebrow-phone` per
// conflict row and its joined text shape, that the desktop title/meta pair
// is STILL in the DOM (jsdom applies no @media — scoped with `within` per
// DEC-874), and source-scans overview.css to assert both new rules (the
// eyebrow reveal and the resolution-pill fill) live only inside the
// terminal @media (max-width: 700px) block, never at top level. Harness,
// verbatimLine and phoneLayer copied from
// AgendaWorkSection.clash390.render.test.tsx.
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgendaWorkSection } from './AgendaWorkSection';
import type { OverviewPayload } from './types';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Overview.dc.html');
const CSS = stripCssComments(readFileSync(join(HERE, 'overview.css'), 'utf-8'));

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * AgendaWorkSection.clash390.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Brace-matches every `@media (max-width: 700px) { ... }` block in
 * overview.css and concatenates their bodies — copied from
 * AgendaWorkSection.clash390.render.test.tsx's own phoneLayer. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

const PHONE = phoneLayer(CSS);
/** Everything OUTSIDE any @media (max-width:700px) block — the top level. */
const TOP_LEVEL = CSS.replace(/@media\s*\(max-width:\s*700px\)\s*\{[\s\S]*$/, '');

function basePayload(): OverviewPayload {
  return {
    deadlines: { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, planRound: null, eventStartDate: null },
    overdueTasks: { total: 0, rows: [] },
    triage: { total: 0, oldestSubmittedAt: null, rows: [] },
    contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
    agendaWork: {
      unplacedTotal: 0,
      conflictTotal: 1,
      conflicts: [
        {
          day: '2027-03-12',
          startMin: 600,
          endMin: 660,
          roomName: 'Room 2A',
          kind: 'room_overlap',
          entries: [
            { submissionId: 'sub-a', ref: 'DFC-014', title: 'Taming 40-Minute CI', speakerName: 'Priya Raman' },
            { submissionId: 'sub-b', ref: 'DFC-047', title: 'Onboarding in 30 Minutes', speakerName: 'Ruth Adeyemi' },
          ],
          resolution: {
            submissionId: 'sub-b',
            ref: 'DFC-047',
            day: '2027-03-12',
            startMin: 690,
            roomId: 'room-2a',
            roomName: 'Room 2A',
            label: 'Move DFC-047 to 11:30',
          },
        },
      ],
      unplaced: [],
      unplacedRemainderDurationMin: null,
    },
    'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0, evaluationsStarted: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 0, conflicts: 1 },
    comms: { sentLast7Days: 0, lastSentAt: null },
    publishedSessionCount: 0,
  };
}

function Harness() {
  const [state] = useState(basePayload());
  return (
    <MemoryRouter>
      <AgendaWorkSection payload={state} setPayload={() => {}} setError={() => {}} refetch={async () => {}} />
    </MemoryRouter>
  );
}

afterEach(() => cleanup());

describe('Overview §04 clash row — 390 joined eyebrow (DEC-919 wave-32, task w11-ta)', () => {
  it('frame :274 draws the eyebrow as one joined span', () => {
    verbatimLine(
      274,
      '            <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Tue 12, 10:00 · Room 2A</span>',
    );
  });

  it('renders exactly one phone eyebrow node per conflict row with the joined day/time/room text', () => {
    const { container } = render(<Harness />);
    const rows = container.querySelectorAll('.chq-overview-row-agenda');
    expect(rows.length).toBe(1);

    const eyebrow = (rows[0] as HTMLElement).querySelectorAll('.chq-overview-clash-eyebrow-phone');
    expect(eyebrow).toHaveLength(1);
    // formatDayLabel/clockHHMM/publicRoomLabel are this file's existing,
    // unchanged formatters (DEC-877/DEC-900) -- the frame's sample date has
    // no month, but the desktop pair one line above already renders one
    // (DEC-877 "weekday + day-of-month, then start time"), so the eyebrow's
    // joined string carries the same "Fri 12 Mar, 10:00 · Room 2A" shape,
    // not the frame's abbreviated sample text (DEC-967: sample data isn't
    // graded copy).
    expect(eyebrow[0]).toHaveTextContent('Fri 12 Mar, 10:00 · Room 2A');
  });

  it('keeps the desktop day/time and room divs in the DOM alongside the phone node (jsdom applies no @media — DEC-874)', () => {
    const { container } = render(<Harness />);
    const row = within(container.querySelector('.chq-overview-row-agenda') as HTMLElement);

    const desktopTitle = row.getByText((_, el) => el?.className === 'chq-overview-row-title chq-overview-row-title-sm');
    expect(desktopTitle).toHaveTextContent('Fri 12 Mar, 10:00');
    const desktopMeta = row.getAllByText('Room 2A', { selector: '.chq-overview-row-meta' });
    expect(desktopMeta.length).toBeGreaterThanOrEqual(1);
    const eyebrow = row.getByText((_, el) => el?.className === 'chq-overview-clash-eyebrow-phone');
    expect(eyebrow).toHaveTextContent('Fri 12 Mar, 10:00 · Room 2A');
  });

  it('scopes the phone-only reveal to direct children so the shared .chq-overview-row-meta class elsewhere is untouched', () => {
    expect(TOP_LEVEL).not.toMatch(/\.chq-overview-clash-eyebrow-phone\s*\{[^}]*display:\s*block/);
    expect(PHONE).toMatch(
      /\.chq-overview-clash-eyebrow-group\s*>\s*\.chq-overview-row-title-sm,\s*\n?\s*\.chq-overview-clash-eyebrow-group\s*>\s*\.chq-overview-row-meta\s*\{[^}]*display:\s*none/,
    );
    expect(PHONE).toMatch(/\.chq-overview-clash-eyebrow-phone\s*\{[^}]*display:\s*block/);
    expect(PHONE).toMatch(/\.chq-overview-clash-eyebrow-phone\s*\{[^}]*font-size:\s*10px/);
    expect(PHONE).toMatch(/\.chq-overview-clash-eyebrow-phone\s*\{[^}]*font-weight:\s*800/);
    expect(PHONE).toMatch(/\.chq-overview-clash-eyebrow-phone\s*\{[^}]*letter-spacing:\s*0\.1em/);
    expect(PHONE).toMatch(/\.chq-overview-clash-eyebrow-phone\s*\{[^}]*text-transform:\s*uppercase/);
  });

  it('the resolution pill modifier uses existing brand tokens only, inside the terminal block, without restyling the shared class', () => {
    verbatimLine(
      276,
      '            <span style="background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Move DFC-047 to 11:30</span>',
    );

    expect(TOP_LEVEL).not.toMatch(/\.chq-overview-clash-resolve\s*\{/);
    expect(TOP_LEVEL).not.toMatch(/#4[Ee]5[Cc]31/);
    expect(TOP_LEVEL).not.toMatch(/#[Ff]7[Ff]9[Ee]0/);
    expect(PHONE).toMatch(/\.chq-overview-link-btn\.chq-overview-clash-resolve\s*\{[^}]*background:\s*var\(--chq-brand\)/);
    expect(PHONE).toMatch(/\.chq-overview-link-btn\.chq-overview-clash-resolve\s*\{[^}]*color:\s*var\(--chq-on-brand\)/);
    expect(CSS).not.toMatch(/\.chq-overview-clash-resolve\s*\{[^}]*background:\s*#/);

    const { container } = render(<Harness />);
    const button = container.querySelector('.chq-overview-clash-resolve') as HTMLButtonElement;
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('chq-overview-link-btn');
    expect(button).toHaveTextContent('Move DFC-047 to 11:30');
  });
});
