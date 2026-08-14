// DEC-890: Templates tab page chrome (breadcrumb + H1 + New template) and
// the per-row "Last used" meta / Duplicate action. "Not used yet" must
// render for a template lastUsedAt reports null -- never a blank cell.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesTab } from './TemplatesTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { EmailTemplate } from './types';

const EVENT_ID = 'evt-templates-render';

function template(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tpl-1',
    eventId: EVENT_ID,
    name: 'Acceptance',
    subject: 'You are in!',
    bodyText: 'Hi {speaker_name}',
    lastUsedAt: null,
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('TemplatesTab', () => {
  it('renders breadcrumb, H1, New template, and "Not used yet" for a template with no lastUsedAt', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        template({ id: 'tpl-1', name: 'Acceptance', subject: 'You are in!', lastUsedAt: null }),
        template({ id: 'tpl-2', name: 'Decline', subject: 'An update on your submission', lastUsedAt: 1700000000000 }),
      ]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: '‹ Comms' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New template' })).toBeInTheDocument();

    // DEC-890 amendment (wave 4): the row's first line is purpose copy, not
    // the template's own name (that lives on the editor eyebrow once a row
    // is selected) or the subject line (demoted to secondary meta).
    await waitFor(() => expect(screen.getByText('You are in!')).toBeInTheDocument());
    const declineRow = screen.getByText('An update on your submission').closest('tr') as HTMLElement;
    expect(within(declineRow).getByText(/^Last used /)).toBeInTheDocument();
    expect(within(declineRow).getByText('Used for declined submissions')).toBeInTheDocument();

    const acceptanceRow = screen.getByText('You are in!').closest('tr') as HTMLElement;
    expect(within(acceptanceRow).getByText('Not used yet')).toBeInTheDocument();
    expect(within(acceptanceRow).getByText('Used for accepted submissions')).toBeInTheDocument();

    // DEC-890 amendment (wave 4): opening Templates preselects the first
    // template so the right pane is never a blank box, and the editor
    // eyebrow IS that template's name.
    expect(screen.getByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' })).toBeInTheDocument();
  });

  // B7 rule 6 (DEC-678): Templates has no facet, so a settled empty list is
  // always the fresh voice -- EmptyState instead of live headers over an
  // empty body.
  it('renders EmptyState instead of the table when the list settles empty', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No templates yet.')).toBeInTheDocument();
    expect(document.querySelector('thead')).not.toBeInTheDocument();
    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  // Before the initial fetch settles (loaded === false), the table's own
  // header chrome still paints -- the "loading" branch is left untouched by
  // this change, so it must never show EmptyState mid-flight.
  it('does not render EmptyState before the list has settled', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('No templates yet.')).not.toBeInTheDocument();
    expect(document.querySelector('thead')).toBeInTheDocument();

    await screen.findByText('No templates yet.');
  });

  it('Duplicate POSTs a copy with " (copy)" appended to the name', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template({ id: 'tpl-1', name: 'Acceptance' })]),
      [`POST /api/v1/events/${EVENT_ID}/templates`]: { status: 201, body: template({ id: 'tpl-2', name: 'Acceptance (copy)' }) },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    // Acceptance is the only template, so it's preselected -- both the row
    // and the editor eyebrow carry their own "Duplicate" control. Exercise
    // the row's.
    const row = (await screen.findByText('You are in!')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Duplicate' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
      expect(postCall).toBeDefined();
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST')!;
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Acceptance (copy)', subject: 'You are in!', bodyText: 'Hi {speaker_name}' });
  });

  it('the editor eyebrow carries its own Duplicate control naming the same template', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template({ id: 'tpl-1', name: 'Acceptance' })]),
      [`POST /api/v1/events/${EVENT_ID}/templates`]: { status: 201, body: template({ id: 'tpl-2', name: 'Acceptance (copy)' }) },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    const eyebrow = await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    const editorHead = eyebrow.closest('.chq-comms-editor-head') as HTMLElement;
    fireEvent.click(within(editorHead).getByRole('button', { name: 'Duplicate' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'POST')).toBe(true);
    });
  });

  it('"Use in a send" links to a compose landing naming the template', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template({ id: 'tpl-9', name: 'Waitlist' })]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    const row = (await screen.findByText('You are in!')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Use in a send' })).toBeInTheDocument();

    // DEC-890 amendment (wave 4): the editor footer also offers "Use in a
    // send" beside Save, for the preselected template.
    const editorSection = document.querySelector('.chq-comms-editor') as HTMLElement;
    expect(within(editorSection).getByRole('button', { name: 'Use in a send' })).toBeInTheDocument();
    expect(within(editorSection).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  // DEC-941: deleting a template is irreversible, so Delete must open the
  // shared ConfirmDialog and only DELETE after an explicit confirm.
  it('gates template delete behind a confirm dialog naming the template, and only DELETEs on confirm', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template({ id: 'tpl-1', name: 'Acceptance' })]),
      'DELETE /api/v1/templates/tpl-1': { status: 200, body: {} },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this template?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Sends already made keep their copy of "Acceptance"\'s text. This cannot be undone.'),
    ).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

// DEC-993: the template editor's per-field chip row is replaced by a single
// 'Insert a field ▾' control.
describe('TemplatesTab merge-field menu (DEC-993)', () => {
  async function openEditor() {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'New template' }));
    return screen.getByLabelText('Body') as HTMLTextAreaElement;
  }

  it('renders one "Insert a field" trigger, not a row of per-field chips', async () => {
    await openEditor();

    expect(screen.getByRole('button', { name: /Insert a field/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '{speaker_name}' })).not.toBeInTheDocument();
  });

  it('lists every offered token with its sample value once opened', async () => {
    await openEditor();

    fireEvent.click(screen.getByRole('button', { name: /Insert a field/ }));

    const menu = screen.getByRole('menu', { name: /Insert a field/ });
    const item = within(menu).getByRole('menuitem', { name: '{talk_title}' });
    expect(within(item).getByText('Taming 40-Minute CI')).toBeInTheDocument();
  });

  it('inserts a chosen merge field at the body textarea caret position', async () => {
    const body = await openEditor();

    fireEvent.change(body, { target: { value: 'Hi , see you soon' } });
    body.setSelectionRange(3, 3);

    fireEvent.click(screen.getByRole('button', { name: /Insert a field/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '{speaker_name}' }));

    expect(body.value).toBe('Hi {speaker_name}, see you soon');
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    await openEditor();

    const trigger = screen.getByRole('button', { name: /Insert a field/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: /Insert a field/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /Insert a field/ })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
