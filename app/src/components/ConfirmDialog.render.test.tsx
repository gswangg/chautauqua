// w7-a (DEC-631): render coverage for the ONE confirm-dialog contract that
// replaces window.confirm/prompt/alert everywhere — accessible name, Escape
// and scrim-click cancel, single confirm firing, pending disabling both
// buttons.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(() => {
  cleanup();
});

describe('ConfirmDialog', () => {
  it('renders with an accessible name matching the title', () => {
    render(
      <ConfirmDialog
        title="Delete this thing"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete this thing' });
    expect(dialog).toHaveClass('chq-scrim');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.querySelector('.chq-modal')).toHaveClass('chq-confirm-modal');
  });

  it('Escape calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Confirm" confirmLabel="OK" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('a scrim click calls onCancel, but a click inside the modal does not', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Confirm" confirmLabel="OK" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Confirm').closest('.chq-modal')!);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirm fires exactly once per click', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Confirm" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('pending disables both the confirm and cancel buttons, and blocks Escape', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Confirm"
        confirmLabel="Delete"
        pending
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  // DEC-941 (wave-58 amendment): the irreversible weight types the name.
  describe('irreversible weight', () => {
    it('keeps the primary disabled until the exact phrase is typed', () => {
      render(
        <ConfirmDialog
          title="Delete this resource?"
          confirmLabel="Delete resource"
          weight="irreversible"
          confirmPhrase="Speaker slides"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const primary = screen.getByRole('button', { name: 'Delete resource' });
      expect(primary).toBeDisabled();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'wrong name' } });
      expect(primary).toBeDisabled();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Speaker slides' } });
      expect(primary).not.toBeDisabled();
    });

    it('matches case-insensitively and trims whitespace', () => {
      render(
        <ConfirmDialog
          title="Delete this resource?"
          confirmLabel="Delete resource"
          weight="irreversible"
          confirmPhrase="Speaker Slides"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '  speaker slides  ' } });
      expect(screen.getByRole('button', { name: 'Delete resource' })).not.toBeDisabled();
    });

    it('leaves Cancel reachable while the primary is locked', () => {
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          title="Delete this resource?"
          confirmLabel="Delete resource"
          weight="irreversible"
          confirmPhrase="Speaker slides"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelBtn).not.toBeDisabled();
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('throws when the irreversible weight has no confirmPhrase', () => {
      // Suppress the expected React error boundary console noise.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        render(
          <ConfirmDialog
            title="Delete this resource?"
            confirmLabel="Delete resource"
            weight="irreversible"
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />,
        ),
      ).toThrow(/confirmPhrase/);
      consoleError.mockRestore();
    });

    it('throws when confirmPhrase is empty/whitespace-only', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        render(
          <ConfirmDialog
            title="Delete this resource?"
            confirmLabel="Delete resource"
            weight="irreversible"
            confirmPhrase="   "
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />,
        ),
      ).toThrow(/confirmPhrase/);
      consoleError.mockRestore();
    });
  });
});
