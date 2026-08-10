import { describe, expect, it } from 'vitest';
import { buildResultsCsvHref } from './resultsCsv';

describe('buildResultsCsvHref', () => {
  it('builds the DEC-018 CSV export path for a plan', () => {
    expect(buildResultsCsvHref('plan_123')).toBe('/api/v1/plans/plan_123/results?format=csv');
  });

  it('url-encodes the plan id', () => {
    expect(buildResultsCsvHref('plan/weird id')).toBe('/api/v1/plans/plan%2Fweird%20id/results?format=csv');
  });
});
