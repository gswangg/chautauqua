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
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme', title: 'Principal Engineer' },
    { id: 'ct-merge', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme Corp', title: 'Developer Advocate' },
  ],
};

// DEC-705: what GET /contacts/merge/preview would report for this pair —
// a plain discard for Company, and a combine/append outcome for Notes that
// must render WITHOUT strikethrough (it's incorporated, not thrown away).
const PREVIEW_FIELDS = [
  { key: 'company', label: 'Company', kept: 'Acme', discarded: ['Acme Corp'], outcome: 'keep' },
  {
    key: 'notes',
    label: 'Notes',
    kept: 'Met at PlatformCon.\n\n---\n\nPrefers Tuesday.',
    discarded: [],
    outcome: 'append',
  },
];

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
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
      'POST /api/v1/contacts/merge': { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    // Field comparison rows: kept value in ink, discarded value struck through.
    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });
    const discardCell = screen.getByText('Acme Corp');
    expect(discardCell).toHaveClass('chq-contacts-merge-compare-drop');
    expect(discardCell).not.toHaveClass('chq-contacts-merge-compare-combine');

    // Notes is a combine/append outcome: labelled as what will happen,
    // never rendered as a struck-through discard.
    const notesRow = screen.getByText('Notes').closest('.chq-contacts-merge-compare-row') as HTMLElement;
    expect(within(notesRow).getByText(/Met at PlatformCon\..*Prefers Tuesday\./s)).toBeInTheDocument();
    const notesCombineCell = within(notesRow).getByText(/will be appended/);
    expect(notesCombineCell).toHaveClass('chq-contacts-merge-compare-combine');
    expect(notesCombineCell).not.toHaveClass('chq-contacts-merge-compare-drop');

    // DEC-734: the identity pick rows carry company AND title, drawn from
    // the same GET /contacts/duplicates payload -- never a second by-ids
    // fetch.
    expect(screen.getByText(/Developer Advocate/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const dialog = await screen.findByRole('dialog', { name: 'Merge these records?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));

    await waitFor(() => {
      expect(screen.getByText('Contacts landing')).toBeInTheDocument();
    });

    const mergeCall = fetchMock.mock.calls.find(
      ([input], i, calls) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/merge') &&
        (calls[i]![1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(mergeCall).toBeDefined();
    const body = JSON.parse((mergeCall![1] as RequestInit).body as string);
    expect(body).toEqual({ keepId: 'ct-keep', mergeIds: ['ct-merge'] });
  });

  it('DEC-734: the footer\'s "Not a duplicate" navigates back to /contacts with the pair to dismiss, no merge POST', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate' }));

    await waitFor(() => {
      expect(screen.getByText('Contacts landing')).toBeInTheDocument();
    });

    const mergeCall = fetchMock.mock.calls.find(
      ([input], i, calls) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/merge') &&
        (calls[i]![1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(mergeCall).toBeUndefined();
  });
});
