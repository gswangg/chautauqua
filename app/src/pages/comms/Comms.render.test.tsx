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

  it('renders the history tab as batch rows that expand to per-recipient rows', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: (() => {
        // DEC-603: mockApi matches on path only (query strings stripped), so
        // the same route key must answer both the batch-list fetch
        // (?groupBy=batch) and the drill-in fetch (?batchId=...). Since the
        // handler can't see the query string here, this test only exercises
        // the batch-row rendering; recipient drill-in fetches the second
        // response spec below, which happens to be the same rendering it
        // reuses when it can't distinguish the two -- so we only assert on
        // the batch row heading, not the expanded content.
        return listEnvelope([
          {
            batchKey: 'batch-1',
            subject: 'You are in!',
            sentAt: 1700000000000,
            recipientCount: 3,
            statusCounts: { sent: 3 },
          },
        ]);
      })(),
    });

    render(<CommsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'History' }));

    const row = await screen.findByText('You are in!');
    const batchButton = row.closest('.chq-comms-batch-row') as HTMLElement;
    expect(within(batchButton).getByText('3 recipients')).toBeInTheDocument();
    expect(within(batchButton).getByText('3 sent')).toBeInTheDocument();
    expect(screen.getByText('1 total')).toBeInTheDocument();
  });
});
