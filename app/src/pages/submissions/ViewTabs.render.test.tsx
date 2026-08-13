// DEC-941: deleting a saved view is irreversible, so the tab's delete
// control must open the shared ConfirmDialog and only DELETE after an
// explicit confirm -- never on the first click.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ViewTabs } from './ViewTabs';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { DEFAULT_FILTER_STATE } from './types';

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

describe('ViewTabs (DEC-941)', () => {
  it('gates saved-view delete behind a confirm dialog naming the view, and only DELETEs on confirm', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([savedView()]),
      [`DELETE /api/v1/views/view-1`]: { status: 200, body: {} },
    });

    render(
      <ViewTabs
        eventId={EVENT_ID}
        filters={DEFAULT_FILTER_STATE}
        visibleFieldIds={new Set()}
        tracks={[]}
        onApply={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Delete AI track, unread' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this view?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Only the saved filter "AI track, unread" goes — no submissions are affected.'),
    ).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
