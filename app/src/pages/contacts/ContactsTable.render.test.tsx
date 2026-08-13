// eval-findings 45+55 (DEC-712, task-w17-d): the contacts directory table
// drops the '# Submissions' column and the FIELD/OPERATOR/VALUE
// FilterRulesPanel rule builder entirely (segment control moves to the tab
// row, owned by task-w17-c), gains a Labels column of derived-role chips,
// and the row action becomes a quiet 'Open' tertiary link.
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
    labels: ['Speaker', 'Moderator'],
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
      rules={[]}
      segmentId=""
      segments={[]}
      selection={EMPTY_SELECTION}
      loading={false}
      onChangeRules={() => {}}
      onChangeSegment={() => {}}
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

describe('ContactsTable render (eval-findings 45+55, DEC-712)', () => {
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

  it('renders one uppercase small-caps chip per derived label for a two-role contact', () => {
    renderTable();
    expect(screen.getByText('Speaker')).toBeInTheDocument();
    expect(screen.getByText('Moderator')).toBeInTheDocument();
  });

  it('renders a quiet Open tertiary link as the row action, not Add to event', () => {
    renderTable();
    const openButtons = screen.getAllByRole('button', { name: 'Open' });
    expect(openButtons).toHaveLength(2);
    expect(screen.queryByText(/Add to event/)).not.toBeInTheDocument();
  });
});
