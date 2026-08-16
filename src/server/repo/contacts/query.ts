// Contacts repo: pure, db-free decisions (unit-tested directly). Split out
// of repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import type { ContactRecord, SegmentRule } from "../../../domain/contacts";
import type { ContactRow } from "./rows";
import type { PipelineStage } from "../pipeline";
import { clampPage, clampPerPage } from "../../../lib/pagination";
import { boundedQueryString, MAX_SEARCH_QUERY_LENGTH, MAX_FILTER_ID_LENGTH } from "../../../lib/query-bounds";
import { DEC_843 } from "../../../decisions";

void DEC_843; // wave-63 amendment: contacts directory `sort` token is loud, modelled on readStatusTokens

export interface ParsedContactListQuery {
  page: number;
  perPage: number;
  q: string | null;
  segmentId: string | null;
  sort: "name" | "recent";
  rules: SegmentRule[];
}

/**
 * Reads the directory's `sort` token per the DEC-843 wave-63 amendment:
 * modelled byte-for-byte on readStatusTokens/readReuploadedToken in
 * submissions/query.ts. Absent or blank-after-trim defaults to "name";
 * "name"/"recent" return themselves; anything else THROWS a plain Error
 * naming the token (loud) rather than silently falling back to "name" --
 * this module is pure/db-free, so a plain Error, not ApiError.
 */
export function readContactSortToken(raw: string | undefined): "name" | "recent" {
  if (raw === undefined || raw.trim().length === 0) return "name";
  const token = raw.trim();
  if (token === "name") return "name";
  if (token === "recent") return "recent";
  throw new Error(`Unknown sort '${token}'`);
}

/** DEC-013 pagination parsing, DEC-026 filters (q, segmentId, sort
 * name|recent), DEC-149 multi-criteria `rules` (already-parsed+validated by
 * the route layer from ?rules= URL-encoded JSON — this function never
 * touches raw JSON, it just threads the parsed array through). Clamp rule
 * per DEC-480 delegated to clampPage/clampPerPage -- no local copy. */
export function parseContactListQuery(
  raw: Record<string, string | undefined>,
  rules: SegmentRule[] = [],
): ParsedContactListQuery {
  const page = clampPage(raw.page);
  const perPage = clampPerPage(raw.perPage);

  const q = boundedQueryString(raw.q, "q", MAX_SEARCH_QUERY_LENGTH);

  const segmentId = boundedQueryString(raw.segmentId, "segmentId", MAX_FILTER_ID_LENGTH);

  const sort = readContactSortToken(raw.sort);

  return { page, perPage, q, segmentId, sort, rules };
}

/** DEC-554: structural pick of exactly the fields compareContacts reads, so
 * the segment/rules scan (crud.ts) can pass its narrow projected row instead
 * of a full ContactRow — same implementation, no behavior change. */
export type SortableContactRow = Pick<ContactRow, "updatedAt" | "lastName" | "firstName">;

/** Comparator for the two DEC-026 sort orders: name (last, first) or recent (updatedAt desc). */
export function compareContacts(sort: "name" | "recent"): (a: SortableContactRow, b: SortableContactRow) => number {
  if (sort === "recent") {
    return (a, b) => b.updatedAt - a.updatedAt;
  }
  return (a, b) => {
    const last = a.lastName.localeCompare(b.lastName);
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName);
  };
}

export type ImportUpsertAction =
  | { action: "create"; values: Omit<ContactRecord, "id"> }
  | { action: "update"; id: string; patch: Partial<Omit<ContactRecord, "id">> };

/**
 * Decides create-vs-update for one already-mapped import row, matched by
 * case-insensitive email (DEC-026). `existingId` is the id of an org
 * contact whose email already matches (case-insensitively), if any.
 *
 * DEC-575: on the create branch, blank stays blank (there's nothing to
 * lose). On the update branch, a blank-after-trim cell means "no value
 * supplied", never "clear this field" — such standard fields (firstName,
 * lastName, company, title, phone, bio) are omitted from the patch
 * entirely rather than written as "". customFields never replace the
 * stored blob wholesale: `existingCustomFields` (the contact's currently
 * stored custom fields, if any — the caller fetches this in its own
 * chunked pre-pass, not per row) is merged key-by-key with the parsed
 * row's custom columns, and a blank-after-trim custom value is skipped
 * (leaves the stored key, if any, untouched) rather than overwriting it.
 */
export function resolveImportUpsert(
  existingId: string | undefined,
  parsed: Partial<ContactRecord>,
  existingCustomFields?: Record<string, string>,
): ImportUpsertAction {
  if (!parsed.email || parsed.email.trim() === "") {
    throw new Error("resolveImportUpsert: parsed row must have a non-blank email");
  }
  if (existingId === undefined) {
    return {
      action: "create",
      values: {
        email: parsed.email,
        firstName: parsed.firstName ?? "",
        lastName: parsed.lastName ?? "",
        ...(parsed.company !== undefined ? { company: parsed.company } : {}),
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
        ...(parsed.bio !== undefined ? { bio: parsed.bio } : {}),
        ...(parsed.customFields !== undefined ? { customFields: parsed.customFields } : {}),
      },
    };
  }
  const patch: Partial<Omit<ContactRecord, "id">> = {};
  const setIfNonBlank = (
    key: "firstName" | "lastName" | "company" | "title" | "phone" | "bio",
    value: string | undefined,
  ) => {
    if (value !== undefined && value.trim() !== "") {
      patch[key] = value;
    }
  };
  setIfNonBlank("firstName", parsed.firstName);
  setIfNonBlank("lastName", parsed.lastName);
  setIfNonBlank("company", parsed.company);
  setIfNonBlank("title", parsed.title);
  setIfNonBlank("phone", parsed.phone);
  setIfNonBlank("bio", parsed.bio);

  if (parsed.customFields !== undefined) {
    const merged: Record<string, string> = { ...(existingCustomFields ?? {}) };
    for (const [key, value] of Object.entries(parsed.customFields)) {
      if (value.trim() !== "") merged[key] = value;
    }
    patch.customFields = merged;
  }

  return { action: "update", id: existingId, patch };
}

/** DEC-282: every table with a *_id column pointing at contact.id must be
 * repointed on merge. This is the exhaustive list — the schema-tripwire
 * test in test/contacts-merge-integrity.test.ts walks src/db/schema.ts and
 * fails loudly if a new contact-referencing table is added here without
 * being enumerated. pipeline_entry was the DEC-282 gap: it was omitted,
 * so listPipelineForOrg threw "references missing contact" for the whole
 * org after any merge (the merged contact's pipeline_entry row was never
 * repointed before the contact row was deleted). */
export const CONTACT_FK_TABLES = [
  "user",
  "participant",
  "task_assignment",
  "email_log",
  "file",
  "file_comment",
  "pipeline_entry",
] as const;
export type MergeRepointTable = (typeof CONTACT_FK_TABLES)[number];

export interface MergeRepointOp {
  table: MergeRepointTable;
  from: string;
  to: string;
}

/**
 * Plans the DEC-282 FK repoints on merge (participant, task_assignment,
 * email_log, user.contact_id, file.uploaded_by_contact_id,
 * file_comment.author_contact_id, pipeline_entry.contact_id) before the
 * duplicate row is deleted. Fails loudly if asked to merge a contact into
 * itself.
 */
export function buildMergeRepointOps(keepId: string, mergeId: string): MergeRepointOp[] {
  if (keepId === mergeId) {
    throw new Error("buildMergeRepointOps: keepId and mergeId must differ");
  }
  return CONTACT_FK_TABLES.map((table) => ({
    table,
    from: mergeId,
    to: keepId,
  }));
}

/** DEC-180 wave-79 amendment: re-exported from ../pipeline's PipelineStage
 * (the ONE declared pipeline-stage vocabulary) under this module's own name
 * rather than re-listed as a second copy. The prior comment's stated reason
 * ("avoid a module cycle") did not hold: this is a type-only import, erased
 * before runtime, so it cannot create a require() cycle even though
 * contacts/merge.ts (a consumer of this file) is reachable from pipeline.ts
 * transitively. */
export type PipelineStageLike = PipelineStage;

const PIPELINE_STAGE_RANK: Record<PipelineStageLike, number> = {
  identified: 0,
  contacted: 1,
  interested: 2,
  confirmed: 3,
  declined: -1,
};

/** DEC-282: picks the surviving stage when both contacts being merged are
 * enrolled in the pipeline. null means "not enrolled" (a missing
 * pipeline_entry row) — if only one side is enrolled, that side's stage
 * wins outright. If both are enrolled, the further-along stage wins by
 * rank (declined is deliberately rank -1 so it never displaces genuine
 * progress just because it's "later" chronologically); equal rank keeps
 * the kept contact's own value. */
export function mergedPipelineStage(
  keep: PipelineStageLike | null,
  merge: PipelineStageLike | null,
): PipelineStageLike | null {
  if (keep === null && merge === null) return null;
  if (keep === null) return merge;
  if (merge === null) return keep;
  const keepRank = PIPELINE_STAGE_RANK[keep];
  const mergeRank = PIPELINE_STAGE_RANK[merge];
  if (mergeRank > keepRank) return merge;
  return keep;
}

// DEC-738/DEC-726 (supersedes DEC-712): a contact's Labels are its
// customFields, formatted once server-side by src/domain/contact-labels.ts
// (contactLabels) directly over the already-fetched ContactRow -- no
// separate batched `participant` query. deriveContactLabels/
// fetchContactLabels were deleted here along with the ContactParticipantRoleRow
// type; see test/contacts-labels.test.ts for the replacement coverage.
