// CRM repo layer (J11, DEC-026). Only this module touches drizzle row types
// for contacts/segments (DEC-012); handlers in src/routes/api/contacts.ts
// call these, which call the already-landed pure core src/domain/contacts.ts
// (findDuplicateGroups, planMerge, matchesSegment, mapImportRow). The
// non-db-dependent decisions below (sort comparator, import upsert
// resolution, merge repoint plan) are factored out as plain functions so
// they're directly vitest-testable without a D1 binding (no D1 test harness
// exists in this repo — see test/contacts-repo.test.ts).
//
// This file is a barrel: implementation lives in contacts/{rows,query,crud,
// history,import,merge,stats,segments,bulk,push}.ts, split out for
// contention decomposition (no behavior change). Re-export everything so
// existing import paths keep working unchanged.

export { toRow, toContactRecord, type ContactRow } from "./contacts/rows";

export {
  parseContactListQuery,
  compareContacts,
  resolveImportUpsert,
  CONTACT_FK_TABLES,
  buildMergeRepointOps,
  mergedPipelineStage,
  type ParsedContactListQuery,
  type ImportUpsertAction,
  type MergeRepointTable,
  type MergeRepointOp,
  type PipelineStageLike,
} from "./contacts/query";

export {
  customFieldsJsonOf,
  parseContactCustomFields,
  findContactById,
  findContactForOrg,
  createContact,
  patchContact,
  listContactsForOrg,
  listContactReferenceRows,
  countContactsForSegmentRules,
  deleteContact,
  type ContactInput,
  type ContactPatch,
  type ContactListResult,
  type ContactReferenceRows,
} from "./contacts/crud";

export {
  getContactHistory,
  type ContactHistorySubmission,
  type ContactHistoryEmail,
  type ContactHistory,
} from "./contacts/history";

export {
  applyImportRows,
  planImportRows,
  lookupContactIdsByEmail,
  MAX_IMPORT_ROWS,
  type ImportSkip,
  type ImportResult,
  type ImportPlan,
  type ImportPlanRow,
  type ImportPlanOverwrite,
} from "./contacts/import";

export {
  findDuplicateGroupsForOrg,
  findDuplicateCandidatesForOrg,
  mergeContacts,
  checkMergeConflicts,
  dismissDuplicatePair,
  countMergeImpact,
  type DuplicateGroup,
  type DuplicateCandidateMatch,
} from "./contacts/merge";

export { getContactStats, type ContactStats } from "./contacts/stats";

export {
  listSegmentsForOrg,
  countSegmentsForOrg,
  findSegmentForOrg,
  upsertSegmentByName,
  patchSegment,
  deleteSegment,
  type SegmentRow,
} from "./contacts/segments";

export { findContactsForOrg } from "./contacts/bulk";
export { findAccountUserId, findAccountUserIds } from "./comms";

export { pushContactToEvent, pushContactsToEvent } from "./contacts/push";
