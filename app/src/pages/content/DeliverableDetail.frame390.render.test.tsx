// w29-h (DEC-976/DEC-967/DEC-385/DEC-874, MEASUREMENT ONLY): frame
// docs/design/Chautauqua Content.dc.html:373-429 "Session · deliverable"
// was one of Content's two worst-instrumented 390 frames (17 of 19 drawn
// strings asserted by no markup instrument before this file). Mounts
// DeliverableDetail directly (the same pattern DeliverableDetail.render.
// test.tsx and DeliverableDetail.stack-390.render.test.tsx already use) in
// the re-uploaded-after-changes-requested state the frame draws.
//
// Every citation below is verbatimLine()'d against the actual design file
// line (DEC-967 shape, copied from DeliverableDetail.stack-390.render.
// test.tsx's own helper) so a stale `:line` reference fails loudly instead
// of rotting silently.
//
// w8-g (DEC-874 wave-8, ruled): frame :381's DIVERGES row is now CLOSED --
// the status band's value line composes a relative-day clause through
// formatRelativeDays (lib/dates.ts), and the cause clause ("you asked for
// changes") renders only while the record's content status is actually
// changes_requested, "Updated" otherwise. See docs/design/audit/
// content-drill-390-v12.md's CLOSED-with-receipt section for the ruling.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeliverableDetail } from './DeliverableDetail';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { formatRelativeDays } from '../../lib/dates';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- copied from DeliverableDetail.stack-390.
 * render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const SUBMISSION_ID = 'sub-frame390';
const EVENT_ID = 'evt-frame390';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// Frame :376/:377: title "Taming 40-Minute CI", "Priya Raman · DFC-014".
// Frame :381: re-uploaded, changes were requested 8 days ago -- the status
// band composes its relative-day clause off real Date.now() at render time
// (formatRelativeDays, lib/dates.ts), so the assertion below re-derives the
// expected clause through the SAME function+real-"now" pair rather than
// pinning the clock (the codebase's existing formatDate(1700000300000)
// convention for date-bearing assertions, DeliverableDetail.render.test.tsx).
const UPDATED_AT = Date.now() - 8 * 86_400_000;

// Two chains: Slides with 3 versions (active), Recording with 1 -- frame
// :386/:387.
const files = [
  {
    id: 'file-slides-v3',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v3.pdf',
    sizeBytes: 100,
    contentType: 'application/pdf',
    previousFileId: 'file-slides-v2',
    uploadedByContactId: null,
    uploaderName: 'Priya Raman',
    createdAt: UPDATED_AT,
    versionNo: 3,
  },
  {
    id: 'file-slides-v2',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v2.pdf',
    sizeBytes: 95,
    contentType: 'application/pdf',
    previousFileId: 'file-slides-v1',
    uploadedByContactId: null,
    uploaderName: 'Priya Raman',
    createdAt: UPDATED_AT - 1000,
    versionNo: 2,
  },
  {
    id: 'file-slides-v1',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v1.pdf',
    sizeBytes: 90,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Priya Raman',
    createdAt: UPDATED_AT - 2000,
    versionNo: 1,
  },
  {
    id: 'file-recording-v1',
    submissionId: SUBMISSION_ID,
    kind: 'recording',
    filename: 'recording-v1.mp4',
    sizeBytes: 8000,
    contentType: 'video/mp4',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Priya Raman',
    createdAt: UPDATED_AT - 3000,
    versionNo: 1,
  },
];

function mockDetail() {
  return mockApi({
    [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
    [`GET /api/v1/submissions/${SUBMISSION_ID}`]: {
      id: SUBMISSION_ID,
      ref: 'DFC-014',
      updatedAt: UPDATED_AT,
      participants: [{ name: 'Priya Raman', contactId: 'contact-priya' }],
      slot: null,
      reuploaded: true,
      contentStatus: 'pending',
    },
    [`GET /api/v1/files/file-slides-v3/comments`]: listEnvelope([]),
    [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
    'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
  });
}

function renderDetail() {
  return render(
    <MemoryRouter>
      <DeliverableDetail
        submissionId={SUBMISSION_ID}
        title="Taming 40-Minute CI"
        contentStatus="pending"
        onBack={() => {}}
        onContentStatusChange={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('DeliverableDetail 390 "Session · deliverable" (DEC-967 shape)', () => {
  it('frame citations: :375 back link, :376/:377 title+trailer, :380/:381 status band, :383 Approve, :386/:387 chips, :389 caption, :395-399 version row', async () => {
    // DEC-967 wave-99 amendment: a frame citation proves the PACK draws
    // this frame; it does not prove the APP renders it. This block adds
    // one real render assertion alongside its verbatimLine() quotes so the
    // block itself is not tautological -- the fuller per-region assertions
    // live in the sibling it() blocks below.
    mockDetail();
    renderDetail();
    await screen.findByText('slides-v3.pdf');
    // docs/design/Chautauqua Content.dc.html:373-429 is the whole
    // "Session · deliverable" phone frame, opening with
    // `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`.
    expect(screen.getByRole('heading', { level: 1, name: 'Taming 40-Minute CI' })).toBeInTheDocument();
    expect(document.querySelector('.chq-content-status-band')).not.toBeNull();

    verbatimLine(
      375,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Content</a>',
    );
    verbatimLine(
      376,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:21px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">Taming 40-Minute CI</h1>',
    );
    verbatimLine(377, '        <span style="font-size:13px; color:#565A4B">Priya Raman · DFC-014</span>');
    verbatimLine(
      380,
      '            <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Content status</span>',
    );
    verbatimLine(
      381,
      '            <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; line-height:1.4">Re-uploaded · you asked for changes 8 days ago</span>',
    );
    verbatimLine(
      383,
      '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700; flex-shrink:0">Approve</span>',
    );
    verbatimLine(
      386,
      '          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Slides · 3 versions</span>',
    );
    verbatimLine(
      387,
      '          <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500">Recording · 1 version</span>',
    );
    verbatimLine(
      389,
      '        <span style="font-size:12px; color:#565A4B; line-height:1.5">Versions and notes below are for the selected deliverable</span>',
    );
    verbatimLine(
      395,
      '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:15px; font-weight:700; width:30px">{{ v.tag }}</span>',
    );
    verbatimLine(399, '              <span style="{{ v.markStyle }}">{{ v.mark }}</span>');
  });

  it(':375 one back control ending "Content"', async () => {
    mockDetail();
    renderDetail();
    await screen.findByText('slides-v3.pdf');

    const backLinks = screen.getAllByRole('button', { name: /Content$/ });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveTextContent('Content');
  });

  it(':376/:377 one <h1> carries the session title, with the speaker · ref line beneath', async () => {
    mockDetail();
    renderDetail();
    await screen.findByText('slides-v3.pdf');

    const h1 = screen.getByRole('heading', { level: 1, name: 'Taming 40-Minute CI' });
    expect(h1).toBeInTheDocument();

    const titleCol = h1.closest('.chq-content-detail-title-col');
    expect(titleCol).not.toBeNull();
    const subtitle = (titleCol as HTMLElement).querySelector('.chq-content-detail-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.textContent).toBe('Priya Raman · DFC-014');
    // The subtitle sits AFTER the h1 in the same column, i.e. "beneath" it.
    expect(h1.compareDocumentPosition(subtitle!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it(':380/:381 a "Content status" section whose status line names the re-upload, its cause and its relative age (DEC-874 wave-8, ruled -- CLOSED)', async () => {
    mockDetail();
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Content status')).toBeInTheDocument();
    });

    const band = screen.getByText('Content status').closest('.chq-content-status-band');
    expect(band).not.toBeNull();
    const valueLine = within(band as HTMLElement).getByText(/^Re-uploaded/);
    // The fixture's UPDATED_AT sits exactly 8 real days before render time,
    // matching frame :381's own worked example ("...8 days ago") byte for
    // byte, including the cause clause ("you asked for changes"), which the
    // Re-uploaded state carries (this record was re-uploaded to address a
    // prior change request -- see DeliverableDetail.tsx's
    // statusNeedsCauseClause note).
    expect(valueLine.textContent).toBe(
      `Re-uploaded · you asked for changes ${formatRelativeDays(UPDATED_AT, Date.now())}`,
    );
  });

  it(':381 the changes_requested state (not yet re-uploaded) carries the same cause clause', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'DFC-014',
        updatedAt: UPDATED_AT,
        participants: [{ name: 'Priya Raman', contactId: 'contact-priya' }],
        slot: null,
        reuploaded: false,
        contentStatus: 'changes_requested',
      },
      [`GET /api/v1/files/file-slides-v3/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    });
    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="Taming 40-Minute CI"
          contentStatus="changes_requested"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Content status')).toBeInTheDocument();
    });
    const band = screen.getByText('Content status').closest('.chq-content-status-band');
    const valueLine = within(band as HTMLElement).getByText(/^Changes requested/);
    expect(valueLine.textContent).toBe(
      `Changes requested · you asked for changes ${formatRelativeDays(UPDATED_AT, Date.now())}`,
    );
  });

  it(':381 an approved/not-reviewed status keeps the neutral "Updated" clause, never the cause clause', async () => {
    mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'DFC-014',
        updatedAt: UPDATED_AT,
        participants: [{ name: 'Priya Raman', contactId: 'contact-priya' }],
        slot: null,
        reuploaded: false,
        contentStatus: 'pending',
      },
      [`GET /api/v1/files/file-slides-v3/comments`]: listEnvelope([]),
      [`GET /api/v1/files/file-recording-v1/comments`]: listEnvelope([]),
      'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
    });
    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="Taming 40-Minute CI"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Content status')).toBeInTheDocument();
    });
    const band = screen.getByText('Content status').closest('.chq-content-status-band');
    const valueLine = within(band as HTMLElement).getByText(/^Not reviewed/);
    expect(valueLine.textContent).toBe(`Not reviewed · Updated ${formatRelativeDays(UPDATED_AT, Date.now())}`);
  });

  it(':395-399 the deliverable selector renders one entry per kind, each matching / · \\d+ versions?$/', async () => {
    mockDetail();
    renderDetail();
    await screen.findByText('slides-v3.pdf');

    const chipstrip = document.querySelectorAll('.chq-chipstrip')[0];
    expect(chipstrip).toBeTruthy();
    const chips = within(chipstrip as HTMLElement).getAllByRole('tab');
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip.textContent ?? '').toMatch(/ · \d+ versions?$/);
    }
    expect(chips[0]).toHaveTextContent('Slides · 3 versions');
    expect(chips[1]).toHaveTextContent('Recording · 1 version');
  });

  it(':389 the scoping caption renders as ONE element', async () => {
    mockDetail();
    renderDetail();
    await screen.findByText('slides-v3.pdf');

    const captions = screen.getAllByText('Versions and notes below are for the selected deliverable');
    expect(captions).toHaveLength(1);
  });

  it(':383 Approve is scoped to the phone dock with an explicit count of 1 (DEC-874: DeliverableDetail mounts a desktop action row too)', async () => {
    mockDetail();
    renderDetail();
    await screen.findByText('slides-v3.pdf');

    const dock = document.querySelector('.chq-content-status-band-actions');
    expect(dock).not.toBeNull();
    const approves = within(dock as HTMLElement).getAllByRole('button', { name: 'Approve' });
    expect(approves).toHaveLength(1);

    // The desktop action row (chq-content-detail-actions: "Edit title and
    // abstract" / "Revision history") sits OUTSIDE the status-band dock and
    // carries no "Approve" control of its own -- confirming the scoped
    // query above isn't accidentally the only Approve in the tree by luck.
    const desktopActionsRow = document.querySelector('.chq-content-detail-actions');
    expect(desktopActionsRow).not.toBeNull();
    expect(within(desktopActionsRow as HTMLElement).queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});
