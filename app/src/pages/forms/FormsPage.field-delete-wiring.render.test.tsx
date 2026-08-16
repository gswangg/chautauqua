// DEC-650 (wave-66 amendment): FieldModal's far-left footer Delete reuses
// the SAME handler FieldList's row Delete already uses (handleDeleteField),
// and the shared ConfirmDialog it opens carries irreversible weight -- typed
// confirmation against the field's own label, gated Delete button -- plus
// the blast-radius fact FormsPage already holds (answeredCount).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FormsPage } from './FormsPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { CfpForm } from './types';

const EVENT_ID = 'evt-forms-delete-wiring';

const FORM: CfpForm = {
  id: 'form-1',
  eventId: EVENT_ID,
  title: 'DevCon 2026 CFP',
  intro: 'Submit your talk!',
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracks: [],
  fields: [
    { id: 'f1', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true },
    {
      id: 'f2',
      section: 'session',
      kind: 'text',
      label: 'Co-speaker email',
      required: false,
      position: 1,
      locked: false,
    },
  ],
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

async function openEditModalFor(fieldLabel: string) {
  const row = screen.getByText(fieldLabel).closest('.chq-forms-field-row') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  return screen.findByRole('dialog', { name: 'Edit a question' });
}

describe('FieldModal Delete -> shared irreversible ConfirmDialog (DEC-650 wave-66)', () => {
  it('closes the edit modal, opens the field-delete ConfirmDialog at irreversible weight naming the blast radius, and DELETEs only once the phrase matches', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 12 }),
      [`DELETE /api/v1/fields/f2`]: { status: 200, body: {} },
    });

    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Co-speaker email')).toBeInTheDocument());

    const modal = await openEditModalFor('Co-speaker email');
    const deleteBtn = within(modal).getByRole('button', { name: 'Delete this question' });
    fireEvent.click(deleteBtn);

    // The edit modal is gone -- Delete does not stack a second dialog on
    // top of it.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit a question' })).not.toBeInTheDocument());

    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete field' });
    expect(within(confirmDialog).getAllByText(/Co-speaker email/).length).toBeGreaterThan(0);
    // Blast radius from the already-held answeredCount.
    expect(within(confirmDialog).getByText(/12 people have already answered this form/)).toBeInTheDocument();

    // Irreversible weight: typed confirmation gates the Delete button.
    const confirmDeleteBtn = within(confirmDialog).getByRole('button', { name: 'Delete field' });
    expect(confirmDeleteBtn).toBeDisabled();
    const typed = within(confirmDialog).getByLabelText('Type "Co-speaker email" to confirm');
    fireEvent.change(typed, { target: { value: 'wrong' } });
    expect(confirmDeleteBtn).toBeDisabled();
    fireEvent.change(typed, { target: { value: 'Co-speaker email' } });
    expect(confirmDeleteBtn).not.toBeDisabled();

    fireEvent.click(confirmDeleteBtn);
    await waitFor(() => {
      const calledDelete = fetchMock.mock.calls.some(
        (call) => call[1]?.method === 'DELETE' && String(call[0]).includes('/fields/f2'),
      );
      expect(calledDelete).toBe(true);
    });
  });
});
