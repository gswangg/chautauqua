// Contacts repo: duplicates + merge. Split out of repo/contacts.ts
// (contention decomposition, no behavior change). See repo/contacts.ts for
// the module-level contract notes.

import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { findDuplicateGroups, planMerge, type ContactRecord } from "../../../domain/contacts";
import { serializeSocialLinks } from "../profile";
import { ApiError } from "../../http";
import { findContactById } from "./crud";
import { toContactRecord, type ContactRow, MAX_CONTACT_DIRECTORY_SCAN } from "./rows";
import { buildMergeRepointOps, mergedPipelineStage, type PipelineStageLike } from "./query";
import { DEC_479 } from "../../../decisions";

void DEC_479;

export interface DuplicateGroup {
  contactIds: string[];
  contacts: { id: string; firstName: string; lastName: string; email: string }[];
}

export async function findDuplicateGroupsForOrg(db: Db, orgId: string): Promise<DuplicateGroup[]> {
  // DEC-554: project only the columns findDuplicateGroups (via
  // normalizeEmail/normalizedName/normalizedCompany) and this function's own
  // output actually read -- id, email, firstName, lastName, company -- not
  // every persisted contact field. Bounded + deterministically ordered so
  // page 2+ of GET /api/v1/contacts/duplicates stays meaningful (DEC-466)
  // and the scan refuses rather than silently truncating past the cap.
  const scanned = await db
    .select({
      id: schema.contact.id,
      email: schema.contact.email,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
    })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId))
    .orderBy(asc(schema.contact.id))
    .limit(MAX_CONTACT_DIRECTORY_SCAN + 1);
  if (scanned.length > MAX_CONTACT_DIRECTORY_SCAN) {
    throw new ApiError(
      "invalid",
      `Org has more than ${MAX_CONTACT_DIRECTORY_SCAN} contacts; duplicate detection cannot scan the whole directory at this size. Narrow the scope or raise MAX_CONTACT_DIRECTORY_SCAN.`,
    );
  }
  const rows: { id: string; email: string; firstName: string; lastName: string }[] = scanned;
  const records: ContactRecord[] = scanned.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    ...(r.company ? { company: r.company } : {}),
  }));
  const groups = findDuplicateGroups(records);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = groups.map((ids) => ({
    contactIds: ids,
    contacts: ids.map((id) => {
      const r = byId.get(id);
      if (!r) throw new Error(`duplicate group referenced unknown contact ${id}`);
      return { id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email };
    }),
  }));
  // DEC-466: the query above has no ORDER BY, so `rows` (and therefore
  // findDuplicateGroups's output order) is not guaranteed deterministic --
  // GET /api/v1/contacts/duplicates now pages this array, so a stable
  // order matters for page 2+ to be meaningful across requests. Tiebreak on
  // each group's own first contact id.
  out.sort((a, b) => {
    const ai = a.contactIds[0] ?? "";
    const bi = b.contactIds[0] ?? "";
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
  return out;
}

/** DEC-565: pure predicate for the (b2) email-conflict pre-check. `owner
 * ContactId` is the contactId of whatever user row already owns the merged
 * email (null for an organizer/reviewer login, which has no contact). A
 * null ownerContactId always conflicts — this is exactly the staff-login
 * case that a SQL `contact_id NOT IN (:keepId, :mergeId)` predicate used to
 * skip, since SQLite's NOT IN evaluates to NULL (not TRUE) whenever the
 * column being compared is NULL, silently letting the merge proceed until
 * it later crashed on the user_email_idx UNIQUE constraint mid-write. */
export function emailConflictsWithOtherAccount(
  ownerContactId: string | null,
  keepId: string,
  mergeId: string,
): boolean {
  return ownerContactId !== keepId && ownerContactId !== mergeId;
}

/** Applies DEC-026/DEC-101/DEC-282/DEC-456/DEC-479 merge, in this exact
 * load-bearing order:
 *  (a) BEFORE any write, load both contacts' user rows; if both have a
 *      login account, throw a conflict (no partial merge — a merge that
 *      silently orphaned one login would be worse than refusing it).
 *  (b) planMerge onto the kept contact row.
 *  (b2) DEC-479: before any write, re-run DEC-456's own conflict pre-check
 *      against merged.email — if some OTHER user row (not keepId's, not
 *      mergeId's) already owns that address, throw a conflict. user_email_
 *      idx is a UNIQUE index (src/db/schema.ts), so this must run before
 *      the write below, not after. DEC-565: this must be evaluated in JS,
 *      not as a `contact_id NOT IN (...)` SQL predicate — organizer/reviewer
 *      logins are created with contactId NULL (src/server/repo/users.ts),
 *      and SQLite's NOT IN evaluates to NULL (not TRUE) whenever the column
 *      is NULL, so a staff login's email silently passed the old check.
 *  (c) dedupe participant rows the two contacts share a submission on
 *      (deleting mergeId's duplicate row rather than repointing it into a
 *      UNIQUE-violating dupe).
 *  (d) dedupe task_assignment rows the two contacts share a task on,
 *      keeping whichever row is 'complete' (completion is never lost).
 *  (e) if both contacts are enrolled in the CRM pipeline, repoint
 *      pipeline_activity onto the kept entry, merge the stage
 *      (mergedPipelineStage), and delete the merged entry.
 *  (f) repoint the seven CONTACT_FK_TABLES from mergeId to keepId, and
 *      (DEC-479) set the surviving user row's email to merged.email so
 *      login identity never drifts from the CRM's record of the contact's
 *      address (the same DEC-456 invariant patchContact enforces).
 *  (g) delete the merged contact row.
 * Both ids must already be verified org-scoped by the caller. */
export async function mergeContacts(db: Db, keepId: string, mergeId: string): Promise<ContactRow> {
  const keepRow = await findContactById(db, keepId);
  const mergeRow = await findContactById(db, mergeId);
  if (!keepRow) throw new Error(`merge: keep contact ${keepId} not found`);
  if (!mergeRow) throw new Error(`merge: merge contact ${mergeId} not found`);

  // (a) Login-account conflict check, before any write.
  const keepUserRows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.contactId, keepId))
    .limit(1);
  const mergeUserRows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.contactId, mergeId))
    .limit(1);
  if (keepUserRows.length > 0 && mergeUserRows.length > 0) {
    throw new ApiError("conflict", "Both contacts have a login account; remove one account before merging");
  }

  // (b) planMerge onto the kept row.
  const { merged } = planMerge(toContactRecord(keepRow), toContactRecord(mergeRow));

  // (b2) DEC-479/DEC-456/DEC-565: before any write, reject if merged.email
  // already belongs to some other login account (neither keepId's nor
  // mergeId's). Evaluated in JS via emailConflictsWithOtherAccount rather
  // than a SQL `contact_id NOT IN (...)` predicate — see DEC-565 note above
  // the function docstring for why NOT IN silently skipped NULL contactId
  // rows (staff logins).
  const mergedEmailLower = merged.email.toLowerCase();
  const emailConflictRows = await db
    .select({ id: schema.user.id, contactId: schema.user.contactId })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = ${mergedEmailLower}`)
    .limit(1);
  const owner = emailConflictRows[0];
  if (owner && emailConflictsWithOtherAccount(owner.contactId, keepId, mergeId)) {
    throw new ApiError("conflict", "That email already belongs to another account");
  }

  await db
    .update(schema.contact)
    .set({
      firstName: merged.firstName,
      lastName: merged.lastName,
      email: merged.email,
      company: merged.company ?? null,
      title: merged.title ?? null,
      phone: merged.phone ?? null,
      bio: merged.bio ?? null,
      headshotUrl: merged.headshotUrl ?? null,
      notes: merged.notes ?? null,
      socialLinksJson: merged.socialLinks ? serializeSocialLinks(merged.socialLinks) : null,
      customFieldsJson: merged.customFields ? JSON.stringify(merged.customFields) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, keepId));

  // Dedupe participant rows BEFORE repointing: if both contacts are already
  // participants on the same submission, repointing mergeId's row onto
  // keepId would produce a duplicate participant for that submission, so we
  // delete mergeId's row for the shared submissions instead.
  const mergeParticipants = await db
    .select({ id: schema.participant.id, submissionId: schema.participant.submissionId })
    .from(schema.participant)
    .where(eq(schema.participant.contactId, mergeId));
  const keepParticipants = await db
    .select({ submissionId: schema.participant.submissionId })
    .from(schema.participant)
    .where(eq(schema.participant.contactId, keepId));
  const keepSubmissionIds = new Set(keepParticipants.map((p) => p.submissionId));
  const dupeParticipantIds = mergeParticipants
    .filter((p) => keepSubmissionIds.has(p.submissionId))
    .map((p) => p.id);
  for (const chunk of chunkIds(dupeParticipantIds)) {
    await db.delete(schema.participant).where(inArray(schema.participant.id, chunk));
  }

  // (d) Dedupe task_assignment rows the two contacts share a task on, same
  // shape as the participant dedupe above (repointing onto keepId would
  // otherwise produce two assignment rows for the same task). Completion is
  // never lost: if exactly one side is 'complete', that side's row survives.
  const mergeTasks = await db
    .select({ id: schema.taskAssignment.id, taskId: schema.taskAssignment.taskId, status: schema.taskAssignment.status })
    .from(schema.taskAssignment)
    .where(eq(schema.taskAssignment.contactId, mergeId));
  const keepTasks = await db
    .select({ id: schema.taskAssignment.id, taskId: schema.taskAssignment.taskId, status: schema.taskAssignment.status })
    .from(schema.taskAssignment)
    .where(eq(schema.taskAssignment.contactId, keepId));
  const keepTaskById = new Map(keepTasks.map((t) => [t.taskId, t]));
  const dupeTaskAssignmentIds: string[] = [];
  for (const mergeTask of mergeTasks) {
    const keepTask = keepTaskById.get(mergeTask.taskId);
    if (!keepTask) continue;
    const mergeComplete = mergeTask.status === "complete";
    const keepComplete = keepTask.status === "complete";
    // Delete the merged row unless it's the only completed one, in which
    // case delete the kept row instead so completion survives.
    if (mergeComplete && !keepComplete) {
      dupeTaskAssignmentIds.push(keepTask.id);
    } else {
      dupeTaskAssignmentIds.push(mergeTask.id);
    }
  }
  for (const chunk of chunkIds(dupeTaskAssignmentIds)) {
    await db.delete(schema.taskAssignment).where(inArray(schema.taskAssignment.id, chunk));
  }

  // (e) Pipeline handling (DEC-282): if both contacts are enrolled, the
  // merged entry's activity feed is repointed onto the kept entry, the kept
  // entry's stage becomes the further-along of the two (mergedPipelineStage
  // — declined never displaces real progress), and the merged entry row is
  // deleted so it isn't left dangling for (f)'s generic repoint to touch.
  // If only one side is enrolled, there's nothing to reconcile here — (f)'s
  // generic pipeline_entry repoint below handles that case on its own.
  const keepEntryRows = await db
    .select({ id: schema.pipelineEntry.id, stage: schema.pipelineEntry.stage })
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.contactId, keepId))
    .limit(1);
  const mergeEntryRows = await db
    .select({ id: schema.pipelineEntry.id, stage: schema.pipelineEntry.stage })
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.contactId, mergeId))
    .limit(1);
  const keepEntry = keepEntryRows[0];
  const mergeEntry = mergeEntryRows[0];
  if (keepEntry && mergeEntry) {
    // Both entries exist, so mergedPipelineStage's null branches (either
    // side "not enrolled") are unreachable here; the cast reflects that.
    const nextStage = mergedPipelineStage(
      keepEntry.stage as PipelineStageLike,
      mergeEntry.stage as PipelineStageLike,
    ) as PipelineStageLike;
    await db
      .update(schema.pipelineActivity)
      .set({ entryId: keepEntry.id })
      .where(eq(schema.pipelineActivity.entryId, mergeEntry.id));
    await db
      .update(schema.pipelineEntry)
      .set({ stage: nextStage, updatedAt: new Date() })
      .where(eq(schema.pipelineEntry.id, keepEntry.id));
    await db.delete(schema.pipelineEntry).where(eq(schema.pipelineEntry.id, mergeEntry.id));
  }

  // (f) Generic FK repoints (DEC-282, CONTACT_FK_TABLES).
  const ops = buildMergeRepointOps(keepId, mergeId);
  for (const op of ops) {
    if (op.table === "participant") {
      await db.update(schema.participant).set({ contactId: op.to }).where(eq(schema.participant.contactId, op.from));
    } else if (op.table === "task_assignment") {
      await db.update(schema.taskAssignment).set({ contactId: op.to }).where(eq(schema.taskAssignment.contactId, op.from));
    } else if (op.table === "email_log") {
      await db.update(schema.emailLog).set({ contactId: op.to }).where(eq(schema.emailLog.contactId, op.from));
    } else if (op.table === "user") {
      await db.update(schema.user).set({ contactId: op.to }).where(eq(schema.user.contactId, op.from));
    } else if (op.table === "file") {
      await db.update(schema.file).set({ uploadedByContactId: op.to }).where(eq(schema.file.uploadedByContactId, op.from));
    } else if (op.table === "file_comment") {
      await db
        .update(schema.fileComment)
        .set({ authorContactId: op.to })
        .where(eq(schema.fileComment.authorContactId, op.from));
    } else {
      await db.update(schema.pipelineEntry).set({ contactId: op.to }).where(eq(schema.pipelineEntry.contactId, op.from));
    }
  }

  // DEC-479/DEC-456: cascade merged.email onto the surviving user row (if
  // any), same as patchContact does for a plain edit -- login identity must
  // never drift from the CRM's record of the contact's address. Conflict
  // already ruled out by (b2) above.
  await db
    .update(schema.user)
    .set({ email: mergedEmailLower, updatedAt: new Date() })
    .where(eq(schema.user.contactId, keepId));

  // (g) Delete the merged contact row.
  await db.delete(schema.contact).where(eq(schema.contact.id, mergeId));

  const updated = await findContactById(db, keepId);
  if (!updated) throw new Error(`merge: keep contact ${keepId} missing after merge`);
  return updated;
}
