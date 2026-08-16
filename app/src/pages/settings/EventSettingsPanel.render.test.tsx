// DEC-844: narrowing an event's window never blocks the write, but the
// panel must render a persistent (role="status", not a toast, not
// dismissable) notice naming every placed session the save unscheduled,
// with a link to /agenda. Nothing renders at count 0.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { EventSettingsPanel } from './EventSettingsPanel';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';

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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

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
    const primaryButton = within(footer).getByRole('button', { name: 'Save changes' });
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

// w28-d/DEC-897/DEC-124: server-only-conflict shape for the Slug field.
describe('EventSettingsPanel save-refusal error shape (DEC-897/DEC-124)', () => {
  it('a field-scoped 409 on slug lands under the Slug control, marks it invalid, and preserves unsaved edits elsewhere -- never the page banner', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        status: 409,
        body: errorEnvelope('conflict', 'slug already in use', { slug: 'taken' }),
      },
    });
    renderPanel();

    const nameInput = await screen.findByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Edited Name' } });
    const slugInput = screen.getByLabelText('Slug');
    fireEvent.change(slugInput, { target: { value: 'taken-slug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const fieldError = await screen.findByText('That slug is already taken by another event in this org.');
    expect(fieldError).toHaveClass('chq-field-error');
    expect(fieldError.closest('.chq-settings-field')).toBe(slugInput.closest('.chq-settings-field'));
    expect(fieldError.getAttribute('role')).toBe('alert');
    expect(screen.getByText('Nothing was lost. Your edits are still below.')).toBeInTheDocument();

    expect(slugInput).toHaveClass('chq-field-invalid');
    expect(slugInput).toHaveAttribute('aria-invalid', 'true');

    // No page banner for a field-scoped refusal, and the raw server
    // message ('slug already in use') never leaks through -- rule 12
    // forbids blaming the input, so the fixed copy above is what renders.
    expect(screen.queryByText('slug already in use')).not.toBeInTheDocument();

    // Never "invalid slug" -- the slug itself was well-formed, it was
    // simply already claimed.
    expect(screen.queryByText(/invalid slug/i)).not.toBeInTheDocument();

    // Unsaved edits survive the refusal: no refetch, no reset.
    expect(screen.getByLabelText('Name')).toHaveValue('Edited Name');
    expect(screen.getByLabelText('Slug')).toHaveValue('taken-slug');
  });

  it('a generic 500 still renders the page banner, with no field-level error on Slug', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        status: 500,
        body: errorEnvelope('internal', 'Something went wrong'),
      },
    });
    renderPanel();

    const nameInput = await screen.findByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Edited Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Something went wrong');

    const slugInput = screen.getByLabelText('Slug');
    expect(slugInput).not.toHaveClass('chq-field-invalid');
    expect(slugInput).not.toHaveAttribute('aria-invalid');
    expect(
      screen.queryByText('That slug is already taken by another event in this org.'),
    ).not.toBeInTheDocument();
  });

  // w56-d/DEC-124 amendment: the server's fields map is read in full, not
  // just fields.slug -- every offending control gets its own inline
  // message and the ErrorSummary anchors to it, while every other field's
  // unsaved edit is left exactly as typed.
  it('a PATCH rejection carrying fields {slug, endDate, timezone} renders three inline messages, three summary anchors at real control ids, and preserves every typed value', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
      [`PATCH /api/v1/events/${EVENT_ID}`]: {
        status: 409,
        body: errorEnvelope('invalid', 'Invalid event', {
          slug: 'Already in use',
          endDate: 'Must be on or after startDate',
          timezone: 'Must be a valid IANA timezone',
        }),
      },
    });
    renderPanel();

    const nameInput = await screen.findByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Edited Name' } });
    const slugInput = screen.getByLabelText('Slug');
    fireEvent.change(slugInput, { target: { value: 'taken-slug' } });
    const timezoneInput = screen.getByLabelText('Time zone');
    fireEvent.change(timezoneInput, { target: { value: 'America/Denver' } });
    const locationInput = screen.getByLabelText('Venue');
    fireEvent.change(locationInput, { target: { value: 'Edited Venue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    // Three inline field-scoped messages, each role="alert".
    const slugMessage = await screen.findByText('That slug is already taken by another event in this org.');
    const endDateMessage = await screen.findByText('The end date must be on or after the start date.');
    const timezoneMessage = await screen.findByText('Must be a valid IANA timezone');
    for (const el of [slugMessage, endDateMessage, timezoneMessage]) {
      expect(el).toHaveClass('chq-field-error');
      expect(el.getAttribute('role')).toBe('alert');
    }
    expect(slugMessage.closest('.chq-settings-field')).toBe(slugInput.closest('.chq-settings-field'));
    expect(timezoneMessage.closest('.chq-settings-field')).toBe(timezoneInput.closest('.chq-settings-field'));

    // Every other server-message key not in this refusal renders nothing,
    // and the raw server text for slug/endDate never leaks through.
    expect(screen.queryByText('Already in use')).not.toBeInTheDocument();
    expect(screen.queryByText('Must be on or after startDate')).not.toBeInTheDocument();

    // ONE ErrorSummary, three anchors pointing at real control ids.
    const summary = screen.getByText('Three things need fixing before these settings can be saved').closest(
      '.chq-error-summary',
    ) as HTMLElement;
    expect(summary).not.toBeNull();
    expect(summary.getAttribute('role')).toBe('alert');
    expect(screen.getByText('Nothing was lost. Your edits are still below.')).toBeInTheDocument();
    const links = within(summary).getAllByRole('link');
    expect(links).toHaveLength(3);
    const startId = screen.getByLabelText('Start date').id;
    expect(startId).not.toBe('');
    for (const link of links) {
      const targetId = (link.getAttribute('href') ?? '').replace('#', '');
      expect(targetId).not.toBe('');
      expect(document.getElementById(targetId)).not.toBeNull();
    }

    // No page banner for a field-scoped refusal.
    expect(screen.queryByText('Invalid event')).not.toBeInTheDocument();

    // Every typed value -- including the untouched Location field's -- is
    // preserved: no refetch, no reset.
    expect(screen.getByLabelText('Name')).toHaveValue('Edited Name');
    expect(screen.getByLabelText('Slug')).toHaveValue('taken-slug');
    expect(screen.getByLabelText('Time zone')).toHaveValue('America/Denver');
    expect(screen.getByLabelText('Venue')).toHaveValue('Edited Venue');
  });
});
