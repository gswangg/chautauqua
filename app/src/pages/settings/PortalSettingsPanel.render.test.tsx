// w3-c/DEC-747 render smoke test, updated w6-e/DEC-815 and for multi-portal:
// PortalSettingsPanel is the Settings "Portals" section -- a read-only
// summary of the event's portals, coverage, item library, access and
// welcome note (with 'Preview the portal'), whose head action links to the
// Portals sub-page. The Welcome note row's 'Change' drills into
// (?section=portal&edit=1) the welcome form above ResourcesPanel
// (unchanged endpoints/CRUD). Multi-portal decision 72 removed the
// Branding row: the portal has no logo or accent for now.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PortalSettingsPanel } from './PortalSettingsPanel';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
import { buildPortalSettingsPayload } from './formState';

const EVENT_ID = 'evt-portal';

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
  cleanup();
});

function mockPortal(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!\n\nWe cannot wait to see you.',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/portals`]: {
      portals: [
        { id: 'p1', name: 'Profile basics', template: 'profile_basics', who: '', participations: 91, items: 2, matchesNobody: false, createdAt: 0 },
        { id: 'p2', name: 'CFP speakers', template: null, who: '', participations: 31, items: 5, matchesNobody: false, createdAt: 0 },
      ],
      covered: 91,
      total: 96,
      notInAny: 5,
      overlap: 38,
      templates: [],
    },
    [`GET /api/v1/events/${EVENT_ID}/library`]: { counts: { task: 2, form: 0, file_request: 1, share_kit: 0, resource: 1 }, entries: [
      { ref: { taskId: 't1' }, type: 'task', title: 'AV needs', scope: 'participation', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
      { ref: { taskId: 't2' }, type: 'task', title: 'Speaker release', scope: 'participation', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
      { ref: { taskId: 't3' }, type: 'file_request', title: 'Final slides', scope: 'participation', instructions: null, formId: null, acceptedTypes: ['pdf'], maxSizeMb: 200, maxFiles: 1, usedBy: [], direct: false, hint: '' },
      { ref: { resourceId: 'res1' }, type: 'resource', title: 'Travel info', scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
      { ref: { systemKind: 'bio' }, type: 'built_in', title: 'Bio', scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
    ] },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([
      { id: 'res1', kind: 'wiki', title: 'Travel info', content: 'Fly into AUS. Rideshare is easiest.', fileId: null, position: 0 },
      { id: 'res2', kind: 'file', title: 'Slide template', content: null, fileId: 'file1', position: 1 },
    ]),
    ...overrides,
  });
}

describe('PortalSettingsPanel (Speaker portal read view)', () => {
  it('summarises the portals, coverage, library, access and branding, and links to the Portals sub-page', async () => {
    mockPortal();
    render(
      <MemoryRouter>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Portals' });
    expect(within(section).getByRole('heading', { name: 'Portals' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Manage portals' })).toBeInTheDocument();

    expect(await within(section).findByText('2 · Profile basics, CFP speakers')).toBeInTheDocument();
    expect(within(section).getByText('91 of 96 participations covered')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: '5 not in any portal' })).toHaveAttribute('href', '/speakers?portal=none');
    // built-in items (Bio) aren't counted as the organizer's library
    expect(within(section).getByText('2 tasks · 1 file request · 1 resource')).toBeInTheDocument();
    expect(
      within(section).getByText('Participants claim their portal from a link in their acceptance or invitation email'),
    ).toBeInTheDocument();

    // the preview covers every portal (multi-portal decision 71); it sits on
    // the Welcome note row now that the Branding row is gone (decision 72)
    const previewLink = within(section).getByRole('link', { name: 'Preview the portal' });
    expect(previewLink).toHaveAttribute('href', `/portal/preview?eventId=${EVENT_ID}`);
    expect(within(section).queryByText('Branding')).not.toBeInTheDocument();
    expect(within(section).queryByText(/accent/)).not.toBeInTheDocument();

    // the welcome note (Profile basics' note, the same stored value)
    expect(within(section).getByText('Shown above the task list · 2 paragraphs')).toBeInTheDocument();
    // what speakers may edit and the onboarding items live in the portals
    expect(within(section).queryByText('Speakers can edit')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Add a resource' })).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('drills into ResourcesPanel via Change, and adds/edits a resource there', async () => {
    const fetchMock = mockPortal({
      'POST /api/v1/events/evt-portal/resources': {
        status: 201,
        body: { id: 'res3', kind: 'wiki', title: 'New page', content: 'Hello there', fileId: null, position: 2 },
      },
      'PATCH /api/v1/resources/res1': {
        id: 'res1',
        kind: 'wiki',
        title: 'Travel info',
        content: 'Updated content here',
        fileId: null,
        position: 0,
      },
    });
    render(
      <MemoryRouter>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Portals' });
    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(screen.getByText('Travel info')).toBeInTheDocument();
    });
    // w7-c/DEC-728 amendment: docs/design/Chautauqua Settings.dc.html
    // :894-895 draws no panel head at all in the edit view -- the section's
    // own 'Change'/'Back' action and <h2> are hidden while editing
    // (SummarySection.tsx); the sole back control is the shell's
    // `‹ Speaker portal` link. DEC-785 amendment (wave 66): the local
    // summary/edit split ResourcesPanel used to own is REMOVED --
    // ResourcesPanel now mounts straight into its full CRUD surface, with
    // no second 'Change' of its own.
    expect(within(section).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    expect(screen.getByText('6 words')).toBeInTheDocument();
    expect(screen.queryByText(/Fly into AUS/)).not.toBeInTheDocument();
    expect(screen.getByText('Slide template')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    const travelRow = screen.getByText('Travel info').closest('li')!;
    expect(within(travelRow).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    const slideRow = screen.getByText('Slide template').closest('li')!;
    expect(within(slideRow).queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add a resource' }));
    // DEC-650 wave-130: the add-resource dialog names its field `Name` (the
    // placeholder that merely repeated the label is gone) and draws ONE
    // primary, `Add it`, for both resource kinds.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New page' } });
    fireEvent.change(screen.getByPlaceholderText('Content'), { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCalls.length).toBe(1);
    });

    fireEvent.click(within(travelRow).getByRole('button', { name: 'Replace' }));
    await waitFor(() => {
      expect(within(travelRow).getByDisplayValue('Travel info')).toBeInTheDocument();
    });
  });

  // DEC-988: the edit form above ResourcesPanel -- the round trip this
  // panel was missing before this task.
  it('renders the welcome edit controls prefilled from the GET, above the Resources sub-panel', async () => {
    mockPortal();
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const welcome = await screen.findByLabelText('Welcome note');
    expect(welcome).toHaveValue('Welcome, speakers!\n\nWe cannot wait to see you.');
    expect(screen.getByRole('checkbox', { name: 'Show resources' })).toBeChecked();

    await waitFor(() => {
      expect(screen.getByText('Travel info')).toBeInTheDocument();
    });
  });

  it('edits the welcome note and issues exactly one PUT with buildPortalSettingsPayload output', async () => {
    const fetchMock = mockPortal({
      [`PUT /api/v1/events/${EVENT_ID}/portal-settings`]: {
        welcomeMessage: 'Hello there',
        logoUrl: null,
        accentColor: null,
        showResources: true,
      },
    });
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const welcome = await screen.findByLabelText('Welcome note');
    fireEvent.change(welcome, { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBe(1);
      const [, init] = putCalls[0]!;
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual(
        buildPortalSettingsPayload({
          welcomeMessage: 'Hello there',
          showResources: true,
        }),
      );
    });
  });

  it('offers no logo or accent field (multi-portal decision 72: the portal has no branding for now)', async () => {
    mockPortal();
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Welcome note');
    expect(screen.queryByLabelText('Logo URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Accent colour')).not.toBeInTheDocument();
  });

  // DEC-958: the server's fields map merges into formErrors (the SAME
  // state the client-side validator populates) instead of collapsing into
  // the single top-of-form saveError sentence -- each named field renders
  // its own message.
  it('merges a server fields-map refusal into the named field hints, not the generic banner', async () => {
    const fetchMock = mockPortal({
      [`PUT /api/v1/events/${EVENT_ID}/portal-settings`]: {
        status: 400,
        body: errorEnvelope('validation_error', 'Invalid portal settings', {
          showResources: 'Must be a boolean',
          welcomeMessage: 'Max 20000 characters',
        }),
      },
    });
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const welcome = await screen.findByLabelText('Welcome note');
    fireEvent.change(welcome, { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBe(1);
    });

    expect(await screen.findByText('Must be a boolean')).toBeInTheDocument();
    expect(screen.getByText('Max 20000 characters')).toBeInTheDocument();
    // The generic banner never fires alongside a fields-map refusal --
    // there is no third "Invalid portal settings" sentence rendered.
    expect(screen.queryByText('Invalid portal settings')).not.toBeInTheDocument();
  });

  // DEC-896 amendment (wave 26): the shared settings edit shell (B10).
  describe('edit view shell (DEC-896)', () => {
    it('renders the footer as secondary-then-primary in DOM order, no full-width buttons, and the portal consequence line', async () => {
      mockPortal();
      render(
        <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
          <PortalSettingsPanel />
        </MemoryRouter>,
      );

      await screen.findByLabelText('Welcome note');
      // multi-portal: what participants may edit is set per portal now; the
      // consequence line says where
      const consequence = document.querySelector('.chq-settings-edit-consequence') as HTMLElement;
      expect(consequence).toHaveTextContent("What participants may edit, and what they're asked for, is set per portal in Manage portals.");
      expect(within(consequence).getByRole('link', { name: 'Manage portals' })).toHaveAttribute('href', '/settings/portals');
      expect(screen.queryByText('What speakers may edit')).not.toBeInTheDocument();

      const footer = document.querySelector('.chq-settings-edit-footer') as HTMLElement;
      expect(footer).not.toBeNull();
      expect(footer.querySelector('.chq-settings-edit-footer-destructive')).toBeNull();
      const secondaryButton = within(footer).getByRole('button', { name: 'Cancel' });
      const primaryButton = within(footer).getByRole('button', { name: 'Save changes' });
      const order = Array.from(footer.querySelectorAll('button'));
      expect(order.indexOf(secondaryButton as HTMLButtonElement)).toBeLessThan(
        order.indexOf(primaryButton as HTMLButtonElement),
      );
      for (const button of order) {
        expect(button.className).not.toMatch(/full-width|btn-full/);
      }
    });

    it('Cancel returns to the read-only summary', async () => {
      mockPortal();
      render(
        <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
          <PortalSettingsPanel />
        </MemoryRouter>,
      );

      await screen.findByLabelText('Welcome note');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
      });
      expect(screen.queryByLabelText('Welcome note')).not.toBeInTheDocument();
    });
  });
});
