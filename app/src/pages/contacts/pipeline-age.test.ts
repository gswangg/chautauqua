// Pure unit tests for pipelineCardAge (CRM-07/08, DEC-803): all five stage
// captions plus the 30-day stale boundary.
import { describe, expect, it } from 'vitest';
import { pipelineCardAge } from './pipeline-age';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100_000 * DAY; // arbitrary fixed "now" far from the epoch

describe('pipelineCardAge', () => {
  it('identified: "Added N days ago"', () => {
    expect(pipelineCardAge('identified', NOW - 5 * DAY, NOW)).toEqual({ text: 'Added 5 days ago', stale: false });
  });

  it('contacted: "No reply · N days"', () => {
    expect(pipelineCardAge('contacted', NOW - 12 * DAY, NOW)).toEqual({ text: 'No reply · 12 days', stale: false });
  });

  it('interested: "Replied N days ago"', () => {
    expect(pipelineCardAge('interested', NOW - 3 * DAY, NOW)).toEqual({ text: 'Replied 3 days ago', stale: false });
  });

  it('confirmed: "Confirmed N days ago"', () => {
    expect(pipelineCardAge('confirmed', NOW - 1 * DAY, NOW)).toEqual({ text: 'Confirmed 1 days ago', stale: false });
  });

  it('declined: "Declined N days ago"', () => {
    expect(pipelineCardAge('declined', NOW - 2 * DAY, NOW)).toEqual({ text: 'Declined 2 days ago', stale: false });
  });

  it('is not stale at exactly the 30-day boundary', () => {
    const result = pipelineCardAge('identified', NOW - 30 * DAY, NOW);
    expect(result.text).toBe('Added 30 days ago');
    expect(result.stale).toBe(false);
  });

  it('is stale one day past the 30-day boundary', () => {
    const result = pipelineCardAge('identified', NOW - 31 * DAY, NOW);
    expect(result.text).toBe('Added 31 days ago');
    expect(result.stale).toBe(true);
  });

  it('never goes negative for a stageSince in the future (clock skew)', () => {
    const result = pipelineCardAge('identified', NOW + DAY, NOW);
    expect(result.text).toBe('Added 0 days ago');
    expect(result.stale).toBe(false);
  });
});
