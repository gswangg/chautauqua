// Files repo — central files library (DEC-159/160/344), event-scoped
// deliverable version chains. Split out of files.ts (contention
// decomposition) — files.ts re-exports everything below for existing
// callers.
//
// DEC-344: this module is server-paginated/server-filtered — one paginated
// statement over chain ROOTS (previous_file_id is null) per the DEC-333/335
// scale rule, never a whole-event scan. resolveLatestVersions likewise never
// scans the event's submissions; it only ever loads the requested files'
// own submissions/version chains.

import { and, eq, inArray, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";
import { FILE_KINDS } from "../../domain/files";
import { chunkIds } from "../../lib/chunk";
import { likeContains } from "./like";
import { ApiError } from "../http";
import { batchContactNames } from "./files-versions";
import { acceptedSpeakerConditions } from "./tasks/crud";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { DEC_680, DEC_773, DEC_902 } from "../../decisions";

void DEC_680;
void DEC_773;
void DEC_902;

// DEC-773 (supersedes DEC-669): a headshot file's kind, used both as the
// row's `kind` value and as the extra token the ?kind= filter accepts
// alongside the deliverable kinds.
export const HEADSHOT_KIND = "headshot";

// DEC-773 amendment (w55-c): the ceiling both listEventDeliverableFiles root
// scans (deliverable chain roots, headshot roots) refuse past — mirrors
// contacts/rows.ts's MAX_CONTACT_DIRECTORY_SCAN. Each root query
// `.limit(MAX_FILE_LIBRARY_SCAN + 1)`s and throws rather than silently
// truncating an audit list once an event's matching file count exceeds this.
export const MAX_FILE_LIBRARY_SCAN = 20000;

export interface EventFilesScope {
  orgId: string;
  slug: string;
}

/** Org + slug for the GET/POST /events/:eventId/files* endpoints — slug
 * feeds the ZIP download's Content-Disposition filename. */
export async function getEventFilesScope(db: Db, eventId: string): Promise<EventFilesScope | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId, slug: schema.event.slug })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}

/** DEC-773: one row per version chain -- either a deliverable (attributed
 * to its submission) or a speaker headshot (attributed directly to its
 * contact, submissionId/submissionRef/submissionTitle all ""). A headshot
 * is structurally a single-file chain (setContactHeadshot never sets
 * previousFileId), so its versionCount is always 1 and rootFileId ===
 * latestFileId. */
export interface EventDeliverableChain {
  rootFileId: string;
  latestFileId: string;
  filename: string;
  kind: string;
  submissionId: string;
  submissionRef: string;
  submissionTitle: string;
  speakerName: string;
  uploadedAt: number;
  versionCount: number;
  // DEC-902: the file's own stored version number (DEC-818 identity, not
  // chain position) -- what the library's VERSION column shows, never
  // versionCount (a chain-length marker). A headshot is structurally its
  // own single-version chain, so this is always 1 for a headshot row.
  versionNo: number;
  sizeBytes: number;
  uploaderName: string | null;
}

export interface EventFilesQuery {
  page: number;
  perPage: number;
  // May contain any of FILE_KINDS plus HEADSHOT_KIND (DEC-773).
  kinds: string[];
  q: string | null;
}

export interface EventDeliverableChainPage {
  items: EventDeliverableChain[];
  total: number;
  // DEC-773: sum of the latest version's sizeBytes for every chain
  // matching the current kind/q filters (not just the page's rows) --
  // produced by the same conditions `total` is, never a page-derived tally.
  totalSizeBytes: number;
  page: number;
  perPage: number;
  // DEC-902: one count per LIBRARY_KIND token, computed by ONE `group by
  // kind` aggregate (deliverables) plus one dedupe-by-file-id count
  // (headshots, a structurally separate population per DEC-773) over the
  // SAME event-scope + q predicate the list itself uses -- never filtered
  // by the currently-selected kind, so switching chips never invalidates
  // the other chips' own counts. Every LIBRARY_KIND token is present, 0
  // for a kind with no matching rows (an absent group must never silently
  // drop a key).
  kindCounts: Record<string, number>;
}

export interface DeliverableFileRow {
  id: string;
  submissionId: string;
  kind: string;
  filename: string;
  previousFileId: string | null;
  createdAt: Date;
  sizeBytes: number;
  uploadedByContactId: string | null;
  // DEC-818/DEC-902: this file's own stored version number (identity, not
  // chain position) — the library's VERSION column reads this, never
  // versionCount (a chain-length marker).
  versionNo: number | null;
}

/** Follows previous_file_id links to find the oldest ancestor ('root') of
 * `fileId` within `byId` — used to group a submission's files into version
 * chains. Bounded by the number of files loaded into `byId` (never the
 * whole event, per DEC-344), so a plain loop rather than a recursive CTE.
 * Exported so other page-scoped hydration passes (e.g. the submissions list's
 * latestFile field) reuse this chain-grouping logic rather than re-deriving
 * it (DEC-686/DEC-344). */
export function findRoot(fileId: string, byId: Map<string, DeliverableFileRow>): string {
  let current = byId.get(fileId);
  if (!current) throw new Error(`findRoot: file ${fileId} not in the loaded set`);
  const visited = new Set<string>([fileId]);
  while (current.previousFileId) {
    if (visited.has(current.previousFileId)) {
      throw new Error(`findRoot: previous_file_id cycle detected at ${current.previousFileId}`);
    }
    const parent = byId.get(current.previousFileId);
    if (!parent) break; // parent outside the loaded set — treat current as root
    visited.add(parent.id);
    current = parent;
  }
  return current.id;
}

/** Loads every file row for `submissionIds` (chunked, never the whole
 * event — DEC-344) and groups them into version chains keyed by root id
 * via findRoot. Shared by the page hydration and the totalSizeBytes
 * aggregate below so both walk chains the same way. */
async function loadDeliverableChains(db: Db, submissionIds: string[]): Promise<Map<string, DeliverableFileRow[]>> {
  const fileRows: DeliverableFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
        versionNo: schema.file.versionNo,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, batch));
    for (const r of batchRows) {
      if (r.submissionId) fileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const byId = new Map(fileRows.map((f) => [f.id, f]));
  const chains = new Map<string, DeliverableFileRow[]>();
  for (const f of fileRows) {
    const root = findRoot(f.id, byId);
    const arr = chains.get(root) ?? [];
    arr.push(f);
    chains.set(root, arr);
  }
  return chains;
}

function latestOf(chain: DeliverableFileRow[]): DeliverableFileRow {
  let latest = chain[0]!;
  for (const f of chain) {
    if (f.createdAt.getTime() > latest.createdAt.getTime()) latest = f;
  }
  return latest;
}

/** Shared by buildDeliverableWhere (root test) and buildDeliverableTipWhere
 * (chain-tip test) -- event scope + kind + q, everything EXCEPT which single
 * file per chain the query is selecting. */
function buildDeliverableCommonConditions(eventId: string, deliverableKinds: string[], q: string | null): SQL[] {
  const conditions = [eq(schema.submission.eventId, eventId)];
  if (deliverableKinds.length > 0) {
    conditions.push(inArray(schema.file.kind, deliverableKinds));
  }
  if (q) {
    const tokens = q.split(/\s+/).filter((t) => t.length > 0);
    const tokenConditions = tokens.map((token) => {
      const like = likeContains(token);
      return or(
        sql`${schema.file.filename} like ${like} escape '\\'`,
        sql`${schema.submission.title} like ${like} escape '\\'`,
        sql`exists (select 1 from ${schema.participant} inner join ${schema.contact} on ${schema.contact.id} = ${schema.participant.contactId} where ${schema.participant.submissionId} = ${schema.submission.id} and (${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like} escape '\\')`,
      )!;
    });
    if (tokenConditions.length > 0) {
      conditions.push(and(...tokenConditions)!);
    }
  }
  return conditions;
}

function buildDeliverableWhere(eventId: string, deliverableKinds: string[], q: string | null): SQL {
  return and(isNull(schema.file.previousFileId), ...buildDeliverableCommonConditions(eventId, deliverableKinds, q))!;
}

// DEC-773 amendment (w29-b): the chain-TIP test (no later file points back
// at this one via previous_file_id) rather than the chain-ROOT test
// (previous_file_id IS NULL) above -- used ONLY by the totalSizeBytes
// aggregate, which needs each chain's LATEST version's sizeBytes, never its
// root's. kind is invariant across a chain (files-versions.ts's
// getReplacesTarget/DEC-020 enforce a new version's kind matches what it
// replaces), so filtering the tip's kind is equivalent to filtering the
// root's.
function buildDeliverableTipWhere(eventId: string, deliverableKinds: string[], q: string | null): SQL {
  const tipTest = sql`not exists (select 1 from ${schema.file} as chq_tip_check where chq_tip_check.previous_file_id = ${schema.file.id})`;
  return and(tipTest, ...buildDeliverableCommonConditions(eventId, deliverableKinds, q))!;
}

// DEC-773 amendment (w29-b, supersedes the headshotUrl string-concatenation
// join): contact.headshot_file_id is the FK mirror of headshotUrl's own
// `/headshots/<fileId>` shape (set together everywhere headshotUrl is
// written -- repo/profile.ts's setContactHeadshot, repo/contacts/merge.ts's
// merge write), an indexable equality the old
// `headshotUrl = '/headshots/' || file.id` predicate could never be (no
// index can serve a computed string concatenation) -- measured as the
// files library's dominant cost (~460ms of ~500ms) at perf-seed scale.
// headshot_url itself is untouched: it stays the served path, and
// profile.ts's getHeadshotServeScope keeps its own unrelated reverse
// headshot_url lookup.
const HEADSHOT_JOIN = eq(schema.contact.headshotFileId, schema.file.id);

function buildHeadshotWhere(eventId: string, q: string | null): SQL {
  const conditions = [acceptedSpeakerConditions(eventId), isNotNull(schema.contact.headshotFileId)];
  if (q) {
    const tokens = q.split(/\s+/).filter((t) => t.length > 0);
    const tokenConditions = tokens.map((token) => {
      const like = likeContains(token);
      return or(
        sql`(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like} escape '\\'`,
        sql`coalesce(${schema.contact.company}, '') like ${like} escape '\\'`,
        sql`${schema.file.filename} like ${like} escape '\\'`,
      )!;
    });
    if (tokenConditions.length > 0) {
      conditions.push(and(...tokenConditions)!);
    }
  }
  return and(...conditions)!;
}

/** DEC-902: one count per LIBRARY_KIND token (FILE_KINDS + HEADSHOT_KIND),
 * over event-scope + q ONLY -- never the caller's selected kind, so a chip's
 * own printed number never depends on which chip is active. The deliverable
 * branch is ONE `group by kind` aggregate over chain roots; the headshot
 * branch counts distinct file ids the same way listEventDeliverableFiles's
 * own headshot branch dedupes (a contact can speak on multiple accepted
 * submissions matching the same headshot file). Every FILE_KINDS/HEADSHOT_
 * KIND token is enumerated into the result at 0 first, so a kind with no
 * matching rows still appears in the map. */
async function computeKindCounts(db: Db, eventId: string, q: string | null): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const k of FILE_KINDS) counts[k] = 0;
  counts[HEADSHOT_KIND] = 0;

  const deliverableWhere = buildDeliverableWhere(eventId, [], q);
  const deliverableGroups = await db
    .select({ kind: schema.file.kind, count: sql<number>`count(*)` })
    .from(schema.file)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.file.submissionId))
    .where(deliverableWhere)
    .groupBy(schema.file.kind);
  for (const g of deliverableGroups) {
    counts[g.kind] = Number(g.count);
  }

  // DEC-773 amendment (w55-c): a whole-population id read used purely as a
  // count is banned by DEC-418/DEC-461 -- one count(distinct file.id)
  // aggregate instead (distinct because a contact can speak on several
  // accepted submissions matching the same headshot file, per the module
  // doc comment above).
  const headshotWhere = buildHeadshotWhere(eventId, q);
  const headshotCountRows = await db
    .select({ count: sql<number>`count(distinct ${schema.file.id})` })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.file, HEADSHOT_JOIN)
    .where(headshotWhere);
  counts[HEADSHOT_KIND] = Number(headshotCountRows[0]?.count ?? 0);

  return counts;
}

interface DeliverableRootRow {
  id: string;
  submissionId: string | null;
  createdAt: Date;
  submissionSeq: number;
  submissionTitle: string;
}

interface HeadshotRootRow {
  id: string;
  contactId: string;
  createdAt: Date;
  filename: string;
  sizeBytes: number;
  uploadedByContactId: string | null;
}

/** Fetches the event row (for the submission ref prefix). Wave-1 read: an
 * independent (eventId)-only query, never depends on anything the list
 * resolves. */
async function fetchRecordPrefix(db: Db, eventId: string): Promise<string> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return eventRows[0]?.recordPrefix ?? "SES";
}

/** Wave-1 read: the deliverable chain-root page over (eventId, kinds, q)
 * only -- never depends on any other wave-1 read's result. */
async function fetchDeliverableRoots(
  db: Db,
  eventId: string,
  deliverableKinds: string[],
  q: string | null,
): Promise<DeliverableRootRow[]> {
  const deliverableWhere = buildDeliverableWhere(eventId, deliverableKinds, q);
  const deliverableRoots = await db
    .select({
      id: schema.file.id,
      submissionId: schema.file.submissionId,
      createdAt: schema.file.createdAt,
      submissionSeq: schema.submission.seq,
      submissionTitle: schema.submission.title,
    })
    .from(schema.file)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.file.submissionId))
    .where(deliverableWhere)
    .orderBy(sql`${schema.file.createdAt} desc, ${schema.file.id} asc`)
    .limit(MAX_FILE_LIBRARY_SCAN + 1);
  if (deliverableRoots.length > MAX_FILE_LIBRARY_SCAN) {
    throw new ApiError(
      "invalid",
      `This files library filter would scan more than ${MAX_FILE_LIBRARY_SCAN} deliverable files — narrow with the search box first (the q filter runs in SQL and composes with the kind filter)`,
    );
  }
  return deliverableRoots;
}

/** Wave-2 read: the chain-tip size sum, keyed on the same (eventId, kinds,
 * q) predicate the deliverable root page resolves against (DEC-902 keeps
 * this off the printed kindCounts, but it still shares q/kind scope with
 * the page, so it moves with the page-keyed wave rather than the bare
 * event-row read). */
async function fetchDeliverableSizeBytes(
  db: Db,
  eventId: string,
  deliverableKinds: string[],
  q: string | null,
): Promise<number> {
  const deliverableTipWhere = buildDeliverableTipWhere(eventId, deliverableKinds, q);
  const deliverableSizeRows = await db
    .select({ sum: sql<number>`coalesce(sum(${schema.file.sizeBytes}), 0)` })
    .from(schema.file)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.file.submissionId))
    .where(deliverableTipWhere);
  return Number(deliverableSizeRows[0]?.sum ?? 0);
}

/** Wave-1 read: the headshot root page over (eventId, q) only -- never
 * depends on any other wave-1 read's result. Dedupe-by-file-id (DEC-680) is
 * cheap in-process work done here so the caller sees a clean root list. */
async function fetchHeadshotRoots(db: Db, eventId: string, q: string | null): Promise<HeadshotRootRow[]> {
  const headshotWhere = buildHeadshotWhere(eventId, q);
  const rows = await db
    .selectDistinct({
      id: schema.file.id,
      contactId: schema.contact.id,
      createdAt: schema.file.createdAt,
      filename: schema.file.filename,
      sizeBytes: schema.file.sizeBytes,
      uploadedByContactId: schema.file.uploadedByContactId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.file, HEADSHOT_JOIN)
    .where(headshotWhere)
    .orderBy(sql`${schema.file.createdAt} desc, ${schema.file.id} asc`)
    .limit(MAX_FILE_LIBRARY_SCAN + 1);
  if (rows.length > MAX_FILE_LIBRARY_SCAN) {
    throw new ApiError(
      "invalid",
      `This files library filter would scan more than ${MAX_FILE_LIBRARY_SCAN} headshot files — narrow with the search box first (the q filter runs in SQL and composes with the kind filter)`,
    );
  }
  // A contact can speak on multiple accepted submissions — dedupe by
  // file id (DEC-680), never rely on selectDistinct alone since row
  // identity here is the file, not the (participant, file) pair.
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/** Wave-2 read: lead speaker names for the PAGE's own deliverable
 * submissions (DEC-344 bounded-cost rule). */
async function fetchLeadBySubmission(
  db: Db,
  submissionIds: string[],
): Promise<Map<string, { order: number; contactId: string; name: string }>> {
  const leadBySubmission = new Map<string, { order: number; contactId: string; name: string }>();
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        contactId: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(
        and(
          inArray(schema.participant.submissionId, batch),
          eq(schema.participant.role, "speaker"),
          inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
        ),
      );
    for (const p of batchRows) {
      if (!p.submissionId) continue;
      const existing = leadBySubmission.get(p.submissionId);
      if (!existing || p.order < existing.order || (p.order === existing.order && p.contactId < existing.contactId)) {
        leadBySubmission.set(p.submissionId, {
          order: p.order,
          contactId: p.contactId,
          name: `${p.firstName} ${p.lastName}`.trim(),
        });
      }
    }
  }
  return leadBySubmission;
}

/** DEC-773: the files library is ONE list — deliverable version chains AND
 * speaker headshots (kind='headshot', submissionId null, attributed to
 * their contact) merged by createdAt desc/id asc. Never a SQL UNION (the
 * two populations join through entirely different tables); each branch
 * fetches every MATCHING root once (bounded by MAX_FILE_LIBRARY_SCAN),
 * giving `total` and the merge candidates directly. totalSizeBytes is a
 * SEPARATE aggregate statement per branch, over the SAME predicates
 * buildDeliverableWhere/buildHeadshotWhere compose (DEC-773 amendment,
 * w29-b) -- never a chain materialization purely to sum a number. Per-page
 * hydration (lead speaker names, uploader names, and now the deliverable
 * chains themselves) stays scoped to just the page's rows (DEC-344).
 *
 * DEC-370/DEC-338 (w61-i): every read below issues in one of TWO declared
 * Promise.all waves rather than a strictly-sequential await ladder. Wave 1
 * holds every read keyed only on (eventId, params) -- the event row,
 * computeKindCounts (still sharing the LIST's own q/event predicate, DEC-
 * 902), and the two root-page queries that resolve which ids land on this
 * page. Wave 2 holds every read keyed on the PAGE's own resolved ids -- the
 * chain-tip size sum, the page's lead-speaker names, and the page's own
 * deliverable version chains. batchContactNames stays a THIRD, solitary
 * step: it needs uploadedByContactId off the chain's latest file, which
 * wave 2's loadDeliverableChains call itself resolves, so it is a real
 * sequential dependency, not an unowned ladder rung. No read here is ever
 * parallelized with a write. */
export async function listEventDeliverableFiles(
  db: Db,
  eventId: string,
  params: EventFilesQuery,
): Promise<EventDeliverableChainPage> {
  const deliverableKinds = params.kinds.filter((k) => k !== HEADSHOT_KIND);
  const wantsDeliverables = params.kinds.length === 0 || deliverableKinds.length > 0;
  const wantsHeadshots = params.kinds.length === 0 || params.kinds.includes(HEADSHOT_KIND);

  // Wave 1: independent of everything except (eventId, params).
  const [recordPrefix, kindCounts, deliverableRoots, headshotRoots] = await Promise.all([
    fetchRecordPrefix(db, eventId),
    // DEC-902: independent of params.kinds -- the chip strip's own counts
    // must never depend on which chip is currently selected.
    computeKindCounts(db, eventId, params.q),
    wantsDeliverables
      ? fetchDeliverableRoots(db, eventId, deliverableKinds, params.q)
      : Promise.resolve([] as DeliverableRootRow[]),
    wantsHeadshots ? fetchHeadshotRoots(db, eventId, params.q) : Promise.resolve([] as HeadshotRootRow[]),
  ]);

  const total = deliverableRoots.length + headshotRoots.length;

  interface Candidate {
    id: string;
    createdAt: Date;
    deliverable: DeliverableRootRow | null;
    headshot: HeadshotRootRow | null;
  }
  const merged: Candidate[] = [
    ...deliverableRoots.map((r) => ({ id: r.id, createdAt: r.createdAt, deliverable: r, headshot: null })),
    ...headshotRoots.map((r) => ({ id: r.id, createdAt: r.createdAt, deliverable: null, headshot: r })),
  ];
  // w5-i: deliverable chains sort ahead of headshots as a whole (each tier
  // still newest-first within itself) rather than one flat date-desc merge
  // -- a headshot uploaded during speaker signup otherwise floats to page 1
  // ahead of every real deliverable purely because signup predates content
  // review, which reads as "the library is full of headshots" on an
  // unfiltered load. The SPA still explains an empty SESSION cell (never
  // renders it blank) for whichever headshot rows do land on a page.
  merged.sort((a, b) => {
    if (a.headshot !== null && b.headshot === null) return 1;
    if (a.headshot === null && b.headshot !== null) return -1;
    const diff = b.createdAt.getTime() - a.createdAt.getTime();
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const offset = (params.page - 1) * params.perPage;
  const page = merged.slice(offset, offset + params.perPage);

  const deliverablePage = page.filter((c) => c.deliverable !== null);
  const headshotPage = page.filter((c) => c.headshot !== null);
  // DEC-773 amendment (w29-b): chains are loaded scoped to just the page's
  // own submissions -- never the full matching population
  // (loadDeliverableChains was previously called eagerly over every
  // matching deliverableRoot's submissionId purely so totalSizeBytes could
  // sum each chain's latest version; that sum is the SQL aggregate below,
  // so this per-page load is the only chain materialization left, matching
  // DEC-344's bounded-cost rule for real).
  const pageSubmissionIds = [
    ...new Set(deliverablePage.map((c) => c.deliverable!.submissionId).filter((id): id is string => !!id)),
  ];

  // Wave 2: every read keyed on the page's own resolved ids -- the
  // chain-tip size sum (shares the page's own event/kind/q predicate),
  // the page's lead-speaker names, and the page's own deliverable version
  // chains. chunkIds([]) yields zero batches, so an empty pageSubmissionIds
  // issues no statement here (mirrors the original conditional guards).
  const [deliverableSizeBytes, leadBySubmission, deliverableChains] = await Promise.all([
    wantsDeliverables ? fetchDeliverableSizeBytes(db, eventId, deliverableKinds, params.q) : Promise.resolve(0),
    fetchLeadBySubmission(db, pageSubmissionIds),
    loadDeliverableChains(db, pageSubmissionIds),
  ]);

  let totalSizeBytes = deliverableSizeBytes;
  for (const root of headshotRoots) totalSizeBytes += root.sizeBytes;

  if (page.length === 0) return { items: [], total, totalSizeBytes, page: params.page, perPage: params.perPage, kindCounts };

  // Uploader/owner names, batched across BOTH branches' page rows in ONE
  // lookup (never per-row, DEC-601). This is a real sequential dependency
  // on wave 2's loadDeliverableChains result (uploadedByContactId comes off
  // the chain's latest file), not an unowned ladder rung -- DEC-370.
  const latestByRoot = new Map<string, DeliverableFileRow>();
  for (const c of deliverablePage) {
    const chain = deliverableChains.get(c.id);
    if (!chain || chain.length === 0) {
      throw new Error(`listEventDeliverableFiles: chain root ${c.id} not resolved in per-page hydration`);
    }
    latestByRoot.set(c.id, latestOf(chain));
  }
  const contactIds = [
    ...new Set([
      ...[...latestByRoot.values()].map((f) => f.uploadedByContactId).filter((id): id is string => !!id),
      ...headshotPage.map((c) => c.headshot!.contactId),
      ...headshotPage.map((c) => c.headshot!.uploadedByContactId).filter((id): id is string => !!id),
    ]),
  ];
  const nameById = await batchContactNames(db, contactIds);

  const items: EventDeliverableChain[] = page.map((c) => {
    if (c.deliverable) {
      const latest = latestByRoot.get(c.id)!;
      const chain = deliverableChains.get(c.id)!;
      const lead = c.deliverable.submissionId ? leadBySubmission.get(c.deliverable.submissionId) : undefined;
      if (latest.versionNo === null || latest.versionNo === undefined) {
        // DEC-818: fail loudly rather than re-deriving version from chain
        // position -- see getFileVersionNumber's identical rule.
        throw new Error(`listEventDeliverableFiles: file ${latest.id} has no stored version_no — data corruption`);
      }
      return {
        rootFileId: c.id,
        latestFileId: latest.id,
        filename: latest.filename,
        kind: latest.kind,
        submissionId: c.deliverable.submissionId ?? "",
        submissionRef: formatRef(recordPrefix, c.deliverable.submissionSeq),
        submissionTitle: c.deliverable.submissionTitle,
        speakerName: lead?.name ?? "",
        uploadedAt: latest.createdAt.getTime(),
        versionCount: chain.length,
        versionNo: latest.versionNo,
        sizeBytes: latest.sizeBytes,
        uploaderName: latest.uploadedByContactId ? (nameById.get(latest.uploadedByContactId) ?? null) : null,
      };
    }
    const h = c.headshot!;
    const contactName = nameById.get(h.contactId) ?? "";
    return {
      rootFileId: h.id,
      latestFileId: h.id,
      filename: h.filename,
      kind: HEADSHOT_KIND,
      submissionId: "",
      submissionRef: "",
      submissionTitle: "",
      speakerName: contactName,
      uploadedAt: h.createdAt.getTime(),
      versionCount: 1,
      // DEC-773: a headshot is structurally its own single-version chain
      // (setContactHeadshot never sets previousFileId, never version_no) --
      // its own version number is always 1.
      versionNo: 1,
      sizeBytes: h.sizeBytes,
      uploaderName: h.uploadedByContactId ? (nameById.get(h.uploadedByContactId) ?? contactName) : contactName,
    };
  });

  return { items, total, totalSizeBytes, page: params.page, perPage: params.perPage, kindCounts };
}

/** Resolves headshot file ids to their own row (a headshot is always its
 * own single-version chain — setContactHeadshot never sets
 * previousFileId), scoped to accepted speakers of `eventId` via the same
 * acceptedSpeakerConditions the library listing composes, and to the
 * REVERSE contact.headshot_url match (so a superseded upload 404s even
 * though its file row/R2 object still exist — mirrors profile.ts's
 * getHeadshotServeScope). Throws (no silent skip) on any id not found in
 * that scope. */
async function resolveHeadshotVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>> {
  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>();
  if (fileIds.length === 0) return out;

  for (const batch of chunkIds(fileIds)) {
    const rows = await db
      .selectDistinct({
        id: schema.file.id,
        filename: schema.file.filename,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
        sizeBytes: schema.file.sizeBytes,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.file, HEADSHOT_JOIN)
      .where(and(acceptedSpeakerConditions(eventId), inArray(schema.file.id, batch)));
    for (const r of rows) {
      out.set(r.id, {
        id: r.id,
        filename: r.filename,
        contentType: r.contentType,
        r2Key: r.r2Key,
        submissionTitle: `${r.firstName} ${r.lastName}`.trim(),
        sizeBytes: r.sizeBytes,
      });
    }
  }
  for (const id of fileIds) {
    if (!out.has(id)) throw new ApiError("not_found", `File ${id} is not a deliverable of this event`);
  }
  return out;
}

/** DEC-160/344/773: resolves each requested file id to its version chain's
 * latest file row (id/filename/contentType/r2Key/submissionTitle) —
 * deliverables resolve through their submission's chain, headshots through
 * resolveHeadshotVersions — throws if any requested id doesn't resolve
 * within `eventId`'s scope (no silent skips, per DEC-160's "whole request
 * 404s" rule). Never calls listEventDeliverableFiles and never loads the
 * event's submissions — only the requested files' own submissions/version
 * chains (DEC-344 bounded-cost rule). */
export async function resolveLatestVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>> {
  if (fileIds.length === 0) return new Map();

  interface RequestedFileRow extends DeliverableFileRow {
    contentType: string;
    r2Key: string;
    sizeBytes: number;
  }

  const requestedFileRows: RequestedFileRow[] = [];
  const headshotIds: string[] = [];
  for (const batch of chunkIds(fileIds)) {
    const rows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
        versionNo: schema.file.versionNo,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const r of rows) {
      if (r.submissionId) {
        requestedFileRows.push({ ...r, submissionId: r.submissionId });
      } else {
        // DEC-773: submissionId null means either a headshot or a resource/
        // task upload — resolveHeadshotVersions itself scopes to kind
        // 'headshot' + an accepted-speaker contact, so a non-headshot
        // submissionId-null file simply won't resolve there and 404s below.
        headshotIds.push(r.id);
      }
    }
  }
  const deliverableIds = requestedFileRows.map((f) => f.id);
  const missingIds = fileIds.filter((id) => !deliverableIds.includes(id) && !headshotIds.includes(id));
  if (missingIds.length > 0) {
    throw new ApiError("not_found", `File ${missingIds[0]} is not a deliverable of this event`);
  }

  const submissionIds = [...new Set(requestedFileRows.map((f) => f.submissionId))];
  const submissionRows: { id: string; eventId: string; seq: number; title: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.submission.id,
        eventId: schema.submission.eventId,
        seq: schema.submission.seq,
        title: schema.submission.title,
      })
      .from(schema.submission)
      .where(inArray(schema.submission.id, batch));
    submissionRows.push(...rows);
  }
  const submissionById = new Map(submissionRows.map((s) => [s.id, s]));

  // Every requested file's submission must belong to eventId — no silent
  // skips (DEC-160), and a file from another event 404s the whole request.
  for (const f of requestedFileRows) {
    const sub = submissionById.get(f.submissionId);
    if (!sub || sub.eventId !== eventId) {
      throw new ApiError("not_found", `File ${f.id} is not a deliverable of this event`);
    }
  }

  // Load the full version chains (incl. contentType/r2Key) of just those
  // submissions (bounded, DEC-344 — never the whole event) to walk
  // findRoot -> latest.
  const chainFileRows: RequestedFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
        versionNo: schema.file.versionNo,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, batch));
    for (const r of rows) {
      if (r.submissionId) chainFileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const byId = new Map(chainFileRows.map((f) => [f.id, f]));

  const chainsByRoot = new Map<string, RequestedFileRow[]>();
  for (const f of chainFileRows) {
    const root = findRoot(f.id, byId);
    const arr = chainsByRoot.get(root) ?? [];
    arr.push(f);
    chainsByRoot.set(root, arr);
  }

  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>();
  for (const requestedId of deliverableIds) {
    const root = findRoot(requestedId, byId);
    const chain = chainsByRoot.get(root);
    if (!chain || chain.length === 0) {
      throw new Error(`resolveLatestVersions: chain root ${root} not resolved for requested file ${requestedId}`);
    }
    let latest = chain[0]!;
    for (const f of chain) {
      if (f.createdAt.getTime() > latest.createdAt.getTime()) latest = f;
    }
    const sub = submissionById.get(latest.submissionId);
    if (!sub) throw new Error(`resolveLatestVersions: submission ${latest.submissionId} not loaded`);
    out.set(requestedId, {
      id: latest.id,
      filename: latest.filename,
      contentType: latest.contentType,
      r2Key: latest.r2Key,
      submissionTitle: sub.title,
      sizeBytes: latest.sizeBytes,
    });
  }

  const headshotResolved = await resolveHeadshotVersions(db, eventId, headshotIds);
  for (const [id, value] of headshotResolved) out.set(id, value);

  return out;
}
