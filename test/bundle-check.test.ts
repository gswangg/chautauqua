import { describe, expect, it } from 'vitest';
import { BUDGET_BYTES, checkEntryBudget, type ChunkSize } from '../scripts/bundle-check-lib';

describe('checkEntryBudget', () => {
  const chunks: ChunkSize[] = [
    { name: 'index-abc123.js', gzipBytes: 100 * 1024 },
    { name: 'index-abc123.css', gzipBytes: 50 * 1024 },
    { name: 'Review-xyz.js', gzipBytes: 200 * 1024 },
  ];

  it('passes when entry JS + CSS combined gzip is within budget', () => {
    const result = checkEntryBudget(chunks, 'index-abc123.js', 'index-abc123.css', 300 * 1024);
    expect(result.entryJsBytes).toBe(100 * 1024);
    expect(result.entryCssBytes).toBe(50 * 1024);
    expect(result.totalBytes).toBe(150 * 1024);
  });

  it('uses the default 300 KB budget when none is passed', () => {
    const result = checkEntryBudget(chunks, 'index-abc123.js', 'index-abc123.css');
    expect(result.totalBytes).toBeLessThanOrEqual(BUDGET_BYTES);
  });

  it('throws when combined entry gzip size exceeds budget', () => {
    const overBudget: ChunkSize[] = [
      { name: 'index-abc123.js', gzipBytes: 250 * 1024 },
      { name: 'index-abc123.css', gzipBytes: 60 * 1024 },
    ];
    expect(() => checkEntryBudget(overBudget, 'index-abc123.js', 'index-abc123.css')).toThrow(
      /exceeds budget/,
    );
  });

  it('throws when entry JS chunk is missing', () => {
    expect(() =>
      checkEntryBudget(chunks, 'index-missing.js', 'index-abc123.css'),
    ).toThrow(/entry JS chunk/);
  });

  it('throws when entry CSS chunk is missing', () => {
    expect(() =>
      checkEntryBudget(chunks, 'index-abc123.js', 'index-missing.css'),
    ).toThrow(/entry CSS chunk/);
  });

  it('exactly-at-budget is allowed (not >)', () => {
    const exact: ChunkSize[] = [
      { name: 'index-abc123.js', gzipBytes: 200 * 1024 },
      { name: 'index-abc123.css', gzipBytes: 100 * 1024 },
    ];
    const result = checkEntryBudget(exact, 'index-abc123.js', 'index-abc123.css', 300 * 1024);
    expect(result.totalBytes).toBe(300 * 1024);
  });
});
