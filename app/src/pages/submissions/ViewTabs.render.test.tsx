// DEC-941: deleting a saved view is gated behind the shared ConfirmDialog
// rather than firing on click. Each saved-view tab item carries a named
// delete affordance (never a bare icon) alongside the apply button.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ViewTabs } from './ViewTabs';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { DEFAULT_FILTER_STATE } from './types';
import { MAX_SAVED_VIEWS_PER_EVENT } from '../../lib/batch-caps';

const EVENT_ID = 'evt-viewtabs-render';

function savedView() {
  return {
    id: 'view-1',
    eventId: EVENT_ID,
    name: 'AI track, unread',
    config: { q: '', status: [], trackId: null, sort: 'newest', columns: [] },
    createdByUserId: 'user-1',
    shared: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

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
});

function otherSavedView() {
  return {
    id: 'view-2',
    eventId: EVENT_ID,
    name: 'Waitlist',
    config: { q: '', status: ['waitlist'], trackId: null, sort: 'newest', columns: [] },
    createdByUserId: 'user-1',
    shared: false,
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
  };
}

describe('ViewTabs (DEC-941)', () => {
  it('renders a saved view tab with a named delete affordance', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([savedView()]),
    });

    render(
      <ViewTabs
        eventId={EVENT_ID}
        filters={DEFAULT_FILTER_STATE}
        visibleFieldIds={new Set()}
        tracks={[]}
        formFields={[]}
        onApply={() => {}}
      />,
    );

    expect(await screen.findByRole('button', { name: 'AI track, unread' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete view AI track, unread' })).toBeInTheDocument();
  });

  it('deletes a saved view after confirming, leaving the other view in place', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([savedView(), otherSavedView()]),
      'DELETE /api/v1/views/view-1': { status: 200, body: {} },
    });

    render(
      <ViewTabs
        eventId={EVENT_ID}
        filters={DEFAULT_FILTER_STATE}
        visibleFieldIds={new Set()}
        tracks={[]}
        formFields={[]}
        onApply={() => {}}
      />,
    );

    await screen.findByRole('button', { name: 'AI track, unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete view AI track, unread' }));

    expect(await screen.findByText(/Only the saved filter "AI track, unread" goes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('button', { name: 'Waitlist' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI track, unread' })).not.toBeInTheDocument();

    const deleteCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      return url.includes('/api/v1/views/view-1') && (init as RequestInit | undefined)?.method === 'DELETE';
    });
    expect(deleteCall).toBeTruthy();
  });

  it('cancelling the delete confirm leaves the view in place and issues no request', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([savedView(), otherSavedView()]),
    });

    render(
      <ViewTabs
        eventId={EVENT_ID}
        filters={DEFAULT_FILTER_STATE}
        visibleFieldIds={new Set()}
        tracks={[]}
        formFields={[]}
        onApply={() => {}}
      />,
    );

    await screen.findByRole('button', { name: 'AI track, unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete view AI track, unread' }));

    expect(await screen.findByText(/Only the saved filter "AI track, unread" goes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/Only the saved filter/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI track, unread' })).toBeInTheDocument();

    const deleteCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE');
    expect(deleteCall).toBeUndefined();
  });
});

// DEC-422/w2-f: the "Save this view" dialog discloses the per-event view
// count against MAX_SAVED_VIEWS_PER_EVENT and disables its Save action at
// the cap.
describe('ViewTabs save dialog (DEC-422 per-event cap disclosure)', () => {
  function manyViews(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `view-${i}`,
      eventId: EVENT_ID,
      name: `View ${i}`,
      config: { q: '', status: [], trackId: null, sort: 'newest', columns: [] },
      createdByUserId: 'user-1',
      shared: false,
      createdAt: 1700000000000 + i,
      updatedAt: 1700000000000 + i,
    }));
  }

  it('shows "n of MAX" and leaves Save enabled below the cap', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope(manyViews(3)),
    });

    render(
      <ViewTabs
        eventId={EVENT_ID}
        filters={DEFAULT_FILTER_STATE}
        visibleFieldIds={new Set()}
        tracks={[]}
        formFields={[]}
        onApply={() => {}}
      />,
    );

    await screen.findByRole('button', { name: 'View 0' });
    fireEvent.click(screen.getByRole('button', { name: 'Save current as view' }));

    // The caption names its noun, matching the house cap-caption pattern
    // ('N of MAX options', 'N of MAX questions').
    expect(await screen.findByText(`3 of ${MAX_SAVED_VIEWS_PER_EVENT} saved views`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save the view' })).toBeEnabled();
  });

  it('disables Save once the per-event view count reaches the cap', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope(manyViews(MAX_SAVED_VIEWS_PER_EVENT)),
    });

    render(
      <ViewTabs
        eventId={EVENT_ID}
        filters={DEFAULT_FILTER_STATE}
        visibleFieldIds={new Set()}
        tracks={[]}
        formFields={[]}
        onApply={() => {}}
      />,
    );

    await screen.findByRole('button', { name: 'View 0' });
    fireEvent.click(screen.getByRole('button', { name: 'Save current as view' }));

    expect(
      await screen.findByText(`${MAX_SAVED_VIEWS_PER_EVENT} of ${MAX_SAVED_VIEWS_PER_EVENT} saved views`),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save the view' })).toBeDisabled();
  });
});
