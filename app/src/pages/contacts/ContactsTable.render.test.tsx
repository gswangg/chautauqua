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

function renderTable() {
  return render(
    <ContactsTable
      items={ITEMS}
      total={2}
      page={1}
      perPage={25}
      selection={EMPTY_SELECTION}
      loading={false}
      onChangePage={() => {}}
      onSelectionChange={() => {}}
      onOpenContact={() => {}}
      onBulkEmail={() => {}}
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
