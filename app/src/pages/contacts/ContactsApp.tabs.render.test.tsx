// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke
// coverage for the ContactsApp tab surfaces that the existing CRM-12
// drill-through test (ContactsApp.render.test.tsx) doesn't touch: the
// directory tab (list envelope + DirectoryRail), duplicates tab (a
// seeded-style same-name+company duplicate group per DEC-143), segments
// tab, the ContactDrawer opened on a contact with populated bio/social/
// headshot fields, the ImportWizard first step, and BulkEmailModal opened
// over a selection. Kept as a separate co-located file so the existing
// narrow CRM-12 test file is never touched. Only the directory/duplicates/
// segments panels exist on ContactsApp at this branch point (no pipeline
// tab, no rule-filter-bar/CRM-dashboard wave-2 additions beyond what's
// already exercised elsewhere) -- nothing else is asserted here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import type { ContactDetail, ContactListItem, DuplicateGroup, Segment } from './types';

const EVENT_ID = 'evt-contacts-tabs-render';

const CONTACTS: ContactListItem[] = [
  { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', title: 'Engineer', submissionCount: 2, labels: [] },
  { id: 'ct2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', company: 'Navy', title: 'Admiral', submissionCount: 1, labels: [] },
];

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

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'VIP speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }], count: 1 },
];

const FULL_CONTACT: ContactDetail = {
  id: 'ct1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  company: 'Acme',
  title: 'Engineer',
  labels: [],
  phone: '555-0100',
  notes: 'Keynote speaker.',
  bio: 'Pioneering computer scientist and mathematician.',
  headshotUrl: 'https://files.example/ada-headshot.png',
  socialLinks: { twitter: '@ada', linkedin: 'ada-lovelace', github: 'adalovelace', website: 'https://ada.example' },
  customFields: {},
  history: { submissions: [], submissionsTotal: 0, emails: [], events: [] },
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  resetEventsCacheForTests();
});

function baseRoutes() {
  return {
    'GET /api/v1/contacts/stats': {
      total: 2,
      speakerCount: 1,
      duplicateCount: DUPLICATE_GROUPS.length,
      topCompanies: [{ company: 'Acme', count: 1 }],
    },
    'GET /api/v1/segments': listEnvelope(SEGMENTS),
    'GET /api/v1/contacts': listEnvelope(CONTACTS),
    'GET /api/v1/contacts/duplicates': listEnvelope(DUPLICATE_GROUPS),
    // DEC-662 amendment (wave 55): the import wizard's ?eventId= preselect
    // validates against this org's own /events list.
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, name: 'Contacts Tabs Test Event' }]),
  };
}

describe('ContactsApp render smoke: directory tab', () => {
  it('renders the two-column directory (table + rail) and the contacts list envelope', async () => {
    mockApi(baseRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace' as unknown as string, { exact: false })).toBeTruthy();
    });

    // Stable markers: title summary + rail "Where they work" + directory rows.
    // DEC-711 amendment (wave 4): the summary states three clauses.
    expect(screen.getByText('2 people · 1 speaker · 1 possible duplicate')).toBeInTheDocument();
    expect(screen.getByText('Where they work')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grace Hopper' })).toBeInTheDocument();
  });
});

describe('ContactsApp render smoke: duplicates tab', () => {
  it('renders a same-name+company duplicate group (DEC-143)', async () => {
    mockApi(baseRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Duplicates/ }));

    await waitFor(() => {
      expect(screen.getByText('Possible duplicates')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Sam Rivera <sam\.rivera@acme\.example>/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Sam Rivera <sam\.r@acmecorp\.example>/)).toBeInTheDocument();
  });
});

describe('ContactsApp render smoke: segments tab', () => {
  it('renders the saved segment list', async () => {
    mockApi(baseRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Segments/ }));

    await waitFor(() => {
      // Scoped to the saved-segment list: the name also appears as an option
      // in the tab row's "Segment: none ▾" control (eval-findings 55).
      expect(within(screen.getByRole('list')).getByText('VIP speakers', { exact: false })).toBeInTheDocument();
    });
  });
});

describe('ContactsApp render smoke: ContactDrawer', () => {
  it('opens a contact with populated bio/social/headshot fields', async () => {
    mockApi({
      ...baseRoutes(),
      'GET /api/v1/contacts/ct1': FULL_CONTACT,
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }));

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText(FULL_CONTACT.bio as string)).toBeInTheDocument();
    });
    expect(within(dialog).getByText('@ada')).toBeInTheDocument();
    expect(within(dialog).getByText('ada-lovelace')).toBeInTheDocument();
    expect(within(dialog).getByAltText('Ada Lovelace headshot')).toHaveAttribute('src', FULL_CONTACT.headshotUrl);

    // Click-to-edit (DEC-616): the value renders as plain text by default;
    // clicking it swaps in an input on the SAME row.
    fireEvent.click(within(dialog).getByText(FULL_CONTACT.bio as string));
    expect((within(dialog).getByDisplayValue(FULL_CONTACT.bio as string) as HTMLTextAreaElement).value).toBe(
      FULL_CONTACT.bio,
    );
  });
});

describe('ContactsApp: headshot upload does not discard unsaved drawer edits (DEC-574)', () => {
  it('keeps the drawer mounted and a typed-but-unsaved bio after a successful headshot upload', async () => {
    mockApi({
      ...baseRoutes(),
      'GET /api/v1/contacts/ct1': FULL_CONTACT,
      'POST /api/v1/contacts/ct1/headshot': {
        ...FULL_CONTACT,
        headshotUrl: 'https://files.example/ada-headshot-new.png',
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
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }));

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText(FULL_CONTACT.bio as string)).toBeInTheDocument();
    });

    // Click into the Bio row (DEC-616: value -> input on the SAME row), then
    // type an edit that is never saved.
    fireEvent.click(within(dialog).getByText(FULL_CONTACT.bio as string));
    const bioField = within(dialog).getByDisplayValue(FULL_CONTACT.bio as string);
    fireEvent.change(bioField, { target: { value: 'An unsaved edit written just before the upload.' } });
    expect(bioField).toHaveValue('An unsaved edit written just before the upload.');

    const fileInput = within(dialog).getByLabelText('Upload headshot') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'new-headshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // The drawer must still be mounted with the headshot updated...
    await waitFor(() => {
      expect(within(dialog).getByAltText('Ada Lovelace headshot')).toHaveAttribute(
        'src',
        'https://files.example/ada-headshot-new.png',
      );
    });
    // ...and the unsaved bio edit must still be there — not discarded by a
    // drawer close-and-reload.
    expect(screen.getByRole('dialog', { name: 'Contact detail' })).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('An unsaved edit written just before the upload.')).toBeInTheDocument();
  });
});

describe('ContactsApp render smoke: ImportWizard', () => {
  it('renders the first step (upload/paste CSV)', async () => {
    mockApi(baseRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));

    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    expect(within(dialog).getByText('Import contacts from CSV')).toBeInTheDocument();
    expect(within(dialog).getByText('Upload a CSV file')).toBeInTheDocument();
    expect(within(dialog).getByText('Or paste CSV text')).toBeInTheDocument();
  });
});

// DEC-827: Speakers links into the importer via ?import=1 -- the wizard
// mounts with the current event preselected, and closing it clears the
// param so a later navigation (e.g. browser back) never replays it. The
// existing 'Import CSV' toolbar button shares this same opener/URL-state
// path (one opener, not two).
describe('ContactsApp: DEC-827 ?import=1 opens the wizard with the current event', () => {
  it('mounts ImportWizard with the current eventId when ?import=1 is present, and clears the param on close', async () => {
    mockApi(baseRoutes());

    render(
      <MemoryRouter initialEntries={[`/contacts?import=1&eventId=${EVENT_ID}`]}>
        <ContactsApp />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    // DEC-827: the wizard opens with the event preselected. w15-c moved the
    // event-scoped session-title field into step 2's match panel (it only
    // appears once eventId is set AND a header row is parsed), so it isn't
    // present on step 1's file/paste screen -- assert the subtitle instead.
    expect(within(dialog).getByText('Import contacts from CSV')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/session title for this batch/i)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Import contacts' })).not.toBeInTheDocument();
    });

    // Reopening via the toolbar button still works through the same
    // opener/URL-state path (one opener, not two).
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    expect(await screen.findByRole('dialog', { name: 'Import contacts' })).toBeInTheDocument();
  });
});

describe('ContactsApp render smoke: BulkEmailModal over a selection', () => {
  it('opens over a selected contact', async () => {
    mockApi({
      ...baseRoutes(),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Select Ada Lovelace')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Select Ada Lovelace'));

    const bulkButton = screen.getByRole('button', { name: 'Bulk email (1)' });
    expect(bulkButton).not.toBeDisabled();
    fireEvent.click(bulkButton);

    const dialog = await screen.findByRole('dialog', { name: 'Bulk email' });
    expect(within(dialog).getByText('1 recipient selected')).toBeInTheDocument();
  });
});
