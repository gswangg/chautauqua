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
import { exportHref } from './SubmissionsTable';
import { paginationSummary } from '../../lib/pagination-summary';
import { activeViewKey, builtInViews } from './ViewTabs';
import { DEFAULT_FILTER_STATE, type FormField, type SubmissionsFilterState } from './types';

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
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
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

  it('renders track names (not a count) and answerDisplayText output for a toggled-on custom column', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
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
    // picker must render answerDisplayText(item.answers['f-level']) in the
    // cell -- the production symptom was that this toggle appeared to do
    // nothing.
    expect(screen.queryByRole('columnheader', { name: 'Level' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Columns: 0', { selector: 'summary' }));
    const checkbox = await screen.findByRole('checkbox', { name: 'Level' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Level' })).toBeInTheDocument();
    });
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('auto-shows the Format column for a form with a "Session format" dropdown (DEC-249)', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
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
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
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
    const formatSelect = screen.getByRole('combobox', { name: /Session format/ });
    expect(formatSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Talk' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument();
  });

  it('shows the bulk-bar batch-size constraint copy once a row is selected', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
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

    // DEC-752: with no single status filter applied, the bar offers the
    // three "move forward" actions, not all six statuses as equal buttons.
    const bulkbar = within(screen.getByRole('toolbar', { name: 'Bulk actions' }));
    expect(bulkbar.getByRole('button', { name: 'Move to accept queue' })).toBeInTheDocument();
    expect(bulkbar.getByRole('button', { name: 'Decline queue' })).toBeInTheDocument();
    expect(bulkbar.getByRole('button', { name: 'Waitlist' })).toBeInTheDocument();
    expect(bulkbar.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    expect(bulkbar.queryByRole('button', { name: 'Mark accepted' })).not.toBeInTheDocument();
    expect(bulkbar.queryByRole('button', { name: 'Mark declined' })).not.toBeInTheDocument();
    expect(bulkbar.queryByRole('button', { name: 'Mark waitlisted' })).not.toBeInTheDocument();
  });

  it('save-view dialog (DEC-610) validates an empty name and POSTs the trimmed name on save', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
      // DEC-678 B7 (wave 46): a real row keeps the ViewTabs chrome (and its
      // "Save current as view" action) on screen -- with zero rows and no
      // facet, the page now renders the 'fresh' zero-row state instead,
      // which drops the chrome by design. This test is about the save-view
      // dialog, not the empty state, so it seeds one row.
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

    fireEvent.change(screen.getByRole('textbox', { name: 'Name it' }), { target: { value: '  My saved view  ' } });
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
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
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

const FORMAT_FIELD: FormField = {
  id: 'f-format',
  section: 'session',
  kind: 'dropdown',
  label: 'Format',
  required: false,
  position: 0,
  options: ['Talk', 'Workshop'],
};

const NO_FORMAT_FIELDS: FormField[] = [
  { id: 'f-abstract', section: 'session', kind: 'text', label: 'Abstract', required: true, position: 0 },
];

describe('ViewTabs pure helpers (DEC-648)', () => {
  it('builtInViews lists Needs triage, All submissions, Accept queue in that order', () => {
    expect(builtInViews([FORMAT_FIELD]).map((v) => v.name)).toEqual([
      'Needs triage',
      'All submissions',
      'Accept queue',
    ]);
  });

  it('with a Format field present, each preset carries exactly that field id as its columns', () => {
    for (const view of builtInViews([FORMAT_FIELD])) {
      expect(view.config.columns).toEqual(['f-format']);
    }
  });

  it('with no Format field present, each preset carries columns: []', () => {
    for (const view of builtInViews(NO_FORMAT_FIELDS)) {
      expect(view.config.columns).toEqual([]);
    }
  });

  it('activeViewKey derives the active tab from live filter state, never click state', () => {
    const needsTriageFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, status: ['pending'] };
    expect(activeViewKey(needsTriageFilters, new Set(['f-format']), [], [FORMAT_FIELD])).toBe('builtin-needs-triage');

    const allFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE };
    expect(activeViewKey(allFilters, new Set(['f-format']), [], [FORMAT_FIELD])).toBe('builtin-all');

    const acceptQueueFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, status: ['accept_queue'] };
    expect(activeViewKey(acceptQueueFilters, new Set(['f-format']), [], [FORMAT_FIELD])).toBe('builtin-accept-queue');

    // No built-in and no saved view matches a q filter -> no tab is active.
    const customFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, q: 'workshop' };
    expect(activeViewKey(customFilters, new Set(['f-format']), [], [FORMAT_FIELD])).toBeNull();
  });

  it('the landing state (Format visible, no status filter) resolves to builtin-all', () => {
    const landingFilters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE };
    expect(activeViewKey(landingFilters, new Set(['f-format']), [], [FORMAT_FIELD])).toBe('builtin-all');
  });

  it('matches a saved view by its id when the config matches exactly', () => {
    const filters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, status: ['declined'] };
    const savedView = {
      id: 'view-1',
      eventId: 'evt-1',
      name: 'Declined',
      config: { q: '', status: ['declined'], trackId: null, sort: 'newest' as const, columns: [] },
      createdByUserId: null,
      shared: true,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(activeViewKey(filters, new Set(), [savedView], NO_FORMAT_FIELDS)).toBe('view-1');
  });
});

// DEC-678 amendment (B7, wave 46): the worklist's real zero-row state --
// no <thead>/no table at all once there are no rows, split into a
// 'filtered' variant (a facet excluded everything, chrome stays, an escape
// clears exactly that facet) and a 'fresh' variant (nothing has ever been
// submitted, chrome is gone, the page header's persistent "New submission"
// button is the collection's one primary action).
describe('SubmissionsTable zero-row state (DEC-678 B7)', () => {
  it('filtered: a status facet that excludes every row drops the table (no columnheader/<thead>), names the facet, keeps chrome, and its escape restores the unfiltered query', async () => {
    let submissionsItems: unknown[] = [
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
    ];

    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope(submissionsItems),
    });

    const { container } = render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    // Starts with a real row -- chrome (the status pills) is on screen.
    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: 'Filter by track' })).toBeInTheDocument();

    // Applying the "Pending" status facet turns the next fetch's result set
    // empty (simulated here since mockApi's routing ignores query strings).
    submissionsItems = [];
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(await screen.findByText('No submissions match the current filters.')).toBeInTheDocument();
    expect(screen.getByText('The selected status filter excludes every submission.')).toBeInTheDocument();

    // No table at all -- not just an empty tbody.
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(container.querySelector('thead')).toBeNull();
    expect(container.querySelector('table')).toBeNull();

    // Chrome stays rendered above the block.
    expect(screen.getByRole('combobox', { name: 'Filter by track' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();

    // Never a primary action on 'filtered' -- only the escape link.
    const escape = screen.getByRole('button', { name: 'Clear filter' });

    fireEvent.click(escape);

    // The facet is cleared back to DEFAULT_FILTER_STATE -- with no other
    // facet in flight the query is now unfiltered, and since the mocked
    // list is still empty this resolves to the 'fresh' zero-row state.
    expect(await screen.findByText('No submissions yet.')).toBeInTheDocument();
  });

  it('fresh: no facet in flight drops the filter chrome and renders exactly one primary action', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No submissions yet.')).toBeInTheDocument();

    // Filter chrome (ViewTabs + FilterBarSearchSort + FilterBar), column
    // picker and pager are all gone.
    expect(screen.queryByRole('combobox', { name: 'Filter by track' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Saved views' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Search submissions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    // Exactly one primary action -- the page header's existing "New
    // submission" button, which already opens NewSubmissionModal. 'fresh'
    // never renders `escape`, and EmptyState throws if a caller tries.
    expect(screen.getAllByRole('button', { name: 'New submission' })).toHaveLength(1);
  });
});
