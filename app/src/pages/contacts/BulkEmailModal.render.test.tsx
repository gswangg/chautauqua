// DEC-144 layer-2 harness: component-render smoke test for the CRM-11
// bulk-email template-fill + preview flow. Mounts the real modal against a
// mocked fetch: selecting a template fills subject/body (both stay
// editable), then Preview calls POST .../bulk-email/preview and renders
// the resolved per-recipient personalization before Send.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BulkEmailModal } from './BulkEmailModal';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-bulk-render';

afterEach(() => {
  // no shared state to reset beyond fetch stub, which mockApi re-stubs per test
});

describe('BulkEmailModal render smoke (CRM-11 template + preview)', () => {
  it('fills subject/body from a picked template (still editable) and previews resolved merge fields', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl1', eventId: EVENT_ID, name: 'Welcome', subject: 'Hi {speaker_name}', bodyText: 'See {event_name}: {portal_link}' },
      ]),
      'POST /api/v1/contacts/bulk-email/preview': {
        items: [
          { contactId: 'ct1', email: 'ada@example.com', subject: 'Hi Ada Lovelace', bodyText: 'See DevCon: /portal' },
        ],
      },
    });

    render(<BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Template')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Template/), { target: { value: 'tpl1' } });

    const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
    const bodyInput = screen.getByLabelText('Body') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(subjectInput.value).toBe('Hi {speaker_name}');
    });
    expect(bodyInput.value).toBe('See {event_name}: {portal_link}');

    // Still editable after template fill.
    fireEvent.change(subjectInput, { target: { value: 'Hi {speaker_name}!!' } });
    expect(subjectInput.value).toBe('Hi {speaker_name}!!');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('Hi Ada Lovelace')).toBeInTheDocument();
    });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('See DevCon: /portal')).toBeInTheDocument();

    const previewCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/bulk-email/preview'),
    );
    expect(previewCall).toBeDefined();

    expect(screen.getByRole('button', { name: /Send to 1 recipient/ })).toBeInTheDocument();
  });

  // DEC-677: the bulk-email send result renders one sentence naming sent
  // and failed counts via describeSendResult, not a hand-built "Sent N"
  // sentence, and lists the failed addresses.
  it('renders one sentence naming sent and failed counts, and lists the failed address', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      'POST /api/v1/contacts/bulk-email/preview': {
        items: [{ contactId: 'ct1', email: 'ada@example.com', subject: 'Hi', bodyText: 'Body' }],
      },
      'POST /api/v1/contacts/bulk-email': {
        sent: 1,
        failed: [{ email: 'bad@example.com', message: 'bounced' }],
        items: [],
      },
    });

    render(<BulkEmailModal contactIds={['ct1', 'ct2']} eventId={EVENT_ID} onClose={() => {}} />);

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Send to 2 recipients/ }));

    expect(await screen.findByText('Sent to 1 email. 1 failure.')).toBeInTheDocument();
    expect(screen.getByText('bad@example.com')).toBeInTheDocument();

    // DEC-837: the sent-result "View in Comms history" link must land on
    // the History tab (?tab=history), not fall through to Comms.tsx's
    // compose fallback when ?tab= is absent.
    expect(screen.getByRole('link', { name: 'View in Comms history' })).toHaveAttribute(
      'href',
      '/admin/comms?tab=history',
    );
  });

  // DEC-793: the placeholder text must only advertise merge fields the
  // server's bulk-email validator actually accepts — {first_name} isn't
  // one of them (BULK_EMAIL_MERGE_FIELDS), so it must not appear anywhere
  // in the compose step's placeholders.
  it('advertises only BULK_EMAIL_MERGE_FIELDS in its placeholders, never {first_name}', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} onClose={() => {}} />);

    const subjectInput = (await screen.findByLabelText('Subject')) as HTMLInputElement;
    const bodyInput = screen.getByLabelText('Body') as HTMLTextAreaElement;

    expect(subjectInput.placeholder).not.toMatch(/\{first_name\}/);
    expect(bodyInput.placeholder).not.toMatch(/\{first_name\}/);
    expect(bodyInput.placeholder).toMatch(/\{speaker_name\}/);
  });
});
