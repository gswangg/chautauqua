// w3-c/DEC-747 render smoke test, updated w6-e/DEC-815: PortalSettingsPanel
// is now a read-only summary (SummarySection) -- Welcome note, Speakers
// can edit (pills), Onboarding tasks, Resources, Access, and an 'Open as
// a speaker' row-level link -- until the 'Change' action drills into
// (?section=portal&edit=1) the one real edit surface, ResourcesPanel
// (unchanged endpoints/CRUD).
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
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: {
      tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      rows: [],
      total: 0,
      page: 1,
      perPage: 1,
      counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([
      { id: 'res1', kind: 'wiki', title: 'Travel info', content: 'Fly into AUS. Rideshare is easiest.', fileId: null, position: 0 },
      { id: 'res2', kind: 'file', title: 'Slide template', content: null, fileId: 'file1', position: 1 },
    ]),
    ...overrides,
  });
}

describe('PortalSettingsPanel (Speaker portal read view)', () => {
  // DEC-815 amendment (wave 4): the Resources row LISTS the real resources
  // at rest instead of describing the set in a sentence; only add/delete
  // controls stay behind Change.
  it('renders every row of the read view from real data, listing the real resources, with Open as a speaker as a row-level link and no resource add/delete control before edit', async () => {
    mockPortal();
    render(
      <MemoryRouter>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Speaker portal' });
    expect(within(section).getByRole('heading', { name: 'Speaker portal' })).toBeInTheDocument();
    const openAsSpeaker = within(section).getByRole('link', { name: 'Open as a speaker' });
    expect(openAsSpeaker).toHaveAttribute('href', `/portal/preview?eventId=${EVENT_ID}`);
    expect(within(section).getByText("read-only preview · not a speaker's account")).toBeInTheDocument();

    await waitFor(() => {
      expect(within(section).getByText('Shown above the task list · 2 paragraphs')).toBeInTheDocument();
    });
    expect(within(section).getByText('3 tasks · created when a submission is accepted')).toBeInTheDocument();
    expect(
      within(section).getByText('Speakers claim their portal from a link in their acceptance email'),
    ).toBeInTheDocument();

    // Speakers-can-edit pills: filled for the always-editable profile
    // fields, outline for the gated session fields.
    expect(within(section).getByText('Bio')).toHaveClass('is-active');
    expect(within(section).getByText('Headshot')).toHaveClass('is-active');
    expect(within(section).getByText('Links')).toHaveClass('is-active');
    expect(within(section).getByText('Session title')).not.toHaveClass('is-active');
    expect(within(section).getByText('Abstract')).not.toHaveClass('is-active');

    // Resources row: the real rows list at rest (title + kind), but no
    // add/delete control until Change is clicked.
    expect(await within(section).findByText('Travel info')).toBeInTheDocument();
    expect(within(section).getByText('Wiki page')).toBeInTheDocument();
    expect(within(section).getByText('Slide template')).toBeInTheDocument();
    expect(within(section).getByText(/^File/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/files/file1');
    expect(within(section).queryByRole('button', { name: 'Add a resource' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
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

    const section = await screen.findByRole('region', { name: 'Speaker portal' });
    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(screen.getByText('Travel info')).toBeInTheDocument();
    });
    // DEC-728 amendment (wave 15): the section's OWN drill action relabels
    // to 'Back' rather than disappearing. DEC-785 amendment (wave 66): the
    // local summary/edit split ResourcesPanel used to own is REMOVED --
    // ResourcesPanel now mounts straight into its full CRUD surface, with
    // no second 'Change' of its own.
    expect(within(section).getByRole('button', { name: 'Back' })).toBeInTheDocument();

    expect(screen.getByText('6 words')).toBeInTheDocument();
    expect(screen.queryByText(/Fly into AUS/)).not.toBeInTheDocument();
    expect(screen.getByText('Slide template')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    const travelRow = screen.getByText('Travel info').closest('li')!;
    expect(within(travelRow).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    const slideRow = screen.getByText('Slide template').closest('li')!;
    expect(within(slideRow).queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add a resource' }));
    fireEvent.change(screen.getAllByPlaceholderText('Title')[0]!, { target: { value: 'New page' } });
    fireEvent.change(screen.getByPlaceholderText('Content'), { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add wiki page' }));

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
  it('renders the branding/welcome edit controls prefilled from the GET, above the Resources sub-panel', async () => {
    mockPortal();
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const welcome = await screen.findByLabelText('Welcome note');
    expect(welcome).toHaveValue('Welcome, speakers!\n\nWe cannot wait to see you.');
    expect(screen.getByLabelText('Logo URL')).toHaveValue('');
    expect(screen.getByLabelText('Accent colour')).toHaveValue('');
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBe(1);
      const [, init] = putCalls[0]!;
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual(
        buildPortalSettingsPayload({
          logoUrl: '',
          accentColor: '',
          welcomeMessage: 'Hello there',
          showResources: true,
        }),
      );
    });
  });

  it('blocks the PUT and shows an inline error for an invalid accent colour', async () => {
    const fetchMock = mockPortal();
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const accent = await screen.findByLabelText('Accent colour');
    fireEvent.change(accent, { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Must be a hex color like #336699');

    const putCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCalls.length).toBe(0);
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
          accentColor: 'Must be a hex color like #336699',
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBe(1);
    });

    expect(await screen.findByText('Must be a hex color like #336699')).toBeInTheDocument();
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
      expect(
        screen.getByText(
          'Title and abstract stay organiser-only — a speaker editing them after acceptance would change what was accepted.',
        ),
      ).toBeInTheDocument();

      // w4-b: the edit form's own 'What speakers may edit' section renders
      // the SAME pill array as the read row -- Bio/Headshot/Links active,
      // Session title/Abstract inactive.
      expect(screen.getByText('What speakers may edit')).toBeInTheDocument();
      expect(screen.getByText('Bio')).toHaveClass('is-active');
      expect(screen.getByText('Headshot')).toHaveClass('is-active');
      expect(screen.getByText('Links')).toHaveClass('is-active');
      expect(screen.getByText('Session title')).not.toHaveClass('is-active');
      expect(screen.getByText('Abstract')).not.toHaveClass('is-active');

      const footer = document.querySelector('.chq-settings-edit-footer') as HTMLElement;
      expect(footer).not.toBeNull();
      expect(footer.querySelector('.chq-settings-edit-footer-destructive')).toBeNull();
      const secondaryButton = within(footer).getByRole('button', { name: 'Cancel' });
      const primaryButton = within(footer).getByRole('button', { name: 'Save' });
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
