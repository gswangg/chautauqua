// Contacts repo: duplicates + merge. Split out of repo/contacts.ts
// (contention decomposition, no behavior change). See repo/contacts.ts for
// the module-level contract notes.

import { and, asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import {
  findDuplicateGroups,
  planMerge,
  mergedInviteStatus,
  mergedParticipantVisible,
  stripContactNameWhitespace,
  type ContactRecord,
  type DuplicateReason,
} from "../../../domain/contacts";
import { normalizeEmail } from "../../../domain/email";
import { serializeSocialLinks } from "../profile";
import { ApiError } from "../../http";
import { findContactById, customFieldsJsonOf } from "./crud";
import { toContactRecord, type ContactRow, MAX_CONTACT_DIRECTORY_SCAN } from "./rows";
import { buildMergeRepointOps, mergedPipelineStage, type PipelineStageLike } from "./query";
import { planMergeFold, detectMergeConflicts } from "./merge-preflight";
import { newId } from "../../../domain/ids";
import { DEC_026, DEC_479, DEC_770, DEC_992 } from "../../../decisions";
import { touchSubmissions, touchSubmissionsForContacts } from "../submissions/touch";

void DEC_026;
void DEC_479;
void DEC_770;
void DEC_992;

/** DEC-770: dismissal pairs are always keyed by (org, min(id), max(id)) so
 * the caller's argument order never matters and the unique index below is
 * the single idempotency contract. */
function orderedPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

/** DEC-770: persists a 'Not a duplicate' / 'Keep both' dismissal for a pair
 * of contacts. Idempotent -- onConflictDoNothing against the
 * (org_id, contact_id_a, contact_id_b) unique index, so a repeat dismissal
 * of the same pair is a no-op, never a 500. Both ids must already be
 * verified org-scoped by the caller. */
export async function dismissDuplicatePair(db: Db, orgId: string, idA: string, idB: string): Promise<void> {
  const [contactIdA, contactIdB] = orderedPair(idA, idB);
  await db
    .insert(schema.contactDuplicateDismissal)
    .values({
      id: newId(),
      orgId,
      contactIdA,
      contactIdB,
      createdAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        schema.contactDuplicateDismissal.orgId,
        schema.contactDuplicateDismissal.contactIdA,
        schema.contactDuplicateDismissal.contactIdB,
      ],
    });
}

/** DEC-770 amendment (wave 48): a dismissal judges a *pair*, never a single
 * contact -- so when either side of that pair is gone (deleted, or merged
 * away into the other contact), the dismissal row itself is deleted, never
 * repointed onto a survivor. One statement, either match column. Called from
 * deleteContact (crud.ts) before the contact row delete, and from
 * mergeOnePair immediately before its own (g) contact delete. */
export async function deleteDismissalsForContact(db: Db, contactId: string): Promise<void> {
  await db
    .delete(schema.contactDuplicateDismissal)
    .where(
      or(
        eq(schema.contactDuplicateDismissal.contactIdA, contactId),
        eq(schema.contactDuplicateDismissal.contactIdB, contactId),
      ),
    );
}

/** DEC-770: the set of dismissed pairs for an org, as "idA,idB" keys (idA <
 * idB) for O(1) membership checks against a group's own sorted pair. */
async function loadDismissedPairKeys(db: Db, orgId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      contactIdA: schema.contactDuplicateDismissal.contactIdA,
      contactIdB: schema.contactDuplicateDismissal.contactIdB,
    })
    .from(schema.contactDuplicateDismissal)
    .where(eq(schema.contactDuplicateDismissal.orgId, orgId));
  return new Set(rows.map((r) => `${r.contactIdA},${r.contactIdB}`));
}

export interface DuplicateGroup {
  contactIds: string[];
  reason: DuplicateReason;
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string | null;
    title?: string | null;
    // DEC-992: the merge compare table's "added <date>" column-head vintage
    // -- one more column on the scan already running, never a second
    // by-ids fetch (same reasoning DEC-734 used for title/company).
    createdAt: number;
  }[];
}

type ScannedContactRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  title: string | null;
  createdAt: Date;
};

// Wave-41 (DEC-788 amendment): the closed-class whitespace codepoints
// stripContactNameWhitespace (src/domain/contacts.ts) strips -- restated here
// as SQLite char() codepoints (tab, LF, VT, FF, CR, space, NBSP) so the SQL
// narrowing built from them is a PROVABLE mirror of that same closed set,
// not a guess at what SQL "whitespace" means.
const CONTACT_NAME_WHITESPACE_CODEPOINTS = [9, 10, 11, 12, 13, 32, 160];

/** Wave-41 (DEC-788 amendment): `lower(coalesce(first_name,'') ||
 * coalesce(last_name,''))` with every whitespace codepoint in
 * CONTACT_NAME_WHITESPACE_CODEPOINTS stripped out -- the SQL mirror of
 * stripContactNameWhitespace(firstName + lastName) in JS. */
function strippedNameSqlExpr(): SQL {
  let expr: SQL = sql`lower(coalesce(${schema.contact.firstName}, '') || coalesce(${schema.contact.lastName}, ''))`;
  for (const codepoint of CONTACT_NAME_WHITESPACE_CODEPOINTS) {
    expr = sql`replace(${expr}, char(${codepoint}), '')`;
  }
  return expr;
}

/** Wave-41 (DEC-788 amendment): a PROVABLE SQL superset of what
 * findDuplicateGroups would actually bucket a `candidate` row with --
 * (normalized email equality) OR (whitespace-stripped name equality, using
 * the SAME closed whitespace class stripContactNameWhitespace uses). Used
 * ONLY by findDuplicateCandidatesForOrg's single-candidate check;
 * findDuplicateGroupsForOrg's full-directory scan is untouched. A superset,
 * not the matcher itself: findDuplicateGroups (imported, never restated)
 * remains the only thing that decides an actual match against the rows this
 * narrows down to. */
function duplicateCandidateNarrowingCondition(candidate: {
  email: string;
  firstName: string;
  lastName: string;
}): SQL {
  const normalizedEmail = normalizeEmail(candidate.email);
  const strippedCandidateName = stripContactNameWhitespace(candidate.firstName + candidate.lastName);
  const nameCond = sql`${strippedNameSqlExpr()} = ${strippedCandidateName}`;
  if (normalizedEmail === "") return nameCond;
  const emailCond = sql`lower(trim(${schema.contact.email})) = ${normalizedEmail}`;
  return sql`(${emailCond}) or (${nameCond})`;
}

/** DEC-554/DEC-734/DEC-788: the one org-contact scan both
 * findDuplicateGroupsForOrg and the create-time duplicate check
 * (GET /contacts/duplicates/check) build on -- project only the columns
 * findDuplicateGroups (via normalizeEmail/normalizedContactName/normalizedCompany)
 * and either caller's own output actually read, not every persisted contact
 * field. Bounded + deterministically ordered; the scan refuses rather than
 * silently truncating past the cap.
 *
 * Wave-41 amendment: `narrowTo`, used ONLY by findDuplicateCandidatesForOrg,
 * adds a PROVABLE-superset SQL predicate (see
 * duplicateCandidateNarrowingCondition) on top of the org filter -- the same
 * `.limit(MAX_CONTACT_DIRECTORY_SCAN + 1)` bound and the same loud refusal
 * past the cap apply to the narrowed query, so a single-candidate check can
 * still answer for an org whose FULL directory would refuse via
 * findDuplicateGroupsForOrg. findDuplicateGroupsForOrg itself never passes
 * `narrowTo` and its full-scan behaviour is unchanged. */
async function scanContactsForOrg(
  db: Db,
  orgId: string,
  narrowTo?: { email: string; firstName: string; lastName: string },
): Promise<ScannedContactRow[]> {
  const whereCond = narrowTo
    ? and(eq(schema.contact.orgId, orgId), duplicateCandidateNarrowingCondition(narrowTo))
    : eq(schema.contact.orgId, orgId);
  const scanned = await db
    .select({
      id: schema.contact.id,
      email: schema.contact.email,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
      title: schema.contact.title,
      createdAt: schema.contact.createdAt,
    })
    .from(schema.contact)
    .where(whereCond)
    .orderBy(asc(schema.contact.id))
    .limit(MAX_CONTACT_DIRECTORY_SCAN + 1);
  if (scanned.length > MAX_CONTACT_DIRECTORY_SCAN) {
    throw new ApiError(
      "invalid",
      `Org has more than ${MAX_CONTACT_DIRECTORY_SCAN} contacts; duplicate detection cannot scan the whole directory at this size. Narrow the scope or raise MAX_CONTACT_DIRECTORY_SCAN.`,
    );
  }
  return scanned;
}

export async function findDuplicateGroupsForOrg(db: Db, orgId: string): Promise<DuplicateGroup[]> {
  const rows = await scanContactsForOrg(db, orgId);
  const records: ContactRecord[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    ...(r.company ? { company: r.company } : {}),
  }));
  const allGroups = findDuplicateGroups(records);
  // DEC-770: a dismissed pair never appears in the list OR the total --
  // filtered here, server-side, before pagination/total ever see it, so the
  // count and the list can never drift. Only 2-contact groups are pairs; a
  // 3+ contact email-bucket group has no single pair to dismiss against, so
  // it is left alone (dismissDuplicatePair/the wire contract is pairwise).
  const dismissedPairKeys = await loadDismissedPairKeys(db, orgId);
  const groups = allGroups.filter((g) => {
    if (g.contactIds.length !== 2) return true;
    const [a, b] = orderedPair(g.contactIds[0]!, g.contactIds[1]!);
    return !dismissedPairKeys.has(`${a},${b}`);
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = groups.map((g) => ({
    contactIds: g.contactIds,
    reason: g.reason,
    contacts: g.contactIds.map((id) => {
      const r = byId.get(id);
      if (!r) throw new Error(`duplicate group referenced unknown contact ${id}`);
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        company: r.company,
        title: r.title,
        createdAt: r.createdAt.getTime(),
      };
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

export interface DuplicateCandidateMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  reason: "email" | "name";
}

// A candidate being typed into "New contact" has no persisted id yet -- this
// sentinel can never collide with a real contact id (newId()'s alphabet
// never produces this literal string).
const CANDIDATE_SENTINEL_ID = "__duplicate_check_candidate__";

/** DEC-788: GET /contacts/duplicates/check's predicate -- reuses the exact
 * same repo-level scan (scanContactsForOrg) and the exact same pair-matching
 * rule (findDuplicateGroups, imported not restated) that
 * findDuplicateGroupsForOrg powers GET /contacts/duplicates with, including
 * its (org, lower(email)) identity bucket. The not-yet-persisted candidate
 * is injected into the same record set under a sentinel id; whichever real
 * contacts land in the sentinel's own group are the candidate's matches.
 * Because findDuplicateGroups buckets by an EXACT normalized-email or
 * normalized-name+company match, any two real contacts that land in the
 * candidate's group necessarily already form their own real-only duplicate
 * pair (with or without the candidate) -- so when the candidate's matches
 * are exactly that one real pair, DEC-770's own dismissal fact for that pair
 * governs here too: a dismissed pair is not reported. Pure read, no writes. */
export async function findDuplicateCandidatesForOrg(
  db: Db,
  orgId: string,
  candidate: { firstName: string; lastName: string; email: string; company?: string },
): Promise<DuplicateCandidateMatch[]> {
  const rows = await scanContactsForOrg(db, orgId, {
    email: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
  });
  const records: ContactRecord[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    ...(r.company ? { company: r.company } : {}),
  }));
  const candidateRecord: ContactRecord = {
    id: CANDIDATE_SENTINEL_ID,
    email: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    ...(candidate.company ? { company: candidate.company } : {}),
  };
  const allGroups = findDuplicateGroups([...records, candidateRecord]);
  const group = allGroups.find((g) => g.contactIds.includes(CANDIDATE_SENTINEL_ID));
  if (!group) return [];
  const matchedIds = group.contactIds.filter((id) => id !== CANDIDATE_SENTINEL_ID);
  if (matchedIds.length === 0) return [];

  // DEC-770: the candidate's matched real ids necessarily also form their
  // own real-only duplicate group (see docstring). When that group is
  // exactly a dismissed pair, it's not reported for the candidate either.
  if (matchedIds.length === 2) {
    const dismissedPairKeys = await loadDismissedPairKeys(db, orgId);
    const [a, b] = orderedPair(matchedIds[0]!, matchedIds[1]!);
    if (dismissedPairKeys.has(`${a},${b}`)) return [];
  }

  const candidateEmail = normalizeEmail(candidate.email);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: DuplicateCandidateMatch[] = matchedIds.map((id) => {
    const r = byId.get(id);
    if (!r) throw new Error(`duplicate candidate group referenced unknown contact ${id}`);
    const reason: "email" | "name" = candidateEmail !== "" && normalizeEmail(r.email) === candidateEmail ? "email" : "name";
    return { id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email, company: r.company, reason };
  });
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, 5);
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
 *  (a) both-logins and (b2) email-taken are no longer checked HERE — DEC-026
 *      wave-43 amendment: mergeContacts now runs a whole-operation preflight
 *      (planMergeFold + detectMergeConflicts) over the FULL id list before
 *      any pair's fold begins, so by the time mergeOnePair runs for any
 *      pair, both conditions are already proven impossible for the WHOLE
 *      operation, not just this pair. The two checks below are kept as
 *      fail-loud invariants (same thrown shape) so a bug in the preflight
 *      surfaces immediately instead of silently letting a bad merge through.
 *  (b) planMerge onto the kept contact row.
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
async function mergeOnePair(db: Db, keepId: string, mergeId: string): Promise<ContactRow> {
  const keepRow = await findContactById(db, keepId);
  const mergeRow = await findContactById(db, mergeId);
  if (!keepRow) throw new Error(`merge: keep contact ${keepId} not found`);
  if (!mergeRow) throw new Error(`merge: merge contact ${mergeId} not found`);

  // (a) DEC-026 wave-43 amendment: mergeContacts' whole-operation preflight
  // already proved no more than one contact in the FULL id list has a login
  // — this recheck of just this pair can never fire; kept as a fail-loud
  // invariant (same thrown shape) rather than deleted, so a preflight bug
  // surfaces as a loud error instead of a silently-orphaned login.
  // DEC-558: the limit-1 lookup below is safe even though `user_contact_id_idx`
  // is a plain (non-unique) index — both queries below are used only via
  // `.length > 0` (an EXISTS check), never by row identity, so which row
  // SQLite happens to return when more than one exists is immaterial.
  const keepUserRows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.contactId, keepId))
    .orderBy(schema.user.id)
    .limit(1);
  // DEC-558: same EXISTS-only reasoning as keepUserRows above -- .orderBy is
  // a total order over the (never-observed) candidate set, added wave 79 so
  // this chain's DEC-558 exemption is checkable, not just asserted.
  const mergeUserRows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.contactId, mergeId))
    .orderBy(schema.user.id)
    .limit(1);
  if (keepUserRows.length > 0 && mergeUserRows.length > 0) {
    throw new ApiError("conflict", "Both contacts have a login account; remove one account before merging");
  }

  // (b) planMerge onto the kept row.
  const { merged } = planMerge(toContactRecord(keepRow), toContactRecord(mergeRow));

  // (b2) DEC-026 wave-43 amendment: mergeContacts' whole-operation preflight
  // already proved every intermediate merged email (planMergeFold, same fold
  // order) is unowned or owned by a contact within the FULL id list — this
  // recheck of just this pair's own merged.email can never fire; kept as a
  // fail-loud invariant (same thrown shape), not deleted, for the same
  // reason as (a) above. Evaluated in JS via emailConflictsWithOtherAccount,
  // never a SQL `contact_id NOT IN (...)` predicate — see DEC-565 note above
  // the function docstring for why NOT IN silently skipped NULL contactId
  // rows (staff logins).
  const mergedEmailLower = merged.email.toLowerCase();
  const emailConflictRows = await db
    .select({ id: schema.user.id, contactId: schema.user.contactId })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = ${mergedEmailLower}`)
    .orderBy(schema.user.id)
    .limit(1);
  const owner = emailConflictRows[0];
  if (owner && emailConflictsWithOtherAccount(owner.contactId, keepId, mergeId)) {
    throw new ApiError("conflict", "That email already belongs to another account");
  }

  // DEC-773 amendment (w29-b): headshotFileId must stay derived from
  // whichever headshotUrl planMerge kept -- the string shape is exactly
  // repo/profile.ts's setContactHeadshot's own `/headshots/<fileId>`, so
  // this mirrors the migration 0040 backfill's parsing rather than
  // preserving either input row's now possibly-stale headshotFileId.
  const mergedHeadshotUrl = merged.headshotUrl ?? null;
  const headshotPrefix = "/headshots/";
  const mergedHeadshotFileId =
    mergedHeadshotUrl && mergedHeadshotUrl.startsWith(headshotPrefix)
      ? mergedHeadshotUrl.slice(headshotPrefix.length)
      : null;

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
      headshotUrl: mergedHeadshotUrl,
      headshotFileId: mergedHeadshotFileId,
      notes: merged.notes ?? null,
      socialLinksJson: merged.socialLinks ? serializeSocialLinks(merged.socialLinks) : null,
      customFieldsJson: customFieldsJsonOf(merged.customFields) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, keepId));

  // Dedupe participant rows BEFORE repointing: if both contacts are already
  // participants on the same submission, repointing mergeId's row onto
  // keepId would produce a duplicate participant for that submission, so we
  // delete mergeId's row for the shared submissions instead. DEC-282
  // amendment: before deleting, fold the merged row's inviteStatus/visible
  // into the kept row (mergedInviteStatus/mergedParticipantVisible) so an
  // accepted invite or public visibility the duplicate carried is never
  // silently lost just because it happened to be the non-surviving row.
  const mergeParticipants = await db
    .select({
      id: schema.participant.id,
      submissionId: schema.participant.submissionId,
      inviteStatus: schema.participant.inviteStatus,
      visible: schema.participant.visible,
    })
    .from(schema.participant)
    .where(eq(schema.participant.contactId, mergeId));
  const keepParticipants = await db
    .select({
      id: schema.participant.id,
      submissionId: schema.participant.submissionId,
      inviteStatus: schema.participant.inviteStatus,
      visible: schema.participant.visible,
    })
    .from(schema.participant)
    .where(eq(schema.participant.contactId, keepId));
  const keepParticipantBySubmissionId = new Map(keepParticipants.map((p) => [p.submissionId, p]));
  const dupeParticipantIds: string[] = [];
  const inviteStatusIdsByTarget = new Map<string, string[]>();
  const makeVisibleIds: string[] = [];
  // DEC-725 amendment: every submission whose participant composition this
  // merge touches (dedupe below, or the generic repoint at (f)) must have
  // its updated_at bumped once, set-based, at the end of this function —
  // see submissions/touch.ts header. mergeParticipants above is already the
  // FULL set of participant rows for mergeId (fetched before either branch
  // runs), so every submissionId in it is affected either way: a shared
  // submission gets its kept row's status/visibility folded in and the
  // dupe deleted (below), and a non-shared submission gets its row
  // repointed onto keepId at (f) — reusing this set avoids a second SELECT
  // (and the ordering that would otherwise put a query between (e) and (f)).
  const affectedSubmissionIds = new Set(mergeParticipants.map((p) => p.submissionId));
  for (const mergeParticipant of mergeParticipants) {
    const keepParticipant = keepParticipantBySubmissionId.get(mergeParticipant.submissionId);
    if (!keepParticipant) continue;
    dupeParticipantIds.push(mergeParticipant.id);
    const nextStatus = mergedInviteStatus(keepParticipant.inviteStatus, mergeParticipant.inviteStatus);
    if (nextStatus !== keepParticipant.inviteStatus) {
      const ids = inviteStatusIdsByTarget.get(nextStatus) ?? [];
      ids.push(keepParticipant.id);
      inviteStatusIdsByTarget.set(nextStatus, ids);
    }
    const nextVisible = mergedParticipantVisible(keepParticipant.visible, mergeParticipant.visible);
    if (nextVisible !== keepParticipant.visible) {
      makeVisibleIds.push(keepParticipant.id);
    }
  }
  for (const [targetStatus, ids] of inviteStatusIdsByTarget) {
    for (const chunk of chunkIds(ids)) {
      await db.update(schema.participant).set({ inviteStatus: targetStatus }).where(inArray(schema.participant.id, chunk));
    }
  }
  for (const chunk of chunkIds(makeVisibleIds)) {
    await db.update(schema.participant).set({ visible: true }).where(inArray(schema.participant.id, chunk));
  }
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
  // DEC-558: at most one row by construction — `pipeline_entry_org_id_contact_id_idx`
  // is a uniqueIndex on (orgId, contactId), and a contact row belongs to
  // exactly one org, so filtering on contactId alone still narrows to at
  // most one pipeline_entry row.
  const keepEntryRows = await db
    .select({ id: schema.pipelineEntry.id, stage: schema.pipelineEntry.stage })
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.contactId, keepId))
    .limit(1);
  // DEC-558: same `pipeline_entry_org_id_contact_id_idx` uniqueIndex
  // reasoning as keepEntryRows above.
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

  // (f) Generic FK repoints (DEC-282, CONTACT_FK_TABLES). The participant
  // rows repointed here are exactly mergeParticipants minus the deduped-away
  // ids above — already covered by affectedSubmissionIds, built from the
  // full mergeParticipants set before either branch ran (see comment above).
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

  // DEC-770 amendment (wave 48): a dismissal judged this pair, not either
  // contact in isolation -- delete it rather than repoint it onto keepId,
  // immediately before the contact delete it must precede.
  await deleteDismissalsForContact(db, mergeId);

  // DEC-725 amendment: one set-based touch covering every submission whose
  // Speakers cell composition this merge changed (dedupe (c) + repoint (f)).
  await touchSubmissions(db, [...affectedSubmissionIds], new Date());

  // DEC-725 (wave-32 amendment): planMerge's winning name can differ from
  // keepRow's OWN pre-merge name (e.g. mergeRow's name wins because keepRow
  // was missing one). affectedSubmissionIds above only covers submissions
  // reached through mergeId's (the discarded contact's) participant rows —
  // it never includes a submission where ONLY keepId already participated,
  // so that submission's already-pushed Speakers string would otherwise go
  // stale. touchSubmissionsForContacts([keepId]) covers keepId's full
  // participant set (including the overlap with affectedSubmissionIds,
  // which is a harmless no-op re-touch).
  if (merged.firstName !== keepRow.firstName || merged.lastName !== keepRow.lastName) {
    await touchSubmissionsForContacts(db, [keepId], new Date());
  }

  // (g) Delete the merged contact row.
  await db.delete(schema.contact).where(eq(schema.contact.id, mergeId));

  const updated = await findContactById(db, keepId);
  if (!updated) throw new Error(`merge: keep contact ${keepId} missing after merge`);
  return updated;
}

/** DEC-802: the merge preview's "N submissions and M tasks move to
 * <keeper>" line -- a set-based count of participant and task_assignment
 * rows belonging to the contacts that would be DISCARDED by the merge
 * (never the keeper), so the number always matches what mergeOnePair's
 * generic FK repoint (f) is about to touch. One chunked COUNT query per
 * table (chunkIds keeps each IN clause within SQLite's variable cap),
 * summed across chunks -- never loads the rows themselves. Both tables
 * only count rows still pointed at a to-be-discarded contact id; a merge
 * dedupes some participant/task rows away before repointing (see
 * mergeOnePair (c)/(d)), so this is an upper bound on what actually moves,
 * not a promise every counted row survives to land on the keeper -- but it
 * is exactly the set of rows this contact currently owns, which is what a
 * user deciding whether to merge needs to see. */
export async function countMergeImpact(
  db: Db,
  discardedContactIds: string[],
): Promise<{ submissions: number; tasks: number }> {
  if (discardedContactIds.length === 0) return { submissions: 0, tasks: 0 };

  let submissions = 0;
  for (const chunk of chunkIds(discardedContactIds)) {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.participant)
      .where(inArray(schema.participant.contactId, chunk));
    submissions += Number(rows[0]?.count ?? 0);
  }

  let tasks = 0;
  for (const chunk of chunkIds(discardedContactIds)) {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.taskAssignment)
      .where(inArray(schema.taskAssignment.contactId, chunk));
    tasks += Number(rows[0]?.count ?? 0);
  }

  return { submissions, tasks };
}

/** DEC-629/DEC-026 wave-43 amendment (wave-47 amendment: extracted so the
 * preview route can run the identical check -- see this function's own
 * docstring on `checkMergeConflicts` for why a second copy would be the
 * drift this exists to remove). Read-only: runs the whole-operation
 * preflight and returns the first conflict found, or null if the merge is
 * clean. Both keepId and every id in mergeIds must already be verified
 * org-scoped by the caller; mergeIds must already be deduped and have
 * keepId filtered out (mergeContacts and the preview route both do this
 * before calling in). Performs no write. */
export async function checkMergeConflicts(
  db: Db,
  keepId: string,
  mergeIds: string[],
): Promise<{ code: string; message: string } | null> {
  const allIds = [keepId, ...mergeIds];

  const keepRow = await findContactById(db, keepId);
  if (!keepRow) throw new Error(`merge: keep contact ${keepId} not found`);
  const mergeRows: ContactRow[] = [];
  for (const mergeId of mergeIds) {
    const row = await findContactById(db, mergeId);
    if (!row) throw new Error(`merge: merge contact ${mergeId} not found`);
    mergeRows.push(row);
  }
  const { steps } = planMergeFold(
    toContactRecord(keepRow),
    mergeRows.map((row) => toContactRecord(row)),
  );

  const contactIdsWithLogin = new Set<string>();
  for (const chunk of chunkIds(allIds)) {
    const rows = await db
      .select({ contactId: schema.user.contactId })
      .from(schema.user)
      .where(inArray(schema.user.contactId, chunk));
    for (const row of rows) {
      if (row.contactId) contactIdsWithLogin.add(row.contactId);
    }
  }

  const intermediateEmails = Array.from(new Set(steps.map((s) => s.mergedEmail.toLowerCase())));
  const emailOwners = new Map<string, string | null>();
  for (const chunk of chunkIds(intermediateEmails)) {
    const rows = await db
      .select({ email: schema.user.email, contactId: schema.user.contactId })
      .from(schema.user)
      .where(inArray(sql`lower(${schema.user.email})`, chunk));
    for (const row of rows) {
      emailOwners.set(row.email.toLowerCase(), row.contactId);
    }
  }

  return detectMergeConflicts({ keepId, mergeIds, contactIdsWithLogin, emailOwners, steps });
}

/** DEC-629/DEC-026 wave-43 amendment: set-based, ALL-OR-NOTHING merge.
 * Dedupes mergeIds, drops keepId if present (a no-op to merge a contact into
 * itself), then runs checkMergeConflicts's whole-operation preflight BEFORE
 * any write -- the SAME function the GET /contacts/merge/preview route calls
 * (wave-47 amendment), so there is exactly one implementation of the rule,
 * not a parallel copy that can drift. Only once the preflight passes clean
 * does the fold run, one mergeOnePair call per id — so a refusal always
 * means ZERO writes, never a write of contacts 1..k-1 followed by a 409 on
 * contact k. Both keepId and every id in mergeIds must already be verified
 * org-scoped by the caller. */
export async function mergeContacts(db: Db, keepId: string, mergeIds: string[]): Promise<ContactRow> {
  const toMerge = Array.from(new Set(mergeIds)).filter((id) => id !== keepId);
  if (toMerge.length === 0) {
    throw new ApiError("invalid", "mergeIds must contain at least one id other than keepId");
  }

  const conflict = await checkMergeConflicts(db, keepId, toMerge);
  if (conflict) {
    throw new ApiError("conflict", conflict.message);
  }

  let survivor: ContactRow | undefined;
  for (const mergeId of toMerge) {
    survivor = await mergeOnePair(db, keepId, mergeId);
  }
  if (!survivor) throw new Error("merge: no survivor produced");
  return survivor;
}
