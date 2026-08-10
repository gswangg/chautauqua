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

    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'tpl1' } });

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
});
