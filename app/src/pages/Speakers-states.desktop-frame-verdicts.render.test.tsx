// w24-e (DEC-651 wave-24): the six remaining desktop frames in
// docs/design/Chautauqua Speakers.dc.html -- two dialogs opened from
// OnboardingGrid (New task, Review these reminders), a form-response
// dialog opened from TaskView's answered tab (Task response), a menu
// opened from a SpeakerDetailPage Sessions row (Participation · open),
// and two 1600 STATES of the Speakers page itself (search found nothing /
// a write failed). Sibling to Speakers.desktop-frame-verdicts.render.test.tsx
// (w14-sh, the four frames :28/:319/:598/:665) -- same verbatimLine helper,
// same console-error guard, same mockApi fixtures. STRICTLY MEASUREMENT
// ONLY: desktop is frozen, so this file moves no desktop byte and edits no
// component/stylesheet -- it renders the real route, reaches every modal/
// menu/state through the REAL control or the REAL condition (never a
// hand-built prop mount), and files divergences in prose.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpeakersPage } from './Speakers';
import { SpeakerDetailPage } from './speakers/SpeakerDetailPage';
import { TaskView } from './speakers/TaskView';
import { mockApi, errorEnvelope } from '../test-utils/mockApi';
import { resetApiCacheForTests } from '../lib/api';
import type { OnboardingGridResponse } from './speakers/types';
import type { SpeakerDetailResponse } from './speakers/speakerDetail';
import type { TaskViewResponse, TaskViewRow } from './speakers/taskRoster';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Speakers.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-speakers-states-desktop-verdicts';
const CONTACT_ID = 'ct-desktop-states-1';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetApiCacheForTests();
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

describe('v12 Speakers DESKTOP frames, the six remaining (w24-e, DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :187 "New task" -- Modal, opened from OnboardingGrid's head
  // action.
  // ---------------------------------------------------------------------
  describe('frame :187 "New task"', () => {
    const GRID: OnboardingGridResponse = {
      tasks: [{ id: 'task-a', kind: 'general', title: 'Confirm participation', dueDate: null, required: true, assigned: 12, complete: 11 }],
      rows: [
        {
          contact: { id: CONTACT_ID, name: 'Priya Raman', email: 'priya@example.com', company: 'Latticework Systems', hasAccount: true, participations: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-a', assignmentId: 'as-1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 12, outstandingRequired: 1, overdue: 3, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    function renderGridAndOpenNewTask() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      });
      const utils = render(
        <MemoryRouter initialEntries={['/speakers']}>
          <Routes>
            <Route path="/speakers" element={<SpeakersPage />} />
          </Routes>
        </MemoryRouter>,
      );
      return utils;
    }

    it('MATCHES: opened from the head "New task" button, title/subtitle/Kind order/Required default/actions', async () => {
      renderGridAndOpenNewTask();
      await screen.findByRole('heading', { name: 'Speakers' });
      fireEvent.click(screen.getByRole('button', { name: 'New task' }));

      const dialog = await screen.findByRole('dialog', { name: 'New task' });
      // docs/design/Chautauqua Speakers.dc.html:193-194 --
      // `<span ...>New task</span>` over `<span ...>Created for all 12 accepted speakers</span>`.
      verbatimLine(194, '          <span style="font-size:13px; color:#565A4B">Created for all 12 accepted speakers</span>');
      expect(within(dialog).getByText('Created for all 12 accepted speakers')).toBeInTheDocument();

      const kindGroup = within(dialog).getByRole('group', { name: 'Kind' });
      const kindButtons = within(kindGroup).getAllByRole('button').map((b) => b.textContent);
      // docs/design/Chautauqua Speakers.dc.html:208-210 draws the segmented
      // control `Upload` / `Form` / `Acknowledge`, in that order, Upload
      // selected.
      verbatimLine(208, '            <span style="border:1px solid #4E5C31; border-radius:4px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 15px; font-size:14px; font-weight:700">Upload</span>');
      expect(kindButtons).toEqual(['Upload', 'Form', 'Acknowledge']);

      // docs/design/Chautauqua Speakers.dc.html:213-215 draws the Required
      // checkbox pre-checked (a filled #4E5C31 swatch).
      verbatimLine(215, '          Required');
      expect(within(dialog).getByRole('checkbox', { name: 'Required' })).toBeChecked();

      // docs/design/Chautauqua Speakers.dc.html:218 -- `Create the task`.
      verbatimLine(218, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Create the task</span>');
      expect(within(dialog).getByRole('button', { name: 'Create the task' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('DIVERGES (additively): the frame\'s last field before the action row is Required; the tree inserts an "Assign to" audience picker there instead', async () => {
      renderGridAndOpenNewTask();
      await screen.findByRole('heading', { name: 'Speakers' });
      fireEvent.click(screen.getByRole('button', { name: 'New task' }));

      const dialog = await screen.findByRole('dialog', { name: 'New task' });
      // docs/design/Chautauqua Speakers.dc.html:213 -- `<label style="display:flex; align-items:center; gap:10px; min-height:44px; font-size:14px; color:#3F4237">`
      // is the Required checkbox's opening tag, the LAST field before the action row -- no audience section.
      verbatimLine(213, '        <label style="display:flex; align-items:center; gap:10px; min-height:44px; font-size:14px; color:#3F4237">');
      // DEC-746 (wave-59 amendment): the picker below is a previously-ruled, already-blessed addition.
      expect(within(dialog).getByRole('radiogroup', { name: 'Assign to' })).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: /Everyone accepted \(12\)/ })).toBeChecked();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :228 "Task response" -- Modal, opened from the task view's
  // answered tab.
  // ---------------------------------------------------------------------
  describe('frame :228 "Task response"', () => {
    const TASK_ID = 'task-desktop-hotel-response';
    const currentYear = new Date().getFullYear();
    const completedAt = new Date(currentYear, 3, 1, 12, 0, 0).getTime();

    function payload(): TaskViewResponse {
      const rows: TaskViewRow[] = [
        {
          contactId: CONTACT_ID,
          name: 'Priya Raman',
          company: 'Latticework Systems',
          assignmentId: 'as-response-1',
          status: 'complete',
          completedAt,
          assignedAt: completedAt - 10 * 24 * 60 * 60 * 1000,
          lastRemindedAt: null,
          remindCount: 0,
          fileId: null,
          fileName: null,
          answerSummary: 'Two nights · 11-13 May',
          overdue: false,
        },
      ];
      return {
        task: { id: TASK_ID, eventId: EVENT_ID, kind: 'form', title: 'Hotel stay form', dueDate: Date.UTC(2027, 3, 1), required: true, formId: 'form-1', instructions: null },
        timezone: 'UTC',
        rows,
        counts: { assigned: 1, complete: 1, pending: 0, answered: 1 },
      };
    }

    function renderAndOpenResponse() {
      mockApi({
        [`GET /api/v1/tasks/${TASK_ID}/roster`]: payload(),
        [`GET /api/v1/task-assignments/as-response-1/response`]: {
          assignmentId: 'as-response-1',
          taskTitle: 'Hotel stay form',
          contact: { id: CONTACT_ID, name: 'Priya Raman', email: 'priya@example.com' },
          status: 'complete',
          assignedAt: completedAt - 10 * 24 * 60 * 60 * 1000,
          completedAt,
          fields: [{ label: 'Nights', value: 'Two nights · 11-13 May' }],
        },
      });
      return render(
        <MemoryRouter initialEntries={[`/speakers/tasks/${TASK_ID}`]}>
          <Routes>
            <Route path="/speakers/tasks/:taskId" element={<TaskView />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: opened via the answered row\'s "Open" action -- Q&A rows plus the "Reopen this task" action and its caption', async () => {
      renderAndOpenResponse();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      const dialog = await screen.findByRole('dialog', { name: 'Task response' });
      // docs/design/Chautauqua Speakers.dc.html:242-243 draws each response
      // row as a question/answer pair.
      verbatimLine(242, '            <span style="font-size:13px; font-weight:600; color:#3F4237">{{ r.q }}</span>');
      expect(within(dialog).getByText('Nights')).toBeInTheDocument();
      expect(within(dialog).getByText('Two nights · 11-13 May')).toBeInTheDocument();

      // docs/design/Chautauqua Speakers.dc.html:250 -- `Reopen this task`,
      // and :251 -- the caption stating what it does.
      verbatimLine(247, '          <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:600; color:#2E2A24">Reopen this task</span>');
      expect(within(dialog).getByRole('button', { name: 'Reopen this task' })).toBeInTheDocument();
      expect(within(dialog).getByText('Sets it back to pending — the next reminder picks it up')).toBeInTheDocument();
    });

    it('MATCHES: the subtitle names WHEN THE TASK WAS SENT ("Priya Raman · sent 2 Apr"), not when it was completed', async () => {
      renderAndOpenResponse();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      const dialog = await screen.findByRole('dialog', { name: 'Task response' });
      // docs/design/Chautauqua Speakers.dc.html:235 --
      // `<span style="font-size:13px; color:#565A4B">Priya Raman · sent 2 Apr</span>`
      verbatimLine(235, '          <span style="font-size:13px; color:#565A4B">Priya Raman · sent 2 Apr</span>');
      const subtitle = within(dialog).getByText(/Priya Raman/);
      expect(subtitle.textContent).toMatch(/sent/);
      expect(subtitle.textContent).not.toMatch(/Completed/);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :288 "Participation · open" -- Menu, opened from a Sessions row.
  // ---------------------------------------------------------------------
  describe('frame :288 "Participation · open"', () => {
    function detail(): SpeakerDetailResponse {
      return {
        contact: {
          id: CONTACT_ID,
          name: 'Wei Chen',
          email: 'wei@example.com',
          company: 'Northwind Data',
          title: null,
          hasAccount: false,
          phone: null,
          notes: null,
          customFields: {},
          headshotFileId: null,
          bio: null,
          socialLinks: [],
        },
        headshotFile: null,
        participation: { participantId: 'p-wei', submissionId: 'sub-wei', inviteStatus: 'none' },
        participationRollup: {
          status: 'none',
          bySubmission: [{ participantId: 'p-wei', submissionId: 'sub-wei', ref: 'S-002', inviteStatus: 'none' }],
        },
        sessions: [
          {
            submissionId: 'sub-wei',
            ref: 'S-002',
            title: 'Streaming State at the Edge',
            status: 'accepted',
            contentStatus: 'pending',
            role: 'speaker',
            scheduled: null,
          },
        ],
        tasks: [],
        counts: { outstandingRequired: 0, overdue: 0, remindCount: 0 },
        otherEvents: [],
        otherEventsCount: 0,
      };
    }

    function renderDetail() {
      mockApi({ [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: detail() });
      return render(
        <MemoryRouter initialEntries={[`/speakers/${CONTACT_ID}`]}>
          <Routes>
            <Route path="/speakers/:contactId" element={<SpeakerDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: opened from a Sessions row -- identity header, 3 selectable states + the invite action (the frame\'s own 4-item menu), and the footer caption', async () => {
      renderDetail();
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Wei Chen' })).toBeInTheDocument());

      const sessionRow = document.querySelector('.chq-speaker-detail-sessions-row') as HTMLElement;
      fireEvent.click(within(sessionRow).getByRole('button', { name: /Participation status for/ }));

      const menu = await screen.findByRole('menu', { name: /Participation status for Wei Chen/ });
      // docs/design/Chautauqua Speakers.dc.html:294-295 -- the menu panel's
      // own identity header, name over "company · account" line.
      verbatimLine(295, '        <span style="font-size:12px; color:#565A4B">Northwind Data · no portal account</span>');
      expect(within(menu).getByText('Northwind Data · no portal account')).toBeInTheDocument();

      // docs/design/Chautauqua Speakers.dc.html:298 -- `<sc-for list="{{ inviteMenu }}" as="m" hint-placeholder-count="4">`
      // DEC-869 (already ruled): 3 SELECTABLE states + the invite action == the same 4-item count.
      verbatimLine(298, '        <sc-for list="{{ inviteMenu }}" as="m" hint-placeholder-count="4">');
      const radios = within(menu).getAllByRole('menuitemradio');
      expect(radios).toHaveLength(3);
      expect(
        radios.map((r) => r.querySelector('.chq-participation-menu-item-label')?.childNodes[0]?.textContent?.trim()),
      ).toEqual([
        'Not invited',
        'Confirmed',
        'Declined',
      ]);
      expect(within(menu).getByRole('menuitem', { name: /Send portal invite/ })).toBeInTheDocument();

      // docs/design/Chautauqua Speakers.dc.html:311 -- the footer caption,
      // `Only "Invited" sends anything — the other two just record what you already know`, verbatim.
      verbatimLine(311, '        <span style="font-size:12px; color:#565A4B; line-height:1.5">Only "Invited" sends anything — the other two just record what you already know</span>');
      expect(
        within(menu.parentElement as HTMLElement).getByText(
          'Only "Invited" sends anything — the other two just record what you already know',
        ),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :442 "Speakers · search found nothing" -- 1600 STATE.
  // ---------------------------------------------------------------------
  describe('frame :442 "Speakers · search found nothing"', () => {
    const GRID_EMPTY: OnboardingGridResponse = {
      tasks: [{ id: 'task-a', kind: 'general', title: 'Confirm participation', dueDate: null, required: true }],
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      counts: { speakers: 12, outstandingRequired: 0, overdue: 3, outstandingContacts: 0 },
      timezone: 'UTC',
    };

    it('MATCHES: a query that matches nothing names the excluding facet (search) and offers to clear exactly it', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_EMPTY,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      });
      render(
        <MemoryRouter initialEntries={['/speakers']}>
          <Routes>
            <Route path="/speakers" element={<SpeakersPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByRole('heading', { name: 'Speakers' });
      fireEvent.change(screen.getByRole('textbox', { name: 'Search speakers' }), { target: { value: 'okafor' } });

      // docs/design/Chautauqua Speakers.dc.html:478 -- `No speaker matches all three filters` -- the frame's OWN
      // excluding-facet headline (worked against "Overdue only"); this test drives the SAME narrowing.ts naming
      // mechanism through the SEARCH facet instead.
      verbatimLine(478, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">No speaker matches all three filters</span>');
      await waitFor(() => expect(screen.getByText('No speakers match "okafor".')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Clear the search filter ›' })).toBeInTheDocument();

      // The H1 aggregate stays mounted (frame :442-447 draws it above the
      // filter strip too) -- this state swaps only the card body.
      expect(screen.getByRole('heading', { name: 'Speakers' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :491 "Review these reminders" -- Modal, opened from the bulk/
  // remind control.
  // ---------------------------------------------------------------------
  describe('frame :491 "Review these reminders"', () => {
    const GRID: OnboardingGridResponse = {
      tasks: [{ id: 'task-a', kind: 'general', title: 'Upload headshot', dueDate: Date.UTC(2027, 3, 10), required: true }],
      rows: [
        {
          contact: { id: CONTACT_ID, name: 'Marcus Okafor', email: 'marcus@example.com', company: 'Cloudreach Labs', hasAccount: true, participations: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-a', assignmentId: 'as-1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 12, outstandingRequired: 1, overdue: 3, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    function renderGridAndOpenReminders() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
        [`POST /api/v1/events/${EVENT_ID}/onboarding/remind/preview`]: {
          drafts: [
            {
              contactId: CONTACT_ID,
              email: 'marcus@example.com',
              name: 'Marcus Okafor',
              subject: 'Action needed',
              text: 'Hi Marcus,\n\nA quick nudge — 1 of your speaker tasks is still open.\n\nStill to do\nUpload headshot — was due 10 Apr.\n\nchautauqua.cc/portal/tasks\n\n— The team',
              parts: {
                greeting: 'Hi Marcus,',
                nudge: 'A quick nudge — 1 of your speaker tasks is still open.',
                stillToDo: ['- Upload headshot — was due 10 Apr.'],
                portalLine: 'chautauqua.cc/portal/tasks',
                signature: '— The team',
              },
              tasks: [{ title: 'Upload headshot', dueLabel: '10 Apr', overdue: true }],
            },
          ],
          skipped: 0,
          remaining: 0,
        },
      });
      return render(
        <MemoryRouter initialEntries={['/speakers']}>
          <Routes>
            <Route path="/speakers" element={<SpeakersPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: title/Send-Cancel/"Logged in Comms history"/per-recipient row', async () => {
      renderGridAndOpenReminders();
      await screen.findByRole('heading', { name: 'Speakers' });
      fireEvent.click(screen.getByRole('button', { name: 'Remind all outstanding' }));

      const dialog = await screen.findByRole('dialog', { name: 'Review these reminders' });
      // docs/design/Chautauqua Speakers.dc.html:498 -- the modal's own
      // title span, verbatim.
      verbatimLine(498, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Review these reminders</span>');
      await waitFor(() => expect(within(dialog).getByText('Marcus Okafor')).toBeInTheDocument());

      // docs/design/Chautauqua Speakers.dc.html:539 -- `Logged in Comms history`.
      verbatimLine(540, '          <span style="font-size:12px; color:#565A4B; line-height:1.5">Logged in Comms history</span>');
      expect(within(dialog).getByText('Logged in Comms history')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Send these 1' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('MATCHES (w7-a): the dialog draws a rendered email card (subject header/greeting/nudge/"Still to do" block/an "Open your tasks" CTA) fed by the structured `parts` contract, not a bare <pre> of `text`', async () => {
      renderGridAndOpenReminders();
      await screen.findByRole('heading', { name: 'Speakers' });
      fireEvent.click(screen.getByRole('button', { name: 'Remind all outstanding' }));

      const dialog = await screen.findByRole('dialog', { name: 'Review these reminders' });
      await waitFor(() => expect(within(dialog).getByText('Marcus Okafor')).toBeInTheDocument());

      // docs/design/Chautauqua Speakers.dc.html:527 draws the rendered
      // CTA button `Open your tasks` inside the email card.
      verbatimLine(529, '              <span style="display:inline-flex; align-items:center; align-self:flex-start; background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:44px; padding:0 20px; font-size:14px; font-weight:700">Open your tasks</span>');
      expect(within(dialog).getByRole('link', { name: 'Open your tasks' })).toBeInTheDocument();

      // DEC-441 (wave-7 amendment): no bare <pre> of the plain-text draft
      // remains, and no event letterhead block was invented -- the subject
      // is the honest header instead.
      expect(dialog.querySelector('pre.chq-speakers-remind-draft-text')).toBeNull();
      expect(within(dialog).getByText('Action needed')).toBeInTheDocument();
      expect(within(dialog).getByText('Hi Marcus,')).toBeInTheDocument();
      expect(within(dialog).getByText(/A quick nudge/)).toBeInTheDocument();
      expect(within(dialog).getByText('Still to do')).toBeInTheDocument();
      const card = dialog.querySelector('.chq-speakers-remind-card');
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByText(/Upload headshot/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Or paste this into your browser/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :549 "Speakers · a write failed" -- 1600 STATE.
  // ---------------------------------------------------------------------
  describe('frame :549 "Speakers · a write failed"', () => {
    const NOW = Date.now();
    const PAST_DUE = NOW - 30 * 24 * 60 * 60 * 1000;

    const GRID: OnboardingGridResponse = {
      tasks: [{ id: 'task-headshot', kind: 'file_request', title: 'headshot', dueDate: PAST_DUE, required: true }],
      rows: [
        {
          contact: { id: CONTACT_ID, name: 'Marcus Okafor', email: 'marcus@example.com', company: 'Cloudreach Labs', hasAccount: true, participations: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [{ taskId: 'task-headshot', assignmentId: 'as-headshot', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: PAST_DUE - 24 * 60 * 60 * 1000 }],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 12, outstandingRequired: 1, overdue: 3, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    it('MATCHES: an optimistic cell flip that the server rejects rolls back AND says so out loud, naming speaker/task/restored-status', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
        [`PATCH /api/v1/task-assignments/as-headshot`]: {
          status: 409,
          body: errorEnvelope('conflict', 'someone else may have edited this speaker while you were here'),
        },
      });
      render(
        <MemoryRouter initialEntries={['/speakers']}>
          <Routes>
            <Route path="/speakers" element={<SpeakersPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const table = within(await screen.findByRole('table'));
      const toggle = table.getByRole('button', { name: /Toggle headshot for Marcus Okafor/ });
      fireEvent.click(toggle);

      const banner = await screen.findByRole('alert');
      // docs/design/Chautauqua Speakers.dc.html:568 -- `Marcus Okafor's headshot task did not change`, the bold title
      // naming speaker+task; :569 -- `The server rejected it — someone else may have edited this speaker while you
      // were here. The cell has been put back to Overdue.`, the muted body (the mocked server message matches it).
      verbatimLine(568, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:700">Marcus Okafor\'s headshot task did not change</span>');
      verbatimLine(569, '            <span style="font-size:14px; line-height:1.55; color:#3F4237">The server rejected it — someone else may have edited this speaker while you were here. The cell has been put back to Overdue.</span>');
      expect(within(banner).getByText("Marcus Okafor's headshot task did not change")).toBeInTheDocument();
      expect(
        within(banner).getByText(
          'The server rejected it — someone else may have edited this speaker while you were here. The cell has been put back to Overdue.',
        ),
      ).toBeInTheDocument();

      // docs/design/Chautauqua Speakers.dc.html:572 -- `Reload the grid` then `Try again` (:573), the recovery actions.
      verbatimLine(572, '            <span style="border:1px solid #CFC7B7; border-radius:4px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Reload the grid</span>');
      expect(within(banner).getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument();
      expect(within(banner).getByRole('button', { name: 'Try again' })).toBeInTheDocument();

      // The optimistic flip rolled BACK: the cell reads its pre-flip
      // status, restored word, marked "not saved" until the banner clears.
      expect(toggle).toHaveTextContent('OVERDUE · not saved');
    });
  });
});
