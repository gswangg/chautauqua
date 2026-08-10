import { describe, expect, it } from 'vitest';
import { applyViewConfig, serializeView } from './views';
import { DEFAULT_FILTER_STATE, type SubmissionsFilterState } from './types';

describe('serializeView / applyViewConfig round trip', () => {
  it('round-trips filter state + visible columns through a DEC-031 config', () => {
    const filters: SubmissionsFilterState = {
      ...DEFAULT_FILTER_STATE,
      page: 3,
      q: 'keynote',
      status: ['pending', 'accepted'],
      trackId: 'trk1',
      sort: 'title',
      includeAnswers: false,
    };
    const visibleFieldIds = new Set(['field1', 'field2']);

    const config = serializeView(filters, visibleFieldIds);
    expect(config).toEqual({
      q: 'keynote',
      status: ['pending', 'accepted'],
      trackId: 'trk1',
      sort: 'title',
      columns: ['field1', 'field2'],
    });

    const applied = applyViewConfig(config);
    // Applying a view resets to page 1 and forces includeAnswers on (the
    // table always needs answers for the dynamic columns), but the rest of
    // the filter-relevant state round-trips exactly.
    expect(applied.filters).toEqual({
      ...DEFAULT_FILTER_STATE,
      page: 1,
      q: 'keynote',
      status: ['pending', 'accepted'],
      trackId: 'trk1',
      sort: 'title',
      includeAnswers: true,
    });
    expect(applied.visibleFieldIds).toEqual(visibleFieldIds);
  });

  it('round-trips the default (empty) filter state', () => {
    const config = serializeView(DEFAULT_FILTER_STATE, new Set());
    expect(config).toEqual({
      q: '',
      status: [],
      trackId: null,
      sort: 'newest',
      columns: [],
    });
    const applied = applyViewConfig(config);
    expect(applied.filters.q).toBe('');
    expect(applied.filters.status).toEqual([]);
    expect(applied.filters.trackId).toBeNull();
    expect(applied.filters.sort).toBe('newest');
    expect(applied.visibleFieldIds.size).toBe(0);
  });

  it('preserves column order through serialize', () => {
    const visibleFieldIds = new Set(['z', 'a', 'm']);
    const config = serializeView(DEFAULT_FILTER_STATE, visibleFieldIds);
    expect(config.columns).toEqual(['z', 'a', 'm']);
  });
});
