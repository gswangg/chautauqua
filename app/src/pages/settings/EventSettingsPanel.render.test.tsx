// DEC-844: narrowing an event's window never blocks the write, but the
// panel must render a persistent (role="status", not a toast, not
// dismissable) notice naming every placed session the save unscheduled,
// with a link to /agenda. Nothing renders at count 0.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { EventSettingsPanel } from './EventSettingsPanel';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-narrow';

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

const eventDetail = {
  id: EVENT_ID,
  name: 'Narrow Con',
  slug: 'narrow-con',
  startDate: '2026-06-01',
  endDate: '2026-06-10',
  location: null,
  timezone: 'UTC',
  recordPrefix: 'EV',
  branding: null,
};

function renderPanel() {
  render(
    <MemoryRouter initialEntries={['/settings?section=event&edit=1']}>
      <EventSettingsPanel />
    </MemoryRouter>,
  );
}

function renderSummary() {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <EventSettingsPanel />
    </MemoryRouter>,
  );
}

describe('EventSettingsPanel unscheduled-by-window notice (DEC-844)', () => {
  it('renders a persistent status notice naming unscheduled sessions after a narrowing save', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        ...eventDetail,
        endDate: '2026-06-05',
        unscheduledByWindow: {
          count: 3,
          sessions: [
            { submissionId: 's1', ref: 'SES-004', title: 'Talk 4', day: '2026-06-15' },
            { submissionId: 's2', ref: 'SES-011', title: 'Talk 11', day: '2026-06-16' },
            { submissionId: 's3', ref: 'SES-019', title: 'Talk 19', day: '2026-06-17' },
          ],
        },
      },
    });
    renderPanel();

    const endDateInput = await screen.findByLabelText('End date');
    fireEvent.change(endDateInput, { target: { value: '5 Jun 2026' } });
    fireEvent.blur(endDateInput);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/placed sessions now fall/);
    expect(notice).toHaveTextContent('SES-004');
    expect(notice).toHaveTextContent('SES-011');
    expect(notice).toHaveTextContent('SES-019');
    expect(within(notice).getByRole('link', { name: 'View agenda' })).toHaveAttribute('href', '/agenda');
  });

  describe('mail configuration Email row (DEC-996 amendment, wave 43)', () => {
    it('reads "Sending as <fromEmail>" when resend is configured', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
        'GET /api/v1/mail-status': { provider: 'resend', configured: true, fromEmail: 'cfp@example.org' },
      });
      renderSummary();

      expect(await screen.findByText('Sending as cfp@example.org')).toBeInTheDocument();
    });

    it('reads "Dev mailbox (/dev/mailbox)" for dev-sink', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
        'GET /api/v1/mail-status': { provider: 'dev-sink', configured: true, fromEmail: null },
      });
      renderSummary();

      expect(await screen.findByText('Dev mailbox (/dev/mailbox)')).toBeInTheDocument();
    });

    it('reads "NOT CONFIGURED — sends will fail" when unconfigured', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
        'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      });
      renderSummary();

      expect(await screen.findByText('NOT CONFIGURED — sends will fail')).toBeInTheDocument();
    });
  });

  it('renders nothing when the save reports count 0', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        ...eventDetail,
        name: 'Renamed Con',
        unscheduledByWindow: { count: 0, sessions: [] },
      },
    });
    renderPanel();

    const nameInput = await screen.findByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Renamed Con' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Renamed Con')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/now fall/)).not.toBeInTheDocument();
  });
});
