// DEC-161/773/902 render smoke for the central files library: mounts against
// real /api/v1/events/:eventId/files list-envelope shapes (ONE list —
// deliverable version chains AND headshot rows, no tabs, kindCounts/total/
// totalSizeBytes all read from the SAME envelope, no fan-out) and asserts a
// marker element renders with zero console.error.
//
// Amendment (wave 41, DEC-773): the table is exactly five columns — FILE /
// SESSION / VERSION / SIZE / Download — with no select-all checkbox and no
// bulk ZIP control; uploader + upload date fold into the FILE cell's
// subline instead of their own UPLOADED column.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-files-render-1';

const ALL_ZERO_KIND_COUNTS = {
  presentation: 0,
  poster: 0,
  handout: 0,
  recording: 0,
  headshot: 0,
};

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
            versionNo: 2,
            sizeBytes: 1234567,
            uploaderName: 'Priya Raman',
          },
        ],
        { kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 1 } },
      ),
    });

    const onSelectSubmission = vi.fn();
    const onBack = vi.fn();
    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={onSelectSubmission} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    expect(await screen.findByText('slides.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('Priya Raman', { exact: false }).length).toBeGreaterThan(0);

    // No checkbox and no ZIP control render (wave 41 amendment).
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download ZIP/ })).not.toBeInTheDocument();

    // Filename and session cells must be real focusable buttons (not
    // onClick divs) so keyboard users and automation can discover and open
    // the deliverable detail drill-in.
    const openButtons = screen.getAllByRole('button', { name: 'Open slides.pdf versions and comments' });
    expect(openButtons).toHaveLength(2);
    for (const button of openButtons) {
      expect(button.tagName).toBe('BUTTON');
    }
    fireEvent.click(openButtons[0]!);
    expect(onSelectSubmission).toHaveBeenCalledWith('sub-1');
    fireEvent.click(openButtons[1]!);
    expect(onSelectSubmission).toHaveBeenCalledWith('sub-1');

    // A per-row Download link to the authenticated file-serve route.
    const downloadLink = screen.getByRole('link', { name: 'Download slides.pdf' });
    expect(downloadLink).toHaveAttribute('href', '/files/file-v2');

    // The breadcrumb is a real link back to the worklist.
    fireEvent.click(screen.getByRole('button', { name: /Content/ }));
    expect(onBack).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('renders a headshot row as a plain filename with its own version number', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(
        [
          {
            rootFileId: 'file-hs-1',
            latestFileId: 'file-hs-1',
            filename: 'priya.jpg',
            kind: 'headshot',
            submissionId: '',
            submissionRef: '',
            submissionTitle: '',
            speakerName: 'Priya Raman',
            uploadedAt: 1700000000000,
            versionCount: 1,
            versionNo: 1,
            sizeBytes: 234567,
            uploaderName: 'Priya Raman',
          },
        ],
        { kindCounts: { ...ALL_ZERO_KIND_COUNTS, headshot: 1 } },
      ),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    expect(await screen.findByText('priya.jpg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open priya\.jpg/ })).not.toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();

    // A headshot row's Download link serves through the gated headshot
    // route, never /files/:fileId (headshots are structurally disjoint
    // from submission deliverables — DEC-773).
    const downloadLink = screen.getByRole('link', { name: 'Download priya.jpg' });
    expect(downloadLink).toHaveAttribute('href', '/headshots/file-hs-1');

    consoleError.mockRestore();
  });

  it('handles an empty library without erroring', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('renders a chip only for a kind with a nonzero count, from the SAME envelope as the list — no tab strip', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], {
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 4, headshot: 2 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'File type' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: 'Deliverables' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Headshots' })).not.toBeInTheDocument();
    const typeTabs = screen.getByRole('tablist', { name: 'File type' });
    expect(within(typeTabs).getByRole('tab', { name: 'All types' })).toHaveClass('is-active');
    // Nonzero kinds get a chip, with the SAME count the list's own envelope
    // supplied.
    expect(within(typeTabs).getByRole('tab', { name: 'Presentation · 4' })).toBeInTheDocument();
    expect(within(typeTabs).getByRole('tab', { name: 'Headshot · 2' })).toBeInTheDocument();
    // A zero-count kind (DEC-902) offers no chip — a filter that can only
    // empty the list is a dead control.
    expect(within(typeTabs).queryByRole('tab', { name: /Poster/ })).not.toBeInTheDocument();
    expect(within(typeTabs).queryByRole('tab', { name: /Handout/ })).not.toBeInTheDocument();
    expect(within(typeTabs).queryByRole('tab', { name: /Recording/ })).not.toBeInTheDocument();

    // The search box sits to the LEFT of the chip strip it narrows.
    const toolbar = screen.getByLabelText('Search files').closest('.chq-content-files-toolbar');
    if (!toolbar) throw new Error('toolbar not found');
    const children = Array.from(toolbar.children);
    const searchIndex = children.findIndex((el) => el.contains(screen.getByLabelText('Search files')));
    const chipIndex = children.indexOf(typeTabs);
    expect(searchIndex).toBeGreaterThanOrEqual(0);
    expect(chipIndex).toBeGreaterThan(searchIndex);
  });

  it('renders a page header — breadcrumb, H1 "Files", and the total/size stat on the header row', async () => {
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
      versionNo: 1,
      sizeBytes: 1234567,
      uploaderName: 'Priya Raman',
    }));

    mockApi({
      // Envelope's own `total`/`totalSizeBytes` (31 files, 412 MB) is far
      // larger than the 3 items on this page — the stat line must read
      // those, never items.length/a page-derived sum.
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, {
        total: 31,
        totalSizeBytes: 412 * 1024 * 1024,
        page: 1,
        perPage: 3,
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 31 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const heading = await screen.findByRole('heading', { name: 'Files', level: 1 });
    const headerRow = heading.closest<HTMLElement>('.chq-content-files-header-row');
    if (!headerRow) throw new Error('header row not found');
    expect(within(headerRow).getByText('31 files · 412.0 MB')).toBeInTheDocument();
    expect(within(headerRow).getByRole('button', { name: /Content/ })).toBeInTheDocument();
    // The bulk 'Download all' control leaves the library with the ZIP
    // selection UI (wave 41 amendment) — the archive endpoint's one
    // remaining caller is the deliverable detail's own 'Download all'.
    expect(within(headerRow).queryByRole('button', { name: 'Download all' })).not.toBeInTheDocument();
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
            versionNo: 2,
            sizeBytes: 1234567,
            uploaderName: 'Priya Raman',
          },
        ],
        { total: 137, page: 1, perPage: 50, kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 137 } },
      ),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    expect(await screen.findByText('Page 1 · 137 total')).toBeInTheDocument();
    const prevButton = screen.getByRole('button', { name: 'Previous' });
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('renders the exact five column headers: FILE / SESSION / VERSION / SIZE / (download)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const table = await screen.findByRole('table');
    const headerCells = within(table).getAllByRole('columnheader');
    expect(headerCells).toHaveLength(5);
    expect(headerCells.map((c) => c.textContent)).toEqual(['File', 'Session', 'Version', 'Size', '']);
  });

  it('renders session/date/version/size metadata columns for a file row, with uploader/date folded into the FILE cell subline', async () => {
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
            versionNo: 2,
            sizeBytes: 1234567,
            uploaderName: 'Priya Raman',
          },
        ],
        { kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 1 } },
      ),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const row = (await screen.findByText('slides.pdf')).closest('tr');
    if (!row) throw new Error('file row not found');
    expect(row).toHaveTextContent('SES-014');
    expect(row).toHaveTextContent('Scaling Vector Search');
    // VERSION shows the file's OWN version number (versionNo), never the
    // chain-length marker (versionCount, which is 2 here vs. versionNo 2
    // coincidentally equal — the distinct 'v' prefix is the regression
    // signal that this reads versionNo, not a bare count).
    expect(row).toHaveTextContent('v2');
    // DEC-601 (3): the size column, formatted with the shared formatBytes
    // helper (1234567 bytes -> 1.2 MB).
    expect(row).toHaveTextContent('1.2 MB');
    // The FILE cell subline folds uploader + upload date together.
    const who = row.querySelector('.chq-content-file-who');
    if (!who) throw new Error('who subline not found');
    expect(who.textContent).toContain('Priya Raman');
    expect(who.textContent).toContain('·');
  });

  it('renders an em dash in the FILE subline when the uploader is unknown', async () => {
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
            versionCount: 1,
            versionNo: 1,
            sizeBytes: 1234567,
            uploaderName: null,
          },
        ],
        { kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 1 } },
      ),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const row = (await screen.findByText('slides.pdf')).closest('tr');
    if (!row) throw new Error('file row not found');
    const who = row.querySelector('.chq-content-file-who');
    if (!who) throw new Error('who subline not found');
    expect(who.textContent).toContain('—');
  });
});
