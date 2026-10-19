// Multi-portal decision 77: the task view's "Add people" hand-picks roster
// people who don't hold this task yet and gives it to them directly
// (POST /tasks/:id/assign), then re-reads the task.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TaskView } from './TaskView';
import { AddPeopleModal } from './AddPeopleModal';
import { errorEnvelope, mockApi } from '../../test-utils/mockApi';
import type { TaskViewResponse, TaskViewRow } from './taskRoster';
import type { OnboardingGridResponse } from './types';

const TASK_ID = 'task-promo';
const EVENT_ID = 'evt-1';

function holder(contactId: string, name: string): TaskViewRow {
  return {
    contactId,
    name,
    company: null,
    assignmentId: `as-${contactId}`,
    status: 'pending',
    completedAt: null,
    assignedAt: 0,
    lastRemindedAt: null,
    remindCount: 0,
    fileId: null,
    fileName: null,
    answerSummary: null,
    overdue: false,
  };
}

function view(rows: TaskViewRow[]): TaskViewResponse {
  return {
    task: { id: TASK_ID, eventId: EVENT_ID, kind: 'general', title: 'Promo video', dueDate: null, required: false, formId: null, instructions: null },
    timezone: 'UTC',
    rows,
    counts: { assigned: rows.length, complete: 0, pending: rows.length, answered: 0 },
  };
}

function rosterRow(id: string, name: string, company: string | null, inviteStatus = 'accepted') {
  return {
    contact: {
      id,
      name,
      email: `${id}@example.com`,
      company,
      hasAccount: true,
      participations: [{ participantId: `pa-${id}`, submissionId: `sub-${id}`, ref: 'S-001', title: 'Talk', inviteStatus }],
    },
    cells: [],
  };
}

const ROSTER = {
  tasks: [],
  rows: [
    rosterRow('ct-ada', 'Ada Lovelace', 'Analytical'),
    rosterRow('ct-bo', 'Bo Diaz', null),
    rosterRow('ct-cy', 'Cy Young', 'Mound Co'),
    rosterRow('ct-di', 'Di Okoro', null, 'invited'),
  ],
  total: 4,
  page: 1,
  perPage: 200,
  counts: { speakers: 3, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
  timezone: 'UTC',
} as unknown as OnboardingGridResponse;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/speakers/tasks/${TASK_ID}`]}>
      <Routes>
        <Route path="/speakers/tasks/:taskId" element={<TaskView />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TaskView: Add people (decision 77)', () => {
  it('lists only roster people without the task, posts the chosen ids, and re-reads the task', async () => {
    let reads = 0;
    const fetchMock = mockApi({
      [`GET /api/v1/tasks/${TASK_ID}/roster`]: () => {
        reads += 1;
        return reads === 1 ? view([holder('ct-ada', 'Ada Lovelace')]) : view([holder('ct-ada', 'Ada Lovelace'), holder('ct-cy', 'Cy Young')]);
      },
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: ROSTER,
      [`POST /api/v1/tasks/${TASK_ID}/assign`]: ROSTER,
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Promo video' });

    fireEvent.click(screen.getByRole('button', { name: 'Add people' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add people' });
    const list = await within(dialog).findByRole('group', { name: 'People on the roster' });
    // Ada already holds it and Di hasn't confirmed, so only Bo and Cy are offered
    expect(within(list).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['Bo Diaz', 'Cy Young · Mound Co']);
    expect(within(dialog).getByText(/Not listed: 1 person who hasn’t confirmed yet/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Find a person'), { target: { value: 'mound' } });
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(within(list).getByRole('checkbox', { name: 'Cy Young · Mound Co' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add 1 person' }));

    await screen.findByText('1 person now has this task.');
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({ contactIds: ['ct-cy'] });
    await waitFor(() => expect(reads).toBe(2));
    expect(screen.queryByRole('dialog', { name: 'Add people' })).not.toBeInTheDocument();
  });

  it('blocks an empty choice and says so when everyone already has the task', async () => {
    mockApi({
      [`GET /api/v1/tasks/${TASK_ID}/roster`]: view([holder('ct-ada', 'Ada Lovelace'), holder('ct-bo', 'Bo Diaz'), holder('ct-cy', 'Cy Young'), holder('ct-di', 'Di Okoro')]),
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: ROSTER,
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Promo video' });
    fireEvent.click(screen.getByRole('button', { name: 'Add people' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add people' });
    await within(dialog).findByText('Everyone on the roster already has this task.');
    expect(within(dialog).getByRole('button', { name: 'Add people' })).toBeDisabled();
  });

  it("shows the assign door's own refusal inside the dialog, and stays open", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: ROSTER,
      [`POST /api/v1/tasks/${TASK_ID}/assign`]: {
        status: 400,
        body: errorEnvelope('invalid', "One or more contacts are not on this event's roster", { contactIds: 'Bo Diaz is no longer on the roster' }),
      },
    });
    const onAdded = vi.fn();
    render(<AddPeopleModal taskId={TASK_ID} eventId={EVENT_ID} taskTitle="Promo video" holderIds={new Set()} onClose={() => {}} onAdded={onAdded} />);
    const dialog = await screen.findByRole('dialog', { name: 'Add people' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Bo Diaz' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add 1 person' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bo Diaz is no longer on the roster');
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('says so when the roster cannot be loaded', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { status: 500, body: errorEnvelope('internal', 'The roster is unavailable') },
    });
    render(<AddPeopleModal taskId={TASK_ID} eventId={EVENT_ID} taskTitle="Promo video" holderIds={new Set()} onClose={() => {}} onAdded={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Add people' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The roster is unavailable');
  });
});
