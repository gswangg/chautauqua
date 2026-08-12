// DEC-684: contact merge is a PAGE at its own URL (/contacts/merge), not a
// modal. The records to merge travel in the query string (?ids=<id>,<id>) so
// the page survives a reload — matched here against the same
// GET /contacts/duplicates data DuplicatesView already fetches. Proves: the
// field-by-field KEEP/DISCARD comparison renders from ?ids=, an honest empty
// state renders with fewer than two ids (the render sweep visits this path
// with no params and must not crash), and the footer's Merge -> confirm ->
// POST /contacts/merge {keepId, mergeIds} flow (DEC-629: set-based).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MergePage } from './MergePage';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const GROUP = {
  contactIds: ['ct-keep', 'ct-merge'],
  contacts: [
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme' },
    { id: 'ct-merge', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme Corp' },
  ],
};

afterEach(() => {
  cleanup();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contacts/merge" element={<MergePage />} />
        <Route path="/contacts" element={<div>Contacts landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MergePage render (DEC-684)', () => {
  it('renders an honest empty state with no ids — the render sweep must not crash', () => {
    renderAt('/contacts/merge');

    expect(screen.getByText('Pick two or more duplicate records from the Duplicates tab.')).toBeInTheDocument();
  });

  it('renders an honest empty state with only one id', () => {
    renderAt('/contacts/merge?ids=ct-keep');

    expect(screen.getByText('Pick two or more duplicate records from the Duplicates tab.')).toBeInTheDocument();
  });

  it('renders the field-by-field KEEP/DISCARD comparison from ?ids=, then posts /contacts/merge {keepId, mergeIds} after confirming', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'POST /api/v1/contacts/merge': { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    // Field comparison rows: kept value in ink, discarded value struck through.
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const dialog = await screen.findByRole('dialog', { name: 'Merge these records?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));

    await waitFor(() => {
      expect(screen.getByText('Contacts landing')).toBeInTheDocument();
    });

    const mergeCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/contacts/merge'),
    );
    expect(mergeCall).toBeDefined();
    const body = JSON.parse((mergeCall![1] as RequestInit).body as string);
    expect(body).toEqual({ keepId: 'ct-keep', mergeIds: ['ct-merge'] });
  });
});
