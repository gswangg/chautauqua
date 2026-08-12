// DEC-350 layer-2 harness for the J5 compose recipient picker
// (app/src/pages/comms/ComposeWizard.tsx): the picker must be server-paged
// and searchable, exactly like the onboarding grid (DEC-340) and the
// submissions worklist (DEC-341) — no client-side filter/sort over a single
// fetched page, and selection must span pages.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-render';

function submission(n: number) {
  return {
    id: `sub-${n}`,
    ref: `S-${String(n).padStart(3, '0')}`,
    title: `Talk number ${n}`,
    status: 'accepted',
    contentStatus: 'approved',
    speakers: [{ contactId: `c${n}`, name: `Speaker ${n}` }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

function page1() {
  return Array.from({ length: 50 }, (_, i) => submission(i + 1));
}

function page2() {
  return Array.from({ length: 50 }, (_, i) => submission(i + 51));
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

describe('ComposeWizard recipient picker', () => {
  it('renders the range label and an enabled Next on a first page of 50', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    expect(await screen.findByText('Talk number 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-50 of 340')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('requests page=2 when Next is clicked', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('/submissions') && /[?&]page=2\b/.test(u))).toBe(true);
    });
  });

  it('keeps a page-1 checkbox selection counted after paging to page 2', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: (() => {
        let call = 0;
        return () => {
          call += 1;
          return call === 1
            ? listEnvelope(page1(), { total: 340, page: 1, perPage: 50 })
            : listEnvelope(page2(), { total: 340, page: 2, perPage: 50 });
        };
      })(),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    expect(screen.getByRole('button', { name: /1 submission selected/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Talk number 51');

    expect(screen.getByRole('button', { name: /1 submission selected/ })).toBeInTheDocument();
  });

  it('issues a request with q= and resets page to 1 when searching', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'testing' } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('/submissions') && u.includes('q=testing'))).toBe(true);
      const last = urls.filter((u) => u.includes('/submissions')).pop()!;
      expect(/[?&]page=1\b/.test(last) || !/[?&]page=/.test(last)).toBe(true);
    });
  });

  // w8-b: DEC-406/DEC-402 re-skin of compose steps 1-2 — the picker table
  // must carry both the shared .chq-table class and its page-prefixed
  // second class, and every rendered <button> must carry a shell chq-*
  // class (no browser-default buttons on this page).
  it('renders the step-1 picker table with both chq-table classes and every button shell-classed', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    expect(table).toHaveClass('chq-table');
    expect(table).toHaveClass('chq-comms-compose-table');

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/chq-/);
    }
  });

  // DEC-677: the compose send step renders the server's SendResult through
  // describeSendResult (one reporter), not a hand-built "Sent N" sentence,
  // and lists the failed addresses the server already reports.
  it('renders one sentence naming sent and failed counts, and lists the failed address', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: {
        sent: 2,
        failed: [{ email: 'bad@example.com', message: 'bounced' }],
        items: [],
      },
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText(/Preview/);
    fireEvent.click(screen.getByRole('button', { name: /Send \d+ emails?/ }));

    expect(await screen.findByText('Sent to 2 emails. 1 failure.')).toBeInTheDocument();
    expect(screen.getByText('bad@example.com')).toBeInTheDocument();
  });

  it('carries chq-input/chq-textarea on step 2 subject/body and shell classes on its buttons', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    const body = screen.getByLabelText('Body');
    expect(subject).toHaveClass('chq-input');
    expect(body).toHaveClass('chq-textarea');

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/chq-/);
    }
  });
});
