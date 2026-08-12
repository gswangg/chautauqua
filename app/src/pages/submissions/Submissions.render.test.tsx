// DEC-144 layer-2 harness regression test. Locks the P0 crash where
// SubmissionsTable called apiList (expects {items,...}) against
// GET /events/:id/forms, which actually returns a single form object
// ({fields: [...]}) -- destructuring/iterating that object as a list threw
// "n is not iterable" and blanked the whole page. This mounts the real page
// against a mocked fetch shaped like the real wire contract and asserts it
// renders without throwing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-render-1';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('SubmissionsPage render smoke', () => {
  it('mounts without throwing and renders seeded column headers', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form-1',
        fields: [
          { id: 'f1', section: 'session', kind: 'text', label: 'Abstract', required: true, position: 0 },
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
        },
      ]),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Submissions' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: 'Ref' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Keynotes' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: 'Filter by track' })).toBeInTheDocument();
  });

  it('renders track names (not a count) and formatAnswerValue output for a toggled-on custom column', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
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
          trackIds: ['trk1'],
          submittedAt: null,
          createdAt: 1700000000000,
          answers: { 'f-level': 'Advanced' },
        },
      ]),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    // Tracks column shows the track NAME, not item.trackIds.length. Scoped
    // to a table cell since "Keynotes" also appears as a <select> option in
    // the track filter.
    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'Keynotes' })).toBeInTheDocument();
    });

    // The custom "Level" column is off by default; toggling it on in the
    // picker must render formatAnswerValue(item.answers['f-level']) in the
    // cell -- the production symptom was that this toggle appeared to do
    // nothing.
    expect(screen.queryByRole('columnheader', { name: 'Level' })).not.toBeInTheDocument();

    const [summary] = screen.getAllByText('Columns');
    fireEvent.click(summary!);
    const checkbox = await screen.findByRole('checkbox', { name: 'Level' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Level' })).toBeInTheDocument();
    });
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('auto-shows the Format column for a form with a "Session format" dropdown (DEC-249)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form-1',
        fields: [
          {
            id: 'f-format',
            section: 'session',
            kind: 'dropdown',
            label: 'Session format',
            required: false,
            position: 0,
            options: ['Talk', 'Workshop'],
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
          answers: { 'f-format': 'Workshop' },
        },
      ]),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Session format' })).toBeInTheDocument();
    });
  });

  it('shows the bulk-bar batch-size constraint copy once a row is selected', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
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
        },
      ]),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    expect(screen.queryByText('Kept across pages · sent in batches of 100')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select S-001' }));

    expect(screen.getByText('Kept across pages · sent in batches of 100')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});
