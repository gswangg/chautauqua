// DEC-715 row-anatomy rebuild (eval-findings item 51): FieldList renders
// one-line rows with a single reorder affordance (the drag handle), quiet
// built-in treatment (no LOCKED pills, a single collapsed speaker-identity
// row), and an Abstract caption naming the REAL imported length cap.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldList } from './FieldList';
import { MAX_LONG_TEXT_LENGTH } from '../../../../src/forms/validate';
import { SESSION_FORMAT_FIELD_ID } from '../../../../src/forms/types';
import type { FormField } from './types';

afterEach(() => {
  cleanup();
});

const FIELDS: FormField[] = [
  { id: 'form-1:title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true },
  {
    id: 'form-1:description',
    section: 'session',
    kind: 'long_text',
    label: 'Description',
    required: true,
    position: 1,
    locked: true,
  },
  {
    id: 'form-1:first_name',
    section: 'speaker',
    kind: 'text',
    label: 'First name',
    required: true,
    position: 2,
    locked: true,
  },
  {
    id: 'form-1:last_name',
    section: 'speaker',
    kind: 'text',
    label: 'Last name',
    required: true,
    position: 3,
    locked: true,
  },
  {
    id: 'form-1:email',
    section: 'speaker',
    kind: 'text',
    label: 'Email',
    required: true,
    position: 4,
    locked: true,
  },
  {
    id: 'f-format',
    section: 'session',
    kind: 'dropdown',
    label: 'Format',
    helpText: '5 options',
    required: true,
    position: 5,
    locked: false,
    options: ['Talk', 'Workshop'],
  },
];

function renderList(fields: FormField[] = FIELDS) {
  return render(
    <FieldList fields={fields} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} onMove={vi.fn()} />,
  );
}

describe('FieldList row anatomy (DEC-715)', () => {
  it('renders no up/down move buttons', () => {
    renderList();
    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
    expect(screen.queryByText('↑')).not.toBeInTheDocument();
    expect(screen.queryByText('↓')).not.toBeInTheDocument();
  });

  it('ArrowDown on the drag handle calls onMove(field, 1)', () => {
    const onMove = vi.fn();
    render(<FieldList fields={FIELDS} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} onMove={onMove} />);
    const handle = screen.getByRole('button', { name: 'Reorder Format (position 4 of 4)' });
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onMove).toHaveBeenCalledTimes(1);
    const [field, direction] = onMove.mock.calls[0] as [FormField, number];
    expect(field.id).toBe('f-format');
    expect(direction).toBe(1);
  });

  it('ArrowUp on the drag handle calls onMove(field, -1)', () => {
    const onMove = vi.fn();
    render(<FieldList fields={FIELDS} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} onMove={onMove} />);
    const handle = screen.getByRole('button', { name: 'Reorder Format (position 4 of 4)' });
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(onMove).toHaveBeenCalledTimes(1);
    const [, direction] = onMove.mock.calls[0] as [FormField, number];
    expect(direction).toBe(-1);
  });

  it('renders exactly one built-in speaker row, collapsing first_name/last_name/email', () => {
    renderList();
    expect(screen.getAllByText('Speaker name and email')).toHaveLength(1);
    expect(screen.getByText('Creates or matches a contact')).toBeInTheDocument();
    expect(screen.queryByText('First name')).not.toBeInTheDocument();
    expect(screen.queryByText('Last name')).not.toBeInTheDocument();
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    // Four visible rows: Title, Abstract, Speaker name and email, Format.
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders the Abstract caption with the imported length cap, never a hardcoded number', () => {
    renderList();
    expect(screen.getByText('Abstract')).toBeInTheDocument();
    expect(screen.getByText(`Up to ${MAX_LONG_TEXT_LENGTH.toLocaleString('en-US')} characters`)).toBeInTheDocument();
  });

  it("gives a custom field's row its own helpText as caption", () => {
    renderList();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('5 options')).toBeInTheDocument();
  });

  it('never renders a LOCKED pill for a built-in field', () => {
    renderList();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Locked built-in field')).not.toBeInTheDocument();
  });

  it('renders the design pack\'s "Single choice" kind label for a dropdown field, never "Dropdown"', () => {
    renderList();
    expect(screen.getByText('Single choice')).toBeInTheDocument();
    expect(screen.queryByText('Dropdown')).not.toBeInTheDocument();
  });

  // DEC-877: locked rows still render Edit/Delete/drag controls (the row
  // keeps its shape), but every one of them must carry the native
  // `disabled` attribute -- exposed to assistive tech, not merely painted
  // quiet by CSS -- because their action is impossible for a locked field.
  it('exposes disabled Edit/Delete/drag controls (not just a visual dimming) for a locked field', () => {
    renderList();
    const titleRow = screen.getByText('Title').closest('[role="listitem"]') as HTMLElement;
    const titleEdit = within(titleRow).getByRole('button', { name: 'Edit' });
    const titleDelete = within(titleRow).getByRole('button', { name: 'Delete' });
    const titleDrag = screen.getByRole('button', { name: 'Reorder Title (position 1 of 4)' });
    expect(titleEdit).toBeDisabled();
    expect(titleDelete).toBeDisabled();
    expect(titleDrag).toBeDisabled();

    // The unlocked Format row keeps its controls enabled.
    const formatRow = screen.getByText('Format').closest('[role="listitem"]') as HTMLElement;
    const formatEdit = within(formatRow).getByRole('button', { name: 'Edit' });
    expect(formatEdit).not.toBeDisabled();
  });

  it('renders the seeded session-format field (DEC-762) as "Format", derived from its shared id', () => {
    renderList([
      {
        id: SESSION_FORMAT_FIELD_ID,
        section: 'session',
        kind: 'dropdown',
        label: 'Session format',
        required: true,
        position: 0,
        locked: false,
        options: ['Talk', 'Workshop'],
      },
    ]);
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.queryByText('Session format')).not.toBeInTheDocument();
  });

  it("gives a dropdown/checkbox field with no caption of its own an '<N> options' description built from its own options array", () => {
    renderList([
      {
        id: 'f-choice',
        section: 'session',
        kind: 'dropdown',
        label: 'Track',
        required: false,
        position: 0,
        locked: false,
        options: ['A', 'B', 'C'],
      },
    ]);
    expect(screen.getByText('3 options')).toBeInTheDocument();
  });
});

/** Minimal DataTransfer stand-in: jsdom does not implement the drag-drop
 * DataTransfer API, so tests supply their own get/setData store, mirroring
 * DayGrid.render.test.tsx's approach for the same drag contract. */
function fakeDataTransfer() {
  const store = new Map<string, string>();
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? '',
    effectAllowed: 'none',
  };
}

describe('FieldList drag-drop reorder (DEC-903)', () => {
  const DRAG_FIELDS: FormField[] = [
    { id: 'form-1:title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true },
    { id: 'f-a', section: 'session', kind: 'text', label: 'Alpha', required: false, position: 1, locked: false },
    { id: 'f-b', section: 'session', kind: 'text', label: 'Beta', required: false, position: 2, locked: false },
  ];

  it('dropping a row onto another row calls onMove(draggedField, delta) once', () => {
    const onMove = vi.fn();
    render(<FieldList fields={DRAG_FIELDS} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} onMove={onMove} />);

    const alphaHandle = screen.getByRole('button', { name: 'Reorder Alpha (position 2 of 3)' });
    const betaRow = screen.getByText('Beta').closest('[role="listitem"]') as HTMLElement;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(alphaHandle, { dataTransfer });
    fireEvent.dragOver(betaRow, { dataTransfer });
    fireEvent.drop(betaRow, { dataTransfer });

    expect(onMove).toHaveBeenCalledTimes(1);
    const [field, direction] = onMove.mock.calls[0] as [FormField, number];
    expect(field.id).toBe('f-a');
    expect(direction).toBe(1);
  });

  it('a locked row refuses to be a drag source or a drop target', () => {
    const onMove = vi.fn();
    render(<FieldList fields={DRAG_FIELDS} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} onMove={onMove} />);

    const titleHandle = screen.getByRole('button', { name: 'Reorder Title (position 1 of 3)' });
    expect(titleHandle).not.toHaveAttribute('draggable', 'true');

    // Dragging the unlocked "Beta" row onto the locked "Title" row must not
    // reorder -- the locked row never accepts a drop.
    const betaHandle = screen.getByRole('button', { name: 'Reorder Beta (position 3 of 3)' });
    const titleRow = screen.getByText('Title').closest('[role="listitem"]') as HTMLElement;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(betaHandle, { dataTransfer });
    fireEvent.dragOver(titleRow, { dataTransfer });
    fireEvent.drop(titleRow, { dataTransfer });

    expect(onMove).not.toHaveBeenCalled();
  });
});
