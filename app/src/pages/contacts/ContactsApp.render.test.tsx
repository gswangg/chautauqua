// DEC-144 layer-2 harness: component-render smoke test for the CRM-12
// dashboard drill-through, and (task-w17-c, DEC-710/DEC-711) the directory
// panel's two-column architecture — table left, DirectoryRail right, tab
// chips carrying counts, and tab selection as URL state (?tab=). Guards the
// integration point between the rail's top-companies widget and the
// DEC-149 rules filter used by the directory query: clicking a company must
// issue GET /contacts with a rules=[{field:'company',op:'eq',value}] query
// param, i.e. the drill-through rides the same rule mechanism as the filter
// builder rather than a parallel filter state.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import type { DuplicateGroup, SegmentRule } from './types';

// DEC-710 round-trip check: exposes the router's current search string so
// the test can assert ?tab= is real URL state, not component state.
function LocationSearchProbe() {
  const location = useLocation();
  return <span data-testid="location-search">{location.search}</span>;
}

const EVENT_ID = 'evt-contacts-render';

function requestUrls(fetchMock: ReturnType<typeof mockApi>): string[] {
  return fetchMock.mock.calls.map(([input]) => (typeof input === 'string' ? input : input.toString()));
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
});

describe('ContactsApp render smoke (CRM-12 top-companies drill-through)', () => {
  it('turns a top-companies click into a DEC-149 company rule on the contacts query', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/stats': {
        total: 3,
        speakerCount: 2,
        duplicateCount: 0,
        topCompanies: [{ company: 'Acme', count: 2 }],
      },
      'GET /api/v1/segments': listEnvelope([]),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([
        { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    const companyButton = await screen.findByRole('button', { name: 'Acme' });

    const before = requestUrls(fetchMock).filter((u) => u.includes('/contacts?')).length;
    fireEvent.click(companyButton);

    await waitFor(() => {
      expect(requestUrls(fetchMock).filter((u) => u.includes('/contacts?')).length).toBeGreaterThan(before);
    });

    const lastContactsUrl = requestUrls(fetchMock)
      .filter((u) => u.includes('/contacts?'))
      .at(-1)!;
    const rulesParam = new URLSearchParams(lastContactsUrl.split('?')[1]).get('rules');
    expect(rulesParam).not.toBeNull();
    expect(JSON.parse(rulesParam!)).toEqual([{ field: 'company', op: 'eq', value: 'Acme' }]);
  });
});

describe('ContactsApp render smoke: directory search (DEC-684/DEC-710)', () => {
  it('renders the search input at the right end of the tab row, and resets to page 1 on change', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/stats': {
        total: 1,
        speakerCount: 0,
        duplicateCount: 0,
        topCompanies: [],
      },
      'GET /api/v1/segments': listEnvelope([]),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([
        { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    const searchInput = await screen.findByLabelText('Search contacts');

    // Toolbar order: the tablist is the first control, the search+segment
    // cluster follows it (margin-left: auto) in the SAME row (DEC-710).
    const tablist = screen.getByRole('tablist', { name: 'Contacts view' });
    expect(tablist.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: 'ada' } });

    await waitFor(() => {
      const urls = requestUrls(fetchMock).filter((u) => u.includes('/contacts?'));
      const last = urls.at(-1)!;
      const params = new URLSearchParams(last.split('?')[1]);
      expect(params.get('q')).toBe('ada');
      expect(params.get('page')).toBe('1');
    });
  });
});

const DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    contactIds: ['ct3', 'ct4'],
    reason: 'name_and_company',
    contacts: [
      { id: 'ct3', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@acme.example', company: 'Acme', createdAt: 1000 },
      { id: 'ct4', firstName: 'Sam', lastName: 'Rivera', email: 'sam.r@acmecorp.example', company: 'Acme', createdAt: 1000 },
    ],
  },
];

function directoryRoutes() {
  return {
    'GET /api/v1/contacts/stats': {
      total: 2,
      speakerCount: 1,
      duplicateCount: DUPLICATE_GROUPS.length,
      topCompanies: [{ company: 'Acme', count: 2 }],
    },
    'GET /api/v1/segments': listEnvelope([
      { id: 'seg1', name: 'VIP speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }], count: 2 },
    ]),
    'GET /api/v1/contacts/duplicates': listEnvelope(DUPLICATE_GROUPS),
    'GET /api/v1/contacts': listEnvelope([
      // labels[] is part of the list contract (DEC-712, GET /api/v1/contacts
      // always fills it via `?? []`); ContactsTable renders it as a column.
      { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] },
      { id: 'ct2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', company: 'Navy', labels: [] },
    ]),
  };
}

describe('ContactsApp render smoke: two-column directory architecture (DEC-710/DEC-711)', () => {
  it('renders table left + rail right, no KPI trio, and tab chips carrying counts', async () => {
    mockApi(directoryRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });

    // Two-column layout: the directory table and the rail are siblings
    // inside the same grid container.
    const grid = document.querySelector('.chq-contacts-directory-grid');
    expect(grid).not.toBeNull();
    expect(grid!.querySelector('.chq-contacts-table-wrap')).not.toBeNull();
    expect(grid!.querySelector('.chq-contacts-rail')).not.toBeNull();

    // The old KPI trio (Total contacts / Events / Returning speakers tiles)
    // is gone with StatsStrip (DEC-711) — only the endpoint-backed title
    // summary and the rail sections remain.
    expect(screen.queryByText('Total contacts')).not.toBeInTheDocument();
    expect(screen.queryByText('Returning speakers')).not.toBeInTheDocument();
    // DEC-711 amendment (wave 4, fields deleted wave 33): the headline is
    // THREE clauses -- people, speakers, possible duplicates. returningSpeakers
    // and eventCount had no renderer and were removed from ContactStats.
    expect(screen.getByText('2 people · 1 speaker · 1 possible duplicate')).toBeInTheDocument();

    // Tab chips carry counts.
    expect(screen.getByRole('tab', { name: 'Duplicates · 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Segments · 1' })).toBeInTheDocument();

    // DEC-711 amendment (wave 4): the action cluster orders
    // Import / Export / New.
    const actions = document.querySelector('.chq-contacts-title-actions')!;
    const labels = Array.from(actions.children).map((el) => el.textContent);
    expect(labels).toEqual(['Import CSV', 'Export CSV', 'New contact']);
  });

  it('round-trips the active tab through ?tab= URL state (DEC-710)', async () => {
    mockApi(directoryRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts?tab=segments']}>
        <ContactsApp />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    // ?tab=segments on initial load selects the Segments tab directly.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Segments · 1', selected: true })).toBeInTheDocument();
    });

    // Switching to Duplicates writes ?tab=duplicates into the URL.
    fireEvent.click(screen.getByRole('tab', { name: /^Duplicates/ }));
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toBe('?tab=duplicates');
    });

    // Switching back to Directory clears the tab param (default, no ?tab=).
    fireEvent.click(screen.getByRole('tab', { name: 'Directory' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toBe('');
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });
  });
});

// DEC-868: the FilterRulesPanel rule builder (one editable row, edited in
// place) composes with the rail's company drill-through rather than the two
// fighting over one rule slot. A half-typed rule (activeRules()) never
// reaches the request.
describe('ContactsApp: FilterRulesPanel composes with the rail (DEC-868)', () => {
  function lastRulesParam(fetchMock: ReturnType<typeof mockApi>): SegmentRule[] | null {
    const last = requestUrls(fetchMock)
      .filter((u) => u.includes('/contacts?'))
      .at(-1)!;
    const raw = new URLSearchParams(last.split('?')[1]).get('rules');
    return raw === null ? null : JSON.parse(raw);
  }

  it('adding a second rule via the panel narrows the request rather than replacing the first', async () => {
    const fetchMock = mockApi(directoryRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Ada Lovelace' });

    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    fireEvent.change(screen.getByLabelText('Filter 1 field'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('Filter 1 value'), { target: { value: 'Engineer' } });

    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toEqual([{ field: 'title', op: 'contains', value: 'Engineer' }]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    fireEvent.change(screen.getByLabelText('Filter 2 field'), { target: { value: 'company' } });
    fireEvent.change(screen.getByLabelText('Filter 2 value'), { target: { value: 'Acme' } });

    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toEqual([
        { field: 'title', op: 'contains', value: 'Engineer' },
        { field: 'company', op: 'contains', value: 'Acme' },
      ]);
    });
  });

  it('removing a rule widens the request back to the remaining rules', async () => {
    const fetchMock = mockApi(directoryRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Ada Lovelace' });

    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    fireEvent.change(screen.getByLabelText('Filter 1 value'), { target: { value: 'acme.com' } });
    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toEqual([{ field: 'email', op: 'contains', value: 'acme.com' }]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove filter 1' }));

    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toBeNull();
    });
  });

  it('a rail company click preserves an unrelated rule already in the panel', async () => {
    const fetchMock = mockApi(directoryRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Ada Lovelace' });

    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    fireEvent.change(screen.getByLabelText('Filter 1 field'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('Filter 1 value'), { target: { value: 'Engineer' } });
    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toEqual([{ field: 'title', op: 'contains', value: 'Engineer' }]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Acme' }));

    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toEqual([
        { field: 'title', op: 'contains', value: 'Engineer' },
        { field: 'company', op: 'eq', value: 'Acme' },
      ]);
    });

    // Clicking the SAME company again replaces only its own rule, not the
    // unrelated one.
    fireEvent.click(screen.getByRole('button', { name: 'Acme' }));
    await waitFor(() => {
      expect(lastRulesParam(fetchMock)).toEqual([
        { field: 'title', op: 'contains', value: 'Engineer' },
        { field: 'company', op: 'eq', value: 'Acme' },
      ]);
    });
  });
});
