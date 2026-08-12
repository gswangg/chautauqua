// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke
// coverage for the ContactsApp tab surfaces that the existing CRM-12
// drill-through test (ContactsApp.render.test.tsx) doesn't touch: the
// directory tab (list envelope + StatsStrip), duplicates tab (a
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
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import type { ContactDetail, ContactListItem, DuplicateGroup, Segment } from './types';

const EVENT_ID = 'evt-contacts-tabs-render';

const CONTACTS: ContactListItem[] = [
  { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', title: 'Engineer', submissionCount: 2 },
  { id: 'ct2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', company: 'Navy', title: 'Admiral', submissionCount: 1 },
];

const DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    contactIds: ['ct3', 'ct4'],
    contacts: [
      { id: 'ct3', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@acme.example', company: 'Acme' },
      { id: 'ct4', firstName: 'Sam', lastName: 'Rivera', email: 'sam.r@acmecorp.example', company: 'Acme' },
    ],
  },
];

const SEGMENTS: Segment[] = [{ id: 'seg1', name: 'VIP speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }] }];

const FULL_CONTACT: ContactDetail = {
  id: 'ct1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  company: 'Acme',
  title: 'Engineer',
  phone: '555-0100',
  notes: 'Keynote speaker.',
  bio: 'Pioneering computer scientist and mathematician.',
  headshotUrl: 'https://files.example/ada-headshot.png',
  socialLinks: { twitter: '@ada', linkedin: 'ada-lovelace', github: 'adalovelace', website: 'https://ada.example' },
  customFields: {},
  history: { submissions: [], emails: [], events: [] },
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
});

function baseRoutes() {
  return {
    'GET /api/v1/contacts/stats': {
      total: 2,
      eventCount: 1,
      returningSpeakers: 1,
      topCompanies: [{ company: 'Acme', count: 1 }],
    },
    'GET /api/v1/segments': listEnvelope(SEGMENTS),
    'GET /api/v1/contacts': listEnvelope(CONTACTS),
    'GET /api/v1/contacts/duplicates': listEnvelope(DUPLICATE_GROUPS),
  };
}

describe('ContactsApp render smoke: directory tab', () => {
  it('renders the StatsStrip and the contacts list envelope', async () => {
    mockApi(baseRoutes());

    render(<ContactsApp />);

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace' as unknown as string, { exact: false })).toBeTruthy();
    });

    // Stable markers: StatsStrip KPI + directory rows.
    expect(screen.getByText('Total contacts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acme (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grace Hopper' })).toBeInTheDocument();
  });
});

describe('ContactsApp render smoke: duplicates tab', () => {
  it('renders a same-name+company duplicate group (DEC-143)', async () => {
    mockApi(baseRoutes());

    render(<ContactsApp />);

    fireEvent.click(screen.getByRole('tab', { name: 'Duplicates' }));

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

    render(<ContactsApp />);

    fireEvent.click(screen.getByRole('tab', { name: 'Segments' }));

    await waitFor(() => {
      expect(screen.getByText('VIP speakers', { exact: false })).toBeInTheDocument();
    });
  });
});

describe('ContactsApp render smoke: ContactDrawer', () => {
  it('opens a contact with populated bio/social/headshot fields', async () => {
    mockApi({
      ...baseRoutes(),
      'GET /api/v1/contacts/ct1': FULL_CONTACT,
    });

    render(<ContactsApp />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }));

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Bio')).toHaveValue(FULL_CONTACT.bio);
    });
    expect(within(dialog).getByLabelText('Twitter')).toHaveValue('@ada');
    expect(within(dialog).getByLabelText('LinkedIn')).toHaveValue('ada-lovelace');
    expect(within(dialog).getByAltText('Ada Lovelace headshot')).toHaveAttribute('src', FULL_CONTACT.headshotUrl);
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

    render(<ContactsApp />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }));

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Bio')).toHaveValue(FULL_CONTACT.bio);
    });

    // Type a bio edit that is never saved.
    const bioField = within(dialog).getByLabelText('Bio');
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
    expect(within(dialog).getByLabelText('Bio')).toHaveValue('An unsaved edit written just before the upload.');
  });
});

describe('ContactsApp render smoke: ImportWizard', () => {
  it('renders the first step (upload/paste CSV)', async () => {
    mockApi(baseRoutes());

    render(<ContactsApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));

    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    expect(within(dialog).getByText('Import contacts from CSV')).toBeInTheDocument();
    expect(within(dialog).getByText('Upload a CSV file')).toBeInTheDocument();
    expect(within(dialog).getByText('Or paste CSV text')).toBeInTheDocument();
  });
});

describe('ContactsApp render smoke: BulkEmailModal over a selection', () => {
  it('opens over a selected contact', async () => {
    mockApi({
      ...baseRoutes(),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ContactsApp />);

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
