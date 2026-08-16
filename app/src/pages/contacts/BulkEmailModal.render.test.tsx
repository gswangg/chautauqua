// DEC-144 layer-2 harness: component-render smoke test for the CRM-11
// bulk-email template-fill + preview flow. Mounts the real modal against a
// mocked fetch: selecting a template fills subject/body (both stay
// editable), then Preview calls POST .../bulk-email/preview and renders
// the resolved per-recipient personalization before Send.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
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

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

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

    expect(screen.getByRole('button', { name: /Send 1 email/ })).toBeInTheDocument();
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

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1', 'ct2']} eventId={EVENT_ID} recipientNames={['Ada Lovelace', 'Bob Jones']} onClose={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Send 2 emails/ }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Send this email?' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Send 2 emails' }));

    expect(await screen.findByText('Sent to 1 email. 1 failure.')).toBeInTheDocument();
    expect(screen.getByText('bad@example.com')).toBeInTheDocument();

    // DEC-837: the sent-result "View in Comms history" link must land on
    // the History tab (?tab=history), not fall through to Comms.tsx's
    // compose fallback when ?tab= is absent.
    // DEC-834 / DEC-837: basename-relative target (the router's basename is
    // already '/admin'), so it renders without the prefix under this
    // basename-less MemoryRouter.
    expect(screen.getByRole('link', { name: 'View in Comms history' })).toHaveAttribute(
      'href',
      '/comms?tab=history',
    );
  });

  // DEC-967: an email batch asks once before it leaves -- the terminal Send
  // opens the shared ConfirmDialog instead of posting directly.
  it('confirms before sending: no POST to bulk-email until confirmed, and Cancel sends nothing', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      'POST /api/v1/contacts/bulk-email/preview': {
        items: [{ contactId: 'ct1', email: 'ada@example.com', subject: 'Hi Ada', bodyText: 'Body' }],
      },
      'POST /api/v1/contacts/bulk-email': { sent: 1, failed: [] },
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    function sendCallCount() {
      return fetchMock.mock.calls.filter(([input]) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/bulk-email'),
      ).length;
    }

    expect(screen.queryByRole('dialog', { name: 'Send this email?' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Send 1 email/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Send this email?' });
    expect(dialog.textContent).toContain('1 recipient');
    expect(sendCallCount()).toBe(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Send this email?' })).not.toBeInTheDocument();
    expect(sendCallCount()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /Send 1 email/ }));
    const dialog2 = await screen.findByRole('dialog', { name: 'Send this email?' });
    fireEvent.click(within(dialog2).getByRole('button', { name: 'Send 1 email' }));

    await waitFor(() => expect(sendCallCount()).toBe(1));
  });

  // DEC-793: the placeholder text must only advertise merge fields the
  // server's bulk-email validator actually accepts — {first_name} isn't
  // one of them (BULK_EMAIL_MERGE_FIELDS), so it must not appear anywhere
  // in the compose step's placeholders.
  it('advertises only BULK_EMAIL_MERGE_FIELDS in its placeholders, never {first_name}', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

    const subjectInput = (await screen.findByLabelText('Subject')) as HTMLInputElement;
    const bodyInput = screen.getByLabelText('Body') as HTMLTextAreaElement;

    expect(subjectInput.placeholder).not.toMatch(/\{first_name\}/);
    expect(bodyInput.placeholder).not.toMatch(/\{first_name\}/);
    expect(bodyInput.placeholder).toMatch(/\{speaker_name\}/);
  });

  // DEC-856 (wave 1 amendment): the bulk context only resolves
  // speaker_name/event_name/portal_link -- a template referencing anything
  // else (e.g. {talk_title}) must be disabled in the picker and name the
  // offending token inline. A fully-sendable template stays selectable.
  // Item 9 (frame 08-contacts--10): the per-template "Use in Comms compose"
  // forward-link list is gone, collapsed into the ONE unavailability
  // sentence per ruling A19 -- the disabled option's own text is what names
  // the blocking token now.
  it('disables an unsendable template, names its blocking token inline, and states the one unavailability sentence, while a sendable one stays selectable', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-ok', eventId: EVENT_ID, name: 'Welcome', subject: 'Hi {speaker_name}', bodyText: 'See {event_name}: {portal_link}' },
        { id: 'tpl-bad', eventId: EVENT_ID, name: 'Acceptance', subject: 'Congrats on {talk_title}', bodyText: 'Hi {speaker_name}' },
      ]),
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

    const select = (await screen.findByLabelText(/Template/)) as HTMLSelectElement;
    const okOption = within(select).getByRole('option', { name: 'Welcome' }) as HTMLOptionElement;
    expect(okOption.disabled).toBe(false);

    const badOption = within(select).getByRole('option', { name: /Acceptance/ }) as HTMLOptionElement;
    expect(badOption.disabled).toBe(true);
    expect(badOption.textContent).toContain('{talk_title}');

    expect(
      screen.getByText('Acceptance needs a submission, so it is not available here — send those from Comms.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Use in Comms compose/ })).toBeNull();

    // The sendable template is still usable end to end: selecting it fills
    // subject/body.
    fireEvent.change(select, { target: { value: 'tpl-ok' } });
    const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
    await waitFor(() => {
      expect(subjectInput.value).toBe('Hi {speaker_name}');
    });
  });

  // DEC-856 (wave 60 amendment): the preview refusal must name the
  // recipient and the offending token -- never just the sentence, and
  // never their opaque contactId.
  it('names the recipient and the missing token on a preview refusal, with no ULID in the DOM', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      'POST /api/v1/contacts/bulk-email/preview': {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message:
              '1 of 1 recipients are missing {talk_title} — only {speaker_name}, {event_name} and {portal_link} can be merged in a bulk email.',
            fields: {
              'ada@example.com': 'Ada Lovelace is missing {talk_title}',
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct-01hqzxyzabc123']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi {talk_title}' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('Ada Lovelace is missing {talk_title}')).toBeInTheDocument();
    expect(
      screen.getByText(/1 of 1 recipients are missing \{talk_title\}/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ct-01hqzxyzabc123/)).not.toBeInTheDocument();
  });

  // w63-a (DEC-856): the fields map must be read by shape, not dumped --
  // one bullet per RECIPIENT (naming them), never an unlabelled bullet for
  // a per-control refusal like `subject: 'Max <n>'`.
  it('renders one bullet per recipient naming them on a merge-field refusal', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      'POST /api/v1/contacts/bulk-email/preview': {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message: '2 of 2 recipients are missing {talk_title} — only {speaker_name}, {event_name} and {portal_link} can be merged in a bulk email.',
            fields: {
              'ada@example.com': 'Ada Lovelace is missing {talk_title}',
              'bob@example.com': 'Bob Jones is missing {talk_title}',
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1', 'ct2']} eventId={EVENT_ID} recipientNames={['Ada Lovelace', 'Bob Jones']} onClose={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi {talk_title}' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('Ada Lovelace is missing {talk_title}')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones is missing {talk_title}')).toBeInTheDocument();
  });

  // w63-a (DEC-856): a subject-length refusal marks the Subject control
  // inline and NEVER renders as a bare list item ('Max 2000').
  it('marks the Subject control inline on a subject-length refusal, never as a bare bullet', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      'POST /api/v1/contacts/bulk-email/preview': {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message: 'Validation failed',
            fields: { subject: 'Max 2000' },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const subjectInput = await screen.findByLabelText('Subject');
    await waitFor(() => {
      expect(subjectInput).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText('Max 2000')).toBeInTheDocument();
    // Never rendered as a bare, unlabelled bullet.
    const bareBullets = screen.queryAllByRole('listitem').filter((li) => li.textContent === 'Max 2000');
    expect(bareBullets).toHaveLength(0);
  });

  // w63-a (DEC-856): an unrecognised fields-map key renders as a labelled
  // '<key>: <message>' line, never a bare bullet.
  it('renders an unrecognised fields-map key as a labelled line', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      'POST /api/v1/contacts/bulk-email/preview': {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message: 'Validation failed',
            fields: { eventId: 'required' },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} recipientNames={['Ada Lovelace']} onClose={() => {}} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('eventId: required')).toBeInTheDocument();
  });
});
