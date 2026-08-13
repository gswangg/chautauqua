// DEC-861: the participation filter is a single nullable value, never a
// composable set -- it renders as ONE select ("Any participation"), not
// four independently-pressable chq-pill buttons.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { GridFilters } from './GridFilters';
import { DEFAULT_GRID_FILTERS } from './types';
import type { GridFilterState, OnboardingTask } from './types';

afterEach(cleanup);

const TASKS: OnboardingTask[] = [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }];

function renderFilters(filters: GridFilterState, onChange = vi.fn()) {
  render(<GridFilters tasks={TASKS} filters={filters} onChange={onChange} />);
  return onChange;
}

describe('GridFilters participation control', () => {
  it('renders a single "Any participation" select with the four invite-status labels', () => {
    renderFilters(DEFAULT_GRID_FILTERS);

    const select = screen.getByRole('combobox', { name: 'Any participation' }) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toEqual(['Any participation', 'Not invited', 'Invited', 'Confirmed', 'Declined']);
  });

  it('has no aria-pressed pill left for participation (only Overdue only keeps one)', () => {
    renderFilters(DEFAULT_GRID_FILTERS);

    const pressedButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('aria-pressed'));
    expect(pressedButtons).toHaveLength(1);
    expect(pressedButtons[0]).toHaveTextContent('Overdue only');
  });

  it('choosing Confirmed then Declined leaves exactly one active value, not both', () => {
    let filters: GridFilterState = { ...DEFAULT_GRID_FILTERS };
    const onChange = vi.fn((next: GridFilterState) => {
      filters = next;
    });
    const { rerender } = render(<GridFilters tasks={TASKS} filters={filters} onChange={onChange} />);

    const select = () => screen.getByRole('combobox', { name: 'Any participation' }) as HTMLSelectElement;

    fireEvent.change(select(), { target: { value: 'accepted' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_GRID_FILTERS, inviteStatus: 'accepted' });
    rerender(<GridFilters tasks={TASKS} filters={filters} onChange={onChange} />);
    expect(select().value).toBe('accepted');

    fireEvent.change(select(), { target: { value: 'declined' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_GRID_FILTERS, inviteStatus: 'declined' });
    rerender(<GridFilters tasks={TASKS} filters={filters} onChange={onChange} />);
    expect(select().value).toBe('declined');
    expect(filters.inviteStatus).toBe('declined');
  });

  it('choosing the empty option clears the filter', () => {
    let filters: GridFilterState = { ...DEFAULT_GRID_FILTERS, inviteStatus: 'accepted' };
    const onChange = vi.fn((next: GridFilterState) => {
      filters = next;
    });
    const { rerender } = render(<GridFilters tasks={TASKS} filters={filters} onChange={onChange} />);

    const select = screen.getByRole('combobox', { name: 'Any participation' }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_GRID_FILTERS, inviteStatus: null });
    rerender(<GridFilters tasks={TASKS} filters={filters} onChange={onChange} />);
    expect(filters.inviteStatus).toBeNull();
  });
});
