// Files repo — files library WHERE-clause builders + kind-count aggregate.
// Split out of files-library.ts (contention decomposition) —
// files-library.ts re-exports everything below for existing callers.
import { and, eq, inArray, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { FILE_KINDS } from "../../domain/files";
import { likeContains } from "./like";
import { acceptedSpeakerConditions } from "./tasks/crud";
import { HEADSHOT_KIND } from "./files-library-scope";

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

export function buildDeliverableWhere(eventId: string, deliverableKinds: string[], q: string | null): SQL {
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
export function buildDeliverableTipWhere(eventId: string, deliverableKinds: string[], q: string | null): SQL {
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
export const HEADSHOT_JOIN = eq(schema.contact.headshotFileId, schema.file.id);

export function buildHeadshotWhere(eventId: string, q: string | null): SQL {
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
export async function computeKindCounts(db: Db, eventId: string, q: string | null): Promise<Record<string, number>> {
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
