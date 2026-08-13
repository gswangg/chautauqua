// DEC-684: merge is a PAGE at its own URL (MergePage.tsx), not a modal — this
// view now only lists duplicate groups and links each one to
// /contacts/merge?ids=<contactIds>. No dialog, no merge POST, no merge-local
// error plumbing here anymore.
// DEC-734: each pair also renders its company, a 'Keep both' dismiss, a pair
// counter, and reads a one-shot dismissPairIds notice from MergePage's own
// 'Not a duplicate' footer button the same way it reads a merge notice.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DuplicatesView } from './DuplicatesView';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const GROUP = {
  contactIds: ['ct-keep', 'ct-merge'],
  contacts: [
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme' },
    { id: 'ct-merge', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme Corp' },
  ],
};

const SECOND_GROUP = {
  contactIds: ['ct-a', 'ct-b'],
  contacts: [
    { id: 'ct-a', firstName: 'Sam', lastName: 'Ng', email: 'sam@example.com', company: null },
    { id: 'ct-b', firstName: 'Sam', lastName: 'Ng', email: 'sam2@example.com', company: null },
  ],
};

afterEach(() => {
  cleanup();
});

describe('DuplicatesView render (DEC-684: merge moved to its own page)', () => {
  it('links each duplicate group to /contacts/merge?ids=<contactIds> instead of opening a dialog, and shows company', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();

    const mergeLink = screen.getByRole('link', { name: 'Merge' });
    expect(mergeLink).toHaveAttribute('href', '/contacts/merge?ids=ct-keep,ct-merge');

    expect(screen.queryByRole('dialog', { name: 'Merge duplicates' })).not.toBeInTheDocument();
  });

  it('shows the one-shot merge notice passed in via initialNotice, without re-fetching a merge dialog', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} initialNotice="Contacts merged." />
      </MemoryRouter>,
    );

    expect(screen.getByText('Contacts merged.')).toBeInTheDocument();
  });

  it('DEC-734: a pair counter tracks the visible groups, and "Keep both" dismisses a pair from the list without merging', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, SECOND_GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 2');
    });

    const keepBothButtons = screen.getAllByRole('button', { name: 'Keep both' });
    expect(keepBothButtons).toHaveLength(2);
    fireEvent.click(keepBothButtons[0]!);

    expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 1');
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sam Ng/)).toBeInTheDocument();
  });

  it('DEC-734: reads a one-shot initialDismissPairIds (from MergePage\'s "Not a duplicate" footer) and drops that pair on mount', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, SECOND_GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView
          onMerged={() => {}}
          initialNotice="Marked as not a duplicate."
          initialDismissPairIds={['ct-merge', 'ct-keep']}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 1');
    });
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sam Ng/)).toBeInTheDocument();
    expect(screen.getByText('Marked as not a duplicate.')).toBeInTheDocument();
  });
});
