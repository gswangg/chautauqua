// DEC-933: TaskCell is the ONE cell renderer both OnboardingGrid halves
// (the pinned table and the phone-width card list) share -- these render
// tests exercise it directly, standing in for the duplicated inline blocks
// this file replaced (OnboardingGrid.render.test.tsx already covers the
// same behaviour end-to-end through both halves).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskCell, isRowNotChased } from './TaskCell';
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
    assignedAt: 0,
    ...overrides,
  };
}

describe('TaskCell', () => {
  it('renders the em-dash "no assignment" state when cell is undefined', () => {
    render(
      <TaskCell task={TASK} cell={undefined} contactName="Ada Lovelace" now={Date.now()} timezone="UTC" onToggle={vi.fn()} onOpenResponse={vi.fn()} />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onToggle with the assignment id and current status when clicked', () => {
    const onToggle = vi.fn();
    render(
      <TaskCell task={TASK} cell={makeCell()} contactName="Ada Lovelace" now={Date.now()} timezone="UTC" onToggle={onToggle} onOpenResponse={vi.fn()} />,
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
        timezone="UTC"
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
        timezone="UTC"
        onToggle={vi.fn()}
        onOpenResponse={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'Download slides.pdf' });
    expect(link).toHaveAttribute('href', '/files/file-1');
  });

  // DEC-829 amendment: notChased mutes an INCOMPLETE cell (visual only --
  // the toggle keeps working) but never a complete one, since that history
  // is real regardless of whether the row is still chased.
  it('mutes an incomplete cell when notChased is true, but not a complete one', () => {
    render(
      <TaskCell
        task={TASK}
        cell={makeCell({ status: 'pending' })}
        contactName="Ada Lovelace"
        now={Date.now()}
        timezone="UTC"
        onToggle={vi.fn()}
        onOpenResponse={vi.fn()}
        notChased={true}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    expect(btn.closest('.chq-speakers-cell')).toHaveClass('chq-speakers-cell-muted');

    cleanup();

    render(
      <TaskCell
        task={TASK}
        cell={makeCell({ status: 'complete', completedAt: 1 })}
        contactName="Ada Lovelace"
        now={Date.now()}
        timezone="UTC"
        onToggle={vi.fn()}
        onOpenResponse={vi.fn()}
        notChased={true}
      />,
    );
    const completeBtn = screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    expect(completeBtn.closest('.chq-speakers-cell')).not.toHaveClass('chq-speakers-cell-muted');
  });

  it('does not mute when notChased is false/omitted', () => {
    render(
      <TaskCell task={TASK} cell={makeCell({ status: 'pending' })} contactName="Ada Lovelace" now={Date.now()} timezone="UTC" onToggle={vi.fn()} onOpenResponse={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    expect(btn.closest('.chq-speakers-cell')).not.toHaveClass('chq-speakers-cell-muted');
  });

  // DEC-265 amendment (error-states rule 8): a reverted write must keep
  // announcing itself on the cell -- weight/rule (the overdue class family),
  // never a new colour -- until the caller's banner clears.
  it('appends " · not saved" and borrows the overdue class family when notSaved is true', () => {
    render(
      <TaskCell
        task={TASK}
        cell={makeCell({ status: 'pending' })}
        contactName="Ada Lovelace"
        now={Date.now()}
        timezone="UTC"
        onToggle={vi.fn()}
        onOpenResponse={vi.fn()}
        notSaved={true}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    expect(btn).toHaveTextContent('Pending · not saved');
    expect(btn.className).toContain('chq-speakers-status-overdue');
  });

  it('does not append the marker when notSaved is false/omitted', () => {
    render(
      <TaskCell task={TASK} cell={makeCell({ status: 'pending' })} contactName="Ada Lovelace" now={Date.now()} timezone="UTC" onToggle={vi.fn()} onOpenResponse={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    expect(btn).toHaveTextContent('Pending');
    expect(btn).not.toHaveTextContent('not saved');
  });
});

// DEC-829 amendment: the ONE row-level predicate -- every participation
// must be declined, and a non-empty array is required.
describe('isRowNotChased (DEC-829 amendment)', () => {
  it('is true only when every participation is declined', () => {
    expect(isRowNotChased({ participations: [{ inviteStatus: 'declined' }] })).toBe(true);
    expect(
      isRowNotChased({
        participations: [
          { inviteStatus: 'declined' },
          { inviteStatus: 'declined' },
        ],
      }),
    ).toBe(true);
  });

  it('is false when any participation is not declined', () => {
    expect(
      isRowNotChased({
        participations: [{ inviteStatus: 'declined' }, { inviteStatus: 'accepted' }],
      }),
    ).toBe(false);
    expect(isRowNotChased({ participations: [{ inviteStatus: 'invited' }] })).toBe(false);
    expect(isRowNotChased({ participations: [{ inviteStatus: 'none' }] })).toBe(false);
    expect(isRowNotChased({ participations: [{ inviteStatus: 'accepted' }] })).toBe(false);
  });
});
