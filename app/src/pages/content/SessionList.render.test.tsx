// w15-f: v4 mock worklist IA (DEC-692). Locks in that the table renders
// exactly five columns (Session, Speaker, Latest file, Status, actions),
// that the Session cell stacks title/ref, that the Speaker cell shows the
// first speaker plus a '+N' overflow count, that the Latest file cell
// renders 'filename · vN · date' or an honest 'No files yet' empty state,
// and that the row's actions are Approve + Open only (no per-row 'Ask for
// changes' — that action moved to the deliverable-detail screen).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SessionList, TAB_LABELS } from './SessionList';
import type { ContentSubmissionListItem } from './types';
import { WORKLIST_TABS, type WorklistTab } from './worklist';

afterEach(() => {
  cleanup();
});

// DEC-825: chips render '· N' only once their own count has resolved — most
// of this file's tests aren't exercising the chip strip, so every count is
// withheld (null) unless a test overrides it.
const NO_COUNTS: Record<WorklistTab, number | null> = { needs_decision: null, approved: null, all: null };

const baseItem: ContentSubmissionListItem = {
  id: 'sub-1',
  ref: 'S-001',
  title: 'A Talk About Testing',
  contentStatus: 'pending',
  speakers: [
    { contactId: 'c1', name: 'Ada Lovelace' },
    { contactId: 'c2', name: 'Grace Hopper' },
  ],
  deliverableCounts: { presentation: 2, poster: 0, handout: 1, recording: 0, photo: 0 },
  latestFile: { filename: 'slides.pdf', kind: 'presentation', versionCount: 2, uploadedAt: 1700000000000 },
  latestFileVersionNo: 2,
  latestFileByKind: { presentation: 2 },
  reuploaded: true,
  scheduled: null,
};

function noop() {
  // intentionally unused in these render assertions
}

// DEC-825 amendment: bulk selection props — these render assertions cover the
// DEC-692 column IA, not selection, so every case starts with an empty
// selection and a noop change handler.
const SELECTION_PROPS = {
  selectedIds: new Set<string>(),
  onSelectionChange: noop,
  onBulkContentStatus: noop,
  bulkPending: false,
};

describe('SessionList: v4 mock five-column IA (DEC-692)', () => {
  // DEC-825 amendment adds a leading selection column (its header carries the
  // select-all checkbox, so its textContent is empty); the five DEC-692
  // content columns follow it unchanged.
  it('renders the selection column plus exactly five content column headers', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['', 'Session', 'Speaker', 'Latest file', 'Status', '']);
    expect(screen.getByLabelText('Select all on page')).toBeInTheDocument();
  });

  it('stacks title and ref in the Session cell', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const row = container.querySelector('tr.chq-content-row');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('A Talk About Testing');
    expect(row!.querySelector('.chq-content-row-ref')).toHaveTextContent('S-001');
  });
});

// w41-b (DEC-902 amendment): the Session cell's subtitle carries the placed
// schedule slot ('REF · Tue 12 May 10:00, Room 2A') once scheduled, or the
// bare ref (no '· ,' residue) for an unplaced submission.
describe('SessionList: Session cell subtitle carries the placed schedule slot (w41-b)', () => {
  it('renders "REF · <day> <start>, <room>" for a placed session', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[
          {
            ...baseItem,
            scheduled: { day: '2026-05-12', startMin: 600, endMin: 660, roomName: 'Room 2A' },
          },
        ]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const subtitle = container.querySelector('.chq-content-row-ref');
    expect(subtitle).toHaveTextContent('S-001 · Tue 12 May 10:00, Room 2A');
  });

  it('falls back to the honest "To be announced" room label when unassigned', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[
          {
            ...baseItem,
            scheduled: { day: '2026-05-12', startMin: 600, endMin: 660, roomName: null },
          },
        ]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const subtitle = container.querySelector('.chq-content-row-ref');
    expect(subtitle).toHaveTextContent('To be announced');
  });

  it('renders the bare ref with no "· ," residue for an unplaced session', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, scheduled: null }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const subtitle = container.querySelector('.chq-content-row-ref');
    expect(subtitle).toHaveTextContent('S-001');
    expect(subtitle!.textContent).not.toMatch(/·|,/);
  });

  it('renders the first speaker plus a +N overflow count', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const speakerCell = container.querySelector('.chq-content-row-speaker');
    expect(speakerCell).toHaveTextContent('Ada Lovelace +1');
  });

  // w5-i: the Latest file cell prints the STORED per-kind version_no
  // (latestFileByKind), never a stale versionCount -- a deleted middle
  // version would leave a stale versionCount that no longer matches the
  // true identity of the newest surviving row.
  it('renders the stored latestFileByKind version, never versionCount, in the Latest file cell', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[
          {
            ...baseItem,
            latestFile: { ...baseItem.latestFile!, versionCount: 2 },
            latestFileVersionNo: 3,
            latestFileByKind: { presentation: 3 },
          },
        ]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const cell = container.querySelector('.chq-content-latest-file-name');
    expect(cell).toHaveTextContent('v3');
    expect(cell).not.toHaveTextContent('v2');
  });

  it("renders 'No speakers' when the submission has none", () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, speakers: [] }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const speakerCell = container.querySelector('.chq-content-row-speaker');
    expect(speakerCell).toHaveTextContent('No speakers');
  });

  // w5-i (DEC-020 amendment): the Latest file cell is a per-kind summary
  // ("Slides v2"), not the raw filename+version -- filename identity moved
  // to the deliverable detail page, this column states what stage each
  // kind is at.
  it('renders a per-kind summary (kind + version), not the raw filename, in the Latest file cell', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const cell = container.querySelector('.chq-content-row-latest-file');
    expect(cell).toHaveTextContent('Slides v2');
    expect(cell).not.toHaveTextContent('slides.pdf');
  });

  // w5-i: a session with a re-uploaded deck AND a first-time recording
  // names BOTH kinds ("Slides v2 · Recording v1"), never collapsing to only
  // the most-recently-touched kind.
  it('names every kind with files, not just the most-recently-touched one', () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, latestFileByKind: { presentation: 2, recording: 1 } }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const cell = container.querySelector('.chq-content-row-latest-file');
    expect(cell).toHaveTextContent('Slides v2 · Recording v1');
  });

  it("renders an honest 'No files yet' empty state when latestFile is null", () => {
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, latestFile: null }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const cell = container.querySelector('.chq-content-row-latest-file');
    expect(cell).toHaveTextContent('No files yet');
  });

  it('renders only Approve and Open row actions (no per-row "Ask for changes")', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask for changes' })).not.toBeInTheDocument();
  });

  it('Open selects the submission the same way the row click does', () => {
    const onSelect = vi.fn();
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={onSelect}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    screen.getByRole('button', { name: 'Open' }).click();
    expect(onSelect).toHaveBeenCalledWith('sub-1');
  });
});

// w1-f (DEC-733/eval 60/37): item (1) — Approve is ABSENT (never disabled)
// on an already-approved row.
describe('SessionList: Approve is absent, not disabled, once a row is approved', () => {
  it('renders no Approve button for an approved row', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, contentStatus: 'approved' }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('still renders Approve for a pending row', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });
});

// w1-f (DEC-733/eval 60/37): item (3) — LATEST FILE shows relative dates.
describe('SessionList: Latest file column renders a relative date', () => {
  const dayMs = 86_400_000;

  it("renders 'today' when uploaded within the last day", () => {
    const now = 1700000000000;
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, latestFile: { ...baseItem.latestFile!, uploadedAt: now } }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={now}
        counts={NO_COUNTS}
      />,
    );

    expect(container.querySelector('.chq-content-latest-file-date')).toHaveTextContent('today');
  });

  it("renders 'yesterday' one day out", () => {
    const now = 1700000000000;
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, latestFile: { ...baseItem.latestFile!, uploadedAt: now - dayMs } }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={now}
        counts={NO_COUNTS}
      />,
    );

    expect(container.querySelector('.chq-content-latest-file-date')).toHaveTextContent('yesterday');
  });

  it("renders 'N days ago' beyond one day", () => {
    const now = 1700000000000;
    const { container } = render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, latestFile: { ...baseItem.latestFile!, uploadedAt: now - 2 * dayMs } }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={now}
        counts={NO_COUNTS}
      />,
    );

    expect(container.querySelector('.chq-content-latest-file-date')).toHaveTextContent('2 days ago');
  });
});

// DEC-825: the worklist renders exactly the mock's three chips, in the
// mock's order, each counted by its own predicate (worklist.ts
// WORKLIST_TAB_CONTENT_STATUS) rather than a shared/derived number.
describe('SessionList: three DEC-825 chips, in order, each with its own count', () => {
  it('renders Needs a decision / Approved / All accepted sessions in that order with their counts', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={{ needs_decision: 3, approved: 5, all: 8 }}
      />,
    );

    expect(WORKLIST_TABS).toEqual(['needs_decision', 'approved', 'all']);
    const chips = screen.getAllByRole('tab');
    expect(chips.map((c) => c.textContent)).toEqual([
      `${TAB_LABELS.needs_decision} · 3`,
      `${TAB_LABELS.approved} · 5`,
      `${TAB_LABELS.all} · 8`,
    ]);
  });

  it("withholds a chip's count (renders no '· N') until its own read has resolved", () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.getByRole('tab', { name: TAB_LABELS.needs_decision })).toHaveTextContent(TAB_LABELS.needs_decision);
    expect(screen.getByRole('tab', { name: TAB_LABELS.needs_decision }).textContent).not.toMatch(/·/);
  });
});

// DEC-881: the status cell renders worklistStatusLabel's precedence, not
// CONTENT_STATUS_LABELS — a re-uploaded submission reads "Re-uploaded" even
// though its contentStatus is still 'pending'/'changes_requested'.
describe('SessionList: status cell renders the DEC-881 worklist label', () => {
  it("renders 'Re-uploaded' for a pending row whose latest file was re-uploaded", () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, contentStatus: 'pending', reuploaded: true }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const row = screen.getByText('A Talk About Testing').closest('tr');
    expect(row).toHaveTextContent('Re-uploaded');
    // DEC-825 amendment (wave 72): weight carries the state, never colour --
    // 'Re-uploaded' is bold ink (chq-flag, no muted class), the same
    // emphasis 'Changes requested' already had.
    expect(screen.getByText('Re-uploaded')).not.toHaveClass('chq-content-status-muted');
  });

  it("renders 'Approved' (never 'Re-uploaded') for an approved row even when reuploaded is true", () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, contentStatus: 'approved', reuploaded: true }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const row = screen.getByText('A Talk About Testing').closest('tr');
    expect(row).toHaveTextContent('Approved');
    expect(row).not.toHaveTextContent('Re-uploaded');
  });

  it("renders 'Not reviewed' for a pending row that has never been re-uploaded", () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[{ ...baseItem, contentStatus: 'pending', reuploaded: false }]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const row = screen.getByText('A Talk About Testing').closest('tr');
    expect(row).toHaveTextContent('Not reviewed');
    // DEC-825 amendment (wave 72): 'Not reviewed' is muted -- nothing has
    // happened yet.
    expect(screen.getByText('Not reviewed')).toHaveClass('chq-content-status-muted');
  });
});

// DEC-881: the default worklist tab is 'needs_decision' — its empty state
// must read honestly and offer one click back to All, rather than the
// generic 'No submissions in this view.' string every other tab uses.
describe('SessionList: needs_decision empty state names itself and links to All (DEC-881)', () => {
  it("renders an honest empty state with a link to All when the needs_decision tab has no rows", () => {
    const onTabChange = vi.fn();
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="needs_decision"
        onTabChange={onTabChange}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.getByText(/Nothing needs a decision/)).toBeInTheDocument();
    const link = screen.getByRole('button', { name: /View all accepted sessions/ });
    link.click();
    expect(onTabChange).toHaveBeenCalledWith('all');
  });

  it("renders the generic empty state for a non-needs_decision tab with no rows", () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="approved"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.getByText('No submissions in this view.')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing needs a decision/)).not.toBeInTheDocument();
  });
});

// DEC-678 amendment (B7, task-w46-e): a loaded, empty visible set never
// renders the <table> — no columnheader role survives. A non-'all' tab
// narrows the set, so it's 'filtered' (names the tab, offers exactly one
// escape back to 'all'); the 'all' tab with zero rows carries no narrowing
// facet, so it's 'fresh' (no escape, no fabricated primary action).
describe('SessionList: B7 zero-row states render no <table> (DEC-678 amendment)', () => {
  it('renders no columnheader when the needs_decision tab is empty (filtered)', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="needs_decision"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(screen.getByText(/Filtered by the "Needs a decision" tab/)).toBeInTheDocument();
    // Exactly one escape control — the reused "View all accepted sessions"
    // link — no second control.
    expect(screen.getAllByRole('button', { name: 'View all accepted sessions' })).toHaveLength(1);
  });

  it('renders no columnheader when the approved tab is empty (filtered), naming that tab', () => {
    const onTabChange = vi.fn();
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="approved"
        onTabChange={onTabChange}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(screen.getByText(/Filtered by the "Approved" tab/)).toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FILTERED zero-state keeps
    // the pager -- chrome is how a filter gets undone.
    expect(document.querySelector('.chq-content-pager')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    const escape = screen.getByRole('button', { name: 'View all accepted sessions' });
    escape.click();
    expect(onTabChange).toHaveBeenCalledWith('all');
  });

  it("renders no columnheader and a fresh empty state (no escape, no reason) when the 'all' tab is empty", () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(screen.getByText('No accepted sessions yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View all accepted sessions/ })).not.toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state (the
    // unfiltered 'all' tab) hides the pager -- chrome over a worklist that
    // has never held a row.
    expect(document.querySelector('.chq-content-pager')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('still renders a <table> with columnheaders while loading, even with zero items', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={true}
        loaded={false}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    expect(screen.queryAllByRole('columnheader').length).toBeGreaterThan(0);
  });
});

// DEC-871: `<td>` must keep table-cell display so per-column borders land on
// the same baseline across a worklist row — any flex layout for a cell's
// contents belongs on an inner wrapper div, never on the td itself. This
// scan enumerates every class actually applied to a `<td>` in this file (no
// hand-listed trio) and asserts none of them carries `display: flex` in
// content.css, so a future column can't reintroduce the stagger.
// DEC-825 amendment (wave 25, ruling A1): the second bulk-approve primary
// is gone — ONE bar, scoped to the ticked rows, renders between the
// chipstrip and the table; it pre-ticks Re-uploaded rows only.
function StatefulSessionList(props: Omit<ComponentProps<typeof SessionList>, 'selectedIds' | 'onSelectionChange'>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  return <SessionList {...props} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />;
}

describe('SessionList: ONE bulk-approve primary, ruling A1 (DEC-825 amendment)', () => {
  const reuploadedItem: ContentSubmissionListItem = { ...baseItem, id: 'sub-r', contentStatus: 'pending', reuploaded: true };
  const notReviewedA: ContentSubmissionListItem = {
    ...baseItem,
    id: 'sub-a',
    contentStatus: 'pending',
    reuploaded: false,
    latestFile: null,
  };
  const notReviewedB: ContentSubmissionListItem = {
    ...baseItem,
    id: 'sub-b',
    contentStatus: 'pending',
    reuploaded: false,
    latestFile: null,
  };

  it('never renders a numbered "Approve N" control outside the bulk bar', () => {
    render(
      <StatefulSessionList
        items={[reuploadedItem, notReviewedA, notReviewedB]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={3}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
        onBulkContentStatus={noop}
        bulkPending={false}
      />,
    );

    // The per-row "Approve" control (CNT-12) carries no count in its name;
    // only the bulk bar's button reads "Approve N".
    const numberedApproveButtons = screen.getAllByRole('button').filter((btn) => /^Approve \d+$/.test(btn.textContent ?? ''));
    for (const button of numberedApproveButtons) {
      expect(button.closest('.chq-bulkbar')).not.toBeNull();
    }
    // No page-wide "Approve N ready" control exists at all.
    expect(screen.queryByRole('button', { name: /^Approve \d+ ready$/ })).not.toBeInTheDocument();
  });

  it('renders the bulk bar between the chipstrip and the table', () => {
    const { container } = render(
      <StatefulSessionList
        items={[reuploadedItem, notReviewedA, notReviewedB]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={3}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
        onBulkContentStatus={noop}
        bulkPending={false}
      />,
    );

    const worklist = container.querySelector('.chq-content-worklist');
    expect(worklist).not.toBeNull();
    const children = Array.from(worklist!.children);
    const chipstripIndex = children.findIndex((el) => el.classList.contains('chq-chipstrip'));
    const bulkbarIndex = children.findIndex((el) => el.classList.contains('chq-bulkbar'));
    const tableIndex = children.findIndex((el) => el.tagName === 'TABLE');
    expect(chipstripIndex).toBeGreaterThanOrEqual(0);
    expect(bulkbarIndex).toBeGreaterThan(chipstripIndex);
    expect(tableIndex).toBeGreaterThan(bulkbarIndex);
  });

  it('pre-ticks Re-uploaded rows only, never Not-reviewed rows, and the bar reads "1 selected"', () => {
    render(
      <StatefulSessionList
        items={[reuploadedItem, notReviewedA, notReviewedB]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={3}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
        onBulkContentStatus={noop}
        bulkPending={false}
      />,
    );

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    const checkedBoxes = screen
      .getAllByRole('checkbox')
      .filter((box) => (box as HTMLInputElement).checked && box.getAttribute('aria-label') !== 'Select all on page');
    expect(checkedBoxes).toHaveLength(1);
    expect(checkedBoxes[0]).toHaveAccessibleName(`Select ${reuploadedItem.title}`);
  });

  it('renders the consequence line verbatim', () => {
    render(
      <StatefulSessionList
        items={[reuploadedItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
        onBulkContentStatus={noop}
        bulkPending={false}
      />,
    );

    expect(screen.getByText('Sends nothing · the speaker sees it in their portal')).toBeInTheDocument();
  });
});

describe('SessionList: no <td> ever carries display:flex (DEC-871)', () => {
  it('every class applied to a <td> in SessionList.tsx is flex-free in content.css', () => {
    // Vitest runs this suite from the repo root, so resolve siblings
    // relative to process.cwd() rather than import.meta.url (which under
    // jsdom is not always a `file:` URL usable with fileURLToPath).
    const sessionListPath = join(process.cwd(), 'app/src/pages/content/SessionList.tsx');
    const cssPath = join(process.cwd(), 'app/src/pages/content/content.css');
    const tsxSource = readFileSync(sessionListPath, 'utf-8');
    const cssSource = readFileSync(cssPath, 'utf-8');

    // Every `<td ...>` opening tag, capturing its className attribute (if any).
    const tdTagPattern = /<td\b[^>]*>/g;
    const classNamePattern = /className="([^"]*)"/;
    const tdClassNames = new Set<string>();
    for (const tdTag of tsxSource.match(tdTagPattern) ?? []) {
      const classMatch = classNamePattern.exec(tdTag);
      if (!classMatch) continue;
      const classAttr = classMatch[1] ?? '';
      for (const className of classAttr.split(/\s+/).filter(Boolean)) {
        tdClassNames.add(className);
      }
    }

    // Sanity check: this file does apply at least one className to a <td>
    // (chq-content-row-speaker), so the scan itself isn't vacuous.
    expect(tdClassNames.size).toBeGreaterThan(0);

    for (const className of tdClassNames) {
      // Match `.className { ... }` rule bodies (siblings in a comma list are
      // covered too, e.g. `.a, .className { display: flex; }`).
      const rulePattern = new RegExp(
        `(?:^|[,{}\\s])\\.${className}(?![\\w-])[^{]*\\{([^}]*)\\}`,
        'g',
      );
      let match: RegExpExecArray | null;
      while ((match = rulePattern.exec(cssSource)) !== null) {
        const body = match[1] ?? '';
        expect(
          /display\s*:\s*flex/.test(body),
          `.${className} is applied directly to a <td> in SessionList.tsx but content.css sets display:flex on it — move the flex layout to an inner wrapper div (DEC-871).`,
        ).toBe(false);
      }
    }
  });
});

// w21-c (DEC-902 wave-21 amendment): the worklist table
// (docs/design/Chautauqua Content.dc.html:81/85 --
// 26px 1fr 168px 200px 152px auto, gap:18px) was still auto-layout with
// zero widths after w18-d pinned only the files table. `.chq-content-table`
// is a SHARED vocabulary class worn by both tables (w21 finding), so the
// worklist's own pins hang off a worklist-only `chq-content-worklist-table`
// class instead of the shared one.
describe('SessionList: worklist table takes the frame six tracks under fixed layout (w21-c, DEC-902)', () => {
  it('carries the worklist class and one width-class hook per column on the loaded table', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[baseItem]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={false}
        loaded={true}
        onContentStatusChange={noop}
        total={1}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const table = screen.getByRole('table');
    expect(table).toHaveClass('chq-table');
    expect(table).toHaveClass('chq-content-table');
    expect(table).toHaveClass('chq-content-worklist-table');

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveClass('chq-content-worklist-col-select');
    // Session (headers[1]) carries no width class -- it is the sole
    // remainder column under table-layout:fixed.
    expect(headers[1]!.className).not.toMatch(/chq-content-worklist-col/);
    expect(headers[2]).toHaveClass('chq-content-worklist-col-speaker');
    expect(headers[3]).toHaveClass('chq-content-worklist-col-latest-file');
    expect(headers[4]).toHaveClass('chq-content-worklist-col-status');
    expect(headers[5]).toHaveClass('chq-content-worklist-col-actions');
  });

  it('carries the worklist class on the loading-skeleton table too', () => {
    render(
      <SessionList
        {...SELECTION_PROPS}
        items={[]}
        tab="all"
        onTabChange={noop}
        onSelect={noop}
        loading={true}
        loaded={false}
        onContentStatusChange={noop}
        total={0}
        page={1}
        perPage={20}
        onPageChange={noop}
        now={1700000200000}
        counts={NO_COUNTS}
      />,
    );

    const table = screen.getByRole('table');
    expect(table).toHaveClass('chq-content-worklist-table');
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveClass('chq-content-worklist-col-select');
    expect(headers[2]).toHaveClass('chq-content-worklist-col-speaker');
    expect(headers[3]).toHaveClass('chq-content-worklist-col-latest-file');
    expect(headers[4]).toHaveClass('chq-content-worklist-col-status');
    expect(headers[5]).toHaveClass('chq-content-worklist-col-actions');
  });

  it('declares table-layout:fixed with the four pinned tracks, one fixed actions column, and one remainder', () => {
    const cssPath = join(process.cwd(), 'app/src/pages/content/content.css');
    const css = readFileSync(cssPath, 'utf-8');

    const tableMatch = css.match(/\.chq-content-worklist-table\s*\{([^}]*)\}/);
    const selectMatch = css.match(/\.chq-content-worklist-table \.chq-content-worklist-col-select\s*\{([^}]*)\}/);
    const speakerMatch = css.match(/\.chq-content-worklist-table \.chq-content-worklist-col-speaker\s*\{([^}]*)\}/);
    const latestFileMatch = css.match(
      /\.chq-content-worklist-table \.chq-content-worklist-col-latest-file\s*\{([^}]*)\}/,
    );
    const statusMatch = css.match(/\.chq-content-worklist-table \.chq-content-worklist-col-status\s*\{([^}]*)\}/);
    const actionsMatch = css.match(/\.chq-content-worklist-table \.chq-content-worklist-col-actions\s*\{([^}]*)\}/);

    expect(tableMatch).not.toBeNull();
    expect(selectMatch).not.toBeNull();
    expect(speakerMatch).not.toBeNull();
    expect(latestFileMatch).not.toBeNull();
    expect(statusMatch).not.toBeNull();
    expect(actionsMatch).not.toBeNull();

    expect(tableMatch![1]).toMatch(/table-layout:\s*fixed/);
    expect(selectMatch![1]).toMatch(/width:\s*26px/);
    expect(speakerMatch![1]).toMatch(/width:\s*168px/);
    expect(latestFileMatch![1]).toMatch(/width:\s*200px/);
    expect(statusMatch![1]).toMatch(/width:\s*152px/);
    expect(actionsMatch![1]).toMatch(/width:\s*182px/);
    expect(actionsMatch![1]).toMatch(/white-space:\s*nowrap/);
  });

  it('leaves the shared .chq-content-files-table rules untouched (no shared-class regression)', () => {
    const cssPath = join(process.cwd(), 'app/src/pages/content/content.css');
    const css = readFileSync(cssPath, 'utf-8');

    const filesTableMatch = css.match(/\.chq-content-files-table\s*\{([^}]*)\}/);
    const filesSessionMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-session\s*\{([^}]*)\}/);
    const filesVersionMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-version\s*\{([^}]*)\}/);
    const filesSizeMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-size\s*\{([^}]*)\}/);
    const filesActionsMatch = css.match(/\.chq-content-files-table \.chq-content-files-col-actions\s*\{([^}]*)\}/);

    expect(filesTableMatch![1]).toMatch(/table-layout:\s*fixed/);
    expect(filesSessionMatch![1]).toMatch(/width:\s*190px/);
    expect(filesVersionMatch![1]).toMatch(/width:\s*108px/);
    expect(filesSizeMatch![1]).toMatch(/width:\s*92px/);
    expect(filesActionsMatch![1]).toMatch(/width:\s*150px/);

    // Neither the shared .chq-content-table selector, nor the files-only
    // selector, ever declares the worklist's fixed layout -- the pins must
    // stay on the worklist-only class.
    const sharedTableMatch = css.match(/(?:^|[,{}\s])\.chq-content-table\s*\{([^}]*)\}/);
    if (sharedTableMatch) {
      expect(sharedTableMatch[1]).not.toMatch(/table-layout:\s*fixed/);
    }
  });

  it('leaves the phone card block (max-width:700px) auto-layout — no width/table-layout rules added there', () => {
    const cssPath = join(process.cwd(), 'app/src/pages/content/content.css');
    const css = readFileSync(cssPath, 'utf-8');

    const phoneBlockMatch = css.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}\n/);
    expect(phoneBlockMatch).not.toBeNull();
    const phoneBlock = phoneBlockMatch![1]!;
    expect(phoneBlock).not.toMatch(/chq-content-worklist-table/);
    expect(phoneBlock).not.toMatch(/table-layout/);
  });
});
