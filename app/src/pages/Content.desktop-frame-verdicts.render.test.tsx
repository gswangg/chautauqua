// w24-d (DEC-651 wave-24): the per-frame DESKTOP (1600/560) render verdict
// for Content's four desktop frames (docs/design/Chautauqua Content.dc.html)
// -- Worklist · 1600 (:28), Session deliverables (:111), Files library
// (:288) and the Upload rejected modal (:434). Sibling to
// Content.frame-verdicts.render.test.tsx (the four 390 frames), which this
// file does not touch. STRICTLY MEASUREMENT ONLY: desktop is frozen by the
// mandate -- this file moves no desktop byte and edits no component or
// stylesheet, it renders the real route, verdicts what the tree actually
// produces, and files divergences in prose.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) helper pointed at this cluster's own design
// file, same beforeEach/afterEach console guard. jsdom applies no
// stylesheet (no @media, no computed geometry), so every assertion here is
// DOM structure/order/text -- the design pack is never re-read as its own
// proof (DEC-976/DEC-967).
//
// DEC-651 (Amendment wave 24): a Modal/Menu/STATE frame is verdicted by
// operating the control that opens it on the real route -- frame :434
// "Upload rejected" is driven by firing a real, disallowed file selection
// through DeliverableDetail's mounted UploadZone, never by mounting
// UploadRejectedModal directly. NOTE (narrow interpretation, flagged per
// this task's own instruction to name a design gap rather than guess): the
// brief describes this as "making the upload request reject through
// mockApi", but UploadZone's rejection path (src/domain/files.ts
// validateUpload) is a pure, client-side check that runs and rejects BEFORE
// any network request is ever issued -- there is no HTTP round trip for
// mockApi to intercept here. The narrowest reading consistent with DEC-651's
// own text ("operating the control that opens it on the real route") is
// satisfied instead: the route mounts through mockApi exactly like every
// other frame in this file, and the modal is opened by firing a real
// `fireEvent.change` on the actual file input the frame's drop zone wraps.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContentApp } from './content/ContentApp';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-content-desktop-verdicts';
const ME_ENVELOPE = { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' };

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

// DEC-935: mirrors App.tsx's own two <Route>s for /content (worklist) and
// /content/:submissionId (deliverable detail) -- copied from the phone
// sibling's own renderContentApp helper.
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

const worklistRows = [
  {
    id: 'sub-1',
    ref: 'DFC-014',
    title: 'Taming 40-Minute CI',
    status: 'accepted',
    // DEC-825's worklistStatusLabel reads 'Re-uploaded' from `reuploaded`
    // regardless of contentStatus (unless approved) -- kept 'pending' here
    // (not 'changes_requested') so the :111 DIVERGES test below can prove
    // the status band's "Request changes" control is reachable (it renders
    // only while pill !== 'changes_requested').
    contentStatus: 'pending',
    speakers: [{ contactId: 'c1', name: 'Priya Raman' }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
    latestFile: { filename: 'slides-v3.pdf', kind: 'presentation', versionCount: 3, uploadedAt: 1700000100000 },
    latestFileByKind: { presentation: 3 },
    reuploaded: true,
  },
  {
    id: 'sub-2',
    ref: 'DFC-041',
    title: 'Evaluating Agents',
    status: 'accepted',
    contentStatus: 'pending',
    speakers: [{ contactId: 'c2', name: 'Nadia Ferrone' }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
    latestFile: { filename: 'workshop-pack.zip', kind: 'handout', versionCount: 1, uploadedAt: 1700000000000 },
    latestFileByKind: { handout: 1 },
    reuploaded: false,
  },
];

describe('v12 Content DESKTOP (1600) frames: per-frame render verdict receipts (w24-d, DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Worklist · 1600"
  // ---------------------------------------------------------------------
  describe('frame :28 "Worklist · 1600"', () => {
    function renderWorklist() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(worklistRows, {
          contentStatusCounts: { pending: 0, approved: 9, changes_requested: 5 },
          reuploadedCount: 2,
        }),
        'GET /api/v1/me': ME_ENVELOPE,
      });
      return renderContentApp('/content');
    }

    it('MATCHES: title-row actions are "All files" then "Refresh", in that order', async () => {
      renderWorklist();
      await screen.findByRole('heading', { name: 'Content' });
      const actions = document.querySelector('.chq-content-summary-actions');
      const labels = within(actions as HTMLElement).getAllByRole('button').map((b) => b.textContent);
      // docs/design/Chautauqua Content.dc.html:59 --
      // `<a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">All files</a>`
      // (line 60 is the sibling `Refresh` control, same shape.)
      verbatimLine(59, '            <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">All files</a>');
      expect(labels).toEqual(['All files', 'Refresh']);
    });

    it('MATCHES: the chipstrip carries the three worklist tabs, in the frame\'s order, "Needs a decision" active by default', async () => {
      renderWorklist();
      await screen.findByRole('heading', { name: 'Content' });
      const tabs = screen.getAllByRole('tab');
      // docs/design/Chautauqua Content.dc.html:65 (the active, filled pill) --
      // `<span style="background:#1B1D17; color:#F4F1E8; border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600">Needs a decision · 5</span>`
      verbatimLine(65, '          <span style="background:#1B1D17; color:#F4F1E8; border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600">Needs a decision · 5</span>');
      expect(tabs.map((t) => t.textContent)).toEqual(['Needs a decision · 5', 'Approved · 9', 'All accepted sessions · 14']);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('MATCHES: the table header row is [select, Session, Speaker, Latest file, Status, actions]', async () => {
      renderWorklist();
      await screen.findByRole('heading', { name: 'Content' });
      const headerCells = within(screen.getByRole('table')).getAllByRole('columnheader');
      // docs/design/Chautauqua Content.dc.html:82 --
      // `<span>⊟</span><span>Session</span><span>Speaker</span><span>Latest file</span><span>Status</span><span></span>`
      verbatimLine(82, '            <span>⊟</span><span>Session</span><span>Speaker</span><span>Latest file</span><span>Status</span><span></span>');
      expect(headerCells).toHaveLength(6);
      expect(headerCells[1]).toHaveTextContent('Session');
      expect(headerCells[2]).toHaveTextContent('Speaker');
      expect(headerCells[3]).toHaveTextContent('Latest file');
      expect(headerCells[4]).toHaveTextContent('Status');
    });

    it('MATCHES: a row carries Approve + Open, and its cells are Session / Speaker / Latest file / Status in the frame\'s order', async () => {
      renderWorklist();
      await screen.findByRole('heading', { name: 'Content' });
      const row = document.querySelector<HTMLElement>('tr.chq-content-row');
      if (!row) throw new Error('worklist row not found');
      const cells = row.querySelectorAll('td');
      // docs/design/Chautauqua Content.dc.html:98 (the row's trailing action pair) --
      // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:8px 14px; font-size:12px; font-weight:700; white-space:nowrap">Approve</span>`
      verbatimLine(98, '                <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:8px 14px; font-size:12px; font-weight:700; white-space:nowrap">Approve</span>');
      expect(cells[1]).toHaveTextContent('Taming 40-Minute CI');
      expect(cells[2]).toHaveTextContent('Priya Raman');
      expect(cells[3]).toHaveTextContent('Slides v3');
      expect(cells[4]).toHaveTextContent('Re-uploaded');
      expect(within(row).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    });

    it('MATCHES: ticking two rows arms the bulk bar with "N selected", the consequence note, and Approve N + Clear', async () => {
      renderWorklist();
      await screen.findByRole('heading', { name: 'Content' });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Taming 40-Minute CI' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Evaluating Agents' }));
      const bar = screen.getByRole('toolbar', { name: 'Bulk content actions' });
      // docs/design/Chautauqua Content.dc.html:72 (the armed bulk bar's count) --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:14px; font-weight:600">2 selected</span>`
      verbatimLine(72, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:14px; font-weight:600">2 selected</span>');
      expect(within(bar).getByText('2 selected')).toBeInTheDocument();
      expect(within(bar).getByText('Approving sends nothing · the speaker sees it in their portal')).toBeInTheDocument();
      expect(within(bar).getByRole('button', { name: 'Approve 2' })).toBeInTheDocument();
      expect(within(bar).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :111 "Session deliverables · /content/:submissionId"
  // ---------------------------------------------------------------------
  describe('frame :111 "Session deliverables · /content/:submissionId"', () => {
    function renderDetail() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(worklistRows),
        [`GET /api/v1/submissions/sub-1`]: {
          id: 'sub-1',
          ref: 'DFC-014',
          updatedAt: 1700000200000,
          participants: [{ name: 'Priya Raman', contactId: 'c1' }],
          slot: { day: '2027-05-11', startMin: 600, endMin: 645, roomName: 'Room 2A' },
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
      return renderContentApp('/content/sub-1');
    }

    it('MATCHES: the status band carries "Content status" + the status value, and an Approve primary', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: 'Taming 40-Minute CI' });
      const band = document.querySelector<HTMLElement>('.chq-content-status-band')!;
      // docs/design/Chautauqua Content.dc.html:124 --
      // `<span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Content status</span>`
      verbatimLine(124, '          <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Content status</span>');
      expect(within(band).getByText('Content status')).toBeInTheDocument();
      expect(within(band).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      await waitFor(() => expect(within(band).getByText(/Re-uploaded/)).toBeInTheDocument());
    });

    it('RESOLVED-BY-RULING (DEC-902, wave 8): the status band also carries a "Request changes" secondary the frame reserves for the Notes column\'s own "Ask for changes" composer -- a blessed, additive capability', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: 'Taming 40-Minute CI' });
      const band = document.querySelector<HTMLElement>('.chq-content-status-band')!;
      // docs/design/Chautauqua Content.dc.html:128 --
      // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Approve</span>`
      verbatimLine(128, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Approve</span>');
      const bandButtons = within(band).getAllByRole('button');
      expect(bandButtons.map((b) => b.textContent)).toContain('Request changes');
      // The frame's own band holds only Approve + Download-all -- no
      // status-only "Request changes" here (its own note+email composer
      // lives in the right column, :181, "Ask for changes").
    });

    it('RESOLVED-BY-RULING (DEC-902, wave 8): the title row carries "Edit title and abstract" + "Revision history" links the frame draws nowhere on this screen -- blessed, additive capabilities', async () => {
      renderDetail();
      const heading = await screen.findByRole('heading', { name: 'Taming 40-Minute CI' });
      const head = heading.closest<HTMLElement>('.chq-content-detail-head')!;
      // docs/design/Chautauqua Content.dc.html:118 --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1.1">Taming 40-Minute CI: Incremental Builds at Monorepo Scale</span>`
      // -- the header stack is back-link, H1, "Speaker · REF · slot, Room"
      // only -- no third action row under the title.
      verbatimLine(118, '        <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1.1">Taming 40-Minute CI: Incremental Builds at Monorepo Scale</span>');
      expect(within(head).getByRole('link', { name: 'Edit title and abstract ›' })).toBeInTheDocument();
      expect(within(head).getByRole('link', { name: 'Revision history ›' })).toBeInTheDocument();
    });

    it('MATCHES: Deliverables and Notes render as two side-by-side DOM-sibling columns (the SAME shape the frame\'s 1.35fr/1fr grid draws, unlike the 390 stack)', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: 'Taming 40-Minute CI' });
      // docs/design/Chautauqua Content.dc.html:134 --
      // `<div style="display:grid; grid-template-columns:1.35fr 1fr; gap:26px; padding-top:6px">`
      verbatimLine(134, '        <div style="display:grid; grid-template-columns:1.35fr 1fr; gap:26px; padding-top:6px">');
      const body = document.querySelector('.chq-content-group-body');
      expect(body).not.toBeNull();
      const filesCol = body!.querySelector('.chq-content-files-col');
      const commentsCol = body!.querySelector('.chq-content-comments-col');
      expect(filesCol).not.toBeNull();
      expect(commentsCol).not.toBeNull();
      expect(filesCol!.parentElement).toBe(commentsCol!.parentElement);
      await waitFor(() => {
        expect(within(filesCol as HTMLElement).getByText('slides-v3.pdf')).toBeInTheDocument();
      });
      expect(within(commentsCol as HTMLElement).getByText('Notes on the slides')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :288 "Files library"
  // ---------------------------------------------------------------------
  describe('frame :288 "Files library"', () => {
    function renderFiles() {
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
      return renderContentApp('/content?view=files');
    }

    it('MATCHES: header row is breadcrumb + H1 "Files" + "N files · size" stat + a Download-all control', async () => {
      renderFiles();
      await screen.findByRole('button', { name: '‹ Content' });
      // docs/design/Chautauqua Content.dc.html:298 --
      // `<span style="font-size:13px; color:#565A4B">31 files · 412 MB</span>`
      verbatimLine(298, '          <span style="font-size:13px; color:#565A4B">31 files · 412 MB</span>');
      expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
      expect(screen.getByText('31 files · 412 MB')).toBeInTheDocument();
      const headerRow = document.querySelector<HTMLElement>('.chq-content-files-header-row')!;
      expect(within(headerRow).getByRole('button', { name: /Download/ })).toBeInTheDocument();
    });

    it('MATCHES: the search field and the leading "All types" chip render as the frame draws them', async () => {
      renderFiles();
      await screen.findByRole('heading', { name: 'Files' });
      // docs/design/Chautauqua Content.dc.html:304 -- the search box's
      // placeholder text, `Search by file or session…`.
      verbatimLine(304, '          <div style="border:1px solid #BAB6A6; border-radius:4px; padding:8px 12px; font-size:13px; color:#565A4B; background:#FAF8F2; min-width:230px">Search by file or session…</div>');
      expect(screen.getByPlaceholderText('Search by file or session…')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'All types' })).toBeInTheDocument();
    });

    it('RESOLVED-BY-RULING (DEC-902): the frame\'s generic "Other · 5" bucket is a pack-internal inconsistency the desktop frame draws and the phone frame omits over the same library; the tree\'s blessed shape names each kind directly ("Handout · 5"), preserving the organiser\'s per-kind filter', async () => {
      renderFiles();
      await screen.findByRole('heading', { name: 'Files' });
      // docs/design/Chautauqua Content.dc.html:308 -- the frame's own mock
      // draws a generic `Other · 5` chip alongside Slides/Video; DEC-902
      // closes this without a lane (PHONE :344-346 draws no residual chip
      // over the same 31-file library).
      verbatimLine(308, '          <a href="#" style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 14px; font-size:13px; font-weight:500; color:#3F4237">Other · 5</a>');
      expect(screen.getByRole('tab', { name: 'Slides · 22' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Video · 4' })).toBeInTheDocument();
      // The blessed shape: a per-kind chip, not the frame's rejected catch-all.
      expect(screen.getByRole('tab', { name: 'Handout · 5' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Other · 5' })).not.toBeInTheDocument();
    });

    it('MATCHES: the table header row is File / Session / Version / Size / [actions]', async () => {
      renderFiles();
      await screen.findByRole('heading', { name: 'Files' });
      const headerCells = within(screen.getByRole('table')).getAllByRole('columnheader');
      // docs/design/Chautauqua Content.dc.html:312 --
      // `<span>File</span><span>Session</span><span>Version</span><span>Size</span><span></span>`
      verbatimLine(312, '            <span>File</span><span>Session</span><span>Version</span><span>Size</span><span></span>');
      expect(headerCells.map((c) => c.textContent)).toEqual(['File', 'Session', 'Version', 'Size', '']);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :434 "Upload rejected" (Modal, DEC-651)
  // ---------------------------------------------------------------------
  describe('frame :434 "Upload rejected"', () => {
    function makeFile(name: string, sizeBytes: number, type = 'application/octet-stream'): File {
      const file = new File([new Uint8Array(1)], name, { type });
      Object.defineProperty(file, 'size', { value: sizeBytes });
      return file;
    }

    function renderDetail() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(worklistRows),
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
        [`GET /api/v1/files/file-v3/comments`]: listEnvelope([]),
        'GET /api/v1/me': ME_ENVELOPE,
      });
      return renderContentApp('/content/sub-1');
    }

    it('MATCHES (DEC-651: operated via the real control, never mounted directly): a real rejected file selection opens a dialog with header/error-band/"What was kept"/footer, all four parts the frame draws', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: 'Taming 40-Minute CI' });
      await waitFor(() => expect(screen.getByText('slides-v3.pdf')).toBeInTheDocument());

      const input = screen.getByLabelText('Replace presentation') as HTMLInputElement;
      // The real trigger: a disallowed file (a zip is not admitted for the
      // 'presentation' kind) fired through the ACTUAL file input the
      // frame's drop zone wraps -- never <UploadRejectedModal ... /> mounted
      // in isolation.
      fireEvent.change(input, { target: { files: [makeFile('keynote-final.zip', 1024)] } });

      const dialog = await screen.findByRole('dialog');
      // docs/design/Chautauqua Content.dc.html:441 (the modal's own title) --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">That file was not uploaded</span>`
      verbatimLine(441, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">That file was not uploaded</span>');
      expect(dialog).toHaveTextContent('That file was not uploaded');
      // docs/design/Chautauqua Content.dc.html:442 (session + lowercase kind) --
      // `<span style="font-size:13px; color:#565A4B">Taming 40-Minute CI · slides</span>`
      verbatimLine(442, '          <span style="font-size:13px; color:#565A4B">Taming 40-Minute CI · slides</span>');
      expect(dialog).toHaveTextContent('Taming 40-Minute CI · slides');
      // docs/design/Chautauqua Content.dc.html:452 (the "What was kept" micro-label) --
      // `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">What was kept</span>`
      verbatimLine(452, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">What was kept</span>');
      expect(dialog).toHaveTextContent('What was kept');
      expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('RESOLVED-BY-RULING (DEC-902/DEC-967): the frame\'s own error-band copy is bespoke sample prose ("keynote-final.zip is not a slide format"); the tree renders the pure-core\'s server-enforced refusal instead, which DEC-902 blesses as the correct shape', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: 'Taming 40-Minute CI' });
      await waitFor(() => expect(screen.getByText('slides-v3.pdf')).toBeInTheDocument());
      const input = screen.getByLabelText('Replace presentation') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile('keynote-final.zip', 1024)] } });
      const dialog = await screen.findByRole('dialog');
      // docs/design/Chautauqua Content.dc.html:448 (the frame's own bespoke
      // headline for this exact scenario) --
      // `keynote-final.zip is not a slide format`
      verbatimLine(448, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:700">keynote-final.zip is not a slide format</span>');
      expect(dialog).not.toHaveTextContent('is not a slide format');
      expect(dialog).toHaveTextContent('keynote-final.zip Zip archives are only accepted for a handout deliverable');
    });
  });
});
