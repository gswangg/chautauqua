// DEC-941: deleting a resource is irreversible, so the row's Delete link
// must open the shared ConfirmDialog and only DELETE after an explicit
// confirm -- never on the first click.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ResourcesPanel } from './ResourcesPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { allowedUploadExtensions, uploadHintText } from '../../../../src/domain/files';
import { MARKDOWN_SYNTAX_HINT } from '../../lib/markdown-hint';

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

describe('ResourcesPanel (DEC-785 amendment, wave 66)', () => {
  it('renders the full add/edit/delete surface directly at rest, with no local Change/Back drill', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([resource(), fileResource()]),
    });

    render(<ResourcesPanel />);

    expect(await screen.findByText('Speaker FAQ')).toBeInTheDocument();
    expect(screen.getByText('Handout.pdf')).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add a resource' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

describe('ResourcesPanel readOnly prop (DEC-815 amendment, wave 4)', () => {
  it('renders the real resource rows with no Change control and no add/delete surface, ever', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([resource(), fileResource()]),
    });

    render(<ResourcesPanel readOnly />);

    expect(await screen.findByText('Speaker FAQ')).toBeInTheDocument();
    expect(screen.getByText('Wiki page')).toBeInTheDocument();
    expect(screen.getByText('Handout.pdf')).toBeInTheDocument();
    expect(screen.getByText(/^File/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/files/file-1');

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a resource' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
  });

  it('renders the empty state with no Change control when there are no resources', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    });

    render(<ResourcesPanel readOnly />);

    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
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

    // DEC-941 (wave-58 amendment): irreversible weight -- the primary stays
    // disabled until the resource's own title is typed.
    expect(within(dialog).getByRole('button', { name: 'Delete resource' })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Speaker FAQ' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete resource' }));

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

describe('ResourcesPanel file upload discloses caps up front (w63-c)', () => {
  it('sets accept to the handout allowlist and renders the caps hint, derived from the domain module', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));
    fireEvent.click(await screen.findByRole('button', { name: 'File' }));

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const expectedAccept = allowedUploadExtensions('handout')
      .map((e) => `.${e}`)
      .join(',');
    expect(fileInput).toHaveAttribute('accept', expectedAccept);

    expect(screen.getByText(uploadHintText('handout'))).toBeInTheDocument();
  });

  it('refuses a wrong-extension pick client-side, names the allowed types, keeps the typed Title, and never calls apiUpload', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));
    fireEvent.click(await screen.findByRole('button', { name: 'File' }));

    const fileTitleInput = screen.getByPlaceholderText('Title');
    fireEvent.change(fileTitleInput, { target: { value: 'My Slides' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['x'], 'malware.exe', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    fireEvent.click(screen.getByRole('button', { name: 'Upload file' }));

    const alert = await screen.findByRole('alert');
    for (const ext of allowedUploadExtensions('handout')) {
      expect(alert.textContent).toContain(ext);
    }
    expect(alert.textContent).toContain('Title is kept');

    expect((screen.getByPlaceholderText('Title') as HTMLInputElement).value).toBe('My Slides');

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false);
  });
});

describe('ResourcesPanel Add-a-resource modal (DEC-047 wave-64 amendment)', () => {
  it('opens as a modal dialog from the Add a resource control, with exactly one kind (Wiki page) selected by default', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    });

    render(<ResourcesPanel />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Wiki page' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'File' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders exactly one kind\'s fields at a time, switching when the chips are clicked', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));

    // Wiki page selected by default: content textarea present, no file input.
    expect(document.querySelector('textarea')).not.toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add wiki page' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload file' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'File' }));

    // File selected: file input present, no content textarea.
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add wiki page' })).not.toBeInTheDocument();

    // Only one Title input in the DOM at any time.
    expect(screen.getAllByPlaceholderText('Title')).toHaveLength(1);
  });

  it('submitting the wiki kind POSTs to the resources endpoint and closes the modal', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/resources`]: { status: 201, body: resource() },
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Speaker FAQ' } });
    fireEvent.change(document.querySelector('textarea')!, { target: { value: 'Some content' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add wiki page' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body).toEqual({ title: 'Speaker FAQ', content: 'Some content' });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('submitting the File kind calls the same upload endpoint the row-level upload uses', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/resources`]: { status: 201, body: fileResource() },
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));
    fireEvent.click(screen.getByRole('button', { name: 'File' }));

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Handout.pdf' } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = new File(['x'], 'handout.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });

    fireEvent.click(screen.getByRole('button', { name: 'Upload file' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('ResourcesPanel wiki-page content states the Markdown grammar it applies (w1-g, DEC-747)', () => {
  it('shows the syntax hint under the add form content textarea', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a resource' }));

    expect(screen.getByText(MARKDOWN_SYNTAX_HINT)).toBeInTheDocument();
  });

  it('shows the syntax hint under the edit form content textarea', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([resource()]),
    });

    render(<ResourcesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    expect(screen.getByText(MARKDOWN_SYNTAX_HINT)).toBeInTheDocument();
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
