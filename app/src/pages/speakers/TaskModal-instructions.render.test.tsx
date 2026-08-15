// CNT-01: a task carries INSTRUCTIONS end to end -- a free-text brief,
// distinct from the dropped Description field, editable in both create and
// edit modes (unlike kind/formId/deliverableKind, which the DEC-933
// edit-mode freeze locks down).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskModal } from './TaskModal';
import type { EventForm, OnboardingTask } from './types';
import { MAX_TASK_INSTRUCTIONS_LENGTH } from '../../../../src/domain/task-copy';

const FORMS: EventForm[] = [{ id: 'form-default', title: 'Speaker agreement form', isDefault: true }];

afterEach(() => {
  cleanup();
});

function fillTitle(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), { target: { value } });
}

const TASK: OnboardingTask = {
  id: 'task-1',
  kind: 'general',
  title: 'Sign speaker agreement',
  dueDate: null,
  required: true,
  instructions: 'Sign in blue ink and scan back.',
};

describe('TaskModal: CNT-01 instructions field', () => {
  it('renders an Instructions field, lowercase " · optional" suffix, in create mode', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} />);
    const field = screen.getByLabelText(/Instructions/) as HTMLTextAreaElement;
    expect(field).toBeInTheDocument();
    expect(field.value).toBe('');
    expect(field.placeholder).toMatch(/16:9/);
    expect(field.maxLength).toBe(MAX_TASK_INSTRUCTIONS_LENGTH);
  });

  it('renders an Instructions field prefilled with the task value in edit mode', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} task={TASK} />);
    const field = screen.getByLabelText(/Instructions/) as HTMLTextAreaElement;
    expect(field).toBeInTheDocument();
    expect(field.value).toBe('Sign in blue ink and scan back.');
  });

  it('sends a trimmed instructions value on submit in create mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} />);
    fillTitle('Submit your slides');
    fireEvent.change(screen.getByLabelText(/Instructions/), {
      target: { value: '  16:9, under 20 MB, PDF or Keynote  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ instructions: '16:9, under 20 MB, PDF or Keynote' });
  });

  it('sends a trimmed, edited instructions value on submit in edit mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} task={TASK} />);
    fireEvent.change(screen.getByLabelText(/Instructions/), {
      target: { value: '  Updated brief  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ instructions: 'Updated brief' });
  });
});
