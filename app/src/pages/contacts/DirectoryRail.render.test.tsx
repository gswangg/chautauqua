// DirectoryRail render coverage (task-w17-c, DEC-710/DEC-711): three
// stacked sections ("Where they work" / "Saved segments" / "Possible
// duplicates"), each rendering the counts/captions it was handed (never
// recomputing them), and the duplicate row's Merge link routing to the
// existing merge page at its own URL.
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DirectoryRail } from './DirectoryRail';
import type { DuplicateGroup, Segment } from './types';

afterEach(() => {
  cleanup();
});

const TOP_COMPANIES = [
  { company: 'Acme', count: 4 },
  { company: 'Navy', count: 2 },
];

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'VIP speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }], count: 4 },
];

const DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    contactIds: ['ct3', 'ct4'],
    reason: 'name_and_company',
    contacts: [
      { id: 'ct3', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@acme.example', company: 'Acme', createdAt: 1000 },
      { id: 'ct4', firstName: 'Sam', lastName: 'Rivera', email: 'sam.r@acmecorp.example', company: 'Acme', createdAt: 1000 },
    ],
  },
];

function renderRail(overrides: Partial<ComponentProps<typeof DirectoryRail>> = {}) {
  return render(
    <MemoryRouter>
      <DirectoryRail
        topCompanies={TOP_COMPANIES}
        topCompaniesLoaded
        onCompanyClick={vi.fn()}
        segments={SEGMENTS}
        segmentsLoaded
        onApplySegment={vi.fn()}
        onSaveCurrentFilters={vi.fn()}
        duplicateCount={DUPLICATE_GROUPS.length}
        duplicatePreview={DUPLICATE_GROUPS}
        duplicatesLoaded
        onKeepBoth={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('DirectoryRail', () => {
  it('renders the three stacked sections with the mock\'s labels', () => {
    renderRail();

    expect(screen.getByText('Where they work')).toBeInTheDocument();
    expect(screen.getByText('Saved segments')).toBeInTheDocument();
    expect(screen.getByText('Possible duplicates · 1')).toBeInTheDocument();
  });

  it('renders top companies with their counts and fires onCompanyClick', () => {
    const onCompanyClick = vi.fn();
    renderRail({ onCompanyClick });

    const acmeButton = screen.getByRole('button', { name: 'Acme' });
    expect(acmeButton).toBeInTheDocument();
    expect(acmeButton.closest('li')!.textContent).toContain('4');

    acmeButton.click();
    expect(onCompanyClick).toHaveBeenCalledWith('Acme');
  });

  it('renders each segment with its server-computed count and a one-line rule caption, never recomputing it', () => {
    renderRail();

    expect(screen.getByRole('button', { name: 'VIP speakers' })).toBeInTheDocument();
    expect(screen.getByText('company = "Acme"')).toBeInTheDocument();
    // The count rendered is exactly the prop's count (4) — the component
    // never re-derives it from the rule set or the duplicate/company data.
    const segmentRow = screen.getByRole('button', { name: 'VIP speakers' }).closest('li')!;
    expect(segmentRow.textContent).toContain('4');
  });

  it('offers "Save current filters" as a tertiary link on the segments section rule', () => {
    const onSaveCurrentFilters = vi.fn();
    renderRail({ onSaveCurrentFilters });

    const saveLink = screen.getByRole('button', { name: 'Save current filters' });
    saveLink.click();
    expect(onSaveCurrentFilters).toHaveBeenCalled();
  });

  it('renders duplicate pairs by name with a Merge link routing to the merge page at its own URL', () => {
    renderRail();

    expect(screen.getByText('Sam Rivera · Sam Rivera')).toBeInTheDocument();
    const mergeLink = screen.getByRole('link', { name: 'Merge' });
    expect(mergeLink).toHaveAttribute('href', '/contacts/merge?ids=ct3,ct4');
  });

  it('renders the reason caption and a Keep both control alongside every duplicate pair, same as the Duplicates tab', () => {
    const onKeepBoth = vi.fn();
    renderRail({ onKeepBoth });

    expect(screen.getByText('Same name and company')).toBeInTheDocument();

    const keepBothButton = screen.getByRole('button', { name: 'Keep both' });
    expect(keepBothButton).toBeInTheDocument();
    keepBothButton.click();
    expect(onKeepBoth).toHaveBeenCalledWith(DUPLICATE_GROUPS[0]);
  });

  it('renders an honest empty state for each section when there is nothing to show', () => {
    renderRail({ topCompanies: [], segments: [], duplicatePreview: [], duplicateCount: 0 });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No saved segments yet.')).toBeInTheDocument();
    expect(screen.getByText('No duplicate groups found.')).toBeInTheDocument();
    expect(screen.getByText('Possible duplicates · 0')).toBeInTheDocument();
  });

  // DEC-678: an empty state is only reachable from a SETTLED load. Each rail
  // list is fed by its own request, so each withholds its own empty row until
  // its own flag says that request came back -- an empty array before then is
  // "not measured yet", not "nothing to show".
  it('withholds every empty state while that section\'s own load is still in flight', () => {
    renderRail({
      topCompanies: [],
      topCompaniesLoaded: false,
      segments: [],
      segmentsLoaded: false,
      duplicatePreview: [],
      duplicatesLoaded: false,
      duplicateCount: 0,
    });

    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('No saved segments yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No duplicate groups found.')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.chq-empty')).toHaveLength(0);
    // The rail's own structure (its three section labels) still paints.
    expect(screen.getByText('Where they work')).toBeInTheDocument();
  });

  it('settles one section at a time: a loaded-and-empty section shows its empty state while an unsettled one does not', () => {
    renderRail({
      topCompanies: [],
      topCompaniesLoaded: true,
      segments: [],
      segmentsLoaded: false,
      duplicatePreview: [],
      duplicatesLoaded: false,
      duplicateCount: 0,
    });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('No saved segments yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No duplicate groups found.')).not.toBeInTheDocument();
  });
});
