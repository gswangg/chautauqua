import { describe, expect, it } from 'vitest';
import { buildResultsCsvHref } from './resultsCsv';

describe('buildResultsCsvHref', () => {
  it('builds the DEC-018 CSV export path for a plan', () => {
    expect(buildResultsCsvHref('plan_123')).toBe('/api/v1/plans/plan_123/results?format=csv');
  });

  it('url-encodes the plan id', () => {
    expect(buildResultsCsvHref('plan/weird id')).toBe('/api/v1/plans/plan%2Fweird%20id/results?format=csv');
  });

  it('appends round when given', () => {
    expect(buildResultsCsvHref('plan_123', 2)).toBe('/api/v1/plans/plan_123/results?format=csv&round=2');
  });

  it('appends the active sort/dir when given (DEC-345)', () => {
    expect(buildResultsCsvHref('plan_123', undefined, { column: 'average', direction: 'desc' })).toBe(
      '/api/v1/plans/plan_123/results?format=csv&sort=average&dir=desc',
    );
  });

  it('appends criterionId for rating/dropdown sort columns', () => {
    expect(
      buildResultsCsvHref('plan_123', 1, { column: 'rating', criterionId: 'quality', direction: 'asc' }),
    ).toBe('/api/v1/plans/plan_123/results?format=csv&round=1&sort=rating&criterionId=quality&dir=asc');
  });
});
