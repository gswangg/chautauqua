// w14-sh (DEC-930 wave-158 amendment): the per-frame DESKTOP (1600) render
// verdict for the landed v12 Speakers redesign. Sibling to
// Speakers.frame-verdicts.render.test.tsx (w14-sc, the two 390 frames + the
// existing speakers-v12.md) -- this file owns the FOUR desktop frames in
// docs/design/Chautauqua Speakers.dc.html and a NEW audit doc,
// docs/design/audit/speakers-desktop-v12.md, per the amendment's split.
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate, so this file
// moves no desktop byte and edits no component/stylesheet -- it renders the
// real route, verdicts what the tree actually produces, and files
// divergences in prose.
//
// Modelled exactly on Settings.frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) helper, same beforeEach/afterEach console
// guard, same mockApi/listEnvelope test-utils. jsdom applies no stylesheet
// (no @media, no computed grid-template-columns/font-weight), so every
// assertion here is DOM structure/order/text, or a readFileSync of the
// APP's own stylesheet TEXT for the two claims (grid weight inversion, the
// `1fr 132px 96px 150px` task tracks) that are inherently a CSS fact -- the
// design pack is never re-read as its own proof (DEC-976/DEC-967). Every
// DOM/CSS lookup runs BEFORE its citation comment so the citation sits
// immediately beside the `expect(` that receipts it (DEC-976 wave-116's
// EXPECT_PROXIMITY_LINES window).
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
import { mockApi } from '../test-utils/mockApi';
import type { OnboardingGridResponse } from './speakers/types';
import type { SpeakerDetailResponse } from './speakers/speakerDetail';
import type { TaskViewResponse, TaskViewRow } from './speakers/taskRoster';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Speakers.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Settings.frame-verdicts.render.test.tsx's
 * own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-speakers-desktop-verdicts';
const CONTACT_ID = 'ct-desktop-1';
const TASK_ID = 'task-desktop-hotel';

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

describe('v12 Speakers DESKTOP (1600) frames: per-frame render verdict receipts (w14-sh, DEC-930 wave-158 amendment)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Onboarding grid · 1600"
  // ---------------------------------------------------------------------
  describe('frame :28 "Onboarding grid · 1600"', () => {
    const GRID: OnboardingGridResponse = {
      tasks: [
        { id: 'task-a', kind: 'general', title: 'Confirm participation', dueDate: Date.UTC(2027, 3, 1), required: true, assigned: 12, complete: 11 },
        { id: 'task-b', kind: 'general', title: 'Hotel stay form', dueDate: Date.UTC(2027, 3, 25), required: false, assigned: 9, complete: 9 },
      ],
      rows: [
        {
          contact: { id: CONTACT_ID, name: 'Priya Raman', email: 'priya@example.com', company: 'Latticework Systems', hasAccount: true, participations: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', title: 'Talk', inviteStatus: 'accepted' }] },
          cells: [
            { taskId: 'task-a', assignmentId: 'as-1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 },
            { taskId: 'task-b', assignmentId: 'as-2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
          ],
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
      counts: { speakers: 12, outstandingRequired: 1, overdue: 3, outstandingContacts: 1 },
      timezone: 'UTC',
    };

    function renderGrid() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      });
      return render(
        <MemoryRouter initialEntries={['/speakers']}>
          <Routes>
            <Route path="/speakers" element={<SpeakersPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: title/action-row order (Add speaker, New task, Remind all outstanding)', async () => {
      renderGrid();
      await screen.findByRole('heading', { name: 'Speakers' });
      const actions = document.querySelector('.chq-speakers-head-actions');
      const buttonLabels = within(actions as HTMLElement).getAllByRole('button').map((b) => b.textContent);
      // docs/design/Chautauqua Speakers.dc.html:59-63 draws the desktop
      // title action row holding `Add speaker` / `New task` / `Remind all
      // outstanding`, in that order.
      verbatimLine(60, '            <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Add speaker</a>');
      expect(buttonLabels).toEqual(['Add speaker', 'New task', 'Remind all outstanding']);
    });

    it('MATCHES: the header summary reads "N accepted · N overdue" verbatim', async () => {
      renderGrid();
      await screen.findByRole('heading', { name: 'Speakers' });
      const summary = document.querySelector('.chq-summary')?.textContent;
      // docs/design/Chautauqua Speakers.dc.html:57 --
      // `<span style="font-size:13px; color:#565A4B">12 accepted · <strong style="color:#1B1D17">3 overdue</strong></span>`
      verbatimLine(57, '            <span style="font-size:13px; color:#565A4B">12 accepted · <strong style="color:#1B1D17">3 overdue</strong></span>');
      expect(summary).toBe('12 accepted · 3 overdue');
    });

    it('MATCHES: ONE "Edit tasks" control beside the Speaker column head -- never one per task column', async () => {
      renderGrid();
      await screen.findByRole('heading', { name: 'Speakers' });
      const editTasksButtons = within(screen.getByRole('table')).getAllByRole('button', { name: 'Edit tasks' });
      // docs/design/Chautauqua Speakers.dc.html:79 --
      // `<a href="#" style="font-size:11px; font-weight:700; white-space:nowrap">Edit tasks</a>`
      verbatimLine(79, '              <a href="#" style="font-size:11px; font-weight:700; white-space:nowrap">Edit tasks</a>');
      expect(editTasksButtons).toHaveLength(1);
    });

    it('MATCHES: the column head is the aggregate AND the entry point -- the task name links into "One task, every speaker"', async () => {
      renderGrid();
      await screen.findByRole('heading', { name: 'Speakers' });
      const link = within(screen.getByRole('table')).getByRole('link', { name: 'Hotel stay form' });
      // docs/design/Chautauqua Speakers.dc.html:83 --
      // `<a href="#" style="font-size:12px; font-weight:700; line-height:1.25; color:#1B1D17" style-hover="color:#4E5C31">{{ t.title }}</a>`
      verbatimLine(83, '                <a href="#" style="font-size:12px; font-weight:700; line-height:1.25; color:#1B1D17" style-hover="color:#4E5C31">{{ t.title }}</a>');
      expect(link).toHaveAttribute('href', '/speakers/tasks/task-b');
    });

    it('MATCHES (weight inversion, read from the app stylesheet text, never computed style): a settled column-head aggregate is weight 600, an unsettled one weight 800', async () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'speakers', 'speakers.css');
      const css = readFileSync(cssPath, 'utf-8');
      const settledBody = css.match(/\.chq-speakers-task-done-settled\s*\{([^}]*)\}/)?.[1];
      const unsettledBody = css.match(/\.chq-speakers-task-done\s*\{([^}]*)\}/)?.[1];
      // docs/design/Chautauqua Speakers.dc.html:789-791, the pack's own
      // `withDone()` -- `doneStyle: t.done === (t.of || 12) ? '...font-weight:600...' : '...font-weight:800...'`
      verbatimLine(790, "    doneStyle: t.done === (t.of || 12)");
      expect(settledBody).toMatch(/font-weight:\s*600/);
      expect(unsettledBody).toMatch(/font-weight:\s*800/);

      renderGrid();
      await screen.findByRole('heading', { name: 'Speakers' });
      const table = screen.getByRole('table');
      // task-a is 11 of 12 (unsettled, weight 800); task-b is 9 of 9 (settled, "All 9 done", weight 600).
      const unsettled = within(table).getByText('11 of 12 done');
      expect(unsettled).toHaveClass('chq-speakers-task-done');
      expect(unsettled).not.toHaveClass('chq-speakers-task-done-settled');
      const settled = within(table).getByText('All 9 done');
      expect(settled).toHaveClass('chq-speakers-task-done', 'chq-speakers-task-done-settled');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :319 "Speaker detail · /admin/speakers/:contactId"
  // ---------------------------------------------------------------------
  describe('frame :319 "Speaker detail · /admin/speakers/:contactId"', () => {
    function baseDetail(overrides: Partial<SpeakerDetailResponse> = {}): SpeakerDetailResponse {
      return {
        contact: {
          id: CONTACT_ID,
          name: 'Priya Raman',
          email: 'priya@example.com',
          company: 'Latticework Systems',
          title: 'Principal Engineer',
          hasAccount: true,
          phone: '+1 415 555 0134',
          notes: null,
          customFields: {},
          headshotFileId: null,
          bio: null,
          socialLinks: [],
        },
        headshotFile: null,
        participation: { participantId: 'p-1', submissionId: 'sub-1', inviteStatus: 'accepted' },
        participationRollup: {
          status: 'accepted',
          bySubmission: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', inviteStatus: 'accepted' }],
        },
        sessions: [
          {
            submissionId: 'sub-1',
            ref: 'S-001',
            title: 'Taming 40-Minute CI',
            status: 'accepted',
            contentStatus: 'pending',
            role: 'speaker',
            scheduled: { day: '2027-05-13', startMin: 600, endMin: 645, roomName: 'Room 2A' },
          },
        ],
        tasks: [
          { assignmentId: 'as-1', taskId: 't-1', title: 'Upload slides', kind: 'file_request', required: true, dueDate: Date.UTC(2027, 3, 1), status: 'pending', completedAt: null, file: null, lastRemindedAt: null, remindCount: 3, overdue: false },
        ],
        counts: { outstandingRequired: 1, overdue: 0, remindCount: 3 },
        otherEvents: [],
        otherEventsCount: 0,
        ...overrides,
      };
    }

    function renderDetail() {
      mockApi({ [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail() });
      return render(
        <MemoryRouter initialEntries={[`/speakers/${CONTACT_ID}`]}>
          <Routes>
            <Route path="/speakers/:contactId" element={<SpeakerDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('DIVERGES: the frame draws ONE header participation dropdown ("Confirmed ▾"); the header carries no trigger at all in the tree (DEC-936 USER RULING, blessed)', async () => {
      renderDetail();
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Priya Raman' })).toBeInTheDocument());
      const head = document.querySelector('.chq-speaker-detail-head');
      const headTrigger = head?.querySelector('.chq-participation-menu-trigger');
      // The header itself carries no participation trigger at all -- the
      // frame's single header dropdown (below) has no DOM counterpart here.
      // docs/design/Chautauqua Speakers.dc.html:341 --
      // `<span style="font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#565A4B; border-radius:3px; padding:4px 0; cursor:pointer">Confirmed<span style="color:#565A4B; padding-left:6px">▾</span></span>`
      verbatimLine(341, '            <span style="font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#565A4B; border-radius:3px; padding:4px 0; cursor:pointer">Confirmed<span style="color:#565A4B; padding-left:6px">▾</span></span>');
      expect(headTrigger).toBeNull();
    });

    it('DIVERGES (additively): the frame draws each Sessions row status as a bare, non-interactive span; the tree puts a live per-session ParticipationMenu there instead', async () => {
      renderDetail();
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Priya Raman' })).toBeInTheDocument());
      const sessionRow = document.querySelector('.chq-speaker-detail-sessions-row');
      const trigger = sessionRow?.querySelector('.chq-participation-menu-trigger');
      // docs/design/Chautauqua Speakers.dc.html:367 --
      // `<span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Accepted</span>`
      verbatimLine(367, '                <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Accepted</span>');
      expect(trigger).not.toBeNull();
      expect(trigger).toHaveTextContent('Confirmed');
    });

    it('MATCHES: the actions row is exactly Email + Remind', async () => {
      renderDetail();
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Priya Raman' })).toBeInTheDocument());
      const controls = document.querySelector('.chq-speaker-detail-actions')?.querySelectorAll(':scope > .chq-btn');
      // docs/design/Chautauqua Speakers.dc.html:352 --
      // `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Email Priya</span>`
      verbatimLine(352, '            <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Email Priya</span>');
      expect(controls).toHaveLength(2);
      expect(controls?.[0]).toHaveTextContent('Email Priya');
      expect(controls?.[1]).toHaveTextContent(/Remind Priya/);
    });

    it('MATCHES: the Tasks row grid tracks are 1fr 132px 96px 150px (read from the app stylesheet TEXT, never computed style)', async () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'speakers', 'speakers.css');
      const css = readFileSync(cssPath, 'utf-8');
      const rowBody = css.match(/\.chq-speaker-detail-tasks-row\s*\{([^}]*)\}/)?.[1];
      const tracks = rowBody?.match(/grid-template-columns:\s*([^;]+);/)?.[1]?.trim();
      // docs/design/Chautauqua Speakers.dc.html:377 --
      // `<div style="display:grid; grid-template-columns:1fr 132px 96px 150px; gap:18px; align-items:center; padding:12px 0; border-bottom:1px solid #E1DDCE">`
      verbatimLine(377, '                <div style="display:grid; grid-template-columns:1fr 132px 96px 150px; gap:18px; align-items:center; padding:12px 0; border-bottom:1px solid #E1DDCE">');
      expect(tracks).toBe('1fr 132px 96px 150px');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :598 "One task, every speaker" / :665 "One task · still waiting"
  // -- one route, two STATES of the same page (the "still waiting" tab).
  // ---------------------------------------------------------------------
  describe('frames :598 "One task, every speaker" and :665 "One task · still waiting" (TaskView, two states)', () => {
    const DAY = 24 * 60 * 60 * 1000;

    function row(overrides: Partial<TaskViewRow> & Pick<TaskViewRow, 'contactId' | 'name'>): TaskViewRow {
      return {
        company: 'Latticework Systems',
        assignmentId: `as-${overrides.contactId}`,
        status: 'pending',
        completedAt: null,
        assignedAt: Date.now() - 6 * DAY,
        lastRemindedAt: null,
        remindCount: 0,
        fileId: null,
        fileName: null,
        answerSummary: null,
        overdue: false,
        ...overrides,
      };
    }

    const ANSWERED: TaskViewRow[] = [
      row({ contactId: 'ct-priya', name: 'Priya Raman', status: 'complete', completedAt: Date.now() - 3 * DAY, answerSummary: 'Two nights · 11–13 May' }),
    ];
    const WAITING: TaskViewRow[] = [
      row({ contactId: 'ct-ruth', name: 'Ruth Adeyemi', remindCount: 3, lastRemindedAt: Date.now() - 12 * DAY }),
      row({ contactId: 'ct-marcus', name: 'Marcus Okafor' }),
    ];

    function payload(): TaskViewResponse {
      return {
        task: { id: TASK_ID, eventId: EVENT_ID, kind: 'form', title: 'Hotel stay form', dueDate: Date.UTC(2027, 7, 15), required: true, formId: 'form-1', instructions: null },
        timezone: 'UTC',
        rows: [...ANSWERED, ...WAITING],
        counts: { assigned: 3, complete: 1, pending: 2, answered: 1 },
      };
    }

    function renderTaskView() {
      mockApi({ [`GET /api/v1/tasks/${TASK_ID}/roster`]: payload() });
      return render(
        <MemoryRouter initialEntries={[`/speakers/tasks/${TASK_ID}`]}>
          <Routes>
            <Route path="/speakers/tasks/:taskId" element={<TaskView />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('frame :598 MATCHES: header carries "Hotel stay form" and the answered-tab action set Export answers / Move the due date / Remind the missing', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      const exportBtn = screen.queryByRole('button', { name: 'Export answers' });
      const moveDueBtn = screen.queryByRole('button', { name: 'Move the due date' });
      const remindMissingBtn = screen.queryByRole('button', { name: 'Remind the missing' });
      // docs/design/Chautauqua Speakers.dc.html:617 --
      // `<a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Export answers</a>`
      verbatimLine(617, '            <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Export answers</a>');
      expect(exportBtn).toBeInTheDocument();
      expect(moveDueBtn).toBeInTheDocument();
      expect(remindMissingBtn).toBeInTheDocument();
    });

    it('frame :598 MATCHES: the Answers table carries "Their answers" / "Answered" columns', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      const table = screen.getByRole('table', { name: 'Answers' });
      const theirAnswers = within(table).queryByText('Their answers');
      const answered = within(table).queryByText('Answered');
      // docs/design/Chautauqua Speakers.dc.html:642 --
      // `<span ...></span><span>Speaker</span><span>Their answers</span><span>Answered</span><span></span>`
      verbatimLine(642, '            <span style="width:17px; height:17px; border:1px solid #4E5C31; background:#4E5C31; border-radius:3px; display:inline-block"></span><span>Speaker</span><span>Their answers</span><span>Answered</span><span></span>');
      expect(theirAnswers).toBeInTheDocument();
      expect(answered).toBeInTheDocument();
    });

    it('frame :598 MATCHES: the bulk bar renders the frame\'s "Marking complete sends nothing" hint once a row is selected', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Priya Raman' }));
      const hint = screen.queryByText('Marking complete sends nothing');
      // docs/design/Chautauqua Speakers.dc.html:631 --
      // `<span style="font-size:12px; color:#565A4B">Marking complete sends nothing</span>`
      verbatimLine(631, '          <span style="font-size:12px; color:#565A4B">Marking complete sends nothing</span>');
      expect(hint).toBeInTheDocument();
    });

    it('frame :665 MATCHES: the waiting tab swaps to Move the due date / Remind all waiting', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
      const remindAllWaiting = screen.queryByRole('button', { name: 'Remind all waiting' });
      const exportGone = screen.queryByRole('button', { name: 'Export answers' });
      // docs/design/Chautauqua Speakers.dc.html:685 --
      // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:10px 15px; font-size:13px; font-weight:700">Remind all waiting</span>`
      verbatimLine(685, '            <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:10px 15px; font-size:13px; font-weight:700">Remind all waiting</span>');
      expect(remindAllWaiting).toBeInTheDocument();
      expect(exportGone).not.toBeInTheDocument();
    });

    it('frame :665 MATCHES: the Still-waiting table carries "Where it stands" / "Last reminded" / "Status" columns', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
      const table = screen.getByRole('table', { name: 'Still waiting' });
      const whereItStands = within(table).queryByText('Where it stands');
      const lastReminded = within(table).queryByText('Last reminded');
      const status = within(table).queryByText('Status');
      // docs/design/Chautauqua Speakers.dc.html:707 --
      // `<span ...></span><span>Speaker</span><span>Where it stands</span><span>Last reminded</span><span>Status</span>`
      verbatimLine(707, '            <span style="width:17px; height:17px; border:1px solid #4E5C31; background:#4E5C31; border-radius:3px; display:inline-block"></span><span>Speaker</span><span>Where it stands</span><span>Last reminded</span><span>Status</span>');
      expect(whereItStands).toBeInTheDocument();
      expect(lastReminded).toBeInTheDocument();
      expect(status).toBeInTheDocument();
    });

    it('frame :665 MATCHES (modulo the tree\'s own pinned "reminded" wording): the bulk bar carries the waiting-tab microcopy once rows are selected', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ruth Adeyemi' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Marcus Okafor' }));
      const microcopy = screen.queryByText(
        'A reminder names only this task · skips anyone reminded in the last hour · the due date moves for everyone, from the header',
      );
      // docs/design/Chautauqua Speakers.dc.html:697 --
      // `<span style="font-size:12px; color:#565A4B">A reminder names only this task · skips anyone emailed in the last hour · the due date moves for everyone, from the header</span>`
      verbatimLine(697, '          <span style="font-size:12px; color:#565A4B">A reminder names only this task · skips anyone emailed in the last hour · the due date moves for everyone, from the header</span>');
      expect(microcopy).toBeInTheDocument();
    });

    it('dense/roomy token pairing: every status chip on this roster is the ROOMY density, never dense', async () => {
      renderTaskView();
      await screen.findByRole('heading', { name: 'Hotel stay form' });
      fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
      const chips = [...screen.getByRole('table', { name: 'Still waiting' }).querySelectorAll('.chq-speakers-status')];
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        expect(chip.className).toContain('chq-speakers-status-roomy');
        expect(chip.className).not.toContain('chq-speakers-status-dense');
      }
    });
  });
});
