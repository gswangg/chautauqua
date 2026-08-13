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

// DEC-881: the worklist row's status cell and the header's re-uploaded count
// read ONE predicate. Fixed precedence: an approved submission always reads
// "Approved" (a re-upload after approval still shows the decision that
// stands); otherwise a re-uploaded submission reads "Re-uploaded"; otherwise
// contentStatus='changes_requested' reads "Changes requested"; anything else
// (pending, no files yet) reads "Not reviewed".
export type WorklistStatusLabel = 'Approved' | 'Re-uploaded' | 'Changes requested' | 'Not reviewed';

export function worklistStatusLabel(
  contentStatus: 'pending' | 'approved' | 'changes_requested',
  reUploaded: boolean,
): WorklistStatusLabel {
  if (contentStatus === 'approved') return 'Approved';
  if (reUploaded) return 'Re-uploaded';
  if (contentStatus === 'changes_requested') return 'Changes requested';
  return 'Not reviewed';
}
