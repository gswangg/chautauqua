// DEC-933: TaskCell is the ONE cell renderer both OnboardingGrid halves
// (the pinned table and the phone-width card list) share -- these render
// tests exercise it directly, standing in for the duplicated inline blocks
// this file replaced (OnboardingGrid.render.test.tsx already covers the
// same behaviour end-to-end through both halves).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskCell } from './TaskCell';
import type { OnboardingCell, OnboardingTask } from './types';

afterEach(() => cleanup());

const TASK: OnboardingTask = { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true };

function makeCell(overrides: Partial<OnboardingCell> = {}): OnboardingCell {
  return {
    taskId: 'task-1',
    assignmentId: 'as1',
    status: 'pending',
    completedAt: null,
    fileId: null,
    fileName: null,
    fileSizeBytes: null,
    lastRemindedAt: null,
    assignedAt: 0,
    ...overrides,
  };
}

describe('TaskCell', () => {
  it('renders the em-dash "no assignment" state when cell is undefined', () => {
    render(
      <TaskCell task={TASK} cell={undefined} contactName="Ada Lovelace" now={Date.now()} onToggle={vi.fn()} onOpenResponse={vi.fn()} />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onToggle with the assignment id and current status when clicked', () => {
    const onToggle = vi.fn();
    render(
      <TaskCell task={TASK} cell={makeCell()} contactName="Ada Lovelace" now={Date.now()} onToggle={onToggle} onOpenResponse={vi.fn()} />,
    );
    screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' }).click();
    expect(onToggle).toHaveBeenCalledWith('as1', 'pending');
  });

  it('shows a Response link only for a complete form-kind cell, calling onOpenResponse with assignmentId/contactName', () => {
    const onOpenResponse = vi.fn();
    const formTask: OnboardingTask = { ...TASK, kind: 'form' };
    render(
      <TaskCell
        task={formTask}
        cell={makeCell({ status: 'complete', completedAt: 1 })}
        contactName="Ada Lovelace"
        now={Date.now()}
        onToggle={vi.fn()}
        onOpenResponse={onOpenResponse}
      />,
    );
    screen.getByRole('button', { name: 'Response' }).click();
    expect(onOpenResponse).toHaveBeenCalledWith('as1', 'Ada Lovelace');
  });

  it('renders a file link when the cell carries a fileId/fileName', () => {
    render(
      <TaskCell
        task={TASK}
        cell={makeCell({ status: 'complete', fileId: 'file-1', fileName: 'slides.pdf' })}
        contactName="Ada Lovelace"
        now={Date.now()}
        onToggle={vi.fn()}
        onOpenResponse={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'Download slides.pdf' });
    expect(link).toHaveAttribute('href', '/files/file-1');
  });
});
