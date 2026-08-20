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

    // Wait for the PREFILL itself (Body holding the template's own text)
    // rather than merely the Subject field's existence -- the field can
    // mount before the templates read (and thus the prefill effect) has
    // resolved, and racing that resolution is exactly what made this test
    // flaky inside the full suite (DEC-846 wave-116).
    await waitFor(() => expect(screen.getByLabelText('Body')).toHaveValue('Hi {speaker_name}, still waitlisted.'));
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

  it('does not let a late ?template= prefill clobber Subject/Body the organiser already edited, but still records templateId as provenance', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-9&ids=sub-1');

    // mockApi's route handlers are read synchronously (a function handler's
    // return value is used as-is, never awaited), so it can't hold a
    // response open. This test needs to control exactly when the /templates
    // read resolves relative to the organiser's edits, so it stubs `fetch`
    // directly with a route table that DOES await deferred handlers.
    let resolveTemplates!: (value: { items: unknown[] }) => void;
    const templatesPromise = new Promise<{ items: unknown[] }>((resolve) => {
      resolveTemplates = resolve;
    });
    const routes: Record<string, unknown> = {
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: templatesPromise,
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${path}`;
      if (!(key in routes)) throw new Error(`mockApi: no route registered for "${key}"`);
      const body = await routes[key];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    // The organiser starts typing before the templates read has resolved --
    // Subject and Body are both already mounted and blank at this point
    // (the ?ids= landing opens straight at step 2; the prefill effect is
    // still waiting on `templates`).
    await waitFor(() => screen.getByLabelText('Subject'));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'My own subject' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'My own words.' } });

    // NOW the templates read resolves, well after the edits.
    resolveTemplates({
      items: [{ id: 'tpl-9', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Hi {speaker_name}, still waitlisted.' }],
    });

    // Give the prefill effect a chance to run (and to NOT overwrite).
    await waitFor(() => expect(screen.getByText('From "Waitlist"')).toBeInTheDocument());
    expect(screen.getByLabelText('Subject')).toHaveValue('My own subject');
    expect(screen.getByLabelText('Body')).toHaveValue('My own words.');

    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      // templateId is still recorded as provenance even though the late
      // response did not touch subject/bodyText.
      expect(lastBody.templateId).toBe('tpl-9');
      expect(lastBody.subject).toBe('My own subject');
      expect(lastBody.bodyText).toBe('My own words.');
    });
  });

  it('an explicit pick from the template <select> still overwrites Subject/Body even after the organiser has edited them (not gated by pristineness)', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&ids=sub-1');
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

    await waitFor(() => screen.getByLabelText('Subject'));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'My own subject' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'My own words.' } });

    // An explicit dropdown pick is a deliberate act, distinct from the
    // ?template= landing's passive prefill -- it must keep overwriting
    // whatever the composer currently holds, edited or not.
    fireEvent.change(screen.getByLabelText(/^Template/), { target: { value: 'tpl-9' } });

    expect(screen.getByLabelText('Subject')).toHaveValue('Waitlist subject');
    expect(screen.getByLabelText('Body')).toHaveValue('Hi {speaker_name}, still waitlisted.');
  });
});
