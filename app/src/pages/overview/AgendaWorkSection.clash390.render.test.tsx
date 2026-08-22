// DEC-919 wave-32 amendment: Overview §04's 390 clash row collapses the
// desktop per-entry list into ONE joined sentence with a muted "share this
// slot" tail (Chautauqua Overview.dc.html:275). This file is the render
// receipt for that node — mounts AgendaWorkSection with a payload carrying
// both a 2-entry and a 3-entry conflict (DEC-180: a conflict can carry more
// than two entries, so the join must never hard-code two), and pins the CSS
// half (both new rules live inside the terminal
// @media (max-width: 700px) block, never at top level) by brace-matching
// overview.css's own text, mirroring
// app/src/pages/submissions/detail-head-390.test.ts's phoneLayer helper.
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

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Overview.dc.html');
const CSS = readFileSync(join(HERE, 'overview.css'), 'utf-8');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Overview.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Brace-matches every `@media (max-width: 700px) { ... }` block in
 * overview.css and concatenates their bodies — copied from
 * app/src/pages/submissions/detail-head-390.test.ts's own phoneLayer. */
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
      conflictTotal: 2,
      conflicts: [
        {
          day: '2027-03-11',
          startMin: 600,
          endMin: 660,
          roomName: 'Room 2A',
          kind: 'room_overlap',
          entries: [
            { submissionId: 'sub-a', ref: 'DFC-014', title: 'Taming 40-Minute CI', speakerName: 'Priya Raman' },
            { submissionId: 'sub-b', ref: 'DFC-047', title: 'Onboarding in 30 Minutes', speakerName: 'Ruth Adeyemi' },
          ],
          resolution: null,
        },
        {
          day: '2027-03-11',
          startMin: 720,
          endMin: 780,
          roomName: 'Room 2B',
          kind: 'room_overlap',
          entries: [
            { submissionId: 'sub-c', ref: 'DFC-050', title: 'Docs That Answer Back', speakerName: 'Dana Whitmore' },
            { submissionId: 'sub-d', ref: 'DFC-051', title: 'Shipping Without Fear', speakerName: 'Marcus Okafor' },
            { submissionId: 'sub-e', ref: 'DFC-052', title: 'Testing at the Edge', speakerName: 'Lena Vogt' },
          ],
          resolution: null,
        },
      ],
      unplaced: [],
      unplacedRemainderDurationMin: null,
    },
    'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 0, conflicts: 2 },
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

describe('Overview §04 clash row — 390 joined sentence (DEC-919 wave-32)', () => {
  it('frame :275 draws the clash sessions as one joined sentence with a muted "share this slot" tail', () => {
    verbatimLine(
      275,
      '            <span style="font-size:15px; line-height:1.5">Taming 40-Minute CI and Onboarding in 30 Minutes <span style="color:#565A4B">share this slot</span></span>',
    );
  });

  it('renders exactly one phone clash-line node per conflict row, naming every entry title, ending in "share this slot"', () => {
    const { container } = render(<Harness />);
    const rows = container.querySelectorAll('.chq-overview-row-agenda');
    expect(rows.length).toBe(2);

    const phoneLine1 = (rows[0] as HTMLElement).querySelectorAll('.chq-overview-clash-line-phone');
    expect(phoneLine1).toHaveLength(1);
    expect(phoneLine1[0]).toHaveTextContent('Taming 40-Minute CI and Onboarding in 30 Minutes share this slot');

    const phoneLine2 = (rows[1] as HTMLElement).querySelectorAll('.chq-overview-clash-line-phone');
    expect(phoneLine2).toHaveLength(1);
    // DEC-180: a conflict can carry three or more entries — the join must
    // name every title, never hard-code two.
    expect(phoneLine2[0]).toHaveTextContent(
      'Docs That Answer Back and Shipping Without Fear and Testing at the Edge share this slot',
    );
  });

  it('keeps the desktop per-entry nodes in the DOM alongside the phone node (jsdom applies no @media — DEC-874)', () => {
    const { container } = render(<Harness />);
    const rows = container.querySelectorAll('.chq-overview-row-agenda');

    const row1 = within(rows[0] as HTMLElement);
    const desktop1 = row1.getByText((_, el) => el?.className === 'chq-overview-clash-entries-desktop');
    expect(within(desktop1).getByText('Taming 40-Minute CI')).toBeInTheDocument();
    expect(within(desktop1).getByText('Onboarding in 30 Minutes')).toBeInTheDocument();

    const row2 = within(rows[1] as HTMLElement);
    const desktop2 = row2.getByText((_, el) => el?.className === 'chq-overview-clash-entries-desktop');
    expect(within(desktop2).getByText('Docs That Answer Back')).toBeInTheDocument();
    expect(within(desktop2).getByText('Shipping Without Fear')).toBeInTheDocument();
    expect(within(desktop2).getByText('Testing at the Edge')).toBeInTheDocument();
  });

  it('both new CSS rules live inside the terminal @media (max-width:700px) block, never at top level', () => {
    expect(TOP_LEVEL).not.toMatch(/\.chq-overview-clash-entries-desktop\s*\{/);
    expect(TOP_LEVEL).not.toMatch(/\.chq-overview-clash-line-phone\s*\{[^}]*display:\s*block/);

    expect(PHONE).toMatch(/\.chq-overview-clash-entries-desktop\s*\{[^}]*display:\s*none/);
    expect(PHONE).toMatch(/\.chq-overview-clash-line-phone\s*\{[^}]*display:\s*block/);
    expect(PHONE).toMatch(/\.chq-overview-clash-line-phone\s*\{[^}]*font-size:\s*15px/);
    expect(PHONE).toMatch(/\.chq-overview-clash-line-phone\s*\{[^}]*line-height:\s*1\.5/);
  });
});
