// DEC-967 amendment (findings wave 8, w8-b): DECIDE -> NOTIFY handoff.
// BulkActionBar hands the decided selection off to Comms as
// `?tab=compose&ids=<comma-joined>`; ComposeWizard hydrates the shared
// selectionReducer from it and lands on step 2 (rather than starting the
// arrival by asking the organizer to re-select the same rows).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);

    // The garbage entry is dropped, "sub-ok" survives -- one selected, not
    // zero and not a thrown render.
    await waitFor(() => expect(screen.getByText('1 submission selected')).toBeInTheDocument());
    expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument();
  });

  it('a ?template= with no ?ids= applies the template but stays on step 1', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-1');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Body text' },
      ]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    await waitFor(() => expect(screen.getByText('From "Waitlist"')).toBeInTheDocument());
    expect(screen.getByText('1. Pick submissions')).toBeInTheDocument();
  });
});
