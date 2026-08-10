// Shared shapes for the submissions table (DEC-016 list contract, DEC-008
// form field model). Kept dependency-free so filters/selection/columns stay
// pure and unit-testable without a DOM.

// DEC-003 submission status literals.
export type SubmissionStatus = 'pending' | 'accept_queue' | 'decline_queue' | 'accepted' | 'declined';

export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'pending',
  'accept_queue',
  'decline_queue',
  'accepted',
  'declined',
];

// Speaker-facing views never leak internal queue states (field guide); the
// admin table shows the real literal as the pill label since organizers need
// to see queue state, but this map is here for any speaker-facing reuse.
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  accept_queue: 'Accept queue',
  decline_queue: 'Decline queue',
  accepted: 'Accepted',
  declined: 'Declined',
};

export type SortOrder = 'newest' | 'oldest' | 'title' | 'ref';

export const SORT_ORDERS: readonly SortOrder[] = ['newest', 'oldest', 'title', 'ref'];

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

// DEC-070: invite_status literal on a participant.
export type InviteStatus = 'none' | 'invited' | 'accepted' | 'declined';

// GET /api/v1/submissions/:id (src/server/repo/submissions.ts SubmissionDetail).
export interface SubmissionDetailParticipant {
  id: string;
  contactId: string;
  name: string;
  email: string;
  role: string;
  order: number;
  visible: boolean;
  inviteStatus: InviteStatus;
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
  acceptedAt: number | null;
  icsSequence: number;
  createdAt: number;
  updatedAt: number;
  participants: SubmissionDetailParticipant[];
  answers: Record<string, unknown>;
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
