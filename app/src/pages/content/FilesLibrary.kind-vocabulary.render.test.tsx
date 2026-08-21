// w15-tb (DEC-613 wave-159 amendment): the files library draws its OWN
// kind-chip vocabulary, split from the session deliverable strip by
// SURFACE (`recording` -> "Video" here, "Recording" there) and its leading
// chip split by WIDTH ("All types" desktop, "All" phone, one pinned
// accessible name). Every frame citation below reads the ACTUAL pack line
// and asserts it byte-for-byte before asserting the product against it
// (DEC-967 shape), copied from Settings.frame-verdicts.render.test.tsx's
// own `verbatimLine`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-files-kind-vocab-1';

const ALL_ZERO_KIND_COUNTS = {
  presentation: 0,
  poster: 0,
  handout: 0,
  recording: 0,
  headshot: 0,
};

// Follows the matchMedia-stub idiom SessionList.render.test.tsx uses
// (itself following ContactDrawer.phoneRead.render.test.tsx) to force
// useIsPhone's split in jsdom, which implements no matchMedia at all --
// unstubbed in afterEach so every other test in this cluster keeps
// exercising the desktop tree by default.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function makeItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rootFileId: 'file-1',
    latestFileId: 'file-1-latest',
    filename: 'keynote.mp4',
    kind: 'recording' as const,
    submissionId: 'sub-1',
    submissionRef: 'SES-001',
    submissionTitle: 'Talk',
    speakerName: 'Speaker',
    uploadedAt: 1700000000000,
    versionCount: 1,
    versionNo: 1,
    sizeBytes: 1000,
    uploaderName: 'Priya Raman',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FilesLibrary kind vocabulary (DEC-613 wave-159 amendment)', () => {
  it('desktop: the recording chip reads "Video · 4", matching the frame line verbatim', async () => {
    verbatimLine(
      307,
      '          <a href="#" style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 14px; font-size:13px; font-weight:500; color:#3F4237">Video · 4</a>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([makeItem()], {
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, recording: 4 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'File type' })).toBeInTheDocument();
    });
    const typeTabs = screen.getByRole('tablist', { name: 'File type' });
    expect(within(typeTabs).getByRole('tab', { name: 'Video · 4' })).toBeInTheDocument();
    expect(within(typeTabs).queryByRole('tab', { name: /^Recording/ })).not.toBeInTheDocument();
  });

  it('phone (390): the recording chip still reads "Video · 4", matching the frame line verbatim', async () => {
    verbatimLine(
      346,
      '        <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500">Video · 4</span>',
    );

    stubPhoneMatchMedia();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([makeItem()], {
        kindCounts: { ...ALL_ZERO_KIND_COUNTS, recording: 4 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'File type' })).toBeInTheDocument();
    });
    const typeTabs = screen.getByRole('tablist', { name: 'File type' });
    expect(within(typeTabs).getByRole('tab', { name: 'Video · 4' })).toBeInTheDocument();
  });

  it('desktop: the leading chip renders "All types" visible text, matching the frame line verbatim', async () => {
    verbatimLine(
      305,
      '          <span style="background:#1B1D17; color:#F4F1E8; border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600">All types</span>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'File type' })).toBeInTheDocument();
    });
    const typeTabs = screen.getByRole('tablist', { name: 'File type' });
    const allTab = within(typeTabs).getByRole('tab', { name: 'All types' });
    expect(allTab).toHaveTextContent('All types');
  });

  it('phone (390): the leading chip renders "All" visible text but keeps "All types" as its accessible name, matching the frame line verbatim', async () => {
    verbatimLine(
      344,
      '        <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">All</span>',
    );

    stubPhoneMatchMedia();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([], { kindCounts: ALL_ZERO_KIND_COUNTS }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'File type' })).toBeInTheDocument();
    });
    const typeTabs = screen.getByRole('tablist', { name: 'File type' });
    // Accessible name is pinned via aria-label -- unchanged across viewport
    // (same idiom as DEC-833's desktop/phone label pair) -- even though the
    // visible text shrinks to "All" at 390.
    const allTab = within(typeTabs).getByRole('tab', { name: 'All types' });
    expect(allTab).toHaveTextContent('All');
    expect(allTab).not.toHaveTextContent('All types');
  });
});
