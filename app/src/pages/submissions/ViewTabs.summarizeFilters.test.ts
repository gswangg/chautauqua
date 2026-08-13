import { describe, expect, it } from 'vitest';
import { summarizeFilters } from './ViewTabs';
import { DEFAULT_FILTER_STATE, type SubmissionsFilterState, type Track } from './types';

const TRACKS: Track[] = [
  { id: 'trk1', name: 'AI Engineering' },
  { id: 'trk2', name: 'Platform' },
];

describe('summarizeFilters (DEC-750)', () => {
  it('names the actual current filter/sort state', () => {
    const filters: SubmissionsFilterState = {
      ...DEFAULT_FILTER_STATE,
      status: ['pending'],
      trackId: 'trk1',
      sort: 'newest',
    };
    expect(summarizeFilters(filters, TRACKS)).toBe('Pending · AI Engineering · newest first');
  });

  it('falls back to a plain no-filters state with only the sort order', () => {
    const filters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, sort: 'oldest' };
    expect(summarizeFilters(filters, TRACKS)).toBe('oldest first');
  });

  it('includes a search term', () => {
    const filters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, q: 'keynote' };
    expect(summarizeFilters(filters, TRACKS)).toBe('search “keynote” · newest first');
  });

  it('falls back to a generic label for an unknown track id', () => {
    const filters: SubmissionsFilterState = { ...DEFAULT_FILTER_STATE, trackId: 'missing' };
    expect(summarizeFilters(filters, TRACKS)).toBe('a track filter · newest first');
  });
});
