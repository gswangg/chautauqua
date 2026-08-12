// DEC-684: merge is a PAGE at its own URL (MergePage.tsx), not a modal — this
// view now only lists duplicate groups and links each one to
// /contacts/merge?ids=<contactIds>. No dialog, no merge POST, no merge-local
// error plumbing here anymore.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DuplicatesView } from './DuplicatesView';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const GROUP = {
  contactIds: ['ct-keep', 'ct-merge'],
  contacts: [
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    { id: 'ct-merge', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
  ],
};

afterEach(() => {
  cleanup();
});

describe('DuplicatesView render (DEC-684: merge moved to its own page)', () => {
  it('links each duplicate group to /contacts/merge?ids=<contactIds> instead of opening a dialog', async () => {
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
});
