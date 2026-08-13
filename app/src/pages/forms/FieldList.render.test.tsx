// DEC-715 row-anatomy rebuild (eval-findings item 51): FieldList renders
// one-line rows with a single reorder affordance (the drag handle), quiet
// built-in treatment (no LOCKED pills, a single collapsed speaker-identity
// row), and an Abstract caption naming the REAL imported length cap.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldList } from './FieldList';
import { MAX_LONG_TEXT_LENGTH } from '../../../../src/forms/validate';
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
    expect(screen.getByText(`Up to ${MAX_LONG_TEXT_LENGTH} characters`)).toBeInTheDocument();
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
});
