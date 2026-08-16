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

    // DEC-890 amendment (wave 3, w3-e): the row's first line is the stored
    // name -- the only handle the organizer typed -- and the second line
    // carries the derived purpose joined with the subject as muted meta.
    await waitFor(() =>
      expect(screen.getByText('Acceptance', { selector: '.chq-comms-template-name' })).toBeInTheDocument(),
    );
    const declineRow = screen.getByText('Decline', { selector: '.chq-comms-template-name' }).closest('tr') as HTMLElement;
    expect(within(declineRow).getByText(/^Last used /)).toBeInTheDocument();
    expect(within(declineRow).getByText('Used for declined submissions · An update on your submission')).toBeInTheDocument();

    const acceptanceRow = screen.getByText('Acceptance', { selector: '.chq-comms-template-name' }).closest('tr') as HTMLElement;
    expect(within(acceptanceRow).getByText('Not used yet')).toBeInTheDocument();
    expect(within(acceptanceRow).getByText('Used for accepted submissions · You are in!')).toBeInTheDocument();

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

  // DEC-890 amendment (wave 18): the row carries no verbs of its own -- the
  // NAME is the row's one control. A saved row exposes exactly one button
  // (the name) and no Delete.
  it('a saved row exposes exactly one button (the name) and no Delete', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template({ id: 'tpl-1', name: 'Acceptance' })]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    const row = (
      await screen.findByText('Acceptance', { selector: '.chq-comms-template-name' })
    ).closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    expect(within(row).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('clicking the row name selects that template into the editor', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        template({ id: 'tpl-1', name: 'Acceptance' }),
        template({ id: 'tpl-2', name: 'Decline' }),
      ]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    // Acceptance preselects first; click Decline's row name to switch.
    await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    fireEvent.click(await screen.findByText('Decline', { selector: '.chq-comms-template-name' }));

    await waitFor(() => {
      expect(screen.getByText('Decline', { selector: '.chq-comms-editor-eyebrow' })).toBeInTheDocument();
    });
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

    // Acceptance is the only template, so it's preselected -- Duplicate now
    // lives only in the editor head.
    const eyebrow = await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    const editorHead = eyebrow.closest('.chq-comms-editor-head') as HTMLElement;
    fireEvent.click(within(editorHead).getByRole('button', { name: 'Duplicate' }));

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

    // "Use in a send" no longer lives in the row -- it's an editor-only
    // control, alongside Save, for the preselected template.
    await screen.findByText('Waitlist', { selector: '.chq-comms-template-name' });
    const editorSection = document.querySelector('.chq-comms-editor') as HTMLElement;
    expect(within(editorSection).getByRole('button', { name: 'Use in a send' })).toBeInTheDocument();
    expect(within(editorSection).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  // DEC-890 amendment (wave 18): Delete now lives only in the editor's
  // action row -- present for a saved template, absent for a never-saved
  // 'new' draft -- and still gates behind the shared ConfirmDialog.
  it('Delete is present in the editor for a saved template, opens the confirm dialog, and DELETEs on confirm', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template({ id: 'tpl-1', name: 'Acceptance' })]),
      'DELETE /api/v1/templates/tpl-1': { status: 200, body: {} },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    const editorSection = document.querySelector('.chq-comms-editor') as HTMLElement;
    fireEvent.click(within(editorSection).getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this template?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Sends already made keep their copy of "Acceptance"\'s text. This cannot be undone.'),
    ).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete template' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('Delete is absent from the editor for a never-saved "new" draft', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'New template' }));

    const editorSection = document.querySelector('.chq-comms-editor') as HTMLElement;
    expect(within(editorSection).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
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
