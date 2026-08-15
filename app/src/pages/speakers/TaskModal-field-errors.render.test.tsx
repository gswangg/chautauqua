// DEC-958: TaskModal's submit catch must keep err.fields (src/routes/tasks.ts's
// wire keys: kind / title / description / dueDate / required / formId) as a
// fieldErrors state and mark each named control, falling back to the
// top-of-form sentence only when the map is absent or empty. The ApiError
// arrives via the onSubmit prop's rejection (OnboardingGrid's
// handleCreateTask/handleEditTask rethrow) -- this test never touches
// OnboardingGrid, it only supplies a rejecting onSubmit prop directly.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskModal } from './TaskModal';
import { type EventForm } from './types';
import { ApiError } from '../../lib/api';

const FORMS: EventForm[] = [{ id: 'form-default', title: 'Speaker agreement form', isDefault: true }];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillTitle(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), { target: { value } });
}

describe('TaskModal: DEC-958 server fields map renders on the named controls', () => {
  it('marks Task and Due date with the server messages instead of a single generic sentence', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(400, 'invalid', 'Invalid task', {
        title: 'Max 200 characters',
        dueDate: 'Must be a ms-epoch integer',
      }));
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={5} />);

    fillTitle('A task title');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('Max 200 characters')).toBeInTheDocument();
    expect(screen.getByText('Must be a ms-epoch integer')).toBeInTheDocument();
    // No generic top-of-form sentence when the fields map is present.
    expect(screen.queryByText('Failed to create task')).not.toBeInTheDocument();
  });

  it('falls back to the generic sentence when the ApiError carries no fields map', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(500, 'internal', 'Failed to create task'));
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={5} />);

    fillTitle('A task title');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Failed to create task')).toBeInTheDocument();
  });
});
