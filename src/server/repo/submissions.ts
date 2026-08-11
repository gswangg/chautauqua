// Submissions repo (J3 backend, DEC-016 list contract). Repo functions are
// the only code that touches drizzle row types (DEC-012): thin handlers in
// src/routes/api/submissions.ts call these, which call the pure cores in
// src/domain/{status,acceptance,ids}.ts. This module deliberately contains
// NO mail/mailer import (DEC-009 invariant #1) — verified by a source-scan
// test in test/api-submissions.test.ts.
//
// This file is a barrel: implementation lives in submissions/{query,list,
// detail,create,status}.ts, split out for contention decomposition (no
// behavior change). Re-export everything so existing import paths keep
// working unchanged. Participant-management (invite/visibility) lives in
// the sibling repo/participants.ts module (DEC-070), not this barrel.

export {
  chunkIds,
  ID_CHUNK_SIZE,
  isValidStatusLiteral,
  parseListQuery,
  SORT_ORDERS,
  type ParsedListQuery,
  type SortOrder,
} from "./submissions/query";

export {
  listSubmissions,
  type ListSubmissionsResult,
  type SubmissionListItem,
  type SubmissionSpeaker,
} from "./submissions/list";

export {
  getEventOrgId,
  getSubmissionContent,
  getSubmissionDetail,
  getSubmissionOwnership,
  getUserEmail,
  type SubmissionDetail,
  type SubmissionDetailParticipant,
} from "./submissions/detail";

export {
  cloneSubmission,
  createSubmission,
  updateSubmissionFields,
  type CreateSubmissionInput,
  type UpdateSubmissionFieldsInput,
} from "./submissions/create";

export {
  updateSubmissionStatuses,
  ensureOnboardingTasks,
  getSubmissionStatus,
  getSubmissionStatusForParticipant,
  type UpdateStatusesResult,
  type SubmissionStatusForParticipant,
} from "./submissions/status";
