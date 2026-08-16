// DEC-846 amendment (wave 66): picking a template from the dropdown sets
// templateId and LEAVES it set (provenance), so the actual send POST to
// /compose/send carries templateId equal to the picked template's id.
// Picking "Write from scratch" afterward clears templateId and empties
// subject/body. This is asserted end-to-end on the captured send request
// body, not on component state.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-provenance';

function page1() {
  return [
    {
      id: 'sub-1',
      ref: 'DFC-001',
      title: 'Talk number 1',
      status: 'accepted',
      contentStatus: 'approved',
      speakers: [{ contactId: 'c1', name: 'Priya Raman' }],
      trackIds: [],
      submittedAt: null,
      createdAt: 1700000000000,
    },
  ];
}

describe('ComposeWizard send carries templateId as provenance (DEC-846, amendment wave 66)', () => {
  it('posts templateId equal to the picked template id on the actual send request', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 1, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Congrats {speaker_name}' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        items: [
          {
            contactId: 'c1',
            submissionId: 'sub-1',
            email: 'c1@example.com',
            name: 'Priya Raman',
            ref: 'DFC-001',
            scheduled: true,
            subject: 'You are in',
            text: 'Congrats Priya Raman',
          },
        ],
      },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [], items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const templateSelect = await screen.findByLabelText(/Template/);
    fireEvent.change(templateSelect, { target: { value: 'tpl-1' } });
    expect(await screen.findByLabelText('Subject')).toHaveValue('You are in');
    expect(templateSelect).toHaveValue('tpl-1');

    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Priya Raman');
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const step4Send = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.click(step4Send);

    await waitFor(() => {
      const sendCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/send'));
      expect(sendCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(sendCalls[sendCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.templateId).toBe('tpl-1');
      expect(lastBody.subject).toBe('You are in');
      expect(lastBody.bodyText).toBe('Congrats {speaker_name}');
    });
  });

  it('picking "Write from scratch" after a template pick posts no templateId and sends empty subject/body', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 1, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Congrats {speaker_name}' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const templateSelect = await screen.findByLabelText(/Template/);
    fireEvent.change(templateSelect, { target: { value: 'tpl-1' } });
    expect(await screen.findByLabelText('Subject')).toHaveValue('You are in');

    // Explicit "Write from scratch" pick disowns the provenance and empties
    // the composer -- the dropdown's own second (and now only remaining)
    // branch.
    fireEvent.change(templateSelect, { target: { value: '' } });

    expect(templateSelect).toHaveValue('');
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    expect(screen.getByLabelText('Body')).toHaveValue('');

    // "Next: preview" is disabled with an empty subject/body (unrelated
    // gating) -- fill in fresh, from-scratch text to reach the preview
    // request and confirm no templateId rides along.
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'From scratch subject' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'From scratch body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.templateId).toBeUndefined();
      expect(lastBody.subject).toBe('From scratch subject');
      expect(lastBody.bodyText).toBe('From scratch body');
    });
  });
});
