// Contacts repo: pure, db-free decisions (unit-tested directly). Split out
// of repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import type { ContactRecord, SegmentRule } from "../../../domain/contacts";
import type { ContactRow } from "./rows";

export interface ParsedContactListQuery {
  page: number;
  perPage: number;
  q: string | null;
  segmentId: string | null;
  sort: "name" | "recent";
  rules: SegmentRule[];
}

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

/** DEC-013 pagination parsing, DEC-026 filters (q, segmentId, sort
 * name|recent), DEC-149 multi-criteria `rules` (already-parsed+validated by
 * the route layer from ?rules= URL-encoded JSON — this function never
 * touches raw JSON, it just threads the parsed array through). */
export function parseContactListQuery(
  raw: Record<string, string | undefined>,
  rules: SegmentRule[] = [],
): ParsedContactListQuery {
  const pageNum = Number(raw.page);
  const page = Number.isFinite(pageNum) && Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

  const perPageNum = Number(raw.perPage);
  const perPage =
    Number.isFinite(perPageNum) && Number.isInteger(perPageNum) && perPageNum >= 1
      ? Math.min(perPageNum, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  const qTrimmed = raw.q?.trim();
  const q = qTrimmed ? qTrimmed : null;

  const segmentId = raw.segmentId?.trim() ? raw.segmentId.trim() : null;

  const sort = raw.sort === "recent" ? "recent" : "name";

  return { page, perPage, q, segmentId, sort, rules };
}

/**
 * Lowercases `raw`, escapes SQL LIKE metacharacters (\, %, _) so a literal
 * search term can never widen into a wildcard match, and wraps it for
 * substring containment. Callers must pair the result with
 * `LIKE ${like} ESCAPE '\\'` so SQLite honors the escaped backslash
 * (DEC-333/DEC-336: the contact directory search predicate moves into SQL).
 */
export function likeContains(raw: string): string {
  const escaped = raw.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}

/** Comparator for the two DEC-026 sort orders: name (last, first) or recent (updatedAt desc). */
export function compareContacts(sort: "name" | "recent"): (a: ContactRow, b: ContactRow) => number {
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
 * contact whose email already matches (case-insensitively), if any. Update
 * patches only carry the fields present on the parsed row (partial CSV
 * mappings never blank out existing data).
 */
export function resolveImportUpsert(existingId: string | undefined, parsed: Partial<ContactRecord>): ImportUpsertAction {
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
  if (parsed.firstName !== undefined) patch.firstName = parsed.firstName;
  if (parsed.lastName !== undefined) patch.lastName = parsed.lastName;
  if (parsed.company !== undefined) patch.company = parsed.company;
  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.phone !== undefined) patch.phone = parsed.phone;
  if (parsed.bio !== undefined) patch.bio = parsed.bio;
  if (parsed.customFields !== undefined) patch.customFields = parsed.customFields;
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

/** Local union, not imported from ./pipeline, to avoid a module cycle
 * (pipeline.ts's PipelineStage is structurally identical). */
export type PipelineStageLike = "identified" | "contacted" | "interested" | "confirmed" | "declined";

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
