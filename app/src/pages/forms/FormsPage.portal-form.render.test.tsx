// Multi-portal (decision 60): the library's form items are built in this
// builder, opened with ?form=<id>. A portal form shows its own title and
// questions with a way back to the library, and none of the CFP form's
// submission window, received count, public link or save dock.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FormsPage } from './FormsPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { CfpForm } from './types';

const EVENT_ID = 'evt-forms-portal-form';

const TRAVEL_FORM: CfpForm = {
  id: 'form-travel',
  eventId: EVENT_ID,
  title: 'Travel form',
  intro: null,
  isDefault: false,
  openDate: null,
  closeDate: null,
  tracks: [],
  fields: [{ id: 'f1', section: 'session', kind: 'text', label: 'Arrival date', required: true, position: 0, locked: false }],
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

describe('FormsPage · a library form item', () => {
  it('opens the form named by ?form= with its questions and a way back to the library', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devflow-2027', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: TRAVEL_FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 12 }),
    });

    render(
      <MemoryRouter initialEntries={['/submissions/forms?form=form-travel']}>
        <FormsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Travel form' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/events/${EVENT_ID}/forms?form=form-travel`))).toBe(true);
    expect(screen.getByRole('link', { name: '‹ Library' })).toHaveAttribute('href', '/settings/portals/library');
    expect(screen.getByText('Arrival date')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Add a question' })).toHaveLength(2));

    // the CFP form's own chrome stays on the CFP form
    expect(screen.queryByText('Opens')).not.toBeInTheDocument();
    expect(screen.queryByText('Public link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save the form' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Preview' })).not.toBeInTheDocument();
  });
});
