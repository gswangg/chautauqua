// DEC-144 layer-2 harness regression test. Locks the P0 crash where
// SubmissionsTable called apiList (expects {items,...}) against
// GET /events/:id/forms, which actually returns a single form object
// ({fields: [...]}) -- destructuring/iterating that object as a list threw
// "n is not iterable" and blanked the whole page. This mounts the real page
// against a mocked fetch shaped like the real wire contract and asserts it
// renders without throwing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { exportHref, paginationSummary } from './SubmissionsTable';
import { activeViewKey, builtInViews } from './ViewTabs';
import { DEFAULT_FILTER_STATE, type SubmissionsFilterState } from './types';

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

    fireEvent.click(screen.getByText('Columns', { selector: 'summary' }));
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

  it('New submission modal (DEC-598, closes CNT-D6) renders Track checkboxes (multi-select, DEC-579) and a Format select', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
        { id: 'trk1', name: 'Keynotes', color: '#4f46e5' },
        { id: 'trk2', name: 'Workshops', color: '#16a34a' },
      ]),
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
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New submission' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'New submission' }));

    expect(await screen.findByRole('dialog', { name: 'New submission' })).toBeInTheDocument();

    // Tracks render as checkboxes, NOT radios (DEC-579: multi-track data
    // model — the reported "bug" was the label, not the model), one per
    // event track, both togglable independently.
    const keynotes = screen.getByRole('checkbox', { name: 'Keynotes' });
    const workshops = screen.getByRole('checkbox', { name: 'Workshops' });
    expect(keynotes).toBeInTheDocument();
    expect(workshops).toBeInTheDocument();
    fireEvent.click(keynotes);
    fireEvent.click(workshops);
    expect(keynotes).toBeChecked();
    expect(workshops).toBeChecked();

    // Format select is populated from the default form's Format dropdown
    // field's own options.
    const formatSelect = screen.getByRole('combobox', { name: 'Session format' });
    expect(formatSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Talk' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument();
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

  it('save-view dialog (DEC-610) validates an empty name and POSTs the trimmed name on save', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/views`]: { id: 'view-1', name: 'My saved view', config: {} },
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save current as view' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save current as view' }));

    // The ONE dialog contract: scrim + role="dialog" aria-modal, not
    // window.prompt. DEC-651: the header carries .chq-modal-title + a Close
    // control and the name input carries the mock's placeholder.
    const dialog = await screen.findByRole('dialog', { name: 'Save this view' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('AI track, unread')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save the view' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    // Empty-name validation must not have posted.
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  My saved view  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the view' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Save this view' })).not.toBeInTheDocument();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.name).toBe('My saved view');
  });

  it('phone triage (DEC-610): Accept on a pending row optimistically updates status and rolls back loudly on failure', async () => {
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
      [`POST /api/v1/events/${EVENT_ID}/submissions/status`]: () => ({
        status: 500,
        body: { error: { code: 'internal', message: 'boom' } },
      }),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    const group = screen.getByRole('group', { name: 'Triage S-001' });
    fireEvent.click(within(group).getByRole('button', { name: 'Accept' }));

    // Optimistic: status pill flips immediately.
    await waitFor(() => {
      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });

    // Server rejects: rolls back loudly (visible error + status reverts).
    await waitFor(() => {
      expect(screen.getByText(/Status update failed/)).toBeInTheDocument();
    });
    expect(screen.getByRole('cell', { name: 'Pending' })).toBeInTheDocument();
  });
});

describe('paginationSummary', () => {
  it('renders "Showing {start}-{end} of {total}"', () => {
    expect(paginationSummary(1, 50, 47)).toBe('Showing 1–47 of 47');
    expect(paginationSummary(2, 20, 47)).toBe('Showing 21–40 of 47');
  });

  it('never fabricates a range when there are no results', () => {
    expect(paginationSummary(1, 50, 0)).toBe('Showing 0 of 0');
  });
});

describe('exportHref (DEC-649)', () => {
  it('carries the current filters minus page/perPage, plus format=csv', () => {
    const filters: SubmissionsFilterState = {
      ...DEFAULT_FILTER_STATE,
      page: 3,
      perPage: 20,
      q: 'ai track',
      status: ['pending'],
      trackId: 'trk-1',
    };
    const href = exportHref('evt-1', filters);
    const [path, qs] = href.split('?');
    const params = new URLSearchParams(qs);
    expect(path).toBe('/api/v1/events/evt-1/export/submissions');
    expect(params.get('format')).toBe('csv');
    expect(params.get('q')).toBe('ai track');
    expect(params.get('status')).toBe('pending');
    expect(params.get('trackId')).toBe('trk-1');
    expect(params.has('page')).toBe(false);
    expect(params.has('perPage')).toBe(false);
  });

  it('is bare `format=csv` for the default (unfiltered) state', () => {
    const href = exportHref('evt-1', DEFAULT_FILTER_STATE);
    expect(href).toBe('/api/v1/events/evt-1/export/submissions?format=csv');
  });
});

describe('ViewTabs pure helpers (DEC-648)', () => {
  it('builtInViews lists Needs triage, All submissions, Accept queue in that order', () => {
    expect(builtInViews().map((v) => v.name)).toEqual(['Needs triage', 'All submissions', 'Accept queue']);
  });

  it('activeViewKey derives the active tab from live filter state, never click state', () => {
    const needsTriageFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, status: ['pending'] };
    expect(activeViewKey(needsTriageFilters, new Set(), [])).toBe('builtin-needs-triage');

    const allFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE };
    expect(activeViewKey(allFilters, new Set(), [])).toBe('builtin-all');

    const acceptQueueFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, status: ['accept_queue'] };
    expect(activeViewKey(acceptQueueFilters, new Set(), [])).toBe('builtin-accept-queue');

    // No built-in and no saved view matches a q filter -> no tab is active.
    const customFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, q: 'workshop' };
    expect(activeViewKey(customFilters, new Set(), [])).toBeNull();
  });

  it('matches a saved view by its id when the config matches exactly', () => {
    const filters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, status: ['declined'] };
    const savedView = {
      id: 'view-1',
      eventId: 'evt-1',
      name: 'Declined',
      config: { q: '', status: ['declined'], trackId: null, sort: 'newest' as const, columns: [] },
      createdAt: 0,
      updatedAt: 0,
    };
    expect(activeViewKey(filters, new Set(), [savedView])).toBe('view-1');
  });
});
