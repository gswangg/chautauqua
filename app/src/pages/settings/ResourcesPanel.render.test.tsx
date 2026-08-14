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

function fileResource() {
  return { id: 'res-2', kind: 'file', title: 'Handout.pdf', content: null, fileId: 'file-1', position: 0 };
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

describe('ResourcesPanel file-row Rename (DEC-029 amendment)', () => {
  it('a file row shows a Rename control (not Replace), opening a title-only edit form with no content textarea', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([fileResource()]),
    });

    render(<ResourcesPanel />);

    expect(await screen.findByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const titleInput = await screen.findByDisplayValue('Handout.pdf');
    expect(titleInput.tagName).toBe('INPUT');
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });

  it('saving a file-row rename PATCHes only title, never content', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([fileResource()]),
      'PATCH /api/v1/resources/res-2': { status: 200, body: { ...fileResource(), title: 'Renamed Handout' } },
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    const titleInput = await screen.findByDisplayValue('Handout.pdf');
    fireEvent.change(titleInput, { target: { value: 'Renamed Handout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body).toEqual({ title: 'Renamed Handout' });
    });
  });
});
