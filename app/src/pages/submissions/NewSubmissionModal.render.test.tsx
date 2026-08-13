// DEC-863: the New submission dialog stops silently discarding a typed
// speaker name (a name with no email created a submission with no
// participant and no warning), and stops advertising the eval harness's
// organizer login as a speaker's email placeholder.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NewSubmissionModal } from './NewSubmissionModal';

afterEach(() => {
  cleanup();
});

function fillTitle() {
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Opening Keynote' } });
}

describe('NewSubmissionModal (DEC-863)', () => {
  it('shows a field-level error on the Speaker email row when a name is typed with no email, and does not create', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSubmissionModal tracks={[]} onCancel={vi.fn()} onCreate={onCreate} />);

    fillTitle();
    fireEvent.change(screen.getByLabelText(/Speaker name/), { target: { value: 'Jordan Alvarez' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Add an email — a speaker record needs one');

    // The error sits on the Speaker email row specifically, not just a bare banner.
    const emailInput = screen.getByLabelText(/Speaker email/);
    const row = emailInput.closest('.chq-form-row');
    expect(row).not.toBeNull();
    expect(row).toContainElement(alert);

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('creates the submission with a split contact when both name and email are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSubmissionModal tracks={[]} onCancel={vi.fn()} onCreate={onCreate} />);

    fillTitle();
    fireEvent.change(screen.getByLabelText(/Speaker name/), { target: { value: 'Jordan Alvarez' } });
    fireEvent.change(screen.getByLabelText(/Speaker email/), { target: { value: 'jordan@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }));

    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: { email: 'jordan@example.com', firstName: 'Jordan', lastName: 'Alvarez' },
      }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still allows an email-only contact (no speaker name)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSubmissionModal tracks={[]} onCancel={vi.fn()} onCreate={onCreate} />);

    fillTitle();
    fireEvent.change(screen.getByLabelText(/Speaker email/), { target: { value: 'jordan@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }));

    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: { email: 'jordan@example.com', firstName: '', lastName: '' },
      }),
    );
  });

  it('still allows both name and email blank (the documented unattributed invited-talk case)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSubmissionModal tracks={[]} onCancel={vi.fn()} onCreate={onCreate} />);

    fillTitle();
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }));

    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ contact: null }));
  });

  it('has no rendered placeholder or value containing the eval harness login substring "sbek"', () => {
    render(<NewSubmissionModal tracks={[]} onCancel={vi.fn()} onCreate={vi.fn()} />);

    const emailInput = screen.getByLabelText(/Speaker email/) as HTMLInputElement;
    expect(emailInput.placeholder.toLowerCase()).not.toContain('sbek');
    expect(emailInput.value.toLowerCase()).not.toContain('sbek');

    document.querySelectorAll('input, textarea, select, option').forEach((el) => {
      const placeholder = (el as HTMLInputElement).placeholder ?? '';
      const value = (el as HTMLInputElement).value ?? '';
      expect(placeholder.toLowerCase()).not.toContain('sbek');
      expect(value.toLowerCase()).not.toContain('sbek');
    });
  });
});
