// Shared shapes for the Content SPA (J8 content review loop, DEC-020).
// Kept dependency-free so pure helpers stay unit-testable without a DOM.

import type { FileKind } from '../../../../src/domain/files';
import { FILE_KINDS } from '../../../../src/domain/files';
import type { ContentStatus } from '../../../../src/domain/content-status';

// DEC-003 content-status literals — imported from the pure core
// (src/domain/content-status.ts) so the SPA's status union can never drift
// from the server's.
export type { ContentStatus };

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes requested',
};

// Worklist ordering (SPEC §2.3 — worklist, not report): items needing action
// surface first, approved sinks to the bottom. DEC-180 wave-79 amendment:
// same three ContentStatus members as CONTENT_STATUSES (src/domain/content-status.ts)
// but a DIFFERENT, deliberate order (a display priority, not the canonical
// set) -- a genuinely separate vocabulary from the same member set, not a
// re-listed copy, so it is cited here rather than collapsed.
export const CONTENT_STATUS_PRIORITY: readonly ContentStatus[] = ['changes_requested', 'pending', 'approved'];

// DEC-003 file kind literals — imported from the pure core (src/domain/files.ts)
// so the SPA's kind union can never drift from the server's.
export type { FileKind };
export { FILE_KINDS };

// w5-i (docs/design/README.md:236, DEC-756/DEC-721/DEC-020's own quoted mock
// text): the design vocabulary names the deliverable "Slides", never
// "Presentation" -- the domain kind literal stays `presentation` (DEC-003),
// only the label the SPA renders changes.
export const DELIVERABLE_LABELS: Record<FileKind, string> = {
  presentation: 'Slides',
  poster: 'Poster',
  handout: 'Handout',
  recording: 'Recording',
  photo: 'Photo / headshot',
};

// DEC-773: the files library is ONE list — a headshot is a file kind, not a
// tab. LIBRARY_KINDS/LIBRARY_KIND_LABELS extend the deliverable vocabulary
// with 'headshot' for the kind-chip strip and the ?kind= filter; the
// upload-time vocabulary (FILE_KINDS above) stays presentation/poster/
// handout only — a headshot is never uploaded through the submission-files
// upload route.
export const HEADSHOT_KIND = 'headshot' as const;
export type LibraryKind = FileKind | typeof HEADSHOT_KIND;
export const LIBRARY_KINDS: readonly LibraryKind[] = [...FILE_KINDS, HEADSHOT_KIND];
export const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  ...DELIVERABLE_LABELS,
  headshot: 'Headshot',
};

// Item shape for the worklist, sourced from GET /api/v1/events/:eventId/submissions
// (DEC-016 list contract; contentStatus already lands there).
export interface ContentSubmissionListItem {
  id: string;
  ref: string;
  title: string;
  contentStatus: ContentStatus;
  speakers: { contactId: string; name: string }[];
  deliverableCounts: Record<FileKind, number>;
  // v4 mock worklist column (DEC-692): the submission's most-recently
  // uploaded deliverable, or null when nothing has been uploaded yet — the
  // absent state renders honestly ('No files yet'), never inferred client
  // side from deliverableCounts.
  latestFile: { filename: string; kind: FileKind; versionCount: number; uploadedAt: number } | null;
  // DEC-881: the single re-uploaded predicate (latest deliverable file's
  // version_no > 1), computed server-side once and read here — never
  // re-derived client-side from latestFile.versionCount (a deleted middle
  // version could disagree with version_no).
  latestFileVersionNo: number | null;
  reuploaded: boolean;
  // w5-i: a per-kind latest version_no (Partial -- a kind with no files is
  // simply absent), so the worklist's Latest file column can print a
  // per-kind summary ("Slides v3 · Recording v1") rather than collapsing to
  // the single globally-newest upload's filename+version. Batched
  // server-side (src/server/repo/submissions/list.ts), never re-derived
  // client-side from latestFile alone.
  latestFileByKind: Partial<Record<FileKind, number>>;
  // w41-b (DEC-902 amendment): the worklist SESSION cell's subtitle --
  // batched off schedule_slot/room server-side (src/server/repo/submissions
  // /list.ts), never a per-row fetch. null for a submission not yet placed
  // on the agenda.
  scheduled: { day: string; startMin: number; endMin: number; roomName: string | null } | null;
}

// GET /api/v1/submissions/:id/files item (DEC-020: flat file rows; the SPA
// groups by kind and orders each chain newest-first — see version-chain.ts).
export interface DeliverableFile {
  id: string;
  submissionId: string;
  kind: FileKind;
  filename: string;
  sizeBytes: number;
  contentType: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  uploaderName: string | null;
  createdAt: number;
  /** DEC-965: the row's own stored version_no — carried end-to-end instead
   * of re-derived from chain position. */
  versionNo: number;
}

// GET /api/v1/events/:eventId/files item (DEC-159/773: one row per
// previous_file_id version chain OR speaker headshot, newest version's
// metadata surfaced). A headshot row carries submissionId/submissionRef/
// submissionTitle all "" (no submission) and versionCount 1.
export interface EventFileChainItem {
  rootFileId: string;
  latestFileId: string;
  filename: string;
  kind: LibraryKind;
  submissionId: string;
  submissionRef: string;
  submissionTitle: string;
  speakerName: string;
  uploadedAt: number;
  versionCount: number;
  // DEC-902: the file's own stored version number (DEC-818 identity) --
  // what the library's VERSION column shows, never versionCount (a
  // chain-length marker).
  versionNo: number;
  sizeBytes: number;
  uploaderName: string | null;
}

// GET /api/v1/events/:eventId/files envelope (DEC-773: totalSizeBytes sums
// the latest version of every matching chain, alongside `total`; DEC-902:
// kindCounts is one count per LIBRARY_KIND, independent of the caller's
// ?kind= selection, computed server-side in ONE grouped query).
export interface EventFilesEnvelope {
  items: EventFileChainItem[];
  total: number;
  totalSizeBytes: number;
  page: number;
  perPage: number;
  kindCounts: Record<LibraryKind, number>;
}

// GET/POST /api/v1/files/:fileId/comments item (DEC-020: author name + role).
export interface FileComment {
  id: string;
  fileId: string;
  // DEC-573: which version in the chain this comment was written against —
  // v1 is the oldest version.
  versionNumber: number;
  authorName: string;
  authorRole: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: number;
}
