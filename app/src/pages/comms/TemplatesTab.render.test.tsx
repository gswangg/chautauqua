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
        template({ id: 'tpl-1', name: 'Acceptance', lastUsedAt: null }),
        template({ id: 'tpl-2', name: 'Decline', lastUsedAt: 1700000000000 }),
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

    await waitFor(() => expect(screen.getByText('Acceptance')).toBeInTheDocument());
    const declineRow = screen.getByText('Decline').closest('tr') as HTMLElement;
    expect(within(declineRow).getByText(/^Last used /)).toBeInTheDocument();

    const acceptanceRow = screen.getByText('Acceptance').closest('tr') as HTMLElement;
    expect(within(acceptanceRow).getByText('Not used yet')).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
      expect(postCall).toBeDefined();
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST')!;
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Acceptance (copy)', subject: 'You are in!', bodyText: 'Hi {speaker_name}' });
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

    const row = (await screen.findByText('Waitlist')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Use in a send' })).toBeInTheDocument();
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
