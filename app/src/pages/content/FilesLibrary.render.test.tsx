// DEC-161 render smoke for the DEC-159/DEC-160 central files library:
// mounts against real /api/v1/events/:eventId/files list-envelope shapes
// and asserts a marker element renders with zero console.error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-files-render-1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FilesLibrary render smoke', () => {
  it('renders the version-chain table with zero console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([
        {
          rootFileId: 'file-v1',
          latestFileId: 'file-v2',
          filename: 'slides.pdf',
          kind: 'presentation',
          submissionId: 'sub-1',
          submissionRef: 'SES-014',
          submissionTitle: 'Scaling Vector Search',
          speakerName: 'Priya Raman',
          uploadedAt: 1700000000000,
          versionCount: 2,
          sizeBytes: 1234567,
          uploaderName: 'Priya Raman',
        },
      ]),
    });

    const onSelectSubmission = vi.fn();
    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={onSelectSubmission} />);

    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    expect(await screen.findByText('slides.pdf')).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download ZIP (0)' })).toBeInTheDocument();

    // Filename, session, and Versions cells must all be real focusable
    // buttons (not onClick divs) so keyboard users and automation can
    // discover and open the deliverable detail drill-in.
    const openButtons = screen.getAllByRole('button', { name: 'Open slides.pdf versions and comments' });
    expect(openButtons).toHaveLength(3);
    for (const button of openButtons) {
      expect(button.tagName).toBe('BUTTON');
    }
    fireEvent.click(openButtons[0]!);
    expect(onSelectSubmission).toHaveBeenCalledWith('sub-1');
    fireEvent.click(openButtons[2]!);
    expect(onSelectSubmission).toHaveBeenCalledWith('sub-1');

    consoleError.mockRestore();
  });

  it('renders a dash instead of a dead control for rows with no submissionId', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([
        {
          rootFileId: 'file-orphan',
          latestFileId: 'file-orphan',
          filename: 'orphan.pdf',
          kind: 'presentation',
          submissionId: '',
          submissionRef: '',
          submissionTitle: '',
          speakerName: 'Unknown',
          uploadedAt: 1700000000000,
          versionCount: 1,
          sizeBytes: 1234567,
          uploaderName: 'Priya Raman',
        },
      ]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    expect(await screen.findByText('orphan.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open orphan\.pdf/ })).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('handles an empty library without erroring', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('renders deliverable-type chips and a search box (DEC-344 server-side filtering)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });

    // w1-f: the kind <select> is replaced by a chip strip whose counts come
    // from the list endpoint's own totals (mockApi returns the same
    // envelope regardless of query — here that's total: 0 for every kind).
    const typeTabs = screen.getByRole('tablist', { name: 'Deliverable type' });
    expect(within(typeTabs).getByRole('tab', { name: 'All types' })).toHaveClass('is-active');
    expect(within(typeTabs).getByRole('tab', { name: /Presentation/ })).toBeInTheDocument();
    expect(within(typeTabs).getByRole('tab', { name: /Poster/ })).toBeInTheDocument();
    expect(within(typeTabs).getByRole('tab', { name: /Handout/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Search files')).toBeInTheDocument();
  });

  it('renders a stat line and Download all button sourced from the list endpoint total, not the page', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      rootFileId: `file-${i}`,
      latestFileId: `file-${i}-latest`,
      filename: `slides-${i}.pdf`,
      kind: 'presentation' as const,
      submissionId: `sub-${i}`,
      submissionRef: `SES-${i}`,
      submissionTitle: `Talk ${i}`,
      speakerName: 'Speaker',
      uploadedAt: 1700000000000,
      versionCount: 1,
      sizeBytes: 1234567,
      uploaderName: 'Priya Raman',
    }));

    mockApi({
      // Envelope's own `total` (31) is far larger than the 3 items on this
      // page — the stat line must read 31, never items.length.
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, { total: 31, page: 1, perPage: 3 }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    expect(await screen.findByText('31 files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download all' })).toBeEnabled();
  });

  it('renders a Previous/Next pager driven by the envelope total', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(
        [
          {
            rootFileId: 'file-v1',
            latestFileId: 'file-v2',
            filename: 'slides.pdf',
            kind: 'presentation',
            submissionId: 'sub-1',
            submissionRef: 'SES-014',
            submissionTitle: 'Scaling Vector Search',
            speakerName: 'Priya Raman',
            uploadedAt: 1700000000000,
            versionCount: 2,
            sizeBytes: 1234567,
            uploaderName: 'Priya Raman',
          },
        ],
        { total: 137, page: 1, perPage: 50 },
      ),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    expect(await screen.findByText('Page 1 · 137 total')).toBeInTheDocument();
    const prevButton = screen.getByRole('button', { name: 'Previous' });
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('disables the Download ZIP button with a visible message once selection exceeds 50', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      rootFileId: `file-${i}`,
      latestFileId: `file-${i}-latest`,
      filename: `slides-${i}.pdf`,
      kind: 'presentation' as const,
      submissionId: `sub-${i}`,
      submissionRef: `SES-${i}`,
      submissionTitle: `Talk ${i}`,
      speakerName: 'Speaker',
      uploadedAt: 1700000000000,
      versionCount: 1,
      sizeBytes: 1234567,
      uploaderName: 'Priya Raman',
    }));

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, { total: 51, page: 1, perPage: 51 }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select all files on this page')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Select all files on this page'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download ZIP (51)' })).toBeDisabled();
    });
    // w1-h reskin: the archive-limit message must stay loud and legible
    // (shared .chq-error, bold, role=alert) rather than a quiet inline span.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Select at most 50 files to download as a ZIP.');
    expect(alert).toHaveClass('chq-error');
  });

  it('renders session/speaker/date/version metadata columns for a file row', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([
        {
          rootFileId: 'file-v1',
          latestFileId: 'file-v2',
          filename: 'slides.pdf',
          kind: 'presentation',
          submissionId: 'sub-1',
          submissionRef: 'SES-014',
          submissionTitle: 'Scaling Vector Search',
          speakerName: 'Priya Raman',
          uploadedAt: 1700000000000,
          versionCount: 2,
          sizeBytes: 1234567,
          uploaderName: 'Priya Raman',
        },
      ]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    const row = (await screen.findByText('slides.pdf')).closest('tr');
    if (!row) throw new Error('file row not found');
    expect(row).toHaveTextContent('Priya Raman');
    expect(row).toHaveTextContent('SES-014');
    expect(row).toHaveTextContent('Scaling Vector Search');
    expect(row).toHaveTextContent('2');
    // DEC-601 (3): the size column, formatted with the shared formatBytes
    // helper (1234567 bytes -> 1.2 MB).
    expect(row).toHaveTextContent('1.2 MB');
  });

  it('CNT-D5: reports the ZIP outcome in a role=status live region and shows a busy state while in flight', async () => {
    const item = {
      rootFileId: 'file-v1',
      latestFileId: 'file-v2',
      filename: 'slides.pdf',
      kind: 'presentation' as const,
      submissionId: 'sub-1',
      submissionRef: 'SES-014',
      submissionTitle: 'Scaling Vector Search',
      speakerName: 'Priya Raman',
      uploadedAt: 1700000000000,
      versionCount: 2,
      sizeBytes: 1234567,
      uploaderName: 'Priya Raman',
    };
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([item]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);
    await screen.findByText('slides.pdf');
    fireEvent.click(screen.getByLabelText(`Select ${item.filename}`));

    // jsdom doesn't implement URL.createObjectURL/revokeObjectURL — stub
    // them so the post-download <a download> trigger doesn't throw.
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    // Stub the archive POST directly (apiPostBlob reads headers + a real
    // Blob body, which mockApi's JSON-only helper doesn't produce).
    let resolveFetch: (res: Response) => void = () => {};
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/files/archive')) return fetchPromise;
        return realFetch(input, init);
      }),
    );

    const downloadButton = screen.getByRole('button', { name: 'Download ZIP (1)' });
    fireEvent.click(downloadButton);

    const status = screen.getByRole('status');
    // CNT-14: the live region confirms generation is in flight — the
    // disabled button state alone is not feedback.
    await waitFor(() => {
      expect(status).toHaveTextContent('Preparing ZIP…');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Downloading…' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Downloading…' })).toHaveAttribute('aria-busy', 'true');

    const zipBytes = new Uint8Array([1, 2, 3, 4]);
    resolveFetch(
      new Response(zipBytes, {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="evt-files.zip"' },
      }),
    );

    await waitFor(() => {
      expect(status).toHaveTextContent('evt-files.zip: 1 file, 4 B downloaded.');
    });
    expect(screen.getByRole('button', { name: 'Download ZIP (1)' })).not.toBeDisabled();
  });

  it('CNT-D5: reports the ApiError message in the live region when the ZIP download fails', async () => {
    const item = {
      rootFileId: 'file-v1',
      latestFileId: 'file-v2',
      filename: 'slides.pdf',
      kind: 'presentation' as const,
      submissionId: 'sub-1',
      submissionRef: 'SES-014',
      submissionTitle: 'Scaling Vector Search',
      speakerName: 'Priya Raman',
      uploadedAt: 1700000000000,
      versionCount: 2,
      sizeBytes: 1234567,
      uploaderName: 'Priya Raman',
    };
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([item]),
      [`POST /api/v1/events/${EVENT_ID}/files/archive`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Requested files total 42.0MB, which exceeds the 40MB archive limit. Select fewer files.' } },
      },
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);
    await screen.findByText('slides.pdf');
    fireEvent.click(screen.getByLabelText(`Select ${item.filename}`));
    fireEvent.click(screen.getByRole('button', { name: 'Download ZIP (1)' }));

    const status = screen.getByRole('status');
    await waitFor(() => {
      expect(status).toHaveTextContent(
        'Requested files total 42.0MB, which exceeds the 40MB archive limit. Select fewer files.',
      );
    });
  });

  it('DEC-669: switches to a separately-paginated Headshots tab that queries the headshots endpoint', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/headshots`]: listEnvelope([
        {
          fileId: 'file-hs-1',
          filename: 'priya.jpg',
          sizeBytes: 234567,
          contentType: 'image/jpeg',
          createdAt: 1700000000000,
          contactId: 'contact-1',
          contactName: 'Priya Raman',
          company: 'Acme Corp',
        },
      ]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Headshots' }));

    expect(await screen.findByText('priya.jpg')).toBeInTheDocument();
    const row = screen.getByText('priya.jpg').closest('tr');
    if (!row) throw new Error('headshot row not found');
    expect(row).toHaveTextContent('Priya Raman');
    expect(row).toHaveTextContent('Acme Corp');
    expect(row).toHaveTextContent('229.1 KB');

    const link = screen.getByRole('link', { name: 'priya.jpg' });
    expect(link).toHaveAttribute('href', '/headshots/file-hs-1');

    // Bulk-download / select-all controls stay on the deliverables tab only.
    expect(screen.queryByLabelText('Select all files on this page')).not.toBeInTheDocument();
    expect(screen.queryByText(/Download ZIP/)).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
