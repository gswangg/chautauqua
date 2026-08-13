// DEC-941/w41-j: deleting a saved view is irreversible; the view tab row
// itself no longer carries a delete (x) control (frame 00 has none) -- a
// saved-view tab just names and applies its filter/column config.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  it('renders a saved view tab with no delete (x) control', async () => {
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
    expect(screen.queryByRole('button', { name: 'Delete AI track, unread' })).not.toBeInTheDocument();
  });
});
