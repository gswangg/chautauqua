// Settings · Portals › Libraries render tests: the library grouped by type
// with scope, instructions, file limits, "Used by" portal links and the
// "Assigned directly" marker; editing a task (EditLibraryItemModal) and a
// refused rename; a resource's visibility (and a refused change); and a
// new item saved from here (NewLibraryItemModal, no add-to-portal step).
// Multi-portal decision 74: resources are made, edited
// (EditLibraryResourceModal) and deleted here -- a page or an uploaded file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { LibraryPage } from './LibraryPage';
import { errorEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { LibraryEntry, LibraryListing } from './types';

const EVENT_ID = 'evt-library';
const LIB = `/api/v1/events/${EVENT_ID}/library`;

function entry(overrides: Partial<LibraryEntry> & Pick<LibraryEntry, 'ref' | 'type' | 'title'>): LibraryEntry {
  return {
    scope: 'person',
    instructions: null,
    formId: null,
    acceptedTypes: null,
    maxSizeMb: null,
    maxFiles: null,
    usedBy: [],
    direct: false,
    hint: '',
    ...overrides,
  };
}

function listing(): LibraryListing {
  return {
    entries: [
      entry({ ref: { systemKind: 'acceptance' }, type: 'built_in', title: 'Accept your invitation', scope: 'participation', hint: 'Built in · invited participations', usedBy: [{ id: 'p-inv', name: 'Invited speakers' }] }),
      entry({ ref: { taskId: 't-av' }, type: 'task', title: 'AV needs', scope: 'participation', instructions: 'Mics, adapters, a clicker.', usedBy: [{ id: 'p-cfp', name: 'CFP speakers' }] }),
      entry({ ref: { taskId: 't-announce' }, type: 'task', title: 'Announce participation', direct: true }),
      entry({ ref: { taskId: 't-slides' }, type: 'file_request', title: 'Final slides', scope: 'participation', acceptedTypes: ['pdf', 'keynote', 'powerpoint'], maxSizeMb: 200, maxFiles: 2, usedBy: [{ id: 'p-cfp', name: 'CFP speakers' }, { id: 'p-inv', name: 'Invited speakers' }] }),
      entry({ ref: { taskId: 't-share' }, type: 'share_kit', title: 'Share your talk', scope: 'participation', instructions: "I'm speaking at {event}: {session}. {link}" }),
      entry({ ref: { resourceId: 'r-hb' }, type: 'resource', title: 'Speaker Handbook', direct: true, hint: 'Everyone’s resources', resource: { kind: 'wiki', content: '# Welcome', fileName: null } }),
      entry({ ref: { resourceId: 'r-tpl' }, type: 'resource', title: 'Slide template', hint: 'Only in CFP speakers', visibility: 'portal', usedBy: [{ id: 'p-cfp', name: 'CFP speakers' }], resource: { kind: 'file', content: null, fileName: 'template.pptx' } }),
    ],
    counts: { task: 2, form: 0, file_request: 1, share_kit: 1, resource: 2 },
  };
}

type Calls = ReturnType<typeof mockApi>['mock']['calls'];

function bodiesOf(calls: Calls, method: string, path: string): Record<string, unknown>[] {
  return calls
    .filter(([url, init]) => String(url).split('?')[0] === path && (init?.method ?? 'GET').toUpperCase() === method)
    .map(([, init]) => JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/settings/portals/library']}>
      <LibraryPage />
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

describe('LibraryPage', () => {
  it('groups every item by type with what it is about, its limits and the portals that use it', async () => {
    mockApi({ [`GET ${LIB}`]: listing() });
    renderPage();
    expect(await screen.findByText('Tasks · 2')).toBeInTheDocument();
    expect(screen.getByText('File requests · 1')).toBeInTheDocument();
    expect(screen.getByText('Share kits · 1')).toBeInTheDocument();
    expect(screen.getByText('Resources · 2')).toBeInTheDocument();
    expect(screen.getByText('Built in · 1')).toBeInTheDocument();
    // a type with nothing in it has no group
    expect(screen.queryByText(/^Forms · /)).not.toBeInTheDocument();

    expect(screen.getByText('Mics, adapters, a clicker.')).toBeInTheDocument();
    expect(screen.getByText('About the session or company · PDF, Keynote or PowerPoint, up to 200 MB, 2 files')).toBeInTheDocument();
    const slides = screen.getByText('Final slides').closest('li')!;
    expect(within(slides).getByRole('link', { name: 'CFP speakers' })).toHaveAttribute('href', '/settings/portals/p-cfp');
    expect(within(slides).getByRole('link', { name: 'Invited speakers' })).toHaveAttribute('href', '/settings/portals/p-inv');

    const announce = screen.getByText('Announce participation').closest('li')!;
    expect(within(announce).getByText('Assigned directly')).toBeInTheDocument();
    expect(within(announce).getByText('In no portal yet')).toBeInTheDocument();

    // built-ins have no Edit
    const accept = screen.getByText('Accept your invitation').closest('li')!;
    expect(within(accept).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(within(accept).getByText('Built in · invited participations')).toBeInTheDocument();
  });

  it('a form item links to its own questions in the form builder', async () => {
    const withForm = listing();
    withForm.entries.push(entry({ ref: { taskId: 't-travel' }, type: 'form', title: 'Travel form', formId: 'f-travel' }));
    withForm.counts.form = 1;
    mockApi({ [`GET ${LIB}`]: withForm });
    renderPage();
    expect(await screen.findByText('Forms · 1')).toBeInTheDocument();
    const travel = screen.getByText('Travel form').closest('li')!;
    expect(within(travel).getByRole('link', { name: 'Edit the questions in Travel form' })).toHaveAttribute(
      'href',
      '/submissions/forms?form=f-travel',
    );
    // other kinds have no questions to build
    const av = screen.getByText('AV needs').closest('li')!;
    expect(within(av).queryByRole('link', { name: /Edit the questions/ })).not.toBeInTheDocument();
  });

  it('EditLibraryItemModal: edits a file request’s name, instructions and limits', async () => {
    const fetchMock = mockApi({ [`GET ${LIB}`]: listing(), [`PATCH ${LIB}/tasks/t-slides`]: { ok: true } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Final slides' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Final slides' });
    expect(within(dialog).getByText('File request · changes reach 2 portals that list it')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Final deck' } });
    fireEvent.change(within(dialog).getByLabelText(/Instructions/), { target: { value: '16:9, please.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'PowerPoint' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'The person' }));
    expect(within(dialog).getByText(/This moves the item between the profile area and the session sections/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodiesOf(fetchMock.mock.calls, 'PATCH', `${LIB}/tasks/t-slides`)[0]).toEqual({
      title: 'Final deck',
      scope: 'person',
      instructions: '16:9, please.',
      acceptedTypes: ['pdf', 'keynote'],
      maxSizeMb: 200,
      maxFiles: 2,
    });
    expect(screen.getByText('Final deck saved')).toBeInTheDocument();
  });

  it('EditLibraryItemModal: a refused rename shows under the name', async () => {
    mockApi({
      [`GET ${LIB}`]: listing(),
      [`PATCH ${LIB}/tasks/t-av`]: { status: 409, body: errorEnvelope('conflict', 'The library already has an item with that name.', { title: 'Already in the library' }) },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit AV needs' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit AV needs' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Final slides' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save item' }));
    expect(await within(dialog).findByText('The library already has an item with that name.')).toBeInTheDocument();
  });

  it('a resource is shown to everyone or only through the portals that list it', async () => {
    const fetchMock = mockApi({ [`GET ${LIB}`]: listing(), [`PATCH ${LIB}/resources/r-hb`]: { ok: true } });
    renderPage();
    const group = await screen.findByRole('group', { name: 'Who sees Speaker Handbook' });
    expect(within(group).getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'Only portals that list it' }));
    expect(within(group).getByRole('button', { name: 'Only portals that list it' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PATCH', `${LIB}/resources/r-hb`)[0]).toEqual({ visibility: 'portal' }));
  });

  it('a refused visibility change puts the choice back and says why', async () => {
    mockApi({
      [`GET ${LIB}`]: listing(),
      [`PATCH ${LIB}/resources/r-hb`]: { status: 404, body: errorEnvelope('not_found', 'Resource not found') },
    });
    renderPage();
    const group = await screen.findByRole('group', { name: 'Who sees Speaker Handbook' });
    fireEvent.click(within(group).getByRole('button', { name: 'Only portals that list it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Resource not found');
    expect(within(group).getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('NewLibraryItemModal: saves a new item to the library only', async () => {
    const fetchMock = mockApi({
      [`GET ${LIB}`]: listing(),
      [`POST ${LIB}`]: { status: 201, body: { taskId: 't-new', resourceId: null, formId: null } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = screen.getByRole('dialog', { name: 'New item' });
    expect(within(dialog).getByText('Saved to the library; add it to portals from their editors')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resource' }));
    expect(within(dialog).queryByRole('group', { name: 'About' })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Venue map' } });
    fireEvent.change(within(dialog).getByLabelText('Page'), { target: { value: '# Getting here' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodiesOf(fetchMock.mock.calls, 'POST', LIB)[0]).toEqual({
      type: 'resource',
      title: 'Venue map',
      scope: 'person',
      instructions: null,
      acceptedTypes: null,
      maxSizeMb: null,
      maxFiles: null,
      content: '# Getting here',
    });
    expect(screen.getByText('Venue map added to the library')).toBeInTheDocument();
  });

  it('NewLibraryItemModal: a new form opens its own questions in the form builder', async () => {
    mockApi({
      [`GET ${LIB}`]: listing(),
      [`POST ${LIB}`]: { status: 201, body: { taskId: 't-form', resourceId: null, formId: 'f-new' } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = screen.getByRole('dialog', { name: 'New item' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Form' }));
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Dietary needs' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    const saved = await screen.findByRole('dialog', { name: 'Form saved' });
    expect(within(saved).getByRole('link', { name: 'Open the form builder' })).toHaveAttribute('href', '/submissions/forms?form=f-new');
    fireEvent.click(within(saved).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('resources (multi-portal decision 74)', () => {
    it('says whether each resource is a page or a file', async () => {
      mockApi({ [`GET ${LIB}`]: listing() });
      renderPage();
      expect(await screen.findByText('A page participants read')).toBeInTheDocument();
      expect(screen.getByText('A file participants download · template.pptx')).toBeInTheDocument();
    });

    it('NewLibraryItemModal: uploads a file resource, shown only through the portals that list it', async () => {
      const fetchMock = mockApi({
        [`GET ${LIB}`]: listing(),
        [`POST /api/v1/events/${EVENT_ID}/resources`]: { status: 201, body: { id: 'r-new' } },
      });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'New item' }));
      const dialog = screen.getByRole('dialog', { name: 'New item' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Resource' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Upload a file' }));
      fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Venue map' } });
      // a file is required
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
      expect(await within(dialog).findByText('Choose the file participants download.')).toBeInTheDocument();
      const file = new File(['map'], 'venue.pdf', { type: 'application/pdf' });
      fireEvent.change(within(dialog).getByLabelText('File'), { target: { files: [file] } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const upload = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith(`/events/${EVENT_ID}/resources`) && init?.method === 'POST');
      const form = upload![1]!.body as FormData;
      expect(form.get('title')).toBe('Venue map');
      expect((form.get('file') as File).name).toBe('venue.pdf');
      expect(form.get('visibility')).toBe('portal');
      expect(screen.getByText('Venue map added to the library')).toBeInTheDocument();
    });

    it('EditLibraryResourceModal: edits a page, and shows a refusal from the server', async () => {
      const fetchMock = mockApi({
        [`GET ${LIB}`]: listing(),
        [`PATCH /api/v1/resources/r-hb`]: { status: 400, body: errorEnvelope('invalid', 'The page is too long.', { content: 'The page is too long.' }) },
      });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit Speaker Handbook' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit Speaker Handbook' });
      expect(within(dialog).getByLabelText('Page')).toHaveValue('# Welcome');
      fireEvent.change(within(dialog).getByLabelText('Page'), { target: { value: '# Welcome to DevFlow' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save resource' }));
      expect(await within(dialog).findByText('The page is too long.')).toBeInTheDocument();
      expect(bodiesOf(fetchMock.mock.calls, 'PATCH', '/api/v1/resources/r-hb')[0]).toEqual({ title: 'Speaker Handbook', content: '# Welcome to DevFlow' });
    });

    it('EditLibraryResourceModal: a file resource renames only, and keeps its file', async () => {
      const fetchMock = mockApi({ [`GET ${LIB}`]: listing(), [`PATCH /api/v1/resources/r-tpl`]: { ok: true } });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit Slide template' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit Slide template' });
      expect(within(dialog).queryByLabelText('Page')).not.toBeInTheDocument();
      expect(within(dialog).getByText(/The file is template\.pptx/)).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Slide template 2027' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save resource' }));
      await waitFor(() => expect(bodiesOf(fetchMock.mock.calls, 'PATCH', '/api/v1/resources/r-tpl')[0]).toEqual({ title: 'Slide template 2027' }));
    });

    it('deletes a resource after typing its name, saying which portals it leaves', async () => {
      const fetchMock = mockApi({ [`GET ${LIB}`]: listing(), [`DELETE /api/v1/resources/r-tpl`]: { ok: true } });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Delete Slide template' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete "Slide template"?' });
      expect(within(dialog).getByText(/It leaves CFP speakers too/)).toBeInTheDocument();
      const confirm = within(dialog).getByRole('button', { name: 'Delete resource' });
      expect(confirm).toBeDisabled();
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Slide template' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete resource' }));
      await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/resources/r-tpl') && init?.method === 'DELETE')).toBe(true));
      expect(await screen.findByText('Slide template deleted')).toBeInTheDocument();
    });
  });

  it('shows a load failure', async () => {
    mockApi({ [`GET ${LIB}`]: { status: 500, body: errorEnvelope('internal', 'The library is unavailable.') } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('The library is unavailable.');
  });
});
