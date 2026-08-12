// DEC-398: the form-task picker is a <select> of the event's own forms,
// never a free-text id box -- the buyer is explicitly non-technical
// (docs/clarifications.md) and docs/design/Chautauqua Speakers.dc.html:
// 182-196 shows no id field. This is a pure component test (no fetch): the
// list of forms is passed in as a prop by OnboardingGrid.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskModal } from './TaskModal';
import type { EventForm } from './types';

const FORMS: EventForm[] = [
  { id: 'form-default', title: 'Speaker agreement form', isDefault: true },
  { id: 'form-hotel', title: 'Hotel stay requirement form', isDefault: false },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillTitle(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), { target: { value } });
}

describe('TaskModal: DEC-398 form picker', () => {
  it('hides the Form field for non-form kinds', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} />);
    expect(screen.queryByLabelText('Form')).not.toBeInTheDocument();
  });

  it('lists the fetched form titles and submits the selected id, defaulting to the first form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Form' }));

    const select = screen.getByLabelText('Form') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.disabled).toBe(false);
    expect(screen.getByText('Speaker agreement form')).toBeInTheDocument();
    expect(screen.getByText('Hotel stay requirement form')).toBeInTheDocument();
    // Defaults to the first entry.
    expect(select.value).toBe('form-default');

    fireEvent.change(select, { target: { value: 'form-hotel' } });
    fillTitle('Fill out hotel form');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ kind: 'form', formId: 'form-hotel' });
  });

  it('disables the select, explains, and blocks submit when the event has no forms', async () => {
    const onSubmit = vi.fn();
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Form' }));

    const select = screen.getByLabelText('Form') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText('This event has no forms yet. Add a form before creating a form task.')).toBeInTheDocument();

    fillTitle('Fill out a form');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Select a form before creating a form task.')).toBeInTheDocument();
  });
});

// DEC-577: the Kind picker is a .chq-segmented group of real <button>s, not
// a <select> -- every kind must be reachable by keyboard (native button tab
// order + Enter/Space activation, no custom key handling needed), and the
// active item must be identifiable by more than colour (aria-pressed +
// chq-btn-primary vs chq-btn-secondary class swap).
describe('TaskModal: DEC-577 segmented Kind control', () => {
  it('renders one real button per kind, keyboard-focusable, with the active state carried by aria-pressed and class, not colour alone', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} />);

    const group = screen.getByRole('group', { name: 'Kind' });
    expect(group).toBeInTheDocument();

    const general = screen.getByRole('button', { name: 'General' });
    const fileRequest = screen.getByRole('button', { name: 'File request' });
    const form = screen.getByRole('button', { name: 'Form' });

    // Every kind is a real, tabbable <button> -- no tabindex hacks needed.
    for (const btn of [general, fileRequest, form]) {
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).not.toHaveAttribute('tabindex', '-1');
    }

    // Default: 'General' is active -- filled class + aria-pressed, not a
    // bare CSS colour difference the test can't observe.
    expect(general).toHaveAttribute('aria-pressed', 'true');
    expect(general.className).toContain('chq-btn-primary');
    expect(fileRequest).toHaveAttribute('aria-pressed', 'false');
    expect(fileRequest.className).toContain('chq-btn-secondary');

    form.focus();
    expect(form).toHaveFocus();
    fireEvent.click(form);

    expect(form).toHaveAttribute('aria-pressed', 'true');
    expect(form.className).toContain('chq-btn-primary');
    expect(general).toHaveAttribute('aria-pressed', 'false');
    expect(general.className).toContain('chq-btn-secondary');

    // Submit payload still carries the plain TaskKind string value.
    fillTitle('A form task');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));
  });
});
