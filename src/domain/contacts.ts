// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only. This module consumes
// already-parsed CSV rows (parseCsv lives in src/domain/csv.ts, DEC-011); it
// never imports the CSV parser itself.
//
// Structure-custodian decomposition: this file used to hold the whole J11
// domain (805 lines, a merge-conflict hotspot). It is now a re-export
// barrel over src/domain/contacts-parts/*, split by concern:
//   - types.ts       ContactRecord/SocialLinks + name/URL normalization
//   - duplicates.ts  findDuplicateGroups + CSV-import duplicate detection
//   - merge.ts        planMerge/previewMerge + participant-field pickers
//   - segments.ts     tokenizeContactQuery + segment-rule matching
//   - import.ts        CSV row mapping + per-field cap checks
// EVERY existing import path (`./contacts` / `.../domain/contacts`) keeps
// working unchanged; no behavior change. New code inside domain/contacts-
// parts/* imports siblings directly; code outside this directory should
// keep importing from this barrel.

export type { SocialLinks, ContactRecord } from "./contacts-parts/types";
export {
  safeExternalUrl,
  normalizedContactName,
  stripContactNameWhitespace,
} from "./contacts-parts/types";

export type { DuplicateReason, DuplicateCandidate } from "./contacts-parts/duplicates";
export {
  findDuplicateGroups,
  findImportDuplicateCandidates,
  describeImportOverwrites,
} from "./contacts-parts/duplicates";

export type { MergePlan, MergeFieldPreview } from "./contacts-parts/merge";
export {
  planMerge,
  mergedInviteStatus,
  mergedParticipantVisible,
  previewMerge,
} from "./contacts-parts/merge";

export type { SegmentRule } from "./contacts-parts/segments";
export {
  MAX_SEGMENT_RULES,
  tokenizeContactQuery,
  SEGMENT_STANDARD_FIELDS,
  matchesSegment,
  parseSegmentRulesJson,
} from "./contacts-parts/segments";

export type { StandardImportField } from "./contacts-parts/import";
export {
  MAX_IMPORT_CSV_BYTES,
  MAX_IMPORT_ROWS,
  MAX_POSSIBLE_DUPLICATES,
  STANDARD_IMPORT_FIELDS,
  mapImportRow,
  importFieldCapViolations,
  validateImportMapping,
} from "./contacts-parts/import";
