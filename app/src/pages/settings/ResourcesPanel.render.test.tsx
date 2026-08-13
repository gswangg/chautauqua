// DEC-941: deleting a resource is irreversible, so the row's Delete link
// must open the shared ConfirmDialog and only DELETE after an explicit
// confirm -- never on the first click.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ResourcesPanel } from './ResourcesPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-resources-render';

function resource() {
  return { id: 'res-1', kind: 'wiki', title: 'Speaker FAQ', content: 'Some content here', fileId: null, position: 0 };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('ResourcesPanel (DEC-941)', () => {
  it('gates resource delete behind a confirm dialog naming the resource and the consequence, and only DELETEs on confirm', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([resource()]),
      'DELETE /api/v1/resources/res-1': { status: 200, body: {} },
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this resource?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Speakers lose the download from their portal. "Speaker FAQ" cannot be recovered.'),
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
