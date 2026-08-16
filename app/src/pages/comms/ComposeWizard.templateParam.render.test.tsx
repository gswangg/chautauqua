// DEC-890 (Templates "Use in a send" -> `?tab=compose&template=<id>`):
// ComposeWizard reads a ?template= landing param at mount and preselects
// that template exactly like the template <select>'s own onChange -- subject
// and body are prefilled from the template. DEC-846 amendment (wave 3):
// templateId itself IS recorded from this landing (provenance, not
// authority) and posted on preview/send -- but subject/bodyText remain the
// composer's own text, so an edit after the landing still wins.
// DEC-967 amendment (findings wave 8, w8-b): a ?template= landing with no
// ?ids= no longer jumps to step 2 -- there is nothing to compose FOR yet,
// so it prefills subject/body/templateId and stays on step 1 (the rail's
// own "Template" row shows the preselected name).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-template-param';

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
  window.history.pushState({}, '', '/');
});

describe('ComposeWizard ?template= landing', () => {
  it('preselects the named template, prefilling subject/body, but stays on step 1 (no selection to compose for)', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-9');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-9', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Hi {speaker_name}, still waitlisted.' },
      ]),
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );

    // Rail's own "Template" row names the preselected template without the
    // wizard having advanced to it.
    await waitFor(() => expect(screen.getByText('From "Waitlist"')).toBeInTheDocument());
    expect(screen.getByText('1. Pick submissions')).toBeInTheDocument();
    expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();
  });

  it('posts templateId on the send after a ?template=+?ids= landing, alongside the (possibly edited) subject/bodyText', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-9&ids=sub-1');

    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-9', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Hi {speaker_name}, still waitlisted.' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );

    await waitFor(() => screen.getByLabelText('Subject'));
    // Next: preview requires only a non-empty subject/body -- recipient
    // selection isn't gated here.
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Hi {speaker_name}, still waitlisted. Edited.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.templateId).toBe('tpl-9');
      expect(lastBody.subject).toBe('Waitlist subject');
      expect(lastBody.bodyText).toBe('Hi {speaker_name}, still waitlisted. Edited.');
    });
  });
});
