// DEC-505: proves the task view (design pack v12) renders the SERVER's own
// refusal sentence, never a client-invented one. Three write paths, three
// server messages: POST /tasks/:id/unassign ("not needed"), PATCH
// /task-assignments/:id (the bulk status verbs) and the page's own read.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TaskView } from './TaskView';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { TaskViewResponse } from './taskRoster';

const TASK_ID = 'task-refusals';
const EVENT_ID = 'evt-refusals';

function payload(): TaskViewResponse {
  return {
    task: {
      id: TASK_ID,
      eventId: EVENT_ID,
      kind: 'general',
      title: 'Speaker release',
      dueDate: null,
      required: true,
      formId: null,
      instructions: null,
    },
    timezone: 'UTC',
    rows: [
      {
        contactId: 'ct-ruth',
        name: 'Ruth Adeyemi',
        company: 'Meridian Tools',
        assignmentId: 'as-ruth',
        status: 'pending',
        completedAt: null,
        assignedAt: Date.now() - 86_400_000,
        lastRemindedAt: null,
        remindCount: 0,
        fileId: null,
        fileName: null,
        answerSummary: null,
        overdue: false,
      },
      {
        contactId: 'ct-iris',
        name: 'Iris Bell',
        company: 'Latticework',
        assignmentId: 'as-iris',
        status: 'complete',
        completedAt: Date.now() - 86_400_000,
        assignedAt: Date.now() - 5 * 86_400_000,
        remindCount: 0,
        lastRemindedAt: null,
        fileId: null,
        fileName: null,
        answerSummary: null,
        overdue: false,
      },
    ],
    counts: { assigned: 2, complete: 1, pending: 1, answered: 1 },
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/speakers/tasks/${TASK_ID}`]}>
      <Routes>
        <Route path="/speakers/tasks/:taskId" element={<TaskView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DEC-505: the task view renders the server refusal verbatim', () => {
  it('a failed read prints the server sentence, not "Failed to load this task"', async () => {
    mockApi({
      [`GET /api/v1/tasks/${TASK_ID}/roster`]: {
        status: 404,
        body: errorEnvelope('not_found', 'Task not found'),
      },
    });
    renderPage();

    expect(await screen.findByText('Task not found')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load this task')).not.toBeInTheDocument();
  });

  it('a refused "Not needed" prints the server sentence behind the page\'s own prefix', async () => {
    mockApi({
      [`GET /api/v1/tasks/${TASK_ID}/roster`]: payload(),
      [`POST /api/v1/tasks/${TASK_ID}/unassign`]: {
        status: 400,
        body: errorEnvelope('invalid', 'One or more contacts do not have this task'),
      },
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Speaker release' });

    fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ruth Adeyemi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not needed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove this task' }));

    await waitFor(() =>
      expect(screen.getByText('Removal failed: One or more contacts do not have this task')).toBeInTheDocument(),
    );
  });

  it('a refused bulk status write prints the server sentence behind the page\'s own prefix', async () => {
    mockApi({
      [`GET /api/v1/tasks/${TASK_ID}/roster`]: payload(),
      'PATCH /api/v1/task-assignments/as-iris': {
        status: 400,
        body: errorEnvelope('invalid', "status must be 'pending' or 'complete'"),
      },
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Speaker release' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Iris Bell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    await waitFor(() =>
      expect(screen.getByText("Update failed: status must be 'pending' or 'complete'")).toBeInTheDocument(),
    );
  });
});
