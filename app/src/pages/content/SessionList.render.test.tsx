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
import { SessionList } from './SessionList';
import type { ContentSubmissionListItem } from './types';

afterEach(() => {
  cleanup();
});

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
      />,
    );

    expect(container.querySelector('.chq-content-latest-file-date')).toHaveTextContent('2 days ago');
  });
});
