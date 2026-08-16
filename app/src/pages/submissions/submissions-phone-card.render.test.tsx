// DEC-610 (wave 14 task w14-h): the phone card CSS names two class-based
// hooks (see submissions-phone-card.test.ts for the source scan). This
// asserts they are not dead selectors -- the rendered table actually emits
// both `chq-submissions-table-clone-cell` (Clone <td>, always present) and
// `chq-submissions-table-custom` (each toggled-on custom-column <td>).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-phone-card-1';

describe('SubmissionsTable phone-card class hooks render (DEC-610, task w14-h)', () => {
  beforeEach(() => {
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('emits both chq-submissions-table-clone-cell and (once toggled on) chq-submissions-table-custom', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'f-level',
            section: 'session',
            kind: 'dropdown',
            label: 'Level',
            required: false,
            position: 0,
            options: ['Beginner', 'Advanced'],
          },
        ],
      },
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk About Testing',
          status: 'pending',
          contentStatus: 'pending',
          speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          answers: { 'f-level': 'Advanced' },
        },
      ]),
    });

    const { container } = render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    // Clone-cell hook is always present.
    expect(container.querySelector('td.chq-submissions-table-clone-cell')).not.toBeNull();

    // The custom "Level" column is off by default (columns.test.ts /
    // Submissions.render.test.tsx cover the toggle itself) -- toggle it on
    // and confirm the custom-column hook appears on its <td>.
    fireEvent.click(screen.getByText('Columns: 0', { selector: 'summary' }));
    const checkbox = await screen.findByRole('checkbox', { name: 'Level' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(container.querySelector('td.chq-submissions-table-custom')).not.toBeNull();
    });
  });
});
