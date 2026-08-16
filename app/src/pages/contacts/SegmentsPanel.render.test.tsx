// w1-c P3 fix (DEC-239): deleting the actively-applied segment used to
// flash "Internal server error" — SegmentsPanel's onChanged() bumped
// ContactsApp's refreshKey and re-triggered the directory's contacts-list
// effect while segmentId still pointed at the now-deleted segment. Proves
// the state transition: the applied-segment filter (and its query param)
// clears BEFORE the delete-triggered refetch, so no request ever asks the
// server for a deleted segmentId, and no error banner appears.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import type { ContactListItem, Segment } from './types';

const EVENT_ID = 'evt-segment-delete-render';

const CONTACTS: ContactListItem[] = [
  { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', labels: [] },
];

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'VIP speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }], count: 1 },
];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('ContactsApp + SegmentsPanel: deleting the applied segment (w1-c P3, DEC-239)', () => {
  it('clears the segmentId filter before the delete-triggered refetch, so no request carries the deleted segmentId', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/stats': {
        total: 1,
        speakerCount: 0,
        topCompanies: [],
      },
      'GET /api/v1/segments': () => listEnvelope(SEGMENTS),
      'GET /api/v1/contacts': listEnvelope(CONTACTS),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'DELETE /api/v1/segments/seg1': { ok: true },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    // Apply the segment as the directory's active filter.
    fireEvent.change(screen.getByLabelText('Segment filter'), { target: { value: 'seg1' } });
    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input]) =>
        (typeof input === 'string' ? input : input.toString()).includes('/api/v1/contacts?'),
      );
      const last = calls[calls.length - 1]![0];
      expect((typeof last === 'string' ? last : last.toString())).toContain('segmentId=seg1');
    });

    // Delete that segment from the Segments tab.
    fireEvent.click(screen.getByRole('tab', { name: /^Segments/ }));
    await waitFor(() => {
      // Scoped to the saved-segment list: the name also appears as an option
      // in the tab row's "Segment: none ▾" control (eval-findings 55).
      expect(within(screen.getByRole('list')).getByText('VIP speakers', { exact: false })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Delete goes through the shared ConfirmDialog (DEC-809) — the click
    // above only arms it, the dialog's own "Delete" confirms.
    const dialog = await screen.findByRole('dialog', { name: 'Delete this segment' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete segment' }));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([input]) =>
        (typeof input === 'string' ? input : input.toString()).includes('/segments/seg1'),
      );
      expect(deleteCall).toBeDefined();
    });

    // No error banner anywhere in the app (the old bug flashed "Internal
    // server error" here because the refetch still carried segmentId=seg1).
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();

    // Every /contacts request issued AFTER the delete must not carry the
    // now-deleted segmentId.
    await waitFor(() => {
      const contactsCallsAfterDelete = fetchMock.mock.calls
        .map(([input]) => (typeof input === 'string' ? input : input.toString()))
        .filter((url) => url.includes('/api/v1/contacts?'));
      const lastContactsCall = contactsCallsAfterDelete[contactsCallsAfterDelete.length - 1]!;
      expect(lastContactsCall).not.toContain('segmentId=seg1');
    });
  });

  it('asks first via the shared ConfirmDialog, naming the segment, and cancelling deletes nothing (DEC-809)', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/stats': {
        total: 1,
        speakerCount: 0,
        topCompanies: [],
      },
      'GET /api/v1/segments': () => listEnvelope(SEGMENTS),
      'GET /api/v1/contacts': listEnvelope(CONTACTS),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'DELETE /api/v1/segments/seg1': { ok: true },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Segments/ }));
    await waitFor(() => {
      expect(within(screen.getByRole('list')).getByText('VIP speakers', { exact: false })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this segment' });
    // Names the view being removed rather than a bare "are you sure?".
    expect(within(dialog).getByText(/VIP speakers/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Delete this segment' })).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        (typeof input === 'string' ? input : input.toString()).includes('/segments/seg1'),
      ),
    ).toBe(false);
  });

  // DEC-678 (w55-b): the saved-segments list carries no facet of its own to
  // clear, so a zero-row settle is always the shared EmptyState's 'fresh'
  // voice -- never the old bare, escape-less `chq-empty` line.
  it('renders the shared EmptyState (fresh, no escape) when the account has no saved segments', async () => {
    mockApi({
      'GET /api/v1/contacts/stats': {
        total: 1,
        speakerCount: 0,
        topCompanies: [],
      },
      'GET /api/v1/segments': () => listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope(CONTACTS),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Segments/ }));

    await waitFor(() => {
      expect(screen.getByText('No saved segments yet.')).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-empty')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-empty-block-fresh')).not.toBeNull();
    expect(document.querySelector('.chq-empty-escape')).not.toBeInTheDocument();
  });

  // DEC-856 (wave 65 amendment): POST /segments' `rules` fields-map key has
  // no editable control of its own (rules come from the active directory
  // filters) -- it must still render, beside the "Rules: ..." summary line,
  // never dropped or collapsed to a bare err.message.
  it('a save refusal naming `rules` renders that message beside the Rules line', async () => {
    mockApi({
      'GET /api/v1/contacts/stats': {
        total: 1,
        speakerCount: 0,
        topCompanies: [],
      },
      'GET /api/v1/segments': () => listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope(CONTACTS),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'POST /api/v1/segments': {
        status: 400,
        body: { error: { code: 'invalid', message: 'Validation failed', fields: { rules: 'Max 20 rules' } } },
      },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Segments/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Segment name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Segment name'), { target: { value: 'Too many rules' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save segment' }));

    const rulesLine = await screen.findByText(/^Rules:/);
    await waitFor(() => {
      expect(screen.getByText('Max 20 rules')).toBeInTheDocument();
    });
    // Beside the Rules line, not the generic banner (which is dropped in
    // favour of the per-field reading per DEC-856).
    expect(rulesLine.nextElementSibling).toHaveTextContent('Max 20 rules');
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });
});
