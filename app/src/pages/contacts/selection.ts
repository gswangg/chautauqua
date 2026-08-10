/**
 * Row selection state for the contacts table, mirroring
 * submissions/selection.ts's shape: a set of contact ids plus a
 * select-all-on-page checkbox. Selection is NOT cleared across pagination so
 * bulk actions (bulk email) can span multiple pages the organizer visited.
 * Contacts owns its own copy per this wave's "sole owner of Contacts files"
 * scope rather than importing the submissions-page-local module.
 */
export interface SelectionState {
  selectedIds: ReadonlySet<string>;
}

export const EMPTY_SELECTION: SelectionState = { selectedIds: new Set() };

export type SelectionAction =
  | { type: 'TOGGLE_ROW'; id: string }
  | { type: 'TOGGLE_PAGE'; pageIds: string[] }
  | { type: 'CLEAR' }
  | { type: 'SET'; ids: string[] };

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'TOGGLE_ROW': {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return { selectedIds: next };
    }
    case 'TOGGLE_PAGE': {
      const next = new Set(state.selectedIds);
      const allSelected = isPageFullySelected(state, action.pageIds);
      for (const id of action.pageIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return { selectedIds: next };
    }
    case 'CLEAR':
      return { selectedIds: new Set() };
    case 'SET':
      return { selectedIds: new Set(action.ids) };
    default:
      return state;
  }
}

/** True when every id on the current page is selected (drives the header checkbox). */
export function isPageFullySelected(state: SelectionState, pageIds: string[]): boolean {
  if (pageIds.length === 0) return false;
  return pageIds.every((id) => state.selectedIds.has(id));
}

/** True when some but not all ids on the current page are selected (drives the indeterminate state). */
export function isPagePartiallySelected(state: SelectionState, pageIds: string[]): boolean {
  const selectedCount = pageIds.filter((id) => state.selectedIds.has(id)).length;
  return selectedCount > 0 && selectedCount < pageIds.length;
}
