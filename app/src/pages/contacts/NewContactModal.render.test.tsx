// DEC-788: NewContactModal fires the create-time duplicate check as the
// name/company/email fields settle (debounced) and renders a quiet inline
// hint above the submit row that never blocks Create.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { NewContactModal } from './NewContactModal';
import { mockApi } from '../../test-utils/mockApi';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderModal(onCreated = vi.fn()) {
  return render(
    <MemoryRouter>
      <NewContactModal onClose={() => {}} onCreated={onCreated} />
    </MemoryRouter>,
  );
}

describe('NewContactModal duplicate hint (DEC-788)', () => {
  it('shows a "Possible duplicate" hint once the check finds a match, and Create still succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      'GET /api/v1/contacts/duplicates/check': {
        items: [{ id: 'ct-1', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', company: 'Latticework', reason: 'email' }],
      },
      'POST /api/v1/contacts': { status: 201, body: { id: 'ct-new', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com' } },
    });

    renderModal();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Raman' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'priya@example.com' } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicate:/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Priya Raman, Latticework/ })).toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: 'Create contact' });
    expect(createButton).not.toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicate:/)).toBeInTheDocument();
    });
  });

  it('renders no hint when the check finds nothing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      'GET /api/v1/contacts/duplicates/check': { items: [] },
    });

    renderModal();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nora' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'North' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nora@example.com' } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText(/Possible duplicate:/)).not.toBeInTheDocument();
  });
});
