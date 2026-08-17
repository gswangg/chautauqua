// DEC-930 client half render smoke (wave 26 amendment: the 1180 pair --
// header actions, main column, rail). Mounts SpeakerDetailPage against a
// mocked GET /api/v1/events/:eventId/speakers/:contactId envelope and
// asserts: the participation control sits INSIDE the header row (not a
// body paragraph); the rail region carries notes + the other-events list;
// a null headshot renders no broken image and no dead Download link; and
// otherEvents is capped at 5 even if the server ever sent more.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpeakerDetailPage } from './SpeakerDetailPage';
import { mockApi } from '../../test-utils/mockApi';
import type { SpeakerDetailResponse } from './speakerDetail';

const EVENT_ID = 'evt-speaker-detail';
const CONTACT_ID = 'ct-1';

function baseDetail(overrides: Partial<SpeakerDetailResponse> = {}): SpeakerDetailResponse {
  return {
    contact: {
      id: CONTACT_ID,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Acme',
      title: 'Engineer',
      hasAccount: true,
      phone: '+1 415 555 0134',
      notes: 'Prefers a morning slot.',
      customFields: {},
      headshotFileId: null,
      bio: null,
      socialLinks: [],
    },
    participation: {
      participantId: 'p-1',
      submissionId: 'sub-1',
      inviteStatus: 'accepted',
    },
    participationRollup: {
      status: 'accepted',
      bySubmission: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', inviteStatus: 'accepted' }],
    },
    sessions: [
      {
        submissionId: 'sub-1',
        ref: 'S-001',
        title: 'Analytical Engines',
        status: 'accepted',
        contentStatus: 'pending',
        role: 'speaker',
        scheduled: { day: '2026-05-13', startMin: 600, endMin: 645, roomName: 'Hall A' },
      },
    ],
    tasks: [
      {
        assignmentId: 'as-1',
        taskId: 'task-1',
        title: 'Upload slides',
        kind: 'file_request',
        required: true,
        dueDate: Date.UTC(2026, 0, 15),
        status: 'complete',
        completedAt: 1700000000000,
        file: { id: 'file-1', filename: 'slides-final.pdf', sizeBytes: 2048, versionNo: 2 },
        overdue: false,
      },
      {
        assignmentId: 'as-2',
        taskId: 'task-2',
        title: 'Sign agreement',
        kind: 'general',
        required: true,
        dueDate: null,
        status: 'pending',
        completedAt: null,
        file: null,
        overdue: false,
      },
    ],
    counts: { outstandingRequired: 1, overdue: 0 },
    otherEvents: [{ eventId: 'evt-2025', name: 'DevFlow 2025' }],
    otherEventsCount: 1,
    ...overrides,
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/speakers/${CONTACT_ID}`]}>
      <Routes>
        <Route path="/speakers/:contactId" element={<SpeakerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SpeakerDetailPage render smoke', () => {
  it('renders the filename, session link href, and task/session counts', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    // Deliverable named by its own filename in the Files section -- never
    // the word 'File' -- with a separate Download action beside it.
    // DEC-930 wave-24 amendment: the row's role="cell" lands on a wrapper
    // <span>, never on the anchor itself, so the anchor keeps its implicit
    // link role and stays reachable by role.
    expect(screen.getByText('slides-final.pdf')).toBeInTheDocument();
    const fileLink = screen.getAllByRole('link', { name: 'Download' }).find((a) => a.getAttribute('href') === '/files/file-1');
    expect(fileLink).toBeDefined();

    // Session row links to /admin/submissions/:submissionId (basename-free
    // in this render, since SpeakerDetailPage is rendered without App's
    // <BrowserRouter basename="/admin">). It too keeps its link role -- the
    // structural cell role lives on the wrapper <span>, not the control.
    const sessionLink = screen.getByRole('link', { name: /Analytical Engines/ });
    expect(sessionLink).toHaveAttribute('href', '/submissions/sub-1');

    // Counts printed on the page agree with the payload's own arrays.
    expect(screen.getByText('Sessions · 1')).toBeInTheDocument();
    expect(screen.getByText('Tasks · 2 · 1 outstanding · 0 overdue')).toBeInTheDocument();

    // DEC-930 wave-22 amendment: the row grids under Sessions/Tasks/Files
    // carry table semantics -- role=table wrapper, one role=row per record.
    const sessionsTable = screen.getByRole('table', { name: 'Sessions' });
    expect(within(sessionsTable).getAllByRole('row')).toHaveLength(1);
    const tasksTable = screen.getByRole('table', { name: 'Tasks' });
    expect(within(tasksTable).getAllByRole('row')).toHaveLength(2);
    const filesTable = screen.getByRole('table', { name: 'Files' });
    expect(within(filesTable).getAllByRole('row')).toHaveLength(1);

    // Page root carries chq-measure-table (two-plus scanned tables), never
    // the plain chq-measure reading-page class.
    expect(document.querySelector('.chq-speaker-detail-page')).toHaveClass('chq-measure-table');
    expect(document.querySelector('.chq-speaker-detail-page')).not.toHaveClass('chq-measure');

    // Exact slot string for a placed session: day formatted via
    // formatDayLabel + zero-padded clock times, never the raw ISO day.
    expect(screen.getByText('Wed 13 May 10:00–10:45, Hall A')).toBeInTheDocument();
  });

  // DEC-930 wave-19 amendment: Sessions/Tasks/Files drop <table>/<thead>
  // for header-ruled row grids -- and the rail column is the pack's 320px
  // track, not the old 300px one.
  it('renders no <thead> anywhere and the detail grid declares a 320px rail track', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    expect(document.querySelectorAll('thead')).toHaveLength(0);

    const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'speakers.css');
    const css = readFileSync(cssPath, 'utf-8');
    const gridBody = css.match(/\.chq-speaker-detail-grid\s*\{([^}]*)\}/)?.[1];
    expect(gridBody).toBeDefined();
    expect(gridBody).toMatch(/320px/);
  });

  it('promotes the participation control into the header row, not a body paragraph', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    // The old body-paragraph restatement is gone entirely.
    expect(document.querySelector('.chq-speaker-detail-participation')).not.toBeInTheDocument();

    // USER RULING (release night): the live participation control
    // (ParticipationMenu's trigger button) lives up by the name, in the
    // header rollup line -- not in the actions row.
    const rollup = document.querySelector('.chq-speaker-detail-participation-rollup');
    expect(rollup).not.toBeNull();
    const trigger = rollup?.querySelector('.chq-participation-menu-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger).toHaveTextContent('Confirmed');

    const actions = document.querySelector('.chq-speaker-detail-actions');
    expect(actions).not.toBeNull();
    expect(actions?.querySelector('.chq-participation-menu-trigger')).toBeNull();
    expect(actions).toHaveTextContent(/Email Ada/);
    expect(actions).toHaveTextContent(/Remind Ada/);

    // The header block is the ONE place the control renders.
    const head = document.querySelector('.chq-speaker-detail-head');
    expect(head?.querySelectorAll('.chq-participation-menu-trigger')).toHaveLength(1);
  });

  // User-filed (screenshot of /admin/speakers/<id>): "the row of chips and
  // buttons also looks inconsistent here", then USER RULING: one
  // participation control, up by the name. The actions row is exactly the
  // two chq-btn controls the frame draws at one 46px height (docs/design/
  // Chautauqua Speakers.dc.html:346-347); the state changer is the roster's
  // chip (DEC-730 family) in the header rollup line. The height rule in
  // speakers.css is keyed on `row > .chq-btn`, so it silently stops
  // applying if this shape drifts.
  it('draws the action row as exactly Email + Remind, with the state chip up in the header rollup', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const actions = document.querySelector('.chq-speaker-detail-actions');
    expect(actions).not.toBeNull();

    // Exactly two controls, in the frame's order: Email then Remind.
    const children = [...(actions?.children ?? [])];
    expect(children).toHaveLength(2);
    expect(children[0]).toHaveClass('chq-btn', 'chq-btn-secondary');
    expect(children[0]).toHaveTextContent(/Email Ada/);
    expect(children[1]).toHaveClass('chq-btn', 'chq-btn-primary');
    expect(children[1]).toHaveTextContent(/Remind Ada/);
    expect(actions?.querySelectorAll(':scope > .chq-btn')).toHaveLength(2);

    // The state changer: the roster's chip family, in the rollup line.
    const trigger = document.querySelector('.chq-speaker-detail-participation-rollup .chq-participation-menu-trigger');
    expect(trigger).toHaveClass('chq-speakers-status', 'chq-speakers-status-complete');
  });

  it('the rail carries both Notes and the other-events list', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const rail = document.querySelector('.chq-speaker-detail-rail');
    expect(rail).not.toBeNull();
    expect(rail).toHaveTextContent('Prefers a morning slot.');
    expect(rail).toHaveTextContent('DevFlow 2025');
    expect(rail?.querySelector('.chq-speaker-detail-notes')).not.toBeNull();
    expect(rail?.querySelector('.chq-speaker-detail-other-events')).not.toBeNull();
    // Contact block (email/phone) also lives in the rail.
    expect(rail).toHaveTextContent('ada@example.com');
    expect(rail).toHaveTextContent('+1 415 555 0134');
  });

  it('a null headshot renders no broken image and no dead Download link', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        contact: { ...baseDetail().contact, headshotFileId: null },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const identity = document.querySelector('.chq-speaker-detail-identity');
    expect(identity?.querySelector('img.chq-speaker-detail-headshot')).not.toBeInTheDocument();
    expect(identity?.querySelector('.chq-speaker-detail-headshot-download')).not.toBeInTheDocument();
    // A neutral placeholder still occupies the slot.
    expect(identity?.querySelector('.chq-speaker-detail-headshot-placeholder')).toBeInTheDocument();
  });

  it('a present headshot renders an image plus a tertiary Download link carrying the download attribute', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        contact: { ...baseDetail().contact, headshotFileId: 'file-hs-1' },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const identity = document.querySelector('.chq-speaker-detail-identity');
    const img = identity?.querySelector('img.chq-speaker-detail-headshot');
    expect(img).toHaveAttribute('src', '/headshots/file-hs-1');

    const downloadLink = identity?.querySelector('.chq-speaker-detail-headshot-download');
    expect(downloadLink).toHaveAttribute('href', '/headshots/file-hs-1');
    expect(downloadLink).toHaveAttribute('download');
  });

  // DEC-678 (w55-c): sessions/tasks/files/other-events zero-row states
  // render through EmptyState's fresh anatomy (no filter axis on any of
  // these four sub-collections); the notes field's own `.chq-empty` line
  // is NOT a collection and stays untouched.
  it('renders EmptyState fresh anatomy for zero sessions/tasks/files/other-events, and leaves the notes chq-empty line untouched', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        sessions: [],
        tasks: [],
        otherEvents: [],
        otherEventsCount: 0,
        contact: { ...baseDetail().contact, notes: null },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const main = document.querySelector('.chq-speaker-detail-main');
    const rail = document.querySelector('.chq-speaker-detail-rail');

    const freshBlocks = document.querySelectorAll('.chq-empty-block-fresh');
    // Sessions, Tasks, Files (tasks with no file), Other events -- four.
    expect(freshBlocks).toHaveLength(4);
    expect(main).toHaveTextContent('No sessions.');
    expect(main).toHaveTextContent('No tasks.');
    expect(main).toHaveTextContent('No files.');
    expect(rail).toHaveTextContent('No other events.');
    for (const block of Array.from(freshBlocks)) {
      expect(block.querySelector('.chq-empty-escape')).not.toBeInTheDocument();
    }

    // The notes field's bare `.chq-empty` paragraph is the ONE surviving
    // non-collection site and is left exactly as it was.
    const notesSection = rail?.querySelector('.chq-speaker-detail-notes');
    const notesEmpty = notesSection?.querySelector('p.chq-empty');
    expect(notesEmpty).toHaveTextContent('No notes.');
    expect(document.querySelectorAll('p.chq-empty')).toHaveLength(1);
  });

  it('caps otherEvents at 5 even if the server sends more', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ eventId: `evt-${i}`, name: `Conf ${i}` }));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({ otherEvents: many, otherEventsCount: 7 }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const items = document.querySelectorAll('.chq-speaker-detail-other-events-list li');
    expect(items).toHaveLength(5);
    // The count line still reports the true total, not the capped list length.
    expect(screen.getByText('Across your events · 7')).toBeInTheDocument();
  });

  // DEC-829 amendment (w61-e): a Remind control only where something on
  // this speaker's task list is outstanding.
  it('a fully-complete speaker shows no Remind affordance anywhere', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        tasks: [
          {
            assignmentId: 'as-1',
            taskId: 'task-1',
            title: 'Upload slides',
            kind: 'file_request',
            required: true,
            dueDate: Date.UTC(2026, 0, 15),
            status: 'complete',
            completedAt: 1700000000000,
            file: { id: 'file-1', filename: 'slides-final.pdf', sizeBytes: 2048, versionNo: 2 },
            overdue: false,
          },
        ],
        counts: { outstandingRequired: 0, overdue: 0 },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /^Remind/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remind this task' })).not.toBeInTheDocument();
  });

  // DEC-936: a two-session speaker whose participation statuses disagree
  // gets a MIXED chip in the header plus a breakdown line naming each
  // session ref and its own status -- the header can never assert a single
  // status the roster contradicts.
  it('DEC-936: a mixed rollup renders a Mixed breakdown line naming every disagreeing ref', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        participationRollup: {
          status: 'mixed',
          bySubmission: [
            { participantId: 'p-1', submissionId: 'sub-1', ref: 'SES-001', inviteStatus: 'accepted' },
            { participantId: 'p-2', submissionId: 'sub-2', ref: 'SES-014', inviteStatus: 'none' },
          ],
        },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const head = document.querySelector('.chq-speaker-detail-head');
    expect(head).toHaveTextContent('Mixed');
    expect(head).toHaveTextContent('SES-001 confirmed');
    expect(head).toHaveTextContent('SES-014 not invited');
  });

  // USER RULING follow-up: the optimistic flip carries the rollup, so a
  // two-session speaker whose sessions disagreed BY this change shows the
  // Mixed breakdown immediately -- not only after a reload.
  it('declining one of two agreeing sessions surfaces the Mixed breakdown optimistically, before any refetch', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        participation: { participantId: 'p-1', submissionId: 'sub-1', inviteStatus: 'accepted' },
        participationRollup: {
          status: 'accepted',
          bySubmission: [
            { participantId: 'p-1', submissionId: 'sub-1', ref: 'SES-008', inviteStatus: 'accepted' },
            { participantId: 'p-2', submissionId: 'sub-2', ref: 'SES-009', inviteStatus: 'accepted' },
          ],
        },
      }),
      [`PATCH /api/v1/submissions/sub-1/participants/p-1`]: { ok: true },
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());
    expect(document.querySelector('.chq-speaker-detail-participation-rollup-breakdown')).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('.chq-speaker-detail-participation-rollup .chq-participation-menu-trigger')!);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Declined/ }));

    const breakdown = document.querySelector('.chq-speaker-detail-participation-rollup-breakdown');
    expect(breakdown).not.toBeNull();
    expect(breakdown).toHaveTextContent('Mixed · SES-008 declined · SES-009 confirmed');
  });

  it('DEC-936: an agreeing rollup renders one status control naming the shared status, no breakdown line', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        // The write-target row agrees with the rollup (that is what
        // "agreeing" means) -- the menu trigger is now the one chip.
        participation: { participantId: 'p-1', submissionId: 'sub-1', inviteStatus: 'declined' },
        participationRollup: {
          status: 'declined',
          bySubmission: [
            { participantId: 'p-1', submissionId: 'sub-1', ref: 'SES-001', inviteStatus: 'declined' },
            { participantId: 'p-2', submissionId: 'sub-2', ref: 'SES-014', inviteStatus: 'declined' },
          ],
        },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const head = document.querySelector('.chq-speaker-detail-head');
    expect(head).toHaveTextContent('Declined');
    expect(document.querySelector('.chq-speaker-detail-participation-rollup-breakdown')).not.toBeInTheDocument();
    expect(head).not.toHaveTextContent('Mixed');
  });

  it('a speaker with one pending task shows both the header Remind control and the per-row "Remind this task" link', async () => {
    mockApi({
      // baseDetail() already carries one complete task + one pending task.
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Remind Ada' })).toBeInTheDocument();
    // Only the pending row's link renders -- the completed row's does not.
    // DEC-930 wave-24 amendment: the row's cell role lives on a wrapper
    // <span>, so this per-row control keeps its implicit button role.
    expect(screen.getAllByRole('button', { name: 'Remind this task' })).toHaveLength(1);
  });

  // DEC-738 amendment (wave 75): the portal-written bio and social links
  // are read-only-projected onto the speaker record beside the identity
  // header, with a link to the CRM contact record rather than a second
  // editor.
  it('DEC-738: renders the portal-written bio and a social link, with a link to the contact record', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        contact: {
          ...baseDetail().contact,
          bio: 'PORTAL_BIO_SENTINEL: writes optimizing compilers for analytical engines.',
          socialLinks: [{ label: 'Twitter', url: 'https://twitter.com/ada' }],
        },
      }),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    expect(screen.getByText(/PORTAL_BIO_SENTINEL/)).toBeInTheDocument();
    const socialLink = screen.getByRole('link', { name: 'Twitter' });
    expect(socialLink).toHaveAttribute('href', 'https://twitter.com/ada');

    const bioBlock = document.querySelector('.chq-speaker-detail-portal-bio');
    expect(bioBlock).toHaveTextContent('Edit in contact record');
  });

  it('DEC-738: renders nothing (no empty frame) when both bio and social links are absent', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    expect(document.querySelector('.chq-speaker-detail-portal-bio')).not.toBeInTheDocument();
  });
});

// User-filed defect (screenshot of /admin/speakers/<id>, speaker "Elliot
// Ekström", TASKS section): rows arrived in no useful order (completes and
// pendings interleaved, due dates jumping 15 Aug -> 16 Aug -> 26 Aug -> 13
// Aug -> 9 Sep -> 13 Aug); the due-date and status columns landed at
// different x-positions row to row; and the header counted "1 OVERDUE" while
// no row was marked overdue. This block pins all three.
describe('SpeakerDetailPage tasks section: order, overdue mark, column shape', () => {
  // Same six-row shape the filed screenshot showed, in the same unordered
  // arrival order the server sent it.
  function shuffledTasks() {
    return [
      { id: 'as-a', title: 'Hotel stay requirement form', due: Date.UTC(2026, 7, 15), status: 'complete' as const, overdue: false },
      { id: 'as-b', title: 'Flight reimbursement form', due: Date.UTC(2026, 7, 16), status: 'pending' as const, overdue: false },
      { id: 'as-c', title: 'Finalize talk description', due: Date.UTC(2026, 7, 26), status: 'complete' as const, overdue: false },
      { id: 'as-d', title: 'Finalize bio + headshot', due: Date.UTC(2026, 7, 13), status: 'complete' as const, overdue: false },
      { id: 'as-e', title: 'Announce participation', due: Date.UTC(2026, 8, 9), status: 'pending' as const, overdue: false },
      { id: 'as-f', title: 'Upload your slide deck', due: Date.UTC(2026, 7, 13), status: 'pending' as const, overdue: true },
    ].map((t) => ({
      assignmentId: t.id,
      taskId: `task-${t.id}`,
      title: t.title,
      kind: 'general' as const,
      required: t.id === 'as-f',
      dueDate: t.due,
      status: t.status,
      completedAt: t.status === 'complete' ? 1700000000000 : null,
      file: null,
      overdue: t.overdue,
    }));
  }

  function mountWithTasks() {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        tasks: shuffledTasks(),
        counts: { outstandingRequired: 1, overdue: 1 },
      }),
    });
    renderPage();
  }

  function taskRows() {
    return within(screen.getByRole('table', { name: 'Tasks' })).getAllByRole('row');
  }

  it('orders outstanding work first -- overdue, then upcoming pendings, then the completed history, each by due date', async () => {
    mountWithTasks();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const titles = taskRows().map((row) => row.firstElementChild?.textContent?.replace(' Required', '').trim());
    expect(titles).toEqual([
      // Overdue first (13 Aug, the oldest deadline still outstanding).
      'Upload your slide deck',
      // Then the remaining pendings, earliest deadline first.
      'Flight reimbursement form',
      'Announce participation',
      // Then the completed history, also by due date.
      'Finalize bio + headshot',
      'Hotel stay requirement form',
      'Finalize talk description',
    ]);
  });

  it('a task with no due date sorts to the end of its own band, never above a dated one', async () => {
    const tasks = shuffledTasks();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        tasks: [
          { ...tasks[1]!, assignmentId: 'as-undated', title: 'Undated pending', dueDate: null },
          ...tasks,
        ],
        counts: { outstandingRequired: 1, overdue: 1 },
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const titles = taskRows().map((row) => row.firstElementChild?.textContent?.replace(' Required', '').trim());
    expect(titles.indexOf('Undated pending')).toBeGreaterThan(titles.indexOf('Announce participation'));
    // Still inside the pending band -- above every completed row.
    expect(titles.indexOf('Undated pending')).toBeLessThan(titles.indexOf('Finalize bio + headshot'));
  });

  it('marks the overdue pending row with the roster grid OVERDUE vocabulary, and the header count matches the marked rows', async () => {
    mountWithTasks();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    const marked = document.querySelectorAll('.chq-speaker-detail-tasks-row .chq-speakers-status-overdue');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent('OVERDUE');
    // The SAME chip class family the onboarding grid's cells use -- never a
    // second overdue vocabulary invented for this page.
    expect(marked[0]).toHaveClass('chq-speakers-status');
    // Header count and the marked rows agree.
    expect(screen.getByText('Tasks · 6 · 1 outstanding · 1 overdue')).toBeInTheDocument();
    // The other pending row still reads as a plain pending chip.
    expect(document.querySelectorAll('.chq-speaker-detail-tasks-row .chq-speakers-status-pending')).toHaveLength(2);
    // The overdue row stays a live status control (click-to-change intact),
    // and names its lateness in the accessible name.
    expect(marked[0]!.tagName).toBe('BUTTON');
    expect(marked[0]).toHaveAttribute('aria-label', 'Toggle Upload your slide deck for Ada Lovelace, overdue');
  });

  it('gives every row the same four column tracks -- the action track is fixed, so a completed row cannot slide the due date sideways', async () => {
    mountWithTasks();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    // Every row renders four cells, including completed rows (whose fourth
    // cell is deliberately empty -- DEC-829 w61-e: no Remind on a completed
    // task), so no row can collapse a track.
    for (const row of taskRows()) {
      expect(within(row).getAllByRole('cell')).toHaveLength(4);
    }
    // Only the three pending rows carry the per-task Remind control.
    expect(screen.getAllByRole('button', { name: 'Remind this task' })).toHaveLength(3);

    // jsdom applies no external stylesheet, so the track shape is read from
    // the stylesheet text: a fixed action track, never `auto` (an `auto`
    // track resolves to 0px on the rows that render no Remind link and
    // ~88px on the rows that do, which is exactly the raggedness the user
    // filed).
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'speakers.css');
    const css = readFileSync(cssPath, 'utf-8');
    const rowBody = css.match(/\.chq-speaker-detail-tasks-row\s*\{([^}]*)\}/)?.[1];
    expect(rowBody).toBeDefined();
    const tracks = rowBody!.match(/grid-template-columns:\s*([^;]+);/)?.[1]?.trim();
    expect(tracks).toBeDefined();
    expect(tracks!.split(/\s+/)).toHaveLength(4);
    expect(tracks).not.toMatch(/auto/);
    // The frame's own title/due/status tracks are untouched (docs/design/
    // Chautauqua Speakers.dc.html:371).
    expect(tracks).toMatch(/^1fr 150px 130px /);
  });

  it('ticking the overdue task complete restates the header counts, so the header never names a row the reader cannot find', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail({
        tasks: shuffledTasks(),
        counts: { outstandingRequired: 1, overdue: 1 },
      }),
      'PATCH /api/v1/task-assignments/as-f': { ok: true },
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Upload your slide deck for Ada Lovelace, overdue' }));

    await waitFor(() => expect(screen.getByText('Tasks · 6 · 0 outstanding · 0 overdue')).toBeInTheDocument());
    expect(document.querySelectorAll('.chq-speaker-detail-tasks-row .chq-speakers-status-overdue')).toHaveLength(0);
  });
});
