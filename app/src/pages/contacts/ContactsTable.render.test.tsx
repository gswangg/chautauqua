// eval-findings 45+55 (DEC-712, task-w17-d) + DEC-738/DEC-726 (task-w2-c):
// the contacts directory table drops the '# Submissions' column and the
// FIELD/OPERATOR/VALUE FilterRulesPanel rule builder entirely (segment
// control moves to the tab row, owned by task-w17-c), gains a Labels column
// of chips reading the contact's customFields ("`key` `value`", server-
// formatted via src/domain/contact-labels.ts -- supersedes DEC-712's
// derived participation-role chips), and the row action becomes a quiet
// 'Open' tertiary link.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContactsTable } from './ContactsTable';
import { EMPTY_SELECTION } from './selection';
import type { ContactListItem } from './types';

const ITEMS: ContactListItem[] = [
  {
    id: 'ct1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    company: 'Acme',
    title: 'Engineer',
    labels: ['role speaker', 'tshirt L'],
  },
  {
    id: 'ct2',
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    company: 'Navy',
    title: 'Admiral',
    labels: [],
  },
];

function renderTable(overrides: Partial<Parameters<typeof ContactsTable>[0]> = {}) {
  return render(
    <ContactsTable
      items={ITEMS}
      total={2}
      page={1}
      perPage={25}
      selection={EMPTY_SELECTION}
      loading={false}
      empty={{ variant: 'fresh' }}
      onChangePage={() => {}}
      onSelectionChange={() => {}}
      onOpenContact={() => {}}
      onBulkEmail={() => {}}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('ContactsTable render (eval-findings 45+55, DEC-738/DEC-726)', () => {
  it('renders exactly the checkbox/Name and email/Company/Labels columns plus the row action', () => {
    renderTable();
    const headerRow = screen.getAllByRole('row')[0]!;
    const headers = Array.from(headerRow.querySelectorAll('th')).map((th) => th.textContent);
    expect(headers).toEqual(['', 'Name and email', 'Company', 'Labels', '']);
  });

  it('never renders the # Submissions column', () => {
    renderTable();
    expect(screen.queryByText('# Submissions')).not.toBeInTheDocument();
  });

  it('never renders the FIELD/OPERATOR/VALUE filter rules builder', () => {
    renderTable();
    expect(screen.queryByLabelText('Filter field')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter operator')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Segment filter')).not.toBeInTheDocument();
  });

  // DEC-738 amendment (wave 4): the LABELS cell prints the server-formatted
  // strings as plain small-caps meta joined by ' - ' -- no bordered-chip
  // chrome, no per-label list item.
  it('renders labels as plain small-caps meta joined by \' - \', no chip chrome', () => {
    renderTable();
    expect(screen.getByText('role speaker - tshirt L')).toBeInTheDocument();
    expect(document.querySelector('.chq-contacts-label-chip')).not.toBeInTheDocument();
  });

  it("renders the formatted '`key` `value`' string rather than a bare value", () => {
    renderTable();
    expect(screen.getByText('role speaker - tshirt L')).toBeInTheDocument();
    expect(screen.queryByText('speaker')).not.toBeInTheDocument();
  });

  it('renders a quiet Open tertiary link as the row action, not Add to event', () => {
    renderTable();
    const openButtons = screen.getAllByRole('button', { name: 'Open' });
    expect(openButtons).toHaveLength(2);
    expect(screen.queryByText(/Add to event/)).not.toBeInTheDocument();
  });

  // DEC-711 amendment (wave 4): the pager states the matching count as one
  // left-hand group; Previous/Next sit together on the right.
  it('groups the "Showing" count on the left and Previous/Next together on the right', () => {
    renderTable();
    const pager = document.querySelector('.chq-pager')!;
    const children = Array.from(pager.children);
    expect(children).toHaveLength(2);
    expect(children[0]!.textContent).toMatch(/^Showing/);
    const nav = children[1]!;
    expect(nav.className).toContain('chq-contacts-pager-nav');
    const navButtons = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
    expect(navButtons).toEqual(['Previous', 'Next']);
  });
});

// B7 rule 6 (DEC-678): a settled empty directory renders EmptyState INSTEAD
// of the <table>, never live column headers over an empty body.
describe('ContactsTable empty states (B7 rule 6, DEC-678)', () => {
  it('renders no <thead> when settled and empty', () => {
    renderTable({ items: [], total: 0, empty: { variant: 'fresh' } });
    expect(document.querySelector('thead')).not.toBeInTheDocument();
  });

  it('renders the fresh voice with no escape when there is no facet in flight', () => {
    renderTable({ items: [], total: 0, empty: { variant: 'fresh' } });
    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state hides the
    // pager -- chrome over a directory that has never held a row.
    expect(document.querySelector('.chq-pager')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('renders the filtered voice with an escape naming the facet when one is in flight', () => {
    const onClear = () => {};
    renderTable({
      items: [],
      total: 0,
      empty: { variant: 'filtered', reason: 'Search "ada"', onClear },
    });
    expect(screen.getByText('No contacts match the current search/filter.')).toBeInTheDocument();
    expect(screen.getByText('Search "ada"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FILTERED zero-state keeps
    // the pager -- chrome is how a filter gets undone.
    expect(document.querySelector('.chq-pager')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('still paints the loading skeleton and no EmptyState while loading', () => {
    renderTable({ items: [], total: 0, loading: true, empty: { variant: 'fresh' } });
    expect(screen.getByText('Loading contacts…')).toBeInTheDocument();
    expect(screen.queryByText('No contacts yet.')).not.toBeInTheDocument();
  });
});
