// w15-f: v4 mock worklist IA (DEC-692). Locks in that the table renders
// exactly five columns (Session, Speaker, Latest file, Status, actions),
// that the Session cell stacks title/ref, that the Speaker cell shows the
// first speaker plus a '+N' overflow count, that the Latest file cell
// renders 'filename · vN · date' or an honest 'No files yet' empty state,
// and that the row's actions are Approve + Open only (no per-row 'Ask for
// changes' — that action moved to the deliverable-detail screen).
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  deliverableCounts: { presentation: 2, poster: 0, handout: 1 },
  latestFile: { filename: 'slides.pdf', kind: 'presentation', versionCount: 2, uploadedAt: 1700000000000 },
  latestFileVersionNo: 2,
  reuploaded: true,
};

function noop() {
  // intentionally unused in these render assertions
}

describe('SessionList: v4 mock five-column IA (DEC-692)', () => {
  it('renders exactly five column headers', () => {
    render(
      <SessionList
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
    expect(headers).toEqual(['Session', 'Speaker', 'Latest file', 'Status', '']);
  });

  it('stacks title and ref in the Session cell', () => {
    const { container } = render(
      <SessionList
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

  it('renders the first speaker plus a +N overflow count', () => {
    const { container } = render(
      <SessionList
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

  it("renders 'No speakers' when the submission has none", () => {
    const { container } = render(
      <SessionList
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

  it('renders the latest file name, version and date', () => {
    const { container } = render(
      <SessionList
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
    expect(cell).toHaveTextContent('slides.pdf · v2');
  });

  it("renders an honest 'No files yet' empty state when latestFile is null", () => {
    const { container } = render(
      <SessionList
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
  });

  it("renders 'Approved' (never 'Re-uploaded') for an approved row even when reuploaded is true", () => {
    render(
      <SessionList
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

// DEC-871: `<td>` must keep table-cell display so per-column borders land on
// the same baseline across a worklist row — any flex layout for a cell's
// contents belongs on an inner wrapper div, never on the td itself. This
// scan enumerates every class actually applied to a `<td>` in this file (no
// hand-listed trio) and asserts none of them carries `display: flex` in
// content.css, so a future column can't reintroduce the stagger.
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
