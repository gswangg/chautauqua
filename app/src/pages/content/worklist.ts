export type WorklistTab = 'needs_decision' | 'approved' | 'all';

export const WORKLIST_TABS: readonly WorklistTab[] = ['needs_decision', 'approved', 'all'];

// DEC-825: one constant owns the predicate. Every tab's filter — the
// worklist's own list fetch AND each chip's own count fetch — reads its
// `contentStatus` query value from this single map, so the two can never
// drift into two different definitions of the same tab. `all` has no
// filter (undefined): it matches every accepted session in the event.
export const WORKLIST_TAB_CONTENT_STATUS: Record<WorklistTab, string | undefined> = {
  needs_decision: 'changes_requested,pending',
  approved: 'approved',
  all: undefined,
};
