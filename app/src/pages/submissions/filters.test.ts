import { describe, expect, it } from 'vitest';
import { buildSubmissionsQuery, parseSubmissionsQuery } from './filters';
import { DEFAULT_FILTER_STATE, type SubmissionStatus } from './types';

describe('buildSubmissionsQuery', () => {
  it('produces an empty string for the default filter state', () => {
    expect(buildSubmissionsQuery(DEFAULT_FILTER_STATE)).toBe('');
  });

  it('includes only non-default params', () => {
    const qs = buildSubmissionsQuery({
      ...DEFAULT_FILTER_STATE,
      page: 2,
      q: '  keynote  ',
      status: ['pending', 'accept_queue'],
      trackId: 'trk1',
      sort: 'title',
    });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get('page')).toBe('2');
    expect(params.get('q')).toBe('keynote');
    expect(params.get('status')).toBe('pending,accept_queue');
    expect(params.get('trackId')).toBe('trk1');
    expect(params.get('sort')).toBe('title');
    expect(params.has('perPage')).toBe(false);
    expect(params.has('includeAnswers')).toBe(false);
  });

  it('sets includeAnswers=1 only when requested', () => {
    const qs = buildSubmissionsQuery({ ...DEFAULT_FILTER_STATE, includeAnswers: true });
    expect(qs).toBe('?includeAnswers=1');
  });

  it('omits blank q after trimming', () => {
    expect(buildSubmissionsQuery({ ...DEFAULT_FILTER_STATE, q: '   ' })).toBe('');
  });
});

describe('parseSubmissionsQuery', () => {
  it('round-trips through buildSubmissionsQuery', () => {
    const original = {
      ...DEFAULT_FILTER_STATE,
      page: 3,
      perPage: 100,
      q: 'ai',
      status: ['accepted', 'declined'] as SubmissionStatus[],
      trackId: 'trk2',
      sort: 'ref' as const,
      includeAnswers: true,
    };
    const qs = buildSubmissionsQuery(original);
    const parsed = parseSubmissionsQuery(qs);
    expect(parsed).toEqual(original);
  });

  it('falls back to defaults for missing/invalid params', () => {
    const parsed = parseSubmissionsQuery('?status=bogus&sort=nope&page=-1&perPage=abc');
    expect(parsed.status).toEqual([]);
    expect(parsed.sort).toBe('newest');
    expect(parsed.page).toBe(1);
    expect(parsed.perPage).toBe(50);
  });

  it('clamps perPage to the DEC-013 server-side max of 200', () => {
    const parsed = parseSubmissionsQuery('?perPage=5000');
    expect(parsed.perPage).toBe(200);
  });
});
