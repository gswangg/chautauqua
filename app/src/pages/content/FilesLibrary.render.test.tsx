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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

function makeItem(i: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    sizeBytes: 1000,
    uploaderName: 'Priya Raman',
    ...overrides,
  };
}

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

  it('pins File/Session/Version/Size column widths to the frame grid (w4-c, DEC-902)', async () => {
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
    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    await screen.findByText('slides.pdf');

    // Frame: docs/design/Chautauqua Content.dc.html:311 --
    // grid-template-columns: 1fr 190px 108px 92px auto; gap:16px.
    // File carries no width class (takes the 1fr remainder); the other
    // three are pinned classes styled in content.css.
    const table = screen.getByRole('table');
    const sessionHeader = within(table).getAllByRole('columnheader')[1]!;
    const versionHeader = within(table).getAllByRole('columnheader')[2]!;
    const sizeHeader = within(table).getAllByRole('columnheader')[3]!;
    expect(sessionHeader).toHaveClass('chq-content-files-col-session');
    expect(versionHeader).toHaveClass('chq-content-files-col-version');
    expect(sizeHeader).toHaveClass('chq-content-files-col-size');
  });

  // Frame: docs/design/Chautauqua Content.dc.html:311 --
  // grid-template-columns: 1fr 190px 108px 92px auto; gap:16px. File takes
  // the 1fr remainder (no width class); Session/Version/Size are pinned.
  it('pins the four Files table column-width literals to the frame (w4-c, DEC-902)', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
    const sessionMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-session\s*\{([^}]*)\}/);
    const versionMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-version\s*\{([^}]*)\}/);
    const sizeMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-size\s*\{([^}]*)\}/);
    expect(sessionMatch).not.toBeNull();
    expect(versionMatch).not.toBeNull();
    expect(sizeMatch).not.toBeNull();
    expect(sessionMatch![1]).toMatch(/width:\s*190px/);
    expect(versionMatch![1]).toMatch(/width:\s*108px/);
    expect(sizeMatch![1]).toMatch(/width:\s*92px/);
  });

  // w18-d (DEC-902 amendment): under table-layout:auto the remainder went
  // to the LAST unwidthed column -- the trailing actions <th>/<td>, not
  // File -- so the fleet measured File at 127px and Actions at 923px. The
  // actions column now carries its own hug-width class, leaving File as
  // the sole remainder column.
  it('pins the trailing actions header and cell to the hug-width class (w18-d, DEC-902)', async () => {
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
    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    await screen.findByText('slides.pdf');

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    const actionsHeader = headers[headers.length - 1]!;
    expect(actionsHeader).toHaveClass('chq-content-files-col-actions');

    const rows = within(table).getAllByRole('row');
    const dataRow = rows[1]!;
    const cells = within(dataRow).getAllByRole('cell');
    const actionsCell = cells[cells.length - 1]!;
    expect(actionsCell).toHaveClass('chq-content-files-col-actions');
  });

  // w18-d (DEC-902 amendment): table-layout:fixed makes every column's
  // width explicit so the browser stops handing the remainder to whichever
  // unwidthed column happens to be last.
  it('the files table declares table-layout:fixed and the actions column hugs its content (w18-d, DEC-902)', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
    const tableMatch = css.match(/\.chq-content-files-table\s*\{([^}]*)\}/);
    const actionsMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-actions\s*\{([^}]*)\}/);
    expect(tableMatch).not.toBeNull();
    expect(actionsMatch).not.toBeNull();
    expect(tableMatch![1]).toMatch(/table-layout:\s*fixed/);
    expect(actionsMatch![1]).toMatch(/width:\s*1px/);
    expect(actionsMatch![1]).toMatch(/white-space:\s*nowrap/);
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

    // w5-i: a headshot has no submission -- the SESSION cell states that
    // plainly rather than rendering blank (an empty cell reads as a data
    // gap, not a structural fact of what a headshot is).
    expect(screen.getByText(/No session/)).toBeInTheDocument();

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
    expect(within(typeTabs).getByRole('tab', { name: 'Slides · 4' })).toBeInTheDocument();
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
    // CNT-14 (DEC-160, wave-65 amendment): "all" is reserved for the whole
    // filtered set — a page of a larger set (3 of 31) names its true scope
    // and never claims the event's total.
    expect(within(headerRow).getByRole('button', { name: 'Download 3 files (.zip)' })).toBeInTheDocument();
    expect(
      within(headerRow).getByText(/28 files more in this filtered set won't be included/),
    ).toBeInTheDocument();
  });

  it('CNT-14: "Download all" posts the visible rows\' latestFileId set to the archive endpoint', async () => {
    const items = Array.from({ length: 3 }, (_, i) => makeItem(i));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, {
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 3 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const button = await screen.findByRole('button', { name: 'Download all 3 (.zip)' });
    expect(button).not.toBeDisabled();

    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    let capturedBody: unknown = null;
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/files/archive')) {
          capturedBody = init?.body ? JSON.parse(init.body as string) : null;
          return Promise.resolve(
            new Response(new Uint8Array([1, 2, 3]), {
              status: 200,
              headers: { 'content-disposition': 'attachment; filename="files.zip"' },
            }),
          );
        }
        return realFetch(input, init);
      }),
    );

    fireEvent.click(button);

    await waitFor(() => {
      expect(capturedBody).toEqual({ fileIds: ['file-0-latest', 'file-1-latest', 'file-2-latest'] });
    });
  });

  it('DEC-160 (wave-65 amendment): "Download all" survives its label only when the page IS the whole filtered set', async () => {
    const items = Array.from({ length: 3 }, (_, i) => makeItem(i));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, {
        total: 3,
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 3 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    expect(await screen.findByRole('button', { name: 'Download all 3 (.zip)' })).toBeInTheDocument();
    expect(screen.queryByText(/won't be included/)).not.toBeInTheDocument();
  });

  it('DEC-160 (wave-65 amendment): a page of a larger filtered set names its true scope, states the remainder, and still posts exactly the visible latestFileIds', async () => {
    const items = Array.from({ length: 50 }, (_, i) => makeItem(i));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, {
        total: 120,
        page: 1,
        perPage: 50,
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 120 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const button = await screen.findByRole('button', { name: 'Download 50 files (.zip)' });
    expect(button).not.toBeDisabled();
    expect(button.textContent).not.toContain('all');
    expect(screen.getByText(/70 files more in this filtered set won't be included/)).toBeInTheDocument();
    expect(
      screen.getByText(/narrow the search or type chip to change what this downloads/),
    ).toBeInTheDocument();

    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    let capturedBody: unknown = null;
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/files/archive')) {
          capturedBody = init?.body ? JSON.parse(init.body as string) : null;
          return Promise.resolve(
            new Response(new Uint8Array([1, 2, 3]), {
              status: 200,
              headers: { 'content-disposition': 'attachment; filename="files.zip"' },
            }),
          );
        }
        return realFetch(input, init);
      }),
    );

    fireEvent.click(button);

    await waitFor(() => {
      expect(capturedBody).toEqual({ fileIds: items.map((item) => item.latestFileId) });
    });
  });

  it('CNT-14: the "Download all" control does not render for an empty visible set', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Download all/ })).not.toBeInTheDocument();
  });

  it('CNT-14: renders disabled with the cap reason once the visible set exceeds MAX_ARCHIVE_FILES', async () => {
    const items = Array.from({ length: 51 }, (_, i) => makeItem(i));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, {
        total: 51,
        page: 1,
        perPage: 51,
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, presentation: 51 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    const button = await screen.findByRole('button', { name: 'Download all 51 (.zip)' });
    expect(button).toBeDisabled();
    expect(screen.getByText('50 files or 20.0 MB at a time — narrow the filter')).toBeInTheDocument();
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

  // DEC-678 amendment (B7, task-w46-e): a loaded, empty visible set never
  // renders the <table> — no columnheader role survives. With no
  // search/kind facet in flight it's 'fresh' (no button at all — files
  // arrive from speakers, so this page offers no producer action); with a
  // facet applied it's 'filtered' (names the facet, offers exactly one
  // escape that clears it).
  describe('B7 zero-row states render no <table> (DEC-678 amendment)', () => {
    it('renders no columnheader and no button at all when the library is fresh (no facet)', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
      });

      render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
      });
      expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
      // No 'Download all' (the set is empty), and B7 rule 3 forbids
      // fabricating a primary action here (the producer is the speaker, not
      // this page) — no escape link either, since there is no facet to
      // clear.
      expect(screen.queryByRole('button', { name: /Download all/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /./ })).not.toBeInTheDocument();
    });

    it('renders no columnheader, names the search facet, and offers exactly one escape that clears it', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
      });

      render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'nonexistent-file' } });

      await waitFor(() => {
        expect(screen.getByText(/Filtered by search "nonexistent-file"/)).toBeInTheDocument();
      });
      expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
      const escapeButtons = screen.getAllByRole('button', { name: 'Clear filters' });
      expect(escapeButtons).toHaveLength(1);

      fireEvent.click(escapeButtons[0]!);
      await waitFor(() => {
        expect(screen.getByLabelText('Search files')).toHaveValue('');
      });
    });

    it('still renders a <table> with columnheaders while loading, even with zero items', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
      });

      render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

      // Before the fetch resolves, the loading branch still renders the
      // full table shell with its columnheaders (untouched by this
      // amendment).
      expect(screen.queryAllByRole('columnheader').length).toBeGreaterThan(0);

      await waitFor(() => {
        expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// v12 phone pass (390 frame "Files · 390"). css-text pins — jsdom evaluates
// neither @media nor an external stylesheet. The desktop fixed-layout column
// pins above are untouched; the card rules live only inside the max-width
// block and only RELEASE those widths there.
// ---------------------------------------------------------------------------

function filesPhoneBlock(): string {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
  const open = source.indexOf('@media (max-width: 700px) {');
  expect(open).toBeGreaterThan(-1);
  const bodyStart = source.indexOf('{', open) + 1;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

function filesPhoneRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `no phone rule for \`${selector}\``).not.toBeNull();
  return match![1]!;
}

describe('FilesLibrary: the 390 frame header stack and file card', () => {
  const ROW = '.chq-content-files-library .chq-content-table tr.chq-content-row';

  it('stacks the header — back link, title, summary, then a full-measure Download all', () => {
    const phone = filesPhoneBlock();

    const headerRow = filesPhoneRule(phone, '.chq-content-files-header-row');
    expect(headerRow).toMatch(/flex-direction:\s*column/);
    expect(headerRow).toMatch(/align-items:\s*stretch/);

    const headerActions = filesPhoneRule(phone, '.chq-content-files-header-actions');
    expect(headerActions).toMatch(/flex-direction:\s*column/);
    expect(headerActions).toMatch(/align-items:\s*stretch/);

    expect(filesPhoneRule(phone, '.chq-content-files-download-all-wrap')).toMatch(/align-items:\s*stretch/);

    // The breadcrumb is a real tap target on a phone (DESIGN-RULINGS 44px).
    const crumb = filesPhoneRule(phone, '.chq-content-files-breadcrumb');
    expect(crumb).toMatch(/min-height:\s*44px/);

    // The search field owns its own line above the chips it narrows.
    expect(filesPhoneRule(phone, '.chq-content-files-toolbar .chq-input')).toMatch(/flex:\s*1 1 100%/);
  });

  it('reflows the file row into name + version, session, size, then a full-measure Download', () => {
    const phone = filesPhoneBlock();

    const row = filesPhoneRule(phone, ROW);
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto/);
    expect(row).toMatch(/padding:\s*15px 0/);

    expect(filesPhoneRule(phone, `${ROW} > td:nth-child(1)`)).toMatch(/grid-row:\s*1/);
    expect(filesPhoneRule(phone, `${ROW} > td:nth-child(3)`)).toMatch(/grid-row:\s*1/);
    expect(filesPhoneRule(phone, `${ROW} > td:nth-child(3)`)).toMatch(/grid-column:\s*2/);
    expect(filesPhoneRule(phone, `${ROW} > td:nth-child(5)`)).toMatch(/grid-column:\s*1 \/ span 2/);
  });

  it('releases the desktop fixed-layout cell widths on the card, so Download is not clamped to 150px', () => {
    const phone = filesPhoneBlock();
    expect(filesPhoneRule(phone, `${ROW} > td`)).toMatch(/width:\s*auto/);

    // …and the desktop widths themselves are still declared, above the block.
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content.css'), 'utf-8');
    const desktop = source.slice(0, source.indexOf('@media (max-width: 700px) {'));
    expect(desktop).toMatch(/\.chq-content-files-col-actions\s*\{[^}]*width:\s*150px/);
    expect(desktop).toMatch(/\.chq-content-files-col-size\s*\{[^}]*width:\s*92px/);
  });

  it('gives the row Download a bordered 44px face — min-height plus horizontal padding', () => {
    const phone = filesPhoneBlock();
    const link = filesPhoneRule(phone, '.chq-content-files-library .chq-content-files-col-actions .chq-link-button');
    expect(link).toMatch(/min-height:\s*44px/);
    expect(link).toMatch(/padding:\s*0 14px/);
    expect(link).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(link).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
  });
});
