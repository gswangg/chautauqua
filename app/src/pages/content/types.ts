// Shared shapes for the Content SPA (J8 content review loop, DEC-020).
// Kept dependency-free so pure helpers stay unit-testable without a DOM.

// DEC-003 content-status literals.
export type ContentStatus = 'pending' | 'approved' | 'changes_requested';

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes requested',
};

// Worklist ordering (SPEC §2.3 — worklist, not report): items needing action
// surface first, approved sinks to the bottom.
export const CONTENT_STATUS_PRIORITY: readonly ContentStatus[] = ['changes_requested', 'pending', 'approved'];

// DEC-003 deliverable kind literals.
export type DeliverableKind = 'presentation' | 'poster' | 'handout';

export const DELIVERABLE_KINDS: readonly DeliverableKind[] = ['presentation', 'poster', 'handout'];

export const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  presentation: 'Presentation',
  poster: 'Poster',
  handout: 'Handout',
};

// Item shape for the worklist, sourced from GET /api/v1/events/:eventId/submissions
// (DEC-016 list contract; contentStatus already lands there).
export interface ContentSubmissionListItem {
  id: string;
  ref: string;
  title: string;
  contentStatus: ContentStatus;
  speakers: { contactId: string; name: string }[];
  deliverableCounts: Record<DeliverableKind, number>;
}

// GET /api/v1/submissions/:id/files item (DEC-020: flat file rows; the SPA
// groups by kind and orders each chain newest-first — see version-chain.ts).
export interface DeliverableFile {
  id: string;
  submissionId: string;
  kind: DeliverableKind;
  filename: string;
  sizeBytes: number;
  contentType: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  uploaderName?: string;
  createdAt: number;
}

// GET /api/v1/events/:eventId/files item (DEC-159: one row per
// previous_file_id version chain, newest version's metadata surfaced).
export interface EventFileChainItem {
  rootFileId: string;
  latestFileId: string;
  filename: string;
  kind: DeliverableKind;
  submissionId: string;
  submissionRef: string;
  submissionTitle: string;
  speakerName: string;
  uploadedAt: number;
  versionCount: number;
}

// GET/POST /api/v1/files/:fileId/comments item (DEC-020: author name + role).
export interface FileComment {
  id: string;
  fileId: string;
  // DEC-573: which version in the chain this comment was written against —
  // v1 is the oldest version.
  versionNumber: number;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: number;
}
