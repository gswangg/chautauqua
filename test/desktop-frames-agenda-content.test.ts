// Desktop-frame claims, Agenda + Content clusters (DEC-976, v12 mobile
// campaign wave 105; task v12m-w5-e). Node tier only -- readFileSync over
// sources, no jsdom, no render. Claims the last four desktop frames outside
// Settings/Portal/Overview/Review:
//   docs/design/Chautauqua Agenda.dc.html (line 28)   "Day grid · 1600"
//   docs/design/Chautauqua Agenda.dc.html (line 209)  "Breaks · Tue 12 May"
//   docs/design/Chautauqua Content.dc.html:111 "Session deliverables · /content/:submissionId"
//   docs/design/Chautauqua Content.dc.html:434 "Upload rejected"
//
// Receipt shape (DEC-976 wave-87/102): each it() carries the strict
// citation `docs/design/<file>.dc.html:<line>` and a backtick-quoted
// literal copied VERBATIM from that frame line, with a real expect() about
// the tree within 6 source lines. Expected values are TYPED literals, never
// a re-read of the frame compared to itself. Assertions run against file
// CONTENT (rendered strings / literal source text), never against an app
// file's line number.
//
// DEVIATION NOTE (filed here per this task's instructions, not in
// DEVIATIONS.md or a shared audit doc): the task's suggested home for the
// :434 "Upload rejected" refusal band was
// `app/src/pages/content/ContentApp.tsx` + `app/src/components/ErrorSummary.tsx`.
// Neither carries this copy -- ErrorSummary.tsx renders the generic
// top-of-form validation summary (DEC-124/DEC-958), not a modal. The actual
// refusal-band modal lives at
// `app/src/pages/content/UploadRejectedModal.tsx`, whose own file header
// cites this exact frame (":431-457") and whose title/action copy matches
// the frame verbatim. This file claims the frame against that real file
// instead of chasing the suggested (wrong) location.
//
// DESKTOP IS FROZEN: this file asserts against existing source; it makes no
// CSS/TSX change. FILE OWNERSHIP: this task creates ONLY this one new file
// under test/ and touches no content/ or agenda/ source or test file --
// v12m-w4-b/v12m-w4-c own those clusters' CSS and phone tests.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const APP_SRC = join(REPO_ROOT, 'app', 'src');

function designFileLines(basename: string): string[] {
  return readFileSync(join(REPO_ROOT, 'docs', 'design', basename), 'utf-8').split('\n');
}

const AGENDA_LINES = designFileLines('Chautauqua Agenda.dc.html');
const CONTENT_LINES = designFileLines('Chautauqua Content.dc.html');

/** 1-based line lookup so a citation's quote can be asserted against the
 * pack itself (not re-derived), catching a re-cut that moves the line. */
function lineOf(lines: string[], fileLabel: string, n: number): string {
  const line = lines[n - 1];
  if (line === undefined) throw new Error(`${fileLabel} has no line ${n}`);
  return line;
}

function agendaLine(n: number): string {
  return lineOf(AGENDA_LINES, 'docs/design/Chautauqua Agenda.dc.html', n);
}

function contentLine(n: number): string {
  return lineOf(CONTENT_LINES, 'docs/design/Chautauqua Content.dc.html', n);
}

function read(relPath: string): string {
  return readFileSync(join(APP_SRC, relPath), 'utf-8');
}

describe('desktop frame claims: Agenda cluster (v12m-w5-e)', () => {
  // docs/design/Chautauqua Agenda.dc.html:28
  // `Day grid · 1600`
  it('renders the room-columns day grid (rooms across, time rail, session cards) in DayGrid.tsx/gridMath.ts', () => {
    expect(agendaLine(28)).toContain('Day grid · 1600');
    const gridMath = read('pages/agenda/gridMath.ts');
    expect(gridMath).toContain('15-minute increments; rooms are columns');
    const dayGrid = read('pages/agenda/DayGrid.tsx');
    expect(dayGrid).toContain("import { SessionCard } from './SessionCard'");
    expect(dayGrid).toContain('chq-day-grid-time-label');
    expect(dayGrid).toContain('const gridTemplateColumns = `80px repeat(${columns.length}, minmax(140px, 1fr))`');
  });

  // docs/design/Chautauqua Agenda.dc.html:209
  // `Breaks · Tue 12 May`
  it('renders the day-scoped Breaks panel (full-weekday dialog title, break rows) in BreaksPanel.tsx', () => {
    expect(agendaLine(209)).toContain('Breaks · Tue 12 May');
    const src = read('pages/agenda/BreaksPanel.tsx');
    expect(src).toContain('frame 06--02 heads the section "Breaks on Tuesday"');
    expect(src).toContain("export function weekdayOf(day: string | null): string {");
    expect(src).toContain("Tue: 'Tuesday'");
  });

  // break-band-flagged.test.ts's subject: the "flagged" break-band
  // differential this Breaks frame's modal draws its rows through.
  it("carries the break-band-flagged.test.ts subject class in agenda.css", () => {
    const agendaTestSrc = read('pages/agenda/break-band-flagged.test.ts');
    expect(agendaTestSrc).toContain('.chq-agenda-break-band-flagged');
    const agendaCss = read('pages/agenda/agenda.css');
    expect(agendaCss).toContain('.chq-agenda-break-band-flagged {');
  });
});

describe('desktop frame claims: Content cluster (v12m-w5-e)', () => {
  // docs/design/Chautauqua Content.dc.html:111
  // `Session deliverables · /content/:submissionId`
  it('routes /content/:submissionId to the deliverable detail view (files, versions, comment thread) via ContentApp.tsx -> DeliverableDetail.tsx', () => {
    expect(contentLine(111)).toContain('Session deliverables · /content/:submissionId');
    const contentApp = read('pages/content/ContentApp.tsx');
    expect(contentApp).toContain("import { DeliverableDetail } from './DeliverableDetail'");
    expect(contentApp).toContain("submissionId: routeSubmissionId");
    const detail = read('pages/content/DeliverableDetail.tsx');
    expect(detail).toContain("import { CommentThread } from './CommentThread'");
    expect(detail).toContain("import { VersionList } from './VersionList'");
    expect(detail).toContain('&lsaquo; Content');
  });

  // docs/design/Chautauqua Content.dc.html:434
  // `Upload rejected`
  it('renders the "That file was not uploaded" refusal band in UploadRejectedModal.tsx (see deviation note in this file header)', () => {
    expect(contentLine(434)).toContain('Upload rejected');
    const src = read('pages/content/UploadRejectedModal.tsx');
    expect(src).toContain('title="That file was not uploaded"');
    expect(src).toContain('Choose another file');
    expect(src).toContain('What was kept');
  });
});
