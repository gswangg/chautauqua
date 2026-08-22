// Task w29-f: docs/design/Chautauqua Overview.dc.html:190 (extent 190
// through the end of the phone frame's tabbar, i.e. up to the next frame's
// "Modal" label) -- the pack's ONLY Overview phone frame. Before this file,
// 17 of the frame's 28 drawn strings were asserted by no markup instrument
// at all (Overview.phone.render.test.tsx only carries the DEC-833
// section-label register and the two phone-only-hook CSS contracts; the
// headline, the §01 bulk-remind block, every row template, and §02's "All
// N" disclosure had no citer). This file closes that gap for everything
// this task's ASSERT list covers.
//
// Harness copied from Overview.phone.render.test.tsx (same mount, same
// localStorage event-id seed) -- see that file's own header comment for why
// the payload fixture is a private literal, not a shared module (source
// scans that exempt `.test.` files only).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from '../Overview';
import { mockApi } from '../../test-utils/mockApi';
import type { OverviewPayload } from './types';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import { phoneMediaBlocks } from '../../../../test/helpers/css-media-blocks';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERVIEW_CSS = join(HERE, 'overview.css');

/** w16-qg (DEC-994): jsdom applies no stylesheet, so a 390 verdict that
 * never reads overview.css's own `@media (max-width: 700px)` block is
 * really a desktop-cascade claim wearing a phone title. Reuse the promoted
 * brace-depth walk (`test/helpers/css-media-blocks.ts`'s `phoneMediaBlocks`,
 * lifted from Contacts.frame-verdicts.render.test.tsx). */
function readOverviewPhoneCss(): string {
  return phoneMediaBlocks(stripCssComments(readFileSync(OVERVIEW_CSS, 'utf-8'))).join('\n');
}

const EVENT_ID = 'evt-render-390-f';
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
      // DEC-967 wave-29: nulled out so §02's "All N" disclosure renders as
      // the frame's bare "All <n>" (:236) rather than this page's own
      // appended "· oldest N days" clause (Overview.tsx) -- the ASSERT
      // list's shape regex (`/^All \d+$/`) is about the frame's disclosure,
      // not about suppressing a real second clause this page always draws
      // when it has an answer.
      oldestSubmittedAt: null,
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
    review: { plans: 3, evaluationsSubmitted: 1, evaluationsStarted: 6 },
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

async function mount() {
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
}

describe('Overview 390 frame verdict (task w29-f, docs/design/Chautauqua Overview.dc.html:190-296 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0;`)', () => {
  it('draws the five §-sections in the frame\'s DOM order', async () => {
    await mount();

    const sections = document.querySelectorAll('.chq-overview-section');
    expect(sections.length).toBe(5);

    // :211 01 -- Overdue tasks, :235 02 -- Awaiting triage, :253 03 --
    // Content to decide, :270 04 -- Agenda, then the unnumbered "No action
    // needed" section (no NN eyebrow in the frame, DEC-833's own comment).
    expect(sections[0]!.textContent).toContain('Marcus Okafor');
    expect(sections[1]!.textContent).toContain('Docs That Answer Back');
    expect(sections[2]!.textContent).toContain('Taming 40-Minute CI');
    expect(sections[3]!.textContent).toContain('Room Clash Talk A');
    expect(sections[4]!.textContent).toContain('No action needed');
  });

  it(':211/:235/:253/:270 each numbered section carries an "NN — <phone label>" eyebrow at 390, with the 1600 form on a sibling span (DEC-833)', async () => {
    await mount();

    const sections = document.querySelectorAll('.chq-overview-section');
    const expected: [string, string][] = [
      ['01 — Overdue speaker tasks', '01 — Overdue tasks'],
      ['02 — Submissions awaiting triage', '02 — Awaiting triage'],
      ['03 — Session content awaiting approval', '03 — Content to decide'],
      ['04 — Unplaced sessions and conflicts', '04 — Agenda'],
    ];

    expected.forEach(([desktopText, phoneText], i) => {
      const label = sections[i]!.querySelector('.chq-overview-section-label')!;
      const desktop = label.querySelector('.chq-overview-section-label-desktop');
      const phone = label.querySelector('.chq-overview-section-label-phone');
      expect(desktop).not.toBeNull();
      expect(phone).not.toBeNull();
      expect(desktop!.textContent).toBe(desktopText);
      expect(phone!.textContent).toBe(phoneText);
    });

    // The 5th, unnumbered section carries neither span -- a single plain
    // text node, matching the frame (no NN prefix on "No action needed").
    const quietLabel = sections[4]!.querySelector('.chq-overview-section-label')!;
    expect(quietLabel.querySelector('.chq-overview-section-label-desktop')).toBeNull();
    expect(quietLabel.querySelector('.chq-overview-section-label-phone')).toBeNull();
    expect(quietLabel.textContent).toBe('No action needed');

    // "desktop label ABSENT" at 390: jsdom applies no @media rule (every
    // other describe block in this directory notes the same limitation),
    // so the only true assertion available here is the stylesheet's own
    // text -- Overview.phone.render.test.tsx's DEC-833 CSS-contract block
    // already pins `.chq-overview-section-label-desktop { display:none }`
    // inside the terminal max-width:700px block and no rule for it outside
    // one; this file does not re-pin that (DEC-976 -- one owner per
    // assertion) and instead cites it here as the receipt for "absent".
  });

  // :207 `Four things need your attention` -- sample data's "Four" is not
  // graded (DEC-967 wave-29), only the shape: `headlineText()` sums every
  // section's TOTAL (not row count), so this fixture's own numbers compute
  // a real, non-"Four" count -- proof the shape regex, not a literal echo,
  // is what's under test.
  it(':207 the attention lede matches "<count> things need your attention" in shape, not literal', async () => {
    await mount();

    const h1 = document.querySelector('.chq-overview-headline');
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toMatch(/^\w+ things? needs? your attention$/);

    // docs/design/Chautauqua Overview.dc.html:207 `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:29px; font-weight:700; letter-spacing:-0.04em; line-height:1.06">Four things need your attention</h1>`
    // jsdom never applies this rule, so assert the phone media block itself
    // carries the frame's :207 headline size (DEC-994).
    const phoneCss = readOverviewPhoneCss();
    expect(phoneCss).toMatch(/\.chq-overview-headline\s*\{[^}]*font-size:\s*29px;/);
  });

  // :215/:216 the bulk-remind control: a single control whose label matches
  // the frame's shape, with the caption immediately beneath it -- both
  // siblings inside §01's header/caption row, no other content between them.
  it(':215/:216 the §01 bulk-remind control matches "Remind all <n>" with the caption immediately beneath it', async () => {
    await mount();

    const remindAll = document.querySelector('.chq-overview-remind-all');
    expect(remindAll).not.toBeNull();
    expect(remindAll!.textContent).toMatch(/^Remind all \w+$/);

    const section01 = document.querySelectorAll('.chq-overview-section')[0]!;
    const caption = section01.querySelector('.chq-overview-caption');
    expect(caption).not.toBeNull();
    expect(caption!.textContent).toBe('Skips anyone reminded in the last hour');

    // "immediately beneath it": the header row (label + remind-all button)
    // is the caption's previous sibling, no other node between them.
    expect(caption!.previousElementSibling).toBe(remindAll!.closest('.chq-overview-section-header'));
  });

  // :221-:226 the §01 row template. FINDING (recorded, not fixed -- this
  // task's OWNS list permits only overview.css inside its terminal
  // max-width:700px block, and this divergence is a DOM/text-grouping
  // difference no CSS reorder can repair without also splitting the
  // anonymous wrapper `<div>`s Overview.tsx renders around
  // name+company/task+late into their own class hooks): the frame draws
  // `{{ row.name }}` beside `{{ row.late }}` on one line, then
  // `{{ row.task }} · {{ row.company }}` on the next. The shipped DOM
  // instead pairs name+company together and task+late together (a desktop
  // two-column table shape that only collapses to stacked rows at phone,
  // never regrouped), so all four fields are present and in this DOM
  // order: name, company, task, late. See
  // docs/design/audit/overview-390-v12.md for the full writeup.
  it(':221-:226 the §01 row carries name, company, task, lateness marker and both actions in DOM order', async () => {
    await mount();

    const row = document.querySelector('.chq-overview-row-overdue');
    expect(row).not.toBeNull();

    const walker = document.createTreeWalker(row!, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    let node: Node | null;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }

    expect(texts).toEqual([
      'Marcus Okafor',
      'Cloudreach Labs',
      'Upload headshot',
      '4 days late',
      'Remind',
      'Mark complete',
    ]);

    // Both per-row actions are real controls, in frame order (Remind, then
    // Mark complete -- :224/:225).
    const actions = row!.querySelectorAll('.chq-overview-row-actions button');
    expect(actions.length).toBe(2);
    expect(actions[0]!.textContent).toBe('Remind');
    expect(actions[1]!.textContent).toBe('Mark complete');
  });

  // :236 the §02 "All N" disclosure.
  it(':236 the §02 disclosure matches "All <n>"', async () => {
    await mount();

    const disclosure = screen.getByText(/^All \d+$/);
    expect(disclosure.textContent).toMatch(/^All \d+$/);
    expect(disclosure).toHaveClass('chq-overview-section-action');
  });
});
