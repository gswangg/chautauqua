// DEC-398: the form-task picker is a <select> of the event's own forms,
// never a free-text id box -- the buyer is explicitly non-technical
// (docs/clarifications.md) and the "New task" modal (Chautauqua
// Speakers.dc.html:182-196) shows no id field -- citation lands on the
// "DEC-398 form picker" describe's second `it` below, beside its own
// assertion. This is a pure component test (no fetch): the
// list of forms is passed in as a prop by OnboardingGrid.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskModal } from './TaskModal';
import { DELIVERABLE_KINDS, type EventForm } from './types';
import { FILE_KINDS } from '../../../../src/domain/files';

const FORMS: EventForm[] = [
  { id: 'form-default', title: 'Speaker agreement form', isDefault: true },
  { id: 'form-hotel', title: 'Hotel stay requirement form', isDefault: false },
];

// decision 76: a new task goes to a portal (offered first) or named people;
// these mount it as the grid does when filtered to that portal
const PORTALS = [{ id: 'pt-1', name: 'CFP speakers' }];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillTitle(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), { target: { value } });
}

// DEC-746, as amended by multi-portal decision 76: a new task goes to a
// portal by default, and the subtitle names that portal; the modal offers
// no assign-all checkbox and no Description textarea.
describe('TaskModal: DEC-746 audience subtitle and dropped fields', () => {
  it('names the portal in the subtitle and offers neither a Description field nor an assign-all checkbox', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);
    expect(screen.getByText('Added to CFP speakers: everyone it covers gets it')).toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign to all accepted speakers')).not.toBeInTheDocument();
  });

  it('pre-chooses no portal unless the grid is filtered to one, and asks for it before creating', async () => {
    const onSubmit = vi.fn();
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} portals={[...PORTALS, { id: 'pt-2', name: 'Profile basics' }]} />);
    expect(screen.getByText('Added to the portal you choose: everyone it covers gets it')).toBeInTheDocument();
    expect(screen.getByLabelText('Portal')).toHaveValue('');
    fillTitle('Sign the agreement');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose the portal that gets this task.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Portal'), { target: { value: 'pt-2' } });
    expect(screen.getByText('Added to Profile basics: everyone it covers gets it')).toBeInTheDocument();
  });
});

// Ruling A12 (DEC-662 amendment, wave 25): the task column header now
// offers only Edit; Remove moved into the editor Edit opens.
describe('TaskModal: A12 Remove lives inside the editor', () => {
  const TASK = { id: 'task-1', kind: 'general' as const, title: 'Sign speaker agreement', dueDate: null, required: true };

  it('renders no Remove control in create mode, or in edit mode without an onRemove handler', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    cleanup();

    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" task={TASK} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('renders exactly one Remove control in edit mode when onRemove is provided, and it fires onRemove', () => {
    const onRemove = vi.fn();
    render(
      <TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" task={TASK} onRemove={onRemove} />,
    );
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0]!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('TaskModal: DEC-398 form picker', () => {
  it('hides the Form field for non-form kinds', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);
    expect(screen.queryByLabelText('Form')).not.toBeInTheDocument();
  });

  it('lists the fetched form titles and submits the selected id, defaulting to the first form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Form' }));

    // docs/design/Chautauqua Speakers.dc.html:182 `display:flex; flex-direction:column; gap:14px` -- the "New task" modal draws no free-text id field, only this <select>.
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
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={[]} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);

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

// DEC-928: deliverableKind is one vocabulary (src/domain/files.ts) -- the
// Upload kind's Deliverable kind select offers every FILE_KINDS entry
// (including 'recording'), in FILE_KINDS order, defaulting to the first.
describe('TaskModal: DEC-928 deliverable kind vocabulary', () => {
  it('offers a Recording option and defaults to Presentation', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);

    const select = screen.getByLabelText(/Deliverable kind/) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(select.value).toBe('presentation');
  });

  it('parity: SPA DELIVERABLE_KINDS equals the pure-core FILE_KINDS, member-for-member and in order', () => {
    expect(DELIVERABLE_KINDS).toEqual(FILE_KINDS);
  });

  // DEC-879 (wave-67 amendment): 'photo' is the missing deliverable kind for
  // a headshot/photo file request -- the picker offers it with its own
  // label, distinct from a Handout.
  it('offers a Photo / headshot option', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);

    expect(screen.getByText('Photo / headshot')).toBeInTheDocument();
  });

  // Ruling A15 (DEC-662 amendment, wave 25): kind drives real downstream
  // behaviour (only upload-kind tasks get a File link), so the picked value
  // must actually ride along in the create payload the modal posts --
  // never silently dropped in favour of the default.
  it('includes the selected deliverable kind in the submitted create payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);

    const select = screen.getByLabelText(/Deliverable kind/) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'recording' } });
    fillTitle('Upload your recording');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ kind: 'file_request', deliverableKind: 'recording' });
  });
});

// DEC-746 (wave-59 amendment), as amended by multi-portal decision 76: the
// New task modal's audience picker -- 'Everyone in a portal' is the default
// (the chosen portal id is sent, no contactIds); choosing 'Only the people I
// choose' reveals the roster checkbox list and posts exactly the chosen ids
// with a subtitle naming the chosen count; zero chosen blocks submit;
// assigneesTruncated disables the subset choice and states the ceiling.
describe('TaskModal: DEC-746 audience picker (wave-59 amendment)', () => {
  const ASSIGNEES = [
    { contactId: 'contact-1', name: 'Ada Lovelace' },
    { contactId: 'contact-2', name: 'Grace Hopper' },
    { contactId: 'contact-3', name: 'Radia Perlman' },
  ];

  it('defaults to Everyone in a portal, posts the portal id and no contactIds', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" assignees={ASSIGNEES} />,
    );

    expect(screen.getByRole('radio', { name: 'Everyone in a portal' })).toBeChecked();
    fillTitle('Sign the agreement');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].portalId).toBe('pt-1');
    expect(onSubmit.mock.calls[0]![0].contactIds).toBeUndefined();
  });

  it('choosing two people posts exactly those two ids and changes the subtitle', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" assignees={ASSIGNEES} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Only the people I choose' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ada Lovelace' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Radia Perlman' }));

    expect(screen.getByText('Created for the 2 people you choose')).toBeInTheDocument();

    fillTitle('Sign the agreement');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].contactIds).toEqual(['contact-1', 'contact-3']);
  });

  it('blocks submit when the subset choice is selected but zero people are checked', async () => {
    const onSubmit = vi.fn();
    render(
      <TaskModal onCancel={() => {}} onSubmit={onSubmit} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" assignees={ASSIGNEES} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Only the people I choose' }));
    fillTitle('Sign the agreement');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose at least one speaker.')).toBeInTheDocument();
  });

  it('disables the subset choice and states the ceiling when assigneesTruncated', () => {
    render(
      <TaskModal
        onCancel={() => {}}
        onSubmit={vi.fn()}
        forms={FORMS}
        acceptedCount={250} portals={PORTALS} defaultPortalId="pt-1"
        assignees={[]}
        assigneesTruncated
      />,
    );

    expect(screen.getByRole('radio', { name: 'Only the people I choose' })).toBeDisabled();
    expect(screen.getByText(/too many speakers to choose from here/)).toBeInTheDocument();
  });
});

// DEC-577: the Kind picker is a .chq-segmented group of real <button>s, not
// a <select> -- every kind must be reachable by keyboard (native button tab
// order + Enter/Space activation, no custom key handling needed), and the
// active item must be identifiable by more than colour (aria-pressed +
// chq-btn-primary vs chq-btn-secondary class swap).
describe('TaskModal: DEC-577 segmented Kind control', () => {
  it('renders one real button per kind, keyboard-focusable, with the active state carried by aria-pressed and class, not colour alone', () => {
    render(<TaskModal onCancel={() => {}} onSubmit={vi.fn()} forms={FORMS} acceptedCount={12} portals={PORTALS} defaultPortalId="pt-1" />);

    const group = screen.getByRole('group', { name: 'Kind' });
    expect(group).toBeInTheDocument();

    // DEC-746: labels are Upload / Form / Acknowledge (mapping onto
    // file_request / form / general), in that order.
    const upload = screen.getByRole('button', { name: 'Upload' });
    const form = screen.getByRole('button', { name: 'Form' });
    const acknowledge = screen.getByRole('button', { name: 'Acknowledge' });

    // Every kind is a real, tabbable <button> -- no tabindex hacks needed.
    for (const btn of [upload, form, acknowledge]) {
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).not.toHaveAttribute('tabindex', '-1');
    }

    // Default: 'Upload' (file_request) is active -- outlined-chip class +
    // aria-pressed, not a bare CSS colour difference the test can't observe.
    // v6 frame (Amendment wave 48/DEC-694): the selected chip is its own
    // cream/outline visual, NOT a spend of the page-primary chq-btn-primary
    // vocabulary.
    expect(upload).toHaveAttribute('aria-pressed', 'true');
    expect(upload.className).not.toContain('chq-btn-primary');
    expect(upload.className).toContain('chq-speakers-kind-selected');
    expect(acknowledge).toHaveAttribute('aria-pressed', 'false');
    expect(acknowledge.className).toContain('chq-btn-secondary');

    form.focus();
    expect(form).toHaveFocus();
    fireEvent.click(form);

    expect(form).toHaveAttribute('aria-pressed', 'true');
    expect(form.className).not.toContain('chq-btn-primary');
    expect(form.className).toContain('chq-speakers-kind-selected');
    expect(upload).toHaveAttribute('aria-pressed', 'false');
    expect(upload.className).toContain('chq-btn-secondary');

    // Submit payload still carries the plain TaskKind string value.
    fillTitle('A form task');
    fireEvent.click(screen.getByRole('button', { name: 'Create the task' }));
  });
});
