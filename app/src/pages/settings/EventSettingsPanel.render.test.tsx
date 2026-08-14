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

describe('EventSettingsPanel Dates row (DEC-896)', () => {
  it('renders one Dates row in human grammar with a relative hint, no ISO strings, no Starts/Ends rows', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    renderSummary();

    const region = await screen.findByRole('region');
    await waitFor(() => {
      expect(within(region).getByText('Dates')).toBeInTheDocument();
    });

    expect(within(region).queryByText('Starts')).not.toBeInTheDocument();
    expect(within(region).queryByText('Ends')).not.toBeInTheDocument();

    const row = within(region).getByText('Dates').closest('.chq-settings-row') as HTMLElement;
    const valueEl = row.querySelector('.chq-settings-row-value') as HTMLElement;
    expect(valueEl.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(valueEl.textContent).toMatch(/Jun/);

    const hintEl = row.querySelector('.chq-settings-row-hint') as HTMLElement;
    expect(hintEl.textContent).toMatch(/days? away|Today/);
  });

  it('the edit form still shows separate Start date and End date inputs', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    renderPanel();

    expect(await screen.findByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
  });
});

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

  it('renders both a sessions clause and a breaks clause when a narrowing save orphans both (DEC-844 amendment, wave 68)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        ...eventDetail,
        endDate: '2026-06-05',
        unscheduledByWindow: {
          count: 1,
          sessions: [{ submissionId: 's1', ref: 'SES-004', title: 'Talk 4', day: '2026-06-15' }],
        },
        breaksOutsideWindow: {
          count: 2,
          breaks: [
            { id: 'b1', day: '2026-06-15', label: 'Lunch', startMin: 720 },
            { id: 'b2', day: '2026-06-16', label: 'Coffee', startMin: 600 },
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
    expect(notice).toHaveTextContent('SES-004');
    expect(notice).toHaveTextContent('Lunch');
    expect(notice).toHaveTextContent('Coffee');
    expect(within(notice).getByRole('link', { name: 'View agenda' })).toHaveAttribute('href', '/agenda');
  });

  it('renders only the breaks clause when just breaks fall outside the new window', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        ...eventDetail,
        endDate: '2026-06-05',
        unscheduledByWindow: { count: 0, sessions: [] },
        breaksOutsideWindow: {
          count: 1,
          breaks: [{ id: 'b1', day: '2026-06-15', label: 'Lunch', startMin: 720 }],
        },
      },
    });
    renderPanel();

    const endDateInput = await screen.findByLabelText('End date');
    fireEvent.change(endDateInput, { target: { value: '5 Jun 2026' } });
    fireEvent.blur(endDateInput);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Lunch');
    expect(notice).not.toHaveTextContent('placed sessions');
  });

  describe('mail configuration Email row (DEC-996 amendment, wave 57)', () => {
    it('reads "Sending as <fromEmail>" when the email binding is configured', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
        'GET /api/v1/mail-status': { provider: 'email-binding', configured: true, fromEmail: 'cfp@example.org' },
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
        breaksOutsideWindow: { count: 0, breaks: [] },
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

// DEC-896 amendment (wave 26): the shared settings edit shell.
describe('EventSettingsPanel edit view shell (DEC-896)', () => {
  it('renders the footer as secondary-then-primary in DOM order, no full-width buttons, and the slug consequence line', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    renderPanel();

    await screen.findByLabelText('Name');
    expect(
      screen.getByText('Changing the slug breaks every link already shared, including saved embeds'),
    ).toBeInTheDocument();

    const footer = document.querySelector('.chq-settings-edit-footer') as HTMLElement;
    expect(footer).not.toBeNull();
    expect(footer.querySelector('.chq-settings-edit-footer-destructive')).toBeNull();
    const secondaryButton = within(footer).getByRole('button', { name: 'Cancel' });
    const primaryButton = within(footer).getByRole('button', { name: 'Save' });
    const order = Array.from(footer.querySelectorAll('button'));
    expect(order.indexOf(secondaryButton as HTMLButtonElement)).toBeLessThan(
      order.indexOf(primaryButton as HTMLButtonElement),
    );

    const footerButtons = Array.from(footer.querySelectorAll('button'));
    expect(footerButtons.length).toBe(2);
    for (const button of footerButtons) {
      expect(button.className).not.toMatch(/full-width|btn-full/);
    }
  });

  it('paints Start date and End date as a SettingsFieldPair', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    renderPanel();

    const startInput = await screen.findByLabelText('Start date');
    const pair = startInput.closest('.chq-settings-field-pair');
    expect(pair).not.toBeNull();
    expect(within(pair as HTMLElement).getByLabelText('End date')).toBeInTheDocument();
  });
});
