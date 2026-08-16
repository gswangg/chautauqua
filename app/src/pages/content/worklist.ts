// DEC-180 wave-79 amendment: ONE declaration (the array), the type derived
// via `typeof ARR[number]` -- the idiom already in the tree at
// src/domain/acceptance.ts:162-171 -- instead of a type union and a value
// array separately re-listing the same three literals in this same file.
export const WORKLIST_TABS = ['needs_decision', 'approved', 'all'] as const;

export type WorklistTab = (typeof WORKLIST_TABS)[number];

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

// w6-e (DEC-825 amendment / frame 05): weight carries the state, never
// colour -- ONE class mapping (composed with the shared .chq-flag base,
// content.css) so the worklist row's status cell and the deliverable-detail
// band's status value read the identical emphasis rule off the identical
// label, rather than two per-surface conditionals that could drift apart.
// 'Changes requested' and 'Re-uploaded' both mean "something needs you" and
// stay bold ink (the .chq-flag base, unmodified); 'Approved' and
// 'Not reviewed' sink to muted weight via .chq-content-status-muted.
export function worklistStatusEmphasisClass(label: WorklistStatusLabel): string {
  return label === 'Changes requested' || label === 'Re-uploaded' ? '' : 'chq-content-status-muted';
}
