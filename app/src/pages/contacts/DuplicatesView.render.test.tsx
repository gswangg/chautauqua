// w1-c P1 fix (DEC-239): the server's DuplicateGroup shape is {contactIds,
// contacts}, not {ids, contacts}. Proves the merge dialog reads contactIds
// (not the old, nonexistent `.ids`) and posts {keepId, mergeId} drawn from
// it — plus that a merge failure surfaces inside the modal (the top banner
// renders behind the backdrop) and a success closes the dialog with a
// confirmation.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DuplicatesView } from './DuplicatesView';
import { mockApi, listEnvelope, errorEnvelope } from '../../test-utils/mockApi';

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

describe('DuplicatesView render (w1-c P1, DEC-239)', () => {
  it('issues apiPost(/contacts/merge, {keepId, mergeId}) with ids drawn from contactIds, then closes with a confirmation', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'POST /api/v1/contacts/merge': { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    });

    render(<DuplicatesView onMerged={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Merge duplicates' })).toBeInTheDocument();
    });

    // Default keep selection is contactIds[0].
    const mergeButtons = screen.getAllByRole('button', { name: 'Merge' });
    fireEvent.click(mergeButtons[mergeButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Merge duplicates' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Contacts merged.')).toBeInTheDocument();

    const mergeCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/contacts/merge'),
    );
    expect(mergeCall).toBeDefined();
    const body = JSON.parse((mergeCall![1] as RequestInit).body as string);
    expect(body).toEqual({ keepId: 'ct-keep', mergeId: 'ct-merge' });
  });

  it('renders a merge failure inside the modal, not just the (backdrop-hidden) top banner', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'POST /api/v1/contacts/merge': { status: 400, body: errorEnvelope('invalid', 'keepId and mergeId must differ') },
    });

    render(<DuplicatesView onMerged={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Merge' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const dialog = await screen.findByRole('dialog', { name: 'Merge duplicates' });
    const mergeButtons = screen.getAllByRole('button', { name: 'Merge' });
    fireEvent.click(mergeButtons[mergeButtons.length - 1]!);

    await waitFor(() => {
      expect(dialog.querySelector('.chq-modal-error')).not.toBeNull();
    });
    expect(dialog).toBeInTheDocument();
  });
});
