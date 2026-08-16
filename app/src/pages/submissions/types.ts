// Shared shapes for the submissions table (DEC-016 list contract, DEC-008
// form field model). Kept dependency-free so filters/selection/columns stay
// pure and unit-testable without a DOM.

// DEC-003 submission status literals -- imported from the pure core
// (src/domain/status.ts) so the SPA's status union can never drift from the
// server's, same shape as content/types.ts's ContentStatus re-export
// (DEC-180 wave-79 amendment).
import type { SubmissionStatus } from '../../../../src/domain/status';
export type { SubmissionStatus };
export { SUBMISSION_STATUSES } from '../../../../src/domain/status';

// Speaker-facing views never leak internal queue states (field guide); the
// admin table shows the real literal as the pill label since organizers need
// to see queue state, but this map is here for any speaker-facing reuse.
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  accept_queue: 'Accept queue',
  decline_queue: 'Decline queue',
  accepted: 'Accepted',
  declined: 'Declined',
  waitlisted: 'Waitlisted',
};

// Re-exported from the pure domain vocabulary (DEC-613 wave-68 amendment) —
// the ONE set shared with src/server/repo/submissions/query.ts, so a saved
// view or URL carrying 'worklist' (the content app's server-side ordering)
// is a real member here too.
import type { SortOrder } from '../../../../src/domain/submission-sort';
export type { SortOrder };
export { SORT_ORDERS } from '../../../../src/domain/submission-sort';

export interface SubmissionSpeaker {
  contactId: string;
  name: string;
}

// GET /api/v1/events/:eventId/submissions item (DEC-016).
export interface SubmissionListItem {
  id: string;
  ref: string;
  title: string;
  status: SubmissionStatus;
  contentStatus: 'pending' | 'approved' | 'changes_requested';
  speakers: SubmissionSpeaker[];
  trackIds: string[];
  submittedAt: number | null;
  createdAt: number;
  answers?: Record<string, unknown>;
  // w8-d (DEC-051/DEC-780 amendment, findings wave 8): the same slot shape
  // SubmissionDetail.slot carries -- null when the session hasn't been
  // placed on the agenda yet. Lets Compose step 1 (ComposeWizard.tsx) show
  // the fact that decides whether a calendar invite can be attached before
  // the organizer chooses an audience, rather than first refusing at step 3.
  slot: { day: string; startMin: number; endMin: number; roomName: string | null } | null;
}

export interface Track {
  id: string;
  name: string;
}

// DEC-008 form field model, as returned by GET /api/v1/events/:eventId/forms.
export interface FormField {
  id: string;
  section: 'session' | 'speaker';
  kind: 'text' | 'long_text' | 'dropdown' | 'checkbox' | 'number' | 'file';
  label: string;
  helpText?: string;
  required: boolean;
  position: number;
  options?: string[];
  rule?: { fieldId: string; op: 'eq' | 'ne' | 'in'; value: unknown };
}

export interface SubmissionsFilterState {
  page: number;
  perPage: number;
  q: string;
  status: SubmissionStatus[];
  trackId: string | null;
  sort: SortOrder;
  includeAnswers: boolean;
}

// DEC-070 / DEC-789 wave-73 amendment: invite_status literal on a
// participant, re-exported from the pure core (src/domain/invite-status.ts)
// so it never desyncs from the roster's vocabulary.
import type { InviteStatus } from '../../../../src/domain/invite-status';
export type { InviteStatus };

// GET /api/v1/submissions/:id (src/server/repo/submissions.ts SubmissionDetail).
export interface SubmissionDetailParticipant {
  id: string;
  contactId: string;
  name: string;
  email: string;
  title: string | null;
  company: string | null;
  role: string;
  order: number;
  visible: boolean;
  inviteStatus: InviteStatus;
  // DEC-900 (frame 02 speaker rail): the speaker's history line ("N
  // submissions this year · spoke in YYYY"). submissionsThisYear always
  // includes this submission itself, so it is always present.
  // lastSpokeYear is absent (not null, not 0) when the contact has no
  // prior accepted-and-scheduled submission; each clause renders only when
  // its own datum is present, neither is ever fabricated from other fields.
  submissionsThisYear: number;
  lastSpokeYear?: number;
}

// GET /api/v1/submissions/:id/evaluations item (DEC-596).
export interface SubmissionEvaluation {
  planId: string;
  planName: string;
  round: number;
  reviewerName: string | null;
  scores: Record<string, number | string>;
  comment: string | null;
  submittedAt: number | null;
}

// GET /api/v1/contacts item, as returned by src/routes/api/contacts.ts
// serializeContact (only the fields the co-presenter search needs).
export interface ContactSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SubmissionDetail {
  id: string;
  eventId: string;
  ref: string;
  title: string;
  description: string | null;
  status: SubmissionStatus;
  contentStatus: 'pending' | 'approved' | 'changes_requested';
  trackId: string | null;
  trackIds: string[];
  formId: string | null;
  // DEC-851 wave-5 amendment: acceptedAt/icsSequence were deleted from this
  // wire shape -- SubmissionDetailPage.tsx's own decidedLabel reads
  // updatedAt instead (acceptedAt only fires on the FIRST accept
  // transition), and icsSequence has no admin-detail reader.
  createdAt: number;
  updatedAt: number;
  participants: SubmissionDetailParticipant[];
  answers: Record<string, unknown>;
  // DEC-920: real attachment rows for 'file'-kind answers, resolved by
  // detailRows.ts against the raw file id stored in `answers`.
  answerFiles: { id: string; filename: string; sizeBytes: number }[];
  // DEC-780: null when the session hasn't been placed on the agenda yet.
  slot: { day: string; startMin: number; endMin: number; roomName: string | null } | null;
}

export const DEFAULT_FILTER_STATE: SubmissionsFilterState = {
  page: 1,
  perPage: 50,
  q: '',
  status: [],
  trackId: null,
  sort: 'newest',
  includeAnswers: false,
};
