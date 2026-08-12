// w4-h: DEC-609 four-column worklist IA. Locks in that the table renders
// exactly four columns regardless of DELIVERABLE_KINDS count, that the
// Session cell stacks ref/title/speakers, that deliverable chips carry the
// kind's LABEL and count, and that a zero-count kind renders an explicit
// absent chip rather than a bare "0".
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
};

function noop() {
  // intentionally unused in these render assertions
}

describe('SessionList: DEC-609 four-column IA', () => {
  it('renders exactly four column headers', () => {
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
      />,
    );

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Session', 'Deliverables', 'Content status', 'Content actions']);
  });

  it('stacks ref, title and speaker names in the Session cell', () => {
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
      />,
    );

    const row = container.querySelector('tr.chq-content-row');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('S-001');
    expect(row).toHaveTextContent('A Talk About Testing');
    expect(row).toHaveTextContent('Ada Lovelace, Grace Hopper');
  });

  it('renders one labelled chip per kind with uploads, and an explicit absent chip for a zero-count kind', () => {
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
      />,
    );

    const row = container.querySelector('tr.chq-content-row');
    if (!row) throw new Error('row not found');
    const chips = Array.from(row.querySelectorAll('.chq-content-deliverable-chip'));
    expect(chips).toHaveLength(3);

    const byLabel = Object.fromEntries(chips.map((c) => [c.textContent, c]));
    expect(byLabel['Presentation · 2']).toBeDefined();
    expect(byLabel['Presentation · 2']).not.toHaveClass('is-absent');
    expect(byLabel['Handout · 1']).toBeDefined();
    expect(byLabel['Handout · 1']).not.toHaveClass('is-absent');

    const posterChip = chips.find((c) => c.textContent?.startsWith('Poster'));
    expect(posterChip).toBeDefined();
    expect(posterChip).toHaveClass('is-absent');
    expect(posterChip?.textContent).not.toMatch(/\b0\b/);
  });
});
