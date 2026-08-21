// DEC-144 layer-2 harness: overview phone (390) render + CSS contract tests.
// Extracted from Overview.render.test.tsx (contention-decomposition, no
// behavior change) -- these are the "Same five sections, one column" (task
// w2-g) DOM contract and its matching source-scan CSS contract, split into
// their own file so phone-reflow work no longer collides with desktop
// render-smoke or spacing-measure edits in the same file. Carries its own
// copy of the payload fixture it needs (not a shared module) so this file's
// field-value literals stay excluded from source-scans the same way they
// were when this suite lived inside the single .render.test.tsx file --
// see test/wire-field-reader.scan.test.ts and
// app/src/lib/day-math.scan.test.ts, both of which only exempt files whose
// name contains ".test.".
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from '../Overview';
import { mockApi } from '../../test-utils/mockApi';
import type { OverviewPayload } from './types';

const EVENT_ID = 'evt-render-2';
const EVENT_SLUG = 'devflow-conf-2027';

function eventsListEnvelope() {
  return {
    items: [{ id: EVENT_ID, slug: EVENT_SLUG, timezone: 'America/Chicago', name: 'DevFlow Conf 2027' }],
    total: 1,
    page: 1,
    perPage: 20,
  };
}

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

// Chautauqua Overview.dc.html:190 (cited with its strict form, and
// receipted, at the first it() below)
// "Same five sections, one column" (task w2-g): the DOM contract that
// carries the phone reflow -- the deadline strip sits in the shared
// .chq-phone-head sticky scaffold, the rest of the page (headline + all
// five sections) sits in .chq-phone-body, and §02's Waitlist control is
// tagged for phone-only hiding (DEC-610 wave-83 amendment) while Read
// keeps a dedicated hook for its natural-width phone treatment. jsdom
// applies no stylesheet, so this asserts the classes exist on the right
// elements -- the CSS behaviour itself is pinned by the source-scan
// describe block below.
describe('overview phone (390) DOM contract (task w2-g)', () => {
  it('wraps the deadline strip in .chq-phone-head and the rest of the page in .chq-phone-body', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());

    // docs/design/Chautauqua Overview.dc.html:190 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">` -- the phone frame this DOM contract carries.
    const head = document.querySelector('.chq-phone-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('.chq-overview-deadlines')).not.toBeNull();

    const body = document.querySelector('.chq-phone-body');
    expect(body).not.toBeNull();
    expect(body!.querySelector('.chq-overview-headline')).not.toBeNull();
    expect(body!.textContent).toContain('01 — Overdue speaker tasks');
    expect(body!.textContent).toContain('02 — Submissions awaiting triage');
    expect(body!.textContent).toContain('No action needed');
    // the deadline strip is NOT duplicated into the body
    expect(body!.querySelector('.chq-overview-deadlines')).toBeNull();
  });

  it('tags §02\'s Waitlist control for phone-only hiding and Read for its natural-width phone treatment, without touching Accept/Decline', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/overview`]: payload(),
      'GET /api/v1/events': eventsListEnvelope(),
    });

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Docs That Answer Back')).toBeInTheDocument());

    const waitlistBtn = screen.getByText('Waitlist');
    expect(waitlistBtn).toHaveClass('chq-overview-btn-waitlist');

    const readLink = screen.getByText('Read the abstract');
    expect(readLink).toHaveClass('chq-overview-link-btn-read');

    expect(screen.getByText('Accept')).not.toHaveClass('chq-overview-btn-waitlist');
    expect(screen.getByText('Decline')).not.toHaveClass('chq-overview-btn-waitlist');
  });
});

// Chautauqua Overview.dc.html:190 (cited with its strict form, and
// receipted, at the first it() below)
// Source-scan (jsdom applies no @media rule, mirroring the top-third
// spacing describe block above): pins the phone-only behaviour of the two
// new hooks, and that desktop (outside any max-width block) declares no
// rule for either -- "desktop frozen" is a property of the stylesheet
// text, not just of the rendered page.
describe('overview phone (390) CSS contract (task w2-g)', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'overview.css');
  const css = readFileSync(cssPath, 'utf8');
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const maxWidthBlocks = [...css.matchAll(/@media\s*\(max-width:\s*700px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
  const phoneCss = maxWidthBlocks.join('\n');

  it('docs/design/Chautauqua Overview.dc.html:190 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">` -- desktop (outside any max-width block) declares no rule for the two phone-only hooks', () => {
    expect(withoutMedia).not.toMatch(/\.chq-overview-btn-waitlist\s*\{/);
    expect(withoutMedia).not.toMatch(/\.chq-overview-link-btn-read\s*\{/);
  });

  it('§02 Waitlist is display:none at phone width (hidden, not removed from the DOM)', () => {
    const match = phoneCss.match(/\.chq-overview-btn-waitlist\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/display:\s*none/);
  });

  it('§02 Read sits at its natural width beside Accept/Decline, not stretched full-width', () => {
    const match = phoneCss.match(/\.chq-overview-link-btn\.chq-overview-link-btn-read\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/width:\s*auto/);
    expect(match![1]).not.toMatch(/width:\s*100%/);
  });
});
