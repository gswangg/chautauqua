// DEC-505 (wave-53 amendment, task-w53-c): the PATCH-side sibling of the
// landed delete-cascade confirm. A 409 naming `fields.dependents` is a
// confirm-to-proceed door (retry with ?cascade=1); a 409 naming `answers`
// (kind/section change, or an option removal with collected answers) is
// terminal -- no retry control, the existing FieldModal banner stands.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FormsPage } from './FormsPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { CfpForm } from './types';

const EVENT_ID = 'evt-forms-edit-cascade';

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
      kind: 'dropdown',
      label: 'Talk length',
      required: true,
      position: 1,
      locked: false,
      options: ['20 min', '45 min'],
    },
    {
      id: 'f3',
      section: 'session',
      kind: 'text',
      label: 'Why this talk',
      required: false,
      position: 2,
      locked: false,
      rule: { fieldId: 'f2', op: 'eq', value: '45 min' },
    },
  ],
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function baseRoutes(patchHandler: unknown) {
  return {
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: FORM,
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 0 }),
    [`PATCH /api/v1/fields/f2`]: patchHandler,
  };
}

async function openEditModalForTalkLength() {
  render(
    <MemoryRouter>
      <FormsPage />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByText('Talk length')).toBeInTheDocument();
  });
  const row = screen.getByText('Talk length').closest('[role="listitem"]') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit a question' });
  return dialog;
}

describe('FormsPage edit-field cascade confirm (DEC-505 wave-53 amendment)', () => {
  it('renders the "Change field anyway" confirm on a dependents conflict, and confirming retries with ?cascade=1 then refetches the form', async () => {
    let patchCalls = 0;
    const patchHandler = () => {
      patchCalls += 1;
      if (patchCalls === 1) {
        return {
          status: 409,
          body: {
            error: {
              code: 'conflict',
              message: 'This change would invalidate 1 dependent question\'s visibility rule: "Why this talk". Confirm to clear them too.',
              fields: { dependents: 'Why this talk' },
            },
          },
        };
      }
      return { ...FORM.fields[1], options: ['20 min'] };
    };
    const fetchMock = mockApi(baseRoutes(patchHandler));

    const dialog = await openEditModalForTalkLength();
    const saveButton = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    const confirmDialog = await screen.findByRole('dialog', { name: 'Confirm field change' });
    expect(confirmDialog).toBeInTheDocument();
    const changeAnywayButton = await screen.findByRole('button', { name: 'Change field anyway' });
    expect(
      screen.getByText(/would invalidate 1 dependent question/i),
    ).toBeInTheDocument();

    // FieldModal is still mounted underneath -- its own error banner never
    // painted (no rethrow).
    expect(document.querySelector('.chq-error-banner')).not.toBeInTheDocument();

    fireEvent.click(changeAnywayButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Change field anyway' })).not.toBeInTheDocument();
    });

    const retryCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : input.toString();
      return url.includes('/fields/f2') && url.includes('cascade=1') && (init?.method ?? '').toUpperCase() === 'PATCH';
    });
    expect(retryCall).toBeDefined();

    // Refetches the form via the page's existing loader.
    const refetchCalls = fetchMock.mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : input.toString();
      return url.includes(`/events/${EVENT_ID}/forms`) && (init?.method ?? 'GET').toUpperCase() === 'GET';
    });
    expect(refetchCalls.length).toBeGreaterThan(1);

    // Modal fully closes on success.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders NO "Change field anyway" control for a terminal answers conflict, leaving the FieldModal banner', async () => {
    const patchHandler = () => ({
      status: 409,
      body: {
        error: {
          code: 'conflict',
          message: '"Talk length" has 3 collected answers; changing its kind would orphan them. Delete and re-create the question instead.',
          fields: { answers: '3' },
        },
      },
    });
    mockApi(baseRoutes(patchHandler));

    const dialog = await openEditModalForTalkLength();
    const saveButton = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/collected answers/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Change field anyway' })).not.toBeInTheDocument();
    // Original dialog (still the edit form) remains mounted.
    expect(dialog).toBeInTheDocument();
  });
});
