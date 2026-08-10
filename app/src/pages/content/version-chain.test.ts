import { describe, expect, it } from 'vitest';
import { groupByKindNewestFirst, orderVersionsNewestFirst } from './version-chain';
import type { DeliverableFile } from './types';

function file(overrides: Partial<DeliverableFile> = {}): DeliverableFile {
  return {
    id: 'f1',
    submissionId: 'sub1',
    kind: 'presentation',
    filename: 'deck.pdf',
    sizeBytes: 1000,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: 'c1',
    createdAt: 1000,
    ...overrides,
  };
}

describe('orderVersionsNewestFirst', () => {
  it('walks a replace chain newest-first via previousFileId', () => {
    const v1 = file({ id: 'v1', createdAt: 100, previousFileId: null });
    const v2 = file({ id: 'v2', createdAt: 200, previousFileId: 'v1' });
    const v3 = file({ id: 'v3', createdAt: 300, previousFileId: 'v2' });
    // Deliberately out of order input to prove ordering comes from the chain,
    // not from input order or createdAt sort alone.
    expect(orderVersionsNewestFirst([v2, v1, v3]).map((f) => f.id)).toEqual(['v3', 'v2', 'v1']);
  });

  it('handles a single file with no chain', () => {
    const v1 = file({ id: 'v1' });
    expect(orderVersionsNewestFirst([v1]).map((f) => f.id)).toEqual(['v1']);
  });

  it('handles an empty list', () => {
    expect(orderVersionsNewestFirst([])).toEqual([]);
  });

  it('orders independent chains by newest head first', () => {
    const aOld = file({ id: 'a-old', createdAt: 100, previousFileId: null });
    const aNew = file({ id: 'a-new', createdAt: 400, previousFileId: 'a-old' });
    const bOnly = file({ id: 'b-only', createdAt: 250, previousFileId: null });
    expect(orderVersionsNewestFirst([aOld, bOnly, aNew]).map((f) => f.id)).toEqual(['a-new', 'a-old', 'b-only']);
  });

  it('still surfaces files unreachable from any head rather than dropping them', () => {
    // Broken data: v2 points at a previousFileId not present in the set.
    const v2 = file({ id: 'v2', createdAt: 200, previousFileId: 'missing' });
    const orphan = file({ id: 'orphan', createdAt: 50, previousFileId: null });
    const result = orderVersionsNewestFirst([v2, orphan]).map((f) => f.id);
    expect(result).toContain('v2');
    expect(result).toContain('orphan');
    expect(result[0]).toBe('v2');
  });
});

describe('groupByKindNewestFirst', () => {
  it('returns all three kinds even when a kind has no files', () => {
    const grouped = groupByKindNewestFirst([file({ id: 'p1', kind: 'poster' })]);
    expect(Object.keys(grouped).sort()).toEqual(['handout', 'poster', 'presentation']);
    expect(grouped.presentation).toEqual([]);
    expect(grouped.handout).toEqual([]);
    expect(grouped.poster.map((f) => f.id)).toEqual(['p1']);
  });

  it('orders each kind group independently newest-first', () => {
    const files = [
      file({ id: 'pres-v1', kind: 'presentation', createdAt: 100, previousFileId: null }),
      file({ id: 'pres-v2', kind: 'presentation', createdAt: 200, previousFileId: 'pres-v1' }),
      file({ id: 'poster-v1', kind: 'poster', createdAt: 150, previousFileId: null }),
    ];
    const grouped = groupByKindNewestFirst(files);
    expect(grouped.presentation.map((f) => f.id)).toEqual(['pres-v2', 'pres-v1']);
    expect(grouped.poster.map((f) => f.id)).toEqual(['poster-v1']);
  });
});
