// Portal editor render tests (Portals frame, flow 2): the rule builder
// (tests, negative tests, valueless tests, "or" groups) and its live
// matches, the matches-nobody panel, per-item settings, field permission
// segments (only decided fields are sent), the Profile basics welcome note,
// and Review and save's two paths -- a change that needs no preview saves
// straight away; one that does opens the change preview, whose email
// choice is sent with the save.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PortalEditorPage } from './PortalEditorPage';
import { errorEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { LibraryEntry, PortalEditorData, PortalImpact } from './types';

const EVENT_ID = 'evt-portal-editor';
const PORTAL_ID = 'portal-invited';
const BASE = `/api/v1/events/${EVENT_ID}/portals/${PORTAL_ID}`;

const RULE_OPTIONS: PortalEditorData['ruleOptions'] = [
  { field: 'kind', label: 'Participation', values: [{ value: 'session', label: 'A role on a session' }, { value: 'company', label: 'Contact at a sponsor' }] },
  {
    field: 'role',
    label: 'Role',
    values: [
      { value: 'speaker', label: 'Speaker' },
      { value: 'moderator', label: 'Moderator' },
      { value: 'panelist', label: 'Panelist' },
      { value: 'volunteer', label: 'Volunteer' },
    ],
  },
  { field: 'arrival', label: 'How the session arrived', values: [{ value: 'cfp', label: 'Through the CFP' }, { value: 'organizer', label: 'Invited by organizers' }] },
  { field: 'format', label: 'Session format', values: [{ value: 'Keynote', label: 'Keynote' }] },
];

function editorData(overrides: { portal?: Partial<PortalEditorData['portal']>; matches?: PortalEditorData['matches']; noteIsWelcome?: boolean } = {}) {
  const portal: PortalEditorData['portal'] = {
    id: PORTAL_ID,
    eventId: EVENT_ID,
    name: 'Invited speakers',
    note: 'As an invited speaker, you’ll confirm your session and share a bio.',
    rule: {
      groups: [
        {
          conditions: [
            { field: 'role', op: 'is_any_of', values: ['speaker', 'moderator'] },
            { field: 'arrival', op: 'is', values: ['organizer'] },
          ],
        },
      ],
    },
    fieldPermissions: { headshot: { level: 'view', help: 'We use the photo from your keynote announcement.' } },
    capabilities: {},
    notifyOnJoin: true,
    template: 'invited_speakers',
    position: 2,
    createdAt: 1,
    updatedAt: 1,
    items: [],
    ...overrides.portal,
  };
  return {
    portal,
    items: [
      {
        id: 'item-accept',
        portalId: PORTAL_ID,
        taskId: null,
        resourceId: null,
        systemKind: 'acceptance' as const,
        displayName: null,
        deadlineKind: 'fixed' as const,
        dueDate: Date.UTC(2027, 2, 15),
        relativeDays: null,
        required: true,
        graceDays: 0,
        allowEditAfterSubmit: false,
        viewOnlyWhenDone: false,
        position: 0,
        title: 'Accept your invitation',
        kind: 'acceptance',
        scope: 'participation',
        libraryHint: 'Built in',
      },
      {
        id: 'item-travel',
        portalId: PORTAL_ID,
        taskId: 'task-travel',
        resourceId: null,
        systemKind: null,
        displayName: null,
        deadlineKind: 'relative' as const,
        dueDate: null,
        relativeDays: 14,
        required: true,
        graceDays: 0,
        allowEditAfterSubmit: false,
        viewOnlyWhenDone: false,
        position: 1,
        title: 'Travel form',
        kind: 'general',
        scope: 'person',
        libraryHint: 'Shared library item',
      },
    ],
    matches: overrides.matches ?? {
      count: 2,
      rows: [
        { key: 'p:1', contactId: 'ct-1', name: 'Priya Raman', participation: 'Panelist · SES-033 Lunch panel: Platform teams' },
        { key: 'p:2', contactId: 'ct-2', name: 'Iris Bell', participation: 'Moderator · SES-033 Lunch panel: Platform teams' },
      ],
      saved: 0,
    },
    ruleText: 'Role is Speaker or Moderator and How the session arrived is Invited by organizers',
    ruleOptions: RULE_OPTIONS,
    fieldLevels: ['hidden', 'view', 'edit'],
    capabilities: ['editSubmission', 'addCoPresenters', 'addTeammates', 'createSponsorSessions'],
    noteIsWelcome: overrides.noteIsWelcome ?? false,
  };
}

function impact(overrides: Partial<PortalImpact> = {}): PortalImpact {
  return {
    affected: 40,
    gain: { count: 32, who: 'keynote speakers', items: [{ title: 'Accept your invitation', people: 32 }, { title: 'Travel form', people: 30 }] },
    lose: { count: 8, who: 'CFP moderators', items: [{ title: 'Panel prep notes', people: 8, filed: 3 }, { title: 'Travel form', people: 8, keptThrough: [{ portal: 'Sponsors', people: 5 }] }] },
    newItems: { people: 30, contactIds: ['ct-1'] },
    permissionChanges: [],
    people: [{ contactId: 'ct-9', name: 'Jordan Alvarez', participation: 'Speaker · SES-001 Opening keynote', change: 'gain' }],
    needsPreview: true,
    ...overrides,
  };
}

const LIBRARY: { entries: LibraryEntry[]; counts: Record<string, number> } = {
  entries: [
    { ref: { taskId: 'task-travel' }, type: 'task', title: 'Travel form', scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [{ id: PORTAL_ID, name: 'Invited speakers' }], direct: false, hint: 'Person · used by Invited speakers' },
    { ref: { taskId: 'task-diet' }, type: 'task', title: 'Dietary needs', scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: 'Person · not used yet' },
    { ref: { taskId: 'task-release' }, type: 'form', title: 'Speaker release', scope: 'participation', instructions: null, formId: 'f-1', acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [{ id: 'p-cfp', name: 'CFP speakers' }], direct: false, hint: 'Participation · used by CFP speakers' },
  ],
  counts: { task: 2, form: 1, file_request: 0, share_kit: 0, resource: 0 },
};

type Calls = ReturnType<typeof mockApi>['mock']['calls'];

function bodiesOf(calls: Calls, method: string, path: string): Record<string, unknown>[] {
  return calls
    .filter(([url, init]) => String(url).split('?')[0] === path && (init?.method ?? 'GET').toUpperCase() === method)
    .map(([, init]) => JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/settings/portals/${PORTAL_ID}`]}>
      <Routes>
        <Route path="/settings/portals/:portalId" element={<PortalEditorPage />} />
        <Route path="/settings/portals" element={<p>Portals overview page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  resetApiCacheForTests();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('PortalEditorPage', () => {
  it('renders the rule, the matches beside it, the items, permissions and note', async () => {
    mockApi({ [`GET ${BASE}`]: editorData() });
    renderPage();

    expect((await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' })).length).toBeGreaterThan(0);
    const matches = screen.getByRole('complementary', { name: 'Matches' });
    expect(within(matches).getByText('Matches now')).toBeInTheDocument();
    expect(within(matches).getByText('2')).toBeInTheDocument();
    expect(within(matches).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute('href', '/contacts/ct-1');
    // multi-portal decision 71: each match previews the portal as that person
    expect(within(matches).getByRole('link', { name: 'Preview the portal as Priya Raman' })).toHaveAttribute(
      'href',
      `/portal/preview/people/${EVENT_ID}/ct-1`,
    );
    expect(within(matches).getByText('Same as the saved rule')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Speaker, Moderator' })).toBeInTheDocument();
    expect(screen.getByText('Items · 2')).toBeInTheDocument();
    expect(screen.getByText('Accept your invitation')).toBeInTheDocument();
    expect(screen.getByLabelText('Days after joining for Travel form')).toHaveValue(14);

    // a set field shows its level; an unset one shows its default
    expect(within(screen.getByRole('group', { name: 'Headshot' })).getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: 'Bio' })).getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: 'Phone number' })).getByRole('button', { name: 'Hidden' })).toHaveAttribute('aria-pressed', 'true');
    // email is never editable
    expect(within(screen.getByRole('group', { name: 'Email' })).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

    // company-only actions on a rule that can't match a sponsor contact
    expect(screen.getAllByText('Sponsor portals only')).toHaveLength(2);
    expect(screen.getByRole('switch', { name: 'Add co-presenters' })).toHaveAttribute('aria-checked', 'false');

    // the note and how it appears under a session
    expect(screen.getByText('Shown under each session or company this portal covers')).toBeInTheDocument();
    expect(screen.getByText('Lunch panel: Platform teams')).toBeInTheDocument();
    // nothing changed yet
    expect(screen.getByRole('button', { name: 'Review and save' })).toBeDisabled();
  });

  it('edits the rule with a negative test and an "or" group, and counts matches live', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/matches`]: {
        count: 5,
        rows: [{ key: 'p:5', contactId: 'ct-5', name: 'Ruth Adeyemi', participation: 'Speaker · SES-061 Invited talk' }],
        gained: 4,
        lost: 1,
      },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });

    fireEvent.change(screen.getAllByLabelText('Test')[1]!, { target: { value: 'is_not' } });
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'POST', `${BASE}/matches`).length).toBe(1));
    const first = bodiesOf(fetchMock.mock.calls, 'POST', `${BASE}/matches`)[0]!;
    expect(first.rule).toEqual({
      groups: [
        {
          conditions: [
            { field: 'role', op: 'is_any_of', values: ['speaker', 'moderator'] },
            { field: 'arrival', op: 'is_not', values: ['organizer'] },
          ],
        },
      ],
    });
    expect(await screen.findByText('2 saved · +4 · −1')).toBeInTheDocument();
    expect(screen.getByText('Preview shows the saved portal until you save.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ruth Adeyemi' })).toBeInTheDocument();

    // "is none of" keeps the chosen values; "is empty" hides the value control
    fireEvent.change(screen.getAllByLabelText('Test')[0]!, { target: { value: 'is_none_of' } });
    expect(screen.getByRole('button', { name: 'Speaker, Moderator' })).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText('Test')[1]!, { target: { value: 'is_empty' } });
    expect(screen.queryByRole('combobox', { name: 'Value' })).not.toBeInTheDocument();

    // an "or" group starts with an unfinished condition, which isn't counted
    fireEvent.click(screen.getByRole('button', { name: 'Add an “or” group' }));
    expect(screen.getByText('Or')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Group 2, all of' })).toBeInTheDocument();
    expect(screen.getByText("Unfinished conditions aren't counted yet.")).toBeInTheDocument();
    const group2 = screen.getByRole('group', { name: 'Group 2, all of' });
    fireEvent.change(within(group2).getByLabelText('Field'), { target: { value: 'format' } });
    fireEvent.change(within(group2).getByLabelText('Value'), { target: { value: 'Keynote' } });
    await waitFor(() => {
      const last = bodiesOf(fetchMock.mock.calls, 'POST', `${BASE}/matches`).at(-1)!;
      expect(last.rule).toEqual({
        groups: [
          {
            conditions: [
              { field: 'role', op: 'is_none_of', values: ['speaker', 'moderator'] },
              { field: 'arrival', op: 'is_empty', values: [] },
            ],
          },
          { conditions: [{ field: 'format', op: 'is', values: ['Keynote'] }] },
        ],
      });
    });
  });

  it('chooses several values from the checkbox list for "is any of"', async () => {
    mockApi({ [`GET ${BASE}`]: editorData(), [`POST ${BASE}/matches`]: { count: 3, rows: [], gained: 1, lost: 0 } });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getByRole('button', { name: 'Speaker, Moderator' }));
    const list = screen.getByRole('group', { name: 'Values' });
    fireEvent.click(within(list).getByLabelText('Panelist'));
    expect(screen.getByRole('button', { name: 'Speaker, Moderator, Panelist' })).toBeInTheDocument();
  });

  it('blocks Review and save on an unfinished condition and names it', async () => {
    const fetchMock = mockApi({ [`GET ${BASE}`]: editorData(), [`POST ${BASE}/matches`]: { count: 2, rows: [], gained: 0, lost: 0 } });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a condition' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    expect(await screen.findByText('One thing needs fixing before this can be saved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a value for Role, or remove that condition.' })).toHaveAttribute('href', '#portal-rule-0-2-value');
    expect(bodiesOf(fetchMock.mock.calls, 'POST', `${BASE}/preview`)).toHaveLength(0);
  });

  it('shows the matches-nobody panel from the rule as saved', async () => {
    mockApi({
      [`GET ${BASE}`]: editorData({
        portal: { name: 'Volunteers', template: null, rule: { groups: [{ conditions: [{ field: 'role', op: 'is', values: ['volunteer'] }] }] } },
        matches: { count: 0, rows: [], saved: 0 },
      }),
    });
    renderPage();
    const panel = await screen.findByRole('complementary', { name: 'Matches' });
    expect(within(panel).getByText('Matches nobody')).toBeInTheDocument();
    expect(within(panel).getByText('No one has the role Volunteer yet.')).toBeInTheDocument();
    expect(within(panel).getByText('It starts working when someone does.')).toBeInTheDocument();
  });

  it('a note-only change saves straight away, without the change preview', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/preview`]: impact({ affected: 0, needsPreview: false }),
      [`PUT ${BASE}`]: { ok: true, joined: 0, left: 0, emailed: 0 },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.change(screen.getByLabelText('Shown under each session or company this portal covers'), { target: { value: 'See you in Lisbon.' } });
    fireEvent.click(screen.getByLabelText('Email people when they start matching this portal later'));
    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)).toHaveLength(1));
    const body = bodiesOf(fetchMock.mock.calls, 'PUT', BASE)[0]!;
    expect(body.note).toBe('See you in Lisbon.');
    expect(body.notifyOnJoin).toBe(false);
    expect(body.notify).toBe('auto');
    // only the field the portal decided is sent
    expect(body.fieldPermissions).toEqual({ headshot: { level: 'view', help: 'We use the photo from your keynote announcement.' } });
    // fixed deadlines travel as a day
    expect((body.items as { dueDate: string | null }[])[0]!.dueDate).toBe('2027-03-15');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  });

  it('a rule change opens the change preview, and the email choice is sent with the save', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/matches`]: { count: 34, rows: [], gained: 32, lost: 0 },
      [`POST ${BASE}/preview`]: impact(),
      [`PUT ${BASE}`]: { ok: true, joined: 32, left: 8, emailed: 30 },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.change(screen.getAllByLabelText('Test')[1]!, { target: { value: 'is_not' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));

    const dialog = await screen.findByRole('dialog', { name: 'This change affects 40 participations' });
    expect(within(dialog).getByText('Invited speakers · nothing is saved yet')).toBeInTheDocument();
    expect(within(dialog).getByText('keynote speakers')).toBeInTheDocument();
    expect(within(dialog).getByText('What the 32 gain')).toBeInTheDocument();
    expect(within(dialog).getByText('2 already have it from another portal')).toBeInTheDocument();
    expect(within(dialog).getByText('3 already filed · answers are kept')).toBeInTheDocument();
    expect(within(dialog).getByText('5 keep it through Sponsors')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'See all 1 person' }));
    expect(within(dialog).getByText('Speaker · SES-001 Opening keynote · Gains this portal')).toBeInTheDocument();

    const notify = within(dialog).getByLabelText('Email the 30 people who get new items');
    expect(notify).toBeChecked();
    fireEvent.click(notify);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and apply to 40' }));
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)).toHaveLength(1));
    expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)[0]!.notify).toBe('none');
    expect(await screen.findByRole('status')).toHaveTextContent('Saved · 32 joined · 8 left · 30 people emailed');
  });

  it('sends notify "all" when the email box stays ticked; Back to editing saves nothing', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/preview`]: impact({ affected: 0, gain: { count: 0, who: '', items: [] }, lose: { count: 0, who: '', items: [] }, newItems: { people: 2, contactIds: ['ct-1', 'ct-2'] }, people: [] }),
      [`PUT ${BASE}`]: { ok: true, joined: 0, left: 0, emailed: 2 },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.change(screen.getByLabelText('Required for Travel form'), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    let dialog = await screen.findByRole('dialog', { name: 'This change gives 2 people new items' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to editing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    dialog = await screen.findByRole('dialog', { name: 'This change gives 2 people new items' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)).toHaveLength(1));
    const body = bodiesOf(fetchMock.mock.calls, 'PUT', BASE)[0]!;
    expect(body.notify).toBe('all');
    expect((body.items as { required: boolean }[])[1]!.required).toBe(false);
  });

  it('per-item settings: a portal-only name, edits after submitting, view-only, remove', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/preview`]: impact({ needsPreview: false }),
      [`PUT ${BASE}`]: { ok: true, joined: 0, left: 0, emailed: 0 },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Options' })[1]!);
    fireEvent.change(screen.getByPlaceholderText('Travel form'), { target: { value: 'Your travel' } });
    fireEvent.click(screen.getByLabelText('Allow edits after submitting'));
    fireEvent.click(screen.getByLabelText('View only once done'));
    expect(screen.getByText("With both on, view only wins: once done, it can't be edited.")).toBeInTheDocument();
    expect(screen.getByText('Your travel')).toBeInTheDocument();
    expect(screen.getByText('Travel form in the library · Shared library item')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Options' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this portal' }));
    expect(screen.queryByText('Accept your invitation')).not.toBeInTheDocument();
    expect(screen.getByText('Items · 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)).toHaveLength(1));
    const items = bodiesOf(fetchMock.mock.calls, 'PUT', BASE)[0]!.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ taskId: 'task-travel', displayName: 'Your travel', allowEditAfterSubmit: true, viewOnlyWhenDone: true, deadlineKind: 'relative', relativeDays: 14 });
  });

  it('permission segments: setting a level sends that field only; a help text rides with it', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/preview`]: impact({ affected: 0, newItems: { people: 0, contactIds: [] }, people: [], gain: { count: 0, who: '', items: [] }, lose: { count: 0, who: '', items: [] } }),
      [`PUT ${BASE}`]: { ok: true, joined: 0, left: 0, emailed: 0 },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    const bio = screen.getByRole('group', { name: 'Bio' });
    fireEvent.click(within(bio).getByRole('button', { name: 'View' }));
    expect(within(bio).getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');
    // a field set back to its default is not sent
    const company = screen.getByRole('group', { name: 'Company' });
    fireEvent.click(within(company).getByRole('button', { name: 'Hidden' }));
    fireEvent.click(within(company).getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add help text' })[4]!);
    fireEvent.change(screen.getByLabelText('Help text beside bio'), { target: { value: 'Two short paragraphs.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    const dialog = await screen.findByRole('dialog', { name: 'This change applies to 2 participations' });
    expect(within(dialog).getByText('Bio: Edit to View')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PUT', BASE)).toHaveLength(1));
    const body = bodiesOf(fetchMock.mock.calls, 'PUT', BASE)[0]!;
    expect(body.fieldPermissions).toEqual({
      headshot: { level: 'view', help: 'We use the photo from your keynote announcement.' },
      bio: { level: 'view', help: 'Two short paragraphs.' },
    });
  });

  it('offers teammates and sponsor sessions once the rule can match a sponsor contact', async () => {
    mockApi({ [`GET ${BASE}`]: editorData({ portal: { rule: { groups: [{ conditions: [{ field: 'kind', op: 'is', values: ['company'] }] }] } } }) });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    expect(screen.queryByText('Sponsor portals only')).not.toBeInTheDocument();
    const teammates = screen.getByRole('switch', { name: 'Add teammates' });
    fireEvent.click(teammates);
    expect(teammates).toHaveAttribute('aria-checked', 'true');
  });

  it('Profile basics: the note is the event welcome note, previewed at the top of a home', async () => {
    mockApi({ [`GET ${BASE}`]: editorData({ portal: { name: 'Profile basics', template: 'profile_basics', note: 'Welcome to the speaker portal!' }, noteIsWelcome: true }) });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Profile basics' });
    expect(screen.getByLabelText('Welcome note · shown at the top of every participant’s home')).toHaveValue('Welcome to the speaker portal!');
    expect(screen.getByText('Top of every home')).toBeInTheDocument();
    expect(screen.getByText('Hi Priya')).toBeInTheDocument();
  });

  it('adds library items: items already here are checked and locked, the button counts new ones', async () => {
    mockApi({ [`GET ${BASE}`]: editorData(), [`GET /api/v1/events/${EVENT_ID}/library`]: LIBRARY });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add from the library' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add items' });
    const travel = await within(dialog).findByLabelText(/Travel form/);
    expect(travel).toBeChecked();
    expect(travel).toBeDisabled();
    expect(within(dialog).getByText('Person · in this portal')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/Dietary needs/));
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Forms' }));
    fireEvent.click(within(dialog).getByLabelText(/Speaker release/));
    fireEvent.change(within(dialog).getByLabelText('Search the library'), { target: { value: 'zzz' } });
    expect(within(dialog).getByText('Nothing here matches.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear the search' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add 2 items' }));
    expect(screen.getByText('Items · 4')).toBeInTheDocument();
    expect(screen.getByText('Dietary needs')).toBeInTheDocument();
    expect(screen.getByText('Shared library item · also in CFP speakers')).toBeInTheDocument();
  });

  it('creates a new library item and adds it; a share kit names its placeholders', async () => {
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`GET /api/v1/events/${EVENT_ID}/library`]: LIBRARY,
      [`POST /api/v1/events/${EVENT_ID}/library`]: { status: 201, body: { taskId: 'task-new', resourceId: null, formId: null } },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add from the library' }));
    const list = await screen.findByRole('dialog', { name: 'Add items' });
    fireEvent.click(await within(list).findByRole('button', { name: 'New item' }));
    let dialog = screen.getByRole('dialog', { name: 'New item' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share kit' }));
    expect(within(dialog).getByText('{name}, {event}, {session} and {link} are filled in for each person who shares it.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'File request' }));
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Panel slides' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'The session or company' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keynote' }));
    fireEvent.change(within(dialog).getByLabelText('Max size'), { target: { value: '200' } });
    expect(within(dialog).getByText('Enforced on upload: PDF or Keynote, up to 200 MB.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create and add' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodiesOf(fetchMock.mock.calls, 'POST', `/api/v1/events/${EVENT_ID}/library`)[0]).toEqual({
      type: 'file_request',
      title: 'Panel slides',
      scope: 'participation',
      instructions: null,
      acceptedTypes: ['pdf', 'keynote'],
      maxSizeMb: 200,
      maxFiles: 1,
      content: null,
    });
    expect(screen.getByText('Panel slides')).toBeInTheDocument();
    expect(screen.getByText('Items · 3')).toBeInTheDocument();
    dialog = screen.queryByRole('dialog') as HTMLElement;
    expect(dialog).toBeNull();
  });

  it('asks before leaving with unsaved edits', async () => {
    mockApi({ [`GET ${BASE}`]: editorData() });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.change(screen.getByLabelText('Shown under each session or company this portal covers'), { target: { value: 'Changed.' } });
    fireEvent.click(screen.getByRole('link', { name: '‹ Portals' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave “Invited speakers” without saving?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getAllByRole('heading', { level: 1, name: 'Invited speakers' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Leave “Invited speakers” without saving?' })).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByText('Portals overview page')).toBeInTheDocument();
  });

  it('deletes only after the name is typed, then returns to the overview', async () => {
    const fetchMock = mockApi({ [`GET ${BASE}`]: editorData(), [`DELETE ${BASE}`]: { ok: true, detached: 3 } });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete portal' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Invited speakers”?' });
    expect(within(dialog).getByText(/Work people already finished stays on their records/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Delete portal' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Type the portal name to confirm'), { target: { value: 'Invited speakers' } });
    fireEvent.click(confirm);
    expect(await screen.findByText('Portals overview page')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === BASE && init?.method === 'DELETE')).toBe(true);
  });

  it('warns more strongly before deleting Profile basics', async () => {
    mockApi({ [`GET ${BASE}`]: editorData({ portal: { name: 'Profile basics', template: 'profile_basics' }, noteIsWelcome: true }) });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Profile basics' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete portal' }));
    expect(screen.getByText(/Profile basics carries the event’s welcome note/)).toBeInTheDocument();
  });

  it('duplicates into a copy with an empty rule and opens it', async () => {
    const copyBase = `/api/v1/events/${EVENT_ID}/portals/portal-copy`;
    const fetchMock = mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/duplicate`]: { status: 201, body: { id: 'portal-copy' } },
      [`GET ${copyBase}`]: editorData({ portal: { id: 'portal-copy', name: 'Invited speakers (copy)', template: null, rule: { groups: [] } }, matches: { count: 0, rows: [], saved: 0 } }),
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    const dialog = screen.getByRole('dialog', { name: 'Duplicate “Invited speakers”?' });
    expect(within(dialog).getByText(/starts with an empty rule/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duplicate portal' }));
    expect((await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers (copy)' })).length).toBeGreaterThan(0);
    expect(screen.getByText(/No conditions yet, so this portal matches nobody/)).toBeInTheDocument();
    expect(screen.getByLabelText('Portal name')).toHaveValue('Invited speakers (copy)');
    expect(fetchMock.mock.calls.some(([url]) => String(url) === copyBase)).toBe(true);
  });

  it('a refused preview or save shows the server’s own reason, and keeps the edits', async () => {
    mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/preview`]: { status: 400, body: errorEnvelope('invalid', 'An item isn’t in this event’s library.', { items: 'An item isn’t in this event’s library.' }) },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.change(screen.getByLabelText('Shown under each session or company this portal covers'), { target: { value: 'Changed.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An item isn’t in this event’s library.');
    expect(screen.getByLabelText('Shown under each session or company this portal covers')).toHaveValue('Changed.');
  });

  it('a refused save inside the change preview shows there', async () => {
    mockApi({
      [`GET ${BASE}`]: editorData(),
      [`POST ${BASE}/matches`]: { count: 34, rows: [], gained: 32, lost: 0 },
      [`POST ${BASE}/preview`]: impact(),
      [`PUT ${BASE}`]: { status: 400, body: errorEnvelope('invalid', 'A portal can have at most 40 items.') },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.change(screen.getAllByLabelText('Test')[1]!, { target: { value: 'is_not' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review and save' }));
    const dialog = await screen.findByRole('dialog', { name: 'This change affects 40 participations' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and apply to 40' }));
    expect(await within(dialog).findByText('A portal can have at most 40 items.')).toBeInTheDocument();
  });

  it('NewLibraryItemModal: a refused name shows under the Name field', async () => {
    mockApi({
      [`GET ${BASE}`]: editorData(),
      [`GET /api/v1/events/${EVENT_ID}/library`]: LIBRARY,
      [`POST /api/v1/events/${EVENT_ID}/library`]: {
        status: 409,
        body: errorEnvelope('conflict', 'The library already has an item with that name.', { title: 'Already in the library' }),
      },
    });
    renderPage();
    await screen.findAllByRole('heading', { level: 1, name: 'Invited speakers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add from the library' }));
    const list = await screen.findByRole('dialog', { name: 'Add items' });
    fireEvent.click(await within(list).findByRole('button', { name: 'New item' }));
    const dialog = screen.getByRole('dialog', { name: 'New item' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Travel form' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create and add' }));
    expect(await within(dialog).findByText('The library already has an item with that name.')).toBeInTheDocument();
  });

  it('shows a not-found state for a portal that does not exist', async () => {
    mockApi({ [`GET ${BASE}`]: { status: 404, body: errorEnvelope('not_found', 'Portal not found') } });
    renderPage();
    expect((await screen.findAllByRole('heading', { level: 1, name: 'Portal not found' })).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Back to portals' })).toHaveAttribute('href', '/settings/portals');
  });
});
