// DEC-422 (wave-67 amendment): MAX_FORM_FIELDS is a pure-core product cap
// (src/domain/form-copy.ts) that the Add-a-question control must disclose,
// imported through app/src/lib/batch-caps.ts (never a raw
// ../../../src/domain path -- same crossing-module discipline as
// merge-fields.ts/file-caps.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FormsPage } from './FormsPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { MAX_FORM_FIELDS } from '../../lib/batch-caps';
import type { CfpForm } from './types';

const EVENT_ID = 'evt-forms-cap-render';

const FORM: CfpForm = {
  id: 'form-1',
  eventId: EVENT_ID,
  title: 'DevCon 2026 CFP',
  intro: null,
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
      label: 'Custom question',
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

describe('FormsPage discloses the real MAX_FORM_FIELDS ceiling at Add-a-question', () => {
  it('prints the imported cap constant, not a hand-typed number', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 0 }),
    });

    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    // v12 phone frame (w1-i) added a second "Add a question" control (a
    // full-width dashed button, hidden at desktop, DEC-390 phone-selector
    // precedent) alongside the desktop link this test waits on.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Add a question' })).toHaveLength(2);
    });

    // G13 lane-D fix (02-submissions--04): the frame draws a 2-item FIELDS
    // header with NO cap counter -- the DEC-422 hint is gone.
    expect(screen.queryByText(`2 of ${MAX_FORM_FIELDS} questions`)).not.toBeInTheDocument();
    expect(MAX_FORM_FIELDS).toBe(200);
  });
});
