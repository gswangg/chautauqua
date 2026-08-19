// Design pack v12's task view, client half: docs/design/Chautauqua
// Speakers.dc.html frames "One task, every speaker" and "One task · still
// waiting". Mounts TaskView against a mocked GET /api/v1/tasks/:id/roster
// envelope and asserts the things the two frames actually decide -- the
// header's action set per tab, the tab pills and their right-flushed
// reminder meta, the two column sets, the bulk bar's per-tab verbs and
// microcopy, the roomy density on every status chip, and that "Not needed"
// unassigns exactly the selected contacts and nobody else.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TaskView } from './TaskView';
import { mockApi } from '../../test-utils/mockApi';
import type { TaskViewResponse, TaskViewRow } from './taskRoster';

const TASK_ID = 'task-hotel';
const EVENT_ID = 'evt-1';

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
  row({
    contactId: 'ct-priya',
    name: 'Priya Raman',
    status: 'complete',
    completedAt: Date.now() - 14 * DAY,
    answerSummary: 'Two nights · 11–13 May · no accessibility needs',
  }),
  row({
    contactId: 'ct-iris',
    name: 'Iris Bell',
    status: 'complete',
    completedAt: Date.now() - 10 * DAY,
    answerSummary: 'Three nights · 11–14 May',
  }),
];

const WAITING: TaskViewRow[] = [
  row({ contactId: 'ct-ruth', name: 'Ruth Adeyemi', remindCount: 3, lastRemindedAt: Date.now() - 12 * DAY }),
  row({ contactId: 'ct-marcus', name: 'Marcus Okafor', remindCount: 1, lastRemindedAt: Date.now() - 12 * DAY }),
  row({ contactId: 'ct-tomas', name: 'Tomas Bell', overdue: true }),
];

function payload(overrides: Partial<TaskViewResponse> = {}): TaskViewResponse {
  const rows = overrides.rows ?? [...ANSWERED, ...WAITING];
  return {
    task: {
      id: TASK_ID,
      eventId: EVENT_ID,
      kind: 'form',
      title: 'Hotel stay form',
      dueDate: Date.UTC(2027, 7, 15),
      required: true,
      formId: 'form-1',
      instructions: null,
    },
    timezone: 'UTC',
    rows,
    counts: { assigned: rows.length, complete: 2, pending: rows.length - 2, answered: 2 },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/speakers/tasks/${TASK_ID}`]}>
      <Routes>
        <Route path="/speakers/tasks/:taskId" element={<TaskView />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function mountLoaded(routes: Record<string, unknown> = {}) {
  const fetchMock = mockApi({ [`GET /api/v1/tasks/${TASK_ID}/roster`]: payload(), ...routes });
  renderPage();
  await screen.findByRole('heading', { name: 'Hotel stay form' });
  return fetchMock;
}

function switchToWaiting() {
  fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('design pack v12 task view: "One task, every speaker" / "One task · still waiting"', () => {
  it('header states the frame sub-line, and the answered tab carries Export answers + Move the due date + Remind the missing', async () => {
    await mountLoaded();

    expect(screen.getByText('Due 15 Aug 2027 · required · 2 answered of 5 who need it')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Speakers' })).toHaveAttribute('href', '/speakers');

    expect(screen.getByRole('button', { name: 'Export answers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move the due date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remind the missing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remind all waiting' })).not.toBeInTheDocument();
  });

  it('the waiting tab swaps the header verb and drops Export answers, keeping Move the due date', async () => {
    await mountLoaded();
    switchToWaiting();

    expect(screen.getByRole('button', { name: 'Remind all waiting' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export answers' })).not.toBeInTheDocument();
    // The due date moves for the WHOLE task, from the header, on either tab
    // -- there is no per-selection due date anywhere on this page.
    expect(screen.getByRole('button', { name: 'Move the due date' })).toBeInTheDocument();
  });

  it('the two pills count their own halves and the reminder meta is right-flushed on the tab row', async () => {
    await mountLoaded();

    expect(screen.getByRole('button', { name: 'Answered · 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Still waiting · 3' })).toHaveAttribute('aria-pressed', 'false');
    // 3 sends + 1 send + 0 across the roster.
    expect(screen.getByText(/^4 reminder sends · last /)).toBeInTheDocument();
  });

  it('the answered table renders Speaker / Their answers / Answered plus an Open action per row', async () => {
    await mountLoaded();

    const table = screen.getByRole('table', { name: 'Answers' });
    expect(within(table).getByText('Their answers')).toBeInTheDocument();
    expect(within(table).getByText('Answered')).toBeInTheDocument();
    expect(within(table).getByText('Two nights · 11–13 May · no accessibility needs')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'Open' })).toHaveLength(2);
    expect(
      screen.getByText('Exporting sends the selected answers as a CSV · nothing is emailed to the speakers'),
    ).toBeInTheDocument();
    // Frame :648 draws the answered-tab name as a plain span, never a link
    // -- "Open" is the row's one target here, unlike the waiting tab (:713)
    // where the name itself is the link.
    expect(within(table).getByText('Priya Raman').tagName).toBe('SPAN');
    expect(within(table).queryByRole('link', { name: 'Priya Raman' })).not.toBeInTheDocument();
  });

  it('the waiting table renders Where it stands / Last reminded / Status, with the name a link to the speaker', async () => {
    await mountLoaded();
    switchToWaiting();

    const table = screen.getByRole('table', { name: 'Still waiting' });
    expect(within(table).getByText('Where it stands')).toBeInTheDocument();
    expect(within(table).getByText('Last reminded')).toBeInTheDocument();
    expect(within(table).getByText('Status')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Ruth Adeyemi' })).toHaveAttribute('href', '/speakers/ct-ruth');
    expect(within(table).getByText(/^3 sends · last /)).toBeInTheDocument();
    expect(within(table).getByText(/^1 send · /)).toBeInTheDocument();
    expect(within(table).getByText('Never')).toBeInTheDocument();
    expect(
      screen.getByText('Marking a task not needed removes it for that speaker only · it stays on everyone else'),
    ).toBeInTheDocument();
  });

  it('every waiting status chip carries the roomy density class, never the dense one', async () => {
    await mountLoaded();
    switchToWaiting();

    const chips = [...screen.getByRole('table', { name: 'Still waiting' }).querySelectorAll('.chq-speakers-status')];
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip.className).toContain('chq-speakers-status-roomy');
      expect(chip.className).not.toContain('chq-speakers-status-dense');
    }
    // The one overdue row wears the overdue modifier (v12 inverts the
    // vocabulary: overdue is the filled mark, pending is bold ink).
    expect(chips.filter((c) => c.className.includes('chq-speakers-status-overdue'))).toHaveLength(1);
  });

  it('the bulk bar appears only once something is selected, and its verbs follow the tab', async () => {
    await mountLoaded();

    expect(screen.queryByText('Marking complete sends nothing')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Priya Raman' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Marking complete sends nothing')).toBeInTheDocument();
    for (const label of ['Mark complete', 'Reopen', 'Export', 'Clear']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Not needed' })).not.toBeInTheDocument();

    // Switching tabs clears the selection: a contact selected on one half
    // of the roster is not a contact the other half's verbs can act on.
    switchToWaiting();
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ruth Adeyemi' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tomas Bell' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A reminder names only this task · skips anyone emailed in the last hour · the due date moves for everyone, from the header',
      ),
    ).toBeInTheDocument();
    for (const label of ['Remind', 'Not needed', 'Clear']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  it('"Not needed" confirms by name, then unassigns exactly the selected contacts', async () => {
    const remaining = payload({ rows: [...ANSWERED, WAITING[1]!, WAITING[2]!] });
    const fetchMock = await mountLoaded({ [`POST /api/v1/tasks/${TASK_ID}/unassign`]: remaining });

    switchToWaiting();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ruth Adeyemi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not needed' }));

    // The dialog names who loses the task before anything is written --
    // once in the row it came from, once in the confirmation.
    expect(screen.getAllByText('Ruth Adeyemi').length).toBeGreaterThan(1);
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Remove this task' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) =>
        String(url).endsWith(`/tasks/${TASK_ID}/unassign`) && (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(post).toBeDefined();
      expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({ contactIds: ['ct-ruth'] });
    });

    // The refreshed payload the route echoes back is what the page renders
    // -- Ruth is gone, everyone else still holds the task.
    await waitFor(() => expect(screen.queryByText('Ruth Adeyemi')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Marcus Okafor' })).toBeInTheDocument();
  });

  it('"Remind" previews through the task-scoped reminder endpoint, naming only this task', async () => {
    const fetchMock = await mountLoaded({
      [`POST /api/v1/events/${EVENT_ID}/onboarding/remind/preview`]: { drafts: [], skipped: 0, remaining: 0 },
    });

    switchToWaiting();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Marcus Okafor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remind' }));

    await waitFor(() => {
      const preview = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/onboarding/remind/preview'));
      expect(preview).toBeDefined();
      expect(JSON.parse(String((preview![1] as RequestInit).body))).toEqual({
        taskIds: [TASK_ID],
        contactIds: ['ct-marcus'],
      });
    });
  });

  it('"Move the due date" opens the shared date dialog and PATCHes the task, never an assignment', async () => {
    const fetchMock = await mountLoaded({ [`PATCH /api/v1/tasks/${TASK_ID}`]: { id: TASK_ID } });

    fireEvent.click(screen.getByRole('button', { name: 'Move the due date' }));
    const field = screen.getByLabelText(/Due date/);
    fireEvent.change(field, { target: { value: '20 Sep 2027' } });
    fireEvent.blur(field);
    // Header control and dialog primary share the verb; the dialog's is the
    // later of the two in the document.
    const confirms = screen.getAllByRole('button', { name: 'Move the due date' });
    fireEvent.click(confirms[confirms.length - 1]!);

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(String(patch![0])).toBe(`/api/v1/tasks/${TASK_ID}`);
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({ dueDate: Date.UTC(2027, 8, 20) });
    });
  });
});
