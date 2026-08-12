// DEC-290 (task-w9-b), restyled per DEC-662 (task-w11-a): render smoke for
// RosterPanel -- the SPK-01/02/03 add-speaker + import-CSV UI on
// /admin/speakers. RosterPanel is now a controlled panel (its own trigger
// buttons moved into OnboardingGrid's title action row) -- `mode` says
// which body is open. Mocks the api module directly (RosterPanel +
// ImportWizard both call it) rather than stubbing fetch, so we can assert
// on the exact call args (eventId threading).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RosterPanel } from './RosterPanel';
import { ApiError } from '../../lib/api';

const EVENT_ID = 'evt-roster-render';

const apiPostMock = vi.fn();

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiPost: (...args: unknown[]) => apiPostMock(...args),
  };
});

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  apiPostMock.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function fillAddForm() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
}

describe('RosterPanel', () => {
  it('renders nothing when mode is none and there is no toast', () => {
    render(<RosterPanel mode="none" onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts eventId when adding a speaker, then closes and notifies onChanged', async () => {
    apiPostMock.mockResolvedValueOnce({ id: 'ct-new' });
    const onChanged = vi.fn();
    const onClose = vi.fn();

    render(<RosterPanel mode="add" onClose={onClose} onChanged={onChanged} />);

    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(apiPostMock).toHaveBeenCalledWith(
      '/contacts',
      expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', eventId: EVENT_ID }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the import wizard scoped to the current event when mode is import', () => {
    render(<RosterPanel mode="import" onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Import contacts' })).toBeInTheDocument();
  });

  it('renders an error banner and does not call onChanged/onClose when adding fails', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(409, 'conflict', 'A contact with that email already exists.'));
    const onChanged = vi.fn();
    const onClose = vi.fn();

    render(<RosterPanel mode="add" onClose={onClose} onChanged={onChanged} />);

    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    expect(await screen.findByText('A contact with that email already exists.')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
