// DEC-144 layer-2 harness for the Comms SPA (app/src/pages/Comms.tsx):
// mounts the real CommsPage against mocked fetch shaped like the real wire
// envelopes and walks the compose wizard (submission pick -> template pick
// -> per-recipient preview), plus renders the templates and history tabs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommsPage } from '../Comms';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-comms-render';

function submission() {
  return {
    id: 'sub-1',
    ref: 'S-001',
    title: 'A Talk About Testing',
    status: 'accepted',
    contentStatus: 'approved',
    speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

function template() {
  return { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in!', bodyText: 'Congrats {speaker_name}' };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('CommsPage render smoke', () => {
  it('walks the compose wizard through to a per-recipient preview', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([submission()]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        items: [
          {
            contactId: 'c1',
            submissionId: 'sub-1',
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            subject: 'You are in!',
            text: 'Congrats Ada Lovelace',
          },
        ],
      },
    });

    render(<CommsPage />);

    expect(await screen.findByRole('heading', { name: 'Comms' })).toBeInTheDocument();
    expect(await screen.findByText('A Talk About Testing')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select A Talk About Testing'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    expect(await screen.findByText('2. Pick or edit a template')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'tpl-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    expect(await screen.findByText('Recipients · 1')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('ada@example.com', { exact: false }).length).toBeGreaterThan(0);
    });
  });

  it('renders the templates tab', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
    });

    render(<CommsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Templates' }));

    await waitFor(() => {
      expect(screen.getByText('Acceptance')).toBeInTheDocument();
    });
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  });

  it('renders the history tab', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        {
          id: 'log-1',
          eventId: EVENT_ID,
          eventName: 'Demo Event',
          templateId: 'tpl-1',
          contactId: 'c1',
          toEmail: 'ada@example.com',
          subject: 'You are in!',
          bodyText: 'Congrats',
          bodyHtml: null,
          icsText: null,
          icsFilename: null,
          provider: 'dev-sink',
          status: 'sent',
          sentAt: 1700000000000,
        },
      ]),
    });

    render(<CommsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'History' }));

    const row = await screen.findByText('You are in!');
    expect(within(row.closest('.chq-comms-history-row')!).getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 total')).toBeInTheDocument();
  });
});
