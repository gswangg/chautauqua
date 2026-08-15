// Ruling A19 (task-w26-h): the template picker's copy states the mechanism's
// real rules -- the empty option reads "No template — write it here", the
// submission-scoped templates are named as unavailable WITH the reason in
// one sentence, and the footnote names which merge fields DO resolve here.
// The mechanism itself (disable + forward link) is unchanged.
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { BulkEmailModal } from './BulkEmailModal';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-bulk-a19';

describe('Ruling A19: BulkEmailModal template picker copy', () => {
  it('renders the ruling strings: empty option, reason sentence, and resolvable-fields footnote', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-ok', eventId: EVENT_ID, name: 'Welcome', subject: 'Hi {speaker_name}', bodyText: 'See {event_name}' },
        { id: 'tpl-accept', eventId: EVENT_ID, name: 'Acceptance', subject: 'Congrats on {talk_title}', bodyText: 'Hi {speaker_name}' },
        { id: 'tpl-decline', eventId: EVENT_ID, name: 'Decline', subject: 'About {talk_title}', bodyText: 'Hi {speaker_name}' },
        { id: 'tpl-sched', eventId: EVENT_ID, name: 'Schedule live', subject: 'Your slot for {talk_title}', bodyText: 'Hi {speaker_name}' },
      ]),
    });

    render(
      <MemoryRouter>
        <BulkEmailModal contactIds={['ct1']} eventId={EVENT_ID} onClose={() => {}} />
      </MemoryRouter>,
    );

    const select = (await screen.findByLabelText(/Template/)) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Empty option copy.
    expect(screen.getByRole('option', { name: 'No template — write it here' })).toBeInTheDocument();

    // Reason sentence names the unavailable templates with the real rule.
    await waitFor(() => {
      expect(
        screen.getByText('Acceptance, Decline and Schedule live need a submission, so they are not available here.'),
      ).toBeInTheDocument();
    });

    // Forward path is unchanged (copy ruling, not a capability change).
    expect(screen.getAllByRole('link', { name: 'Use in Comms compose' }).length).toBe(3);

    // Footnote names which merge fields DO resolve in this context.
    expect(screen.getByText(/merge fields:/)).toBeInTheDocument();
    expect(screen.getByText(/\{speaker_name\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{event_name\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{portal_link\}/)).toBeInTheDocument();
  });
});
