// DEC-967 amendment (findings wave 8, w8-b): DECIDE -> NOTIFY handoff.
// BulkActionBar hands the decided selection off to Comms as
// `?tab=compose&ids=<comma-joined>`; ComposeWizard hydrates the shared
// selectionReducer from it and lands on step 2 (rather than starting the
// arrival by asking the organizer to re-select the same rows).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-ids-param';

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

describe('ComposeWizard ?ids= landing', () => {
  it('lands on step 2 with the hydrated selection named in the rail', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&ids=sub-a,sub-b');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('2 submissions selected')).toBeInTheDocument());
    expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument();
  });

  it('ignores an over-long/garbage ids entry instead of throwing, and stays on step 1', async () => {
    const garbage = 'x'.repeat(200);
    window.history.pushState({}, '', `/comms?tab=compose&ids=${garbage},,sub-ok`);

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    // The garbage entry is dropped, "sub-ok" survives -- one selected, not
    // zero and not a thrown render.
    await waitFor(() => expect(screen.getByText('1 submission selected')).toBeInTheDocument());
    expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument();
  });

  it('120 ids over the cap: lands on step 2 with 100 selected and states the truncation', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `sub-${i}`).join(',');
    window.history.pushState({}, '', `/comms?tab=compose&ids=${ids}`);

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('100 submissions selected')).toBeInTheDocument());
    expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument();
    expect(screen.getByText('100 of 120 kept · a send is capped at 100')).toBeInTheDocument();
  });

  it('5 clean ids: lands on step 2 with no truncation sentence', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&ids=sub-a,sub-b,sub-c,sub-d,sub-e');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('5 submissions selected')).toBeInTheDocument());
    expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument();
    expect(screen.queryByText(/kept/)).not.toBeInTheDocument();
  });

  it('ids that all parse to nothing: stays on step 1 with no truncation sentence', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&ids=,,,');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('1. Pick submissions')).toBeInTheDocument());
    expect(screen.queryByText(/kept/)).not.toBeInTheDocument();
  });

  it('a ?template= with no ?ids= applies the template but stays on step 1', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-1');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Body text' },
      ]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('From "Waitlist"')).toBeInTheDocument());
    expect(screen.getByText('1. Pick submissions')).toBeInTheDocument();
  });
});
