// DEC-161 render smoke for the DEC-159/DEC-160 central files library:
// mounts against real /api/v1/events/:eventId/files list-envelope shapes
// and asserts a marker element renders with zero console.error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('renders a kind filter and search box (DEC-344 server-side filtering)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });

    const kindSelect = screen.getByLabelText('Filter by kind') as HTMLSelectElement;
    expect(Array.from(kindSelect.options).map((o) => o.textContent)).toEqual([
      'All',
      'Presentation',
      'Poster',
      'Handout',
    ]);
    expect(screen.getByLabelText('Search files')).toBeInTheDocument();
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
  });
});
