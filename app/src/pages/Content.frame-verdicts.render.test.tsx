// w13-ra (DEC-976 wave-157): the phone CLAIMED_FLOOR row for the Content
// cluster reads 53/53 event-wide, but NONE of Content's four width:390px
// frames (docs/design/Chautauqua Content.dc.html:198, :247, :338, :373)
// had ever been RENDERED against the tree -- Content is recorded as
// 'DONE' in docs/mobile-campaign.md on the strength of a probe, not a
// render receipt. This task builds that receipt, modelled EXACTLY on
// Settings.frame-verdicts.render.test.tsx (DEC-976 amendment wave 154,
// task w10-ne): one it() per frame, each opening with a verbatimLine()
// citation of the frame's own caption line (so it cannot silently rot to
// the wrong line), rendering through the REAL route
// (<MemoryRouter><ContentApp/></MemoryRouter>, never a sub-component
// mounted directly), and stating MATCHES/DIVERGES with the divergence
// named. A DIVERGES verdict is a FINDING, not a failure -- this file must
// stay green while it records that a screen does not match, exactly like
// the Settings file. Prose lives in docs/design/audit/content-v12.md; this
// file is the render RECEIPT each verdict row there cites.
//
// jsdom applies no stylesheet (no @media), so every assertion below is
// about DOM STRUCTURE/ORDER, never computed geometry -- consistent with
// every other render-test file in this cluster.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContentApp } from './content/ContentApp';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches
 * the literal this file claims -- a citation that can never silently rot
 * to a wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-content-frame-verdicts';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

// DEC-935: mirrors App.tsx's own two <Route>s for /content (worklist) and
// /content/:submissionId (deliverable detail) -- both render the SAME
// ContentApp component (copied from ContentApp.render.test.tsx's own
// renderContentApp helper), so this file mounts it under the real route
// shape rather than at a bare "/".
function renderContentApp(initialPath = '/content') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/content/:submissionId" element={<ContentApp />} />
        <Route path="/content" element={<ContentApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

// GET /api/v1/me (DEC-024) is fetched unconditionally by the shared
// `useMe` hook some content sub-views mount (comment authoring) --
// registered in every mockApi() call below so an unrelated route-not-found
// throw never masks the frame verdict itself.
const ME_ENVELOPE = { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' };

const oneWorklistRow = {
  id: 'sub-1',
  ref: 'DFC-014',
  title: 'Taming 40-Minute CI',
  status: 'accepted',
  contentStatus: 'changes_requested',
  speakers: [{ contactId: 'c1', name: 'Priya Raman' }],
  trackIds: [],
  submittedAt: null,
  createdAt: 1700000000000,
  latestFile: { filename: 'slides-v3.pdf', kind: 'presentation', versionCount: 3, uploadedAt: 1700000100000 },
  latestFileByKind: { presentation: 3 },
  reuploaded: true,
};

describe('v12 Content 390 frames: per-frame render verdict receipts (w13-ra, DEC-976)', () => {
  // Frame :198-238 "Content" -- caption at :195.
  it('frame :198 Content worklist -- DIVERGES: rows are table cells (select checkbox + separate Speaker/Latest-file/Status columns), not the frame\'s status-first stacked card', async () => {
    verbatimLine(195, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Content</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([oneWorklistRow], {
        contentStatusCounts: { pending: 0, approved: 9, changes_requested: 5 },
        reuploadedCount: 2,
      }),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp();

    // The frame's header line reads "5 need a decision · 2 re-uploaded" --
    // this matches (DEC-913's grouped-aggregate headline).
    await waitFor(() => {
      expect(screen.getByText('5 need a decision · 2 re-uploaded')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();

    // Frame :226-236 draws each row as ONE stacked card: status pill, then
    // title, then "speaker · file, when" on one line, then an
    // Approve/Open action row -- no selection control anywhere on the
    // worklist screen. The real row is a <table> <tr> whose first cell is
    // a per-row selection checkbox (DEC-825 amendment) ahead of the
    // Session cell, and Speaker / Latest file / Status are three separate
    // cells rather than one combined line.
    const row = document.querySelector<HTMLElement>('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');
    expect(within(row).getByRole('checkbox', { name: 'Select Taming 40-Minute CI' })).toBeInTheDocument();
    const cells = row.querySelectorAll('td');
    // cell 0 = select, 1 = session (title+ref), 2 = speaker, 3 = latest
    // file, 4 = status, 5 = actions -- the frame instead opens each card
    // with the status pill, before the title.
    expect(cells).toHaveLength(6);
    expect(cells[1]).toHaveTextContent('Taming 40-Minute CI');
    expect(cells[2]).toHaveTextContent('Priya Raman');
    expect(cells[4]).toHaveTextContent('Re-uploaded');
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  // Frame :247-284 "Content · selecting" -- caption at :243.
  it('frame :247 Content selecting -- DIVERGES: no per-row check icon, the idle summary line stays mounted alongside "N selected", and the bar renders inside the worklist column rather than as the header\'s own footer', async () => {
    verbatimLine(243, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Content · selecting</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([oneWorklistRow], {
        contentStatusCounts: { pending: 0, approved: 9, changes_requested: 5 },
        reuploadedCount: 2,
      }),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp();

    await screen.findByRole('button', { name: 'Select' });
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    // The header's "selecting" meta row (w1-e) DOES match the frame's
    // "N selected / All N / Done" line (:255-257) -- but it renders
    // ALONGSIDE the rest-state summary line rather than replacing it: the
    // header block's summary-line clause carries no `!phoneSelectMode`
    // guard, so "N need a decision · M re-uploaded" (frame :198-203's OWN
    // idle-state text) stays mounted underneath the "selecting" row the
    // frame draws as swapping it out for.
    expect(await screen.findByText('0 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('5 need a decision · 2 re-uploaded')).toBeInTheDocument();

    // Frame :266-273 draws a leading check-mark glyph on each row ahead of
    // the status pill -- the real row instead carries the SAME plain
    // checkbox input the rest-state worklist row does (DEC-825's one
    // selection model, no second UI for select mode), which this test
    // must find to prove the divergence rather than assume it.
    const row = document.querySelector<HTMLElement>('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');
    expect(within(row).getByRole('checkbox', { name: 'Select Taming 40-Minute CI' })).toBeInTheDocument();
    expect(within(row).queryByText('✓')).not.toBeInTheDocument();

    // Frame :278-283 draws the "Approve 2"/consequence-line footer pinned
    // to the SCREEN'S bottom, outside the row list. The real bulk bar
    // (role=toolbar) is a sibling of the table INSIDE the same
    // `.chq-content-worklist` scroller, not the header's own row.
    const bar = screen.getByRole('toolbar', { name: 'Bulk content actions' });
    const worklist = document.querySelector('.chq-content-worklist');
    expect(worklist).not.toBeNull();
    expect(worklist!.contains(bar)).toBe(true);
  });

  // Frame :338-368 "Files · 390" -- caption at :334.
  it('frame :338 Files library (phone) -- DIVERGES: chip strip reads "All types" not "All", and the header row (not the frame\'s stat line alone) carries a Download-all control the frame reserves for the footer dock', async () => {
    verbatimLine(334, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Files · 390</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(
        [
          {
            rootFileId: 'file-v1',
            latestFileId: 'file-v3',
            filename: 'slides-v3.pdf',
            kind: 'presentation',
            submissionId: 'sub-1',
            submissionRef: 'DFC-014',
            submissionTitle: 'Taming 40-Minute CI',
            speakerName: 'Priya Raman',
            uploadedAt: 1700000100000,
            versionCount: 3,
            versionNo: 3,
            sizeBytes: 4096,
            uploaderName: 'Priya Raman',
          },
        ],
        { total: 31, totalSizeBytes: 412 * 1024 * 1024, kindCounts: { presentation: 22, recording: 4, handout: 5 } },
      ),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp('/content?view=files');

    await screen.findByRole('button', { name: '‹ Content' });
    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
    // Frame :340 states "31 files · 412 MB" under the H1 -- the real stat
    // line matches in shape but formatBytes (src/domain/files.ts) always
    // carries one decimal place, so it reads "412.0 MB", not the frame's
    // bare "412 MB".
    expect(screen.getByText('31 files · 412.0 MB')).toBeInTheDocument();

    // Frame :344 draws a plain "All" chip and a "Video · 4" chip; the real
    // toolbar reads "All types" (SessionList's tab-strip vocabulary carried
    // over) and, since the domain kind is `recording` not `video`
    // (DELIVERABLE_LABELS, types.ts), "Recording · 4" rather than "Video · 4".
    expect(screen.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All types' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Slides · 22' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Video · 4' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recording · 4' })).toBeInTheDocument();

    // Frame :338-368 reserves "Download all"/"Search" for the sticky
    // footer dock (:365-367) -- the header row above the chips carries no
    // download control at all in the mock. The real header row DOES mount
    // a "Download all N (.zip)" secondary beside the stat line, ahead of
    // the toolbar -- a second copy of the same capability the footer dock
    // also renders (content.css/FilesLibrary.tsx comment already names
    // this as deliberate, wave-125 amendment), not what the frame draws.
    const headerRow = document.querySelector<HTMLElement>('.chq-content-files-header-row');
    expect(headerRow).not.toBeNull();
    // (Reads "Download 1 file (.zip)" rather than "Download all N" because
    // this fixture's one item is fewer than `total` -- the scoped-count
    // wording, same handler, still the header row's own copy of the
    // capability.)
    expect(within(headerRow!).getByRole('button', { name: /Download/ })).toBeInTheDocument();

    // The footer dock itself DOES match: primary "Download all" beside a
    // bordered "Search" secondary.
    const dock = document.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons.map((b) => b.textContent)).toEqual(['Download 1 file (.zip)', 'Search']);
  });

  // Frame :373-419 "Session · deliverable" -- caption at :369.
  it('frame :373 Session deliverable detail -- DIVERGES: Deliverables and Notes render as two side-by-side DOM columns, not one stacked scroll (versions -> notes -> upload -> note box)', async () => {
    verbatimLine(369, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Session · deliverable</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([oneWorklistRow]),
      [`GET /api/v1/submissions/sub-1`]: {
        id: 'sub-1',
        ref: 'DFC-014',
        updatedAt: 1700000200000,
        participants: [{ name: 'Priya Raman', contactId: 'c1' }],
        slot: null,
        reuploaded: true,
        contentStatus: 'changes_requested',
      },
      [`GET /api/v1/submissions/sub-1/files`]: listEnvelope([
        {
          id: 'file-v3',
          kind: 'presentation',
          filename: 'slides-v3.pdf',
          versionNo: 3,
          uploadedAt: 1700000100000,
          sizeBytes: 4096,
          uploaderName: 'Priya Raman',
        },
      ]),
      [`GET /api/v1/files/file-v3/comments`]: listEnvelope([
        { id: 'c1', who: 'Ada', when: '8 days ago', text: 'Please trim the intro.' },
      ]),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp('/content/sub-1');

    // Frame :373-380 header lines: back link, H1 title, "Speaker · CODE",
    // content-status band with a same-row Approve. These match.
    expect(await screen.findByRole('button', { name: '‹ Content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Taming 40-Minute CI' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/DFC-014/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    // Frame :391-419 stacks ONE scrolling column: version rows, then a
    // 2px-ruled "Notes on the slides" label, then comment rows, then the
    // "Upload a file for the speaker" link, then the note textbox --
    // named in DOM source order, all as SIBLINGS. The real body instead
    // splits into two side-by-side <div> columns
    // (.chq-content-files-col / .chq-content-comments-col), each the
    // FIRST child of its own column rather than later siblings of one
    // shared list.
    const body = document.querySelector('.chq-content-group-body');
    expect(body).not.toBeNull();
    const filesCol = body!.querySelector('.chq-content-files-col');
    const commentsCol = body!.querySelector('.chq-content-comments-col');
    expect(filesCol).not.toBeNull();
    expect(commentsCol).not.toBeNull();
    // The two columns are DOM SIBLINGS of the same parent, not one column
    // nested after the other the way the frame's single stack would read.
    expect(filesCol!.parentElement).toBe(commentsCol!.parentElement);

    await waitFor(() => {
      expect(within(filesCol as HTMLElement).getByText('slides-v3.pdf')).toBeInTheDocument();
    });
    expect(within(commentsCol as HTMLElement).getByText('Notes on the slides')).toBeInTheDocument();
    // The "Upload a file for the speaker" affordance (frame :415) lives in
    // the LEFT (files) column, not appended after the notes thread the
    // way the frame's single stack draws it. (UploadZone renders both a
    // desktop and a phone prompt string on the same control; jsdom applies
    // no @media so both text nodes coexist here -- querying the phone
    // prompt specifically, which is the one the frame's own copy matches.)
    expect(within(filesCol as HTMLElement).getByText('Upload a file for the speaker')).toBeInTheDocument();
  });
});
