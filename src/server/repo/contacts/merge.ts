// Contacts repo: duplicates + merge. Split out of repo/contacts.ts
// (contention decomposition, no behavior change). See repo/contacts.ts for
// the module-level contract notes.

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { findDuplicateGroups, planMerge } from "../../../domain/contacts";
import { serializeSocialLinks } from "../profile";
import { ApiError } from "../../http";
import { findContactById } from "./crud";
import { toContactRecord, toRow, type ContactRow } from "./rows";
import { buildMergeRepointOps, mergedPipelineStage, type PipelineStageLike } from "./query";

export interface DuplicateGroup {
  contactIds: string[];
  contacts: { id: string; firstName: string; lastName: string; email: string }[];
}

export async function findDuplicateGroupsForOrg(db: Db, orgId: string): Promise<DuplicateGroup[]> {
  const rows = (await db.select().from(schema.contact).where(eq(schema.contact.orgId, orgId))).map(toRow);
  const records = rows.map(toContactRecord);
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

/** Applies DEC-026/DEC-101/DEC-282 merge, in this exact load-bearing order:
 *  (a) BEFORE any write, load both contacts' user rows; if both have a
 *      login account, throw a conflict (no partial merge — a merge that
 *      silently orphaned one login would be worse than refusing it).
 *  (b) planMerge onto the kept contact row.
 *  (c) dedupe participant rows the two contacts share a submission on
 *      (deleting mergeId's duplicate row rather than repointing it into a
 *      UNIQUE-violating dupe).
 *  (d) dedupe task_assignment rows the two contacts share a task on,
 *      keeping whichever row is 'complete' (completion is never lost).
 *  (e) if both contacts are enrolled in the CRM pipeline, repoint
 *      pipeline_activity onto the kept entry, merge the stage
 *      (mergedPipelineStage), and delete the merged entry.
 *  (f) repoint the seven CONTACT_FK_TABLES from mergeId to keepId.
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

  // (g) Delete the merged contact row.
  await db.delete(schema.contact).where(eq(schema.contact.id, mergeId));

  const updated = await findContactById(db, keepId);
  if (!updated) throw new Error(`merge: keep contact ${keepId} missing after merge`);
  return updated;
}
