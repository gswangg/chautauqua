import { describe, expect, it } from 'vitest';
import { EMPTY_SELECTION, isPageFullySelected, isPagePartiallySelected, selectionReducer } from './selection';

describe('selectionReducer', () => {
  it('toggles a single row on and off', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'TOGGLE_ROW', id: 'a' });
    expect(s1.selectedIds.has('a')).toBe(true);
    const s2 = selectionReducer(s1, { type: 'TOGGLE_ROW', id: 'a' });
    expect(s2.selectedIds.has('a')).toBe(false);
  });

  it('select-all-on-page selects every id on the page when none are selected', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'TOGGLE_PAGE', pageIds: ['a', 'b', 'c'] });
    expect([...s1.selectedIds].sort()).toEqual(['a', 'b', 'c']);
  });

  it('select-all-on-page clears the page when the whole page is already selected', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'TOGGLE_PAGE', pageIds: ['a', 'b'] });
    const s2 = selectionReducer(s1, { type: 'TOGGLE_PAGE', pageIds: ['a', 'b'] });
    expect(s2.selectedIds.size).toBe(0);
  });

  it('select-all-on-page re-selects the whole page when it is only partially selected', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'TOGGLE_ROW', id: 'a' });
    const s2 = selectionReducer(s1, { type: 'TOGGLE_PAGE', pageIds: ['a', 'b'] });
    expect([...s2.selectedIds].sort()).toEqual(['a', 'b']);
  });

  it('selection persists across pages (not cleared by TOGGLE_PAGE on a different page)', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'TOGGLE_ROW', id: 'x-on-page-1' });
    const s2 = selectionReducer(s1, { type: 'TOGGLE_PAGE', pageIds: ['y-on-page-2', 'z-on-page-2'] });
    expect(s2.selectedIds.has('x-on-page-1')).toBe(true);
    expect(s2.selectedIds.has('y-on-page-2')).toBe(true);
  });

  it('CLEAR empties the selection', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'TOGGLE_ROW', id: 'a' });
    const s2 = selectionReducer(s1, { type: 'CLEAR' });
    expect(s2.selectedIds.size).toBe(0);
  });

  it('SET replaces the selection wholesale', () => {
    const s1 = selectionReducer(EMPTY_SELECTION, { type: 'SET', ids: ['a', 'b'] });
    expect([...s1.selectedIds].sort()).toEqual(['a', 'b']);
  });
});

describe('isPageFullySelected / isPagePartiallySelected', () => {
  it('reports false/false for an empty page', () => {
    expect(isPageFullySelected(EMPTY_SELECTION, [])).toBe(false);
    expect(isPagePartiallySelected(EMPTY_SELECTION, [])).toBe(false);
  });

  it('reports fully selected only when every page id is present', () => {
    const state = selectionReducer(EMPTY_SELECTION, { type: 'SET', ids: ['a', 'b'] });
    expect(isPageFullySelected(state, ['a', 'b'])).toBe(true);
    expect(isPageFullySelected(state, ['a', 'b', 'c'])).toBe(false);
  });

  it('reports partially selected when some but not all page ids are present', () => {
    const state = selectionReducer(EMPTY_SELECTION, { type: 'SET', ids: ['a'] });
    expect(isPagePartiallySelected(state, ['a', 'b'])).toBe(true);
    expect(isPagePartiallySelected(state, ['a'])).toBe(false);
  });
});
