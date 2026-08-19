// DEC-919 (v12 mobile campaign w2 ruling, task w2-a). Closes audit finding 2
// (docs/design/audit/submissions-v12.md): at 390 .chq-submissions-filterbar
// renders only two of the six SUBMISSION_STATUSES pills plus the search box
// -- the Status caption, the other four pills, the divider, the track
// <select>, and the ColumnPicker <details> are hidden via submissions.css's
// phone block (submissions-css.test.ts asserts the CSS side; this file
// asserts the DOM carries the hooks that CSS needs).
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterBar, FilterBarSearchSort } from './FilterBar';
import { DEFAULT_FILTER_STATE, SUBMISSION_STATUSES } from './types';

function statusLabel(status: (typeof SUBMISSION_STATUSES)[number]): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    accept_queue: 'Accept queue',
    decline_queue: 'Decline queue',
    accepted: 'Accepted',
    declined: 'Declined',
    waitlisted: 'Waitlisted',
  };
  return labels[status]!;
}

describe('FilterBar phone-hiding hooks (DEC-919)', () => {
  it('every status pill carries a data-status attribute the phone CSS keys off of', () => {
    render(
      <FilterBar
        filters={DEFAULT_FILTER_STATE}
        tracks={[]}
        columns={[]}
        visibleFieldIds={new Set()}
        onChange={vi.fn()}
        onToggleColumn={vi.fn()}
      />,
    );
    const group = screen.getByRole('group', { name: 'Filter by status' });
    for (const status of SUBMISSION_STATUSES) {
      const pill = within(group).getByRole('button', { name: statusLabel(status) });
      expect(pill).toHaveAttribute('data-status', status);
    }
  });

  it('the track select and the Sort select carry distinct classes (both otherwise share .chq-submissions-filterbar-select)', () => {
    render(
      <FilterBar
        filters={DEFAULT_FILTER_STATE}
        tracks={[]}
        columns={[]}
        visibleFieldIds={new Set()}
        onChange={vi.fn()}
        onToggleColumn={vi.fn()}
      />,
    );
    render(<FilterBarSearchSort filters={DEFAULT_FILTER_STATE} onChange={vi.fn()} />);

    const trackSelect = screen.getByRole('combobox', { name: 'Filter by track' });
    const sortSelect = screen.getByRole('combobox', { name: 'Sort' });
    expect(trackSelect).not.toHaveClass('chq-submissions-filterbar-sort-select');
    expect(sortSelect).toHaveClass('chq-submissions-filterbar-sort-select');
  });
});
