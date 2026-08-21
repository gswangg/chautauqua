// w14-sc (DEC-976 wave-157): per-frame 390 render-verdict receipt for
// docs/design/Chautauqua Overview.dc.html :190 "Overview" (OverviewPage's
// phone reflow). Entered through OverviewPage's real mount (the same
// component /overview routes to) -- no isPhone split exists on this page
// (unlike Agenda's), so no matchMedia stub is needed: .chq-phone-head/
// .chq-phone-body are CSS-only hooks that render unconditionally
// (overview/Overview.phone.render.test.tsx's own "task w2-g" suite already
// established this). jsdom applies no stylesheet, so every assertion below
// is about DOM STRUCTURE/ORDER, never computed geometry. Overview has no
// audit doc (DEC-976 wave-105: a cluster with a single-item verdict files it
// in the test file's own header rather than a near-empty
// docs/design/audit/*.md) -- this comment IS that verdict:
//
// VERDICT -- frame :190 Overview -- CONFORMS (was DIVERGES until DEC-833
// wave-16): the frame's 390 body draws FOUR shortened section labels
// ("01 — Overdue tasks" :211, "02 — Awaiting triage" :235, "03 — Content to
// decide" :253, "04 — Agenda" :270) that exist ONLY in the phone frame --
// the desktop 1600 frame (:74/:98/:117/:136) draws the longer forms.
// Overview.tsx and overview/AgendaWorkSection.tsx now render BOTH forms as
// sibling spans (`.chq-overview-section-label-desktop` /
// `-phone`) on the existing `.chq-overview-section-label`, with the phone
// span hidden outside overview.css's terminal @media (max-width:700px)
// block and revealed (desktop span hidden) inside it -- jsdom applies no
// stylesheet, so this test sees both text nodes; the CSS-side reveal/hide
// is pinned separately by overview/Overview.phone.render.test.tsx's CSS
// contract describe block. The headline h1 (frame :207 "Four things need
// your attention") DOES match structurally -- it is genuinely computed from
// the payload (headlineText in overview/rows.ts), never a hardcoded frame
// literal, so the differing count in this test's fixture is expected and is
// not itself a divergence.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from './Overview';
import { mockApi } from '../test-utils/mockApi';
import type { OverviewPayload } from './overview/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Overview.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-overview-frame-verdicts';
const EVENT_SLUG = 'devflow-conf-2027';

function eventsListEnvelope() {
  return {
    items: [{ id: EVENT_ID, slug: EVENT_SLUG, timezone: 'America/Chicago', name: 'DevFlow Conf 2027' }],
    total: 1,
    page: 1,
    perPage: 20,
  };
}

// Fixture reused from overview/Overview.phone.render.test.tsx's own
// `payload()` (task w2-g harness) -- one row per actionable section so
// every "01 —" through "04 —" label actually renders.
function payload(): OverviewPayload {
  return {
    deadlines: {
      formCloseDate: Date.now() + 6 * 86_400_000,
      nextTaskDueDate: Date.now() + 2 * 86_400_000,
      planCloseDate: Date.now() + 19 * 86_400_000,
      planRound: 2,
      eventStartDate: Date.now() + 94 * 86_400_000,
    },
    overdueTasks: {
      total: 1,
      rows: [
        {
          assignmentId: 'as-1',
          contactId: 'c-1',
          contactName: 'Marcus Okafor',
          company: 'Cloudreach Labs',
          taskId: 'task-1',
          taskTitle: 'Upload headshot',
          dueDate: Date.now() - 4 * 86_400_000,
          daysLate: 4,
        },
      ],
    },
    triage: {
      total: 1,
      oldestSubmittedAt: Date.now() - 6 * 86_400_000,
      rows: [
        {
          submissionId: 'sub-1',
          ref: 'DFC-033',
          title: 'Docs That Answer Back',
          speakerName: 'Dana Whitmore',
          trackName: 'Developer Experience',
          format: 'talk',
          submittedAt: Date.now() - 6 * 86_400_000,
        },
      ],
    },
    contentApproval: {
      total: 1,
      reuploadedCount: 1,
      rows: [
        {
          submissionId: 'sub-2',
          ref: 'DFC-014',
          title: 'Taming 40-Minute CI',
          speakerName: 'Priya Raman',
          fileName: 'slides-v3.pdf',
          uploadedAt: Date.now() - 86_400_000,
          reuploaded: true,
        },
      ],
    },
    agendaWork: {
      unplacedTotal: 0,
      conflictTotal: 2,
      conflicts: [
        {
          day: '2027-03-11',
          startMin: 540,
          endMin: 600,
          roomName: 'Ballroom',
          kind: 'room_overlap',
          entries: [
            { submissionId: 'sub-3', ref: 'DFC-020', title: 'Room Clash Talk A', speakerName: 'Ada Lovelace' },
            { submissionId: 'sub-4', ref: 'DFC-021', title: 'Room Clash Talk B', speakerName: 'Grace Hopper' },
          ],
          resolution: null,
        },
        {
          day: '2027-03-12',
          startMin: 660,
          endMin: 720,
          roomName: 'Studio B',
          kind: 'speaker_overlap',
          entries: [
            { submissionId: 'sub-5', ref: 'DFC-022', title: 'Speaker Clash Talk A', speakerName: 'Katherine Johnson' },
            { submissionId: 'sub-6', ref: 'DFC-023', title: 'Speaker Clash Talk B', speakerName: 'Katherine Johnson' },
          ],
          resolution: null,
        },
      ],
      unplaced: [],
      unplacedRemainderDurationMin: null,
    },
    'triage-counts': { pending: 1, accept_queue: 0, decline_queue: 0 },
    review: { plans: 3, evaluationsSubmitted: 1, evaluationsExpected: 6 },
    speakers: { contactsOwing: 1, overdueAssignments: 1 },
    content: { awaitingApproval: 1 },
    agenda: { unplaced: 0, conflicts: 0 },
    comms: { sentLast7Days: 4, lastSentAt: Date.now() - 2 * 86_400_000 },
    publishedSessionCount: 17,
  };
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('v12 Overview 390 frame: per-frame render verdict receipt (w14-sc, DEC-976)', () => {
  it('frame :190 Overview -- CONFORMS: computed headline matches, and the frame\'s four shortened phone-only section labels render alongside the desktop-length labels', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter initialEntries={['/overview']}>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());

    // Structural order: .chq-phone-head (deadline strip) precedes
    // .chq-phone-body (headline + every section), matching the frame's own
    // head-band-then-scroll-body layout.
    const head = document.querySelector('.chq-phone-head')!;
    const body = document.querySelector('.chq-phone-body')!;
    // docs/design/Chautauqua Overview.dc.html:190 `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(190, '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">');
    expect(head.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The headline genuinely computes from the payload (5 actionable items:
    // 1 overdue + 1 triage + 1 content + 0 unplaced + 2 conflicts), so it
    // structurally matches the frame's "N things need your attention" shape
    // even though the spelled number differs from the frame's illustrative
    // "Four".
    const headline = body.querySelector('.chq-overview-headline')!;
    expect(headline.textContent).toBe('Five things need your attention');
    expect(head.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // docs/design/Chautauqua Overview.dc.html:211 `            <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">01 — Overdue tasks</span>`
    verbatimLine(211, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">01 — Overdue tasks</span>');
    expect(screen.getByText('01 — Overdue tasks')).toBeInTheDocument();
    // docs/design/Chautauqua Overview.dc.html:235 `            <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">02 — Awaiting triage</span>`
    verbatimLine(235, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">02 — Awaiting triage</span>');
    expect(screen.getByText('02 — Awaiting triage')).toBeInTheDocument();
    // docs/design/Chautauqua Overview.dc.html:253 `            <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">03 — Content to decide</span>`
    verbatimLine(253, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">03 — Content to decide</span>');
    expect(screen.getByText('03 — Content to decide')).toBeInTheDocument();
    // docs/design/Chautauqua Overview.dc.html:270 `            <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">04 — Agenda</span>`
    verbatimLine(270, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">04 — Agenda</span>');
    expect(screen.getByText('04 — Agenda')).toBeInTheDocument();

    // The desktop-length labels render alongside the phone-short forms as
    // sibling spans (DEC-833), at this same 390-equivalent jsdom width (no
    // @media applied), matching the desktop 1600 frame's own text
    // (:74/:98/:117/:136).
    expect(screen.getByText('01 — Overdue speaker tasks')).toBeInTheDocument();
    expect(screen.getByText('02 — Submissions awaiting triage')).toBeInTheDocument();
    expect(screen.getByText('03 — Session content awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('04 — Unplaced sessions and conflicts')).toBeInTheDocument();
  });
});
