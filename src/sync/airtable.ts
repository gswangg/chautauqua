// One-way Airtable sync (stage-2 bonus): pushes contacts and submissions into
// an Airtable base every cron tick so downstream Airtable automations can fire
// on new rows. Airtable is NEVER a source of truth (per the customer's stated
// use: "they like to setup automations that happen on airtable once a new row
// lands" — read-only on their side). Feature is OFF unless both
// AIRTABLE_TOKEN and AIRTABLE_BASE_ID are configured; absence is a valid
// state, not an error. Sync failures throw (fail loudly) after reminders have
// already run — visible in the cron invocation log.
//
// Upserts merge on the ChautauquaId field, batched 10 records per request
// (Airtable API limit); at seed scale this is a handful of requests per tick,
// far under the 5 rps base limit.

import { and, asc, eq, gt, inArray } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../server/context";
import { formatRef } from "../domain/ids";
import { ACTIVE_INVITE_STATUSES } from "../domain/acceptance";
import { chunkIds } from "../lib/chunk";

const BATCH = 10;
const API = "https://api.airtable.com/v0";
const MAX_RETRIES = 3;
// DEC-725 amendment: an external Retry-After is untrusted — a huge value
// (e.g. 86400s) would pause the cron for a day, and a negative value would
// otherwise slip past Number.isFinite. Clamp to [0, MAX_RETRY_AFTER_MS].
const MAX_RETRY_AFTER_MS = 30_000;
const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface AirtableRecord {
  fields: Record<string, string>;
}

export function contactRecord(c: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  title: string | null;
}, now: Date): AirtableRecord {
  return {
    fields: {
      Name: `${c.firstName} ${c.lastName}`.trim(),
      Email: c.email,
      Company: c.company ?? "",
      Title: c.title ?? "",
      ChautauquaId: c.id,
      SyncedAt: now.toISOString(),
    },
  };
}

export function submissionRecord(s: {
  id: string;
  ref: string;
  title: string;
  status: string;
  speakers: string;
  tracks: string;
}, now: Date): AirtableRecord {
  return {
    fields: {
      Title: s.title,
      Ref: s.ref,
      Status: s.status,
      Speakers: s.speakers,
      Tracks: s.tracks,
      ChautauquaId: s.id,
      SyncedAt: now.toISOString(),
    },
  };
}

export function chunk<T>(items: T[], size: number = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// DEC-725: a 429 is a rate limit, not a failure — honour Retry-After and
// retry, bounded at MAX_RETRIES attempts so a permanently-throttled base
// still fails the tick loudly (naming the table and the status) instead of
// retrying forever. sleep is injected so tests never actually wait.
async function upsertBatches(
  fetchImpl: typeof fetch,
  token: string,
  baseId: string,
  table: string,
  records: AirtableRecord[],
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<number> {
  let upserted = 0;
  for (const batch of chunk(records)) {
    let attempt = 0;
    for (;;) {
      const res = await fetchImpl(`${API}/${baseId}/${encodeURIComponent(table)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          performUpsert: { fieldsToMergeOn: ["ChautauquaId"] },
          records: batch,
        }),
      });
      if (res.ok) {
        upserted += batch.length;
        break;
      }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        attempt += 1;
        const retryAfterHeader = res.headers?.get?.("Retry-After");
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const waitMs =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
            ? Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS)
            : 1000 * attempt;
        await sleep(waitMs);
        continue;
      }
      const body = await res.text();
      throw new Error(`airtable upsert ${table} failed: ${res.status} ${body.slice(0, 200)}`);
    }
  }
  return upserted;
}

/** Env surface the sync needs; both AIRTABLE_TOKEN/AIRTABLE_BASE_ID unset =>
 * feature off. DEC-450: one Airtable base serves exactly one org, so once the
 * integration IS configured, AIRTABLE_ORG_ID is required to scope every read
 * — a configured-but-unscoped sync would push one tenant's rows into
 * another tenant's base. */
export interface AirtableSyncEnv {
  AIRTABLE_TOKEN?: string;
  AIRTABLE_BASE_ID?: string;
  AIRTABLE_ORG_ID?: string;
  // DEC-725: structural port so scheduled.ts's already-full env (which
  // carries a real Cloudflare KVNamespace) satisfies this with no caller
  // change. Optional — a missing KV means every tick is a full push (no
  // watermark to read or write), never an error.
  KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
}

function watermarkKey(orgId: string): string {
  return `airtable:watermark:${orgId}`;
}

// DEC-725 amendment: like Retry-After above, the stored watermark is an
// externally-sourced string (KV, not our own write path once corruption or a
// hand-edit is in play) — parsing it without validation would turn a corrupt
// cursor into a NaN-valued lookbackMark, which makes gt(...) match nothing
// and the sync silently push zero rows forever while still advancing the
// watermark. Fail loudly instead, naming the key and the offending value, so
// the corruption surfaces in the cron invocation log rather than as a
// permanently dead sync.
function parseWatermark(key: string, storedMark: string): Date {
  const parsed = new Date(storedMark);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`airtable sync: watermark KV key ${key} holds an unparseable value: ${JSON.stringify(storedMark)}`);
  }
  return parsed;
}

// DEC-450: hard cap on rows read per sync tick. A cap that's silently
// truncated would drop rows without anyone noticing; instead we throw,
// naming the table and the cap, so an org that outgrows this needs a real
// design (pagination, incremental sync) rather than silent data loss.
export const MAX_SYNC_ROWS = 10_000;

// DEC-450 wave-33 amendment: `now` is captured BEFORE the watermark-scoped
// SELECTs run and is only stored AFTER both upserts succeed (read back,
// stamp forward) — every writer in this repo follows the same
// timestamp-before-await, commit-after pattern (see `patchedAt` in
// src/server/repo/contacts/crud.ts and `now` in src/server/repo/profile.ts).
// A row that commits between this tick's `now` capture and its SELECT can
// therefore carry an updated_at at or before `now`, and a strict gt(now)
// filter would miss it this tick and permanently exclude it next tick
// (gt(now) again). WATERMARK_LOOKBACK_MS widens the filter into the past by
// a fixed window so any such row is re-covered by the FOLLOWING tick. This
// asymmetry (read back with lookback, stamp forward without one) is safe
// because upsertBatches is an idempotent merge-on-ChautauquaId PATCH and both
// pushed strings (Speakers, Tracks) are deterministically ordered (DEC-450
// wave-64 amendment) — re-pushing an unchanged row fires no customer
// automation, whereas a dropped row is unrecoverable.
export const WATERMARK_LOOKBACK_MS = 5 * 60 * 1000;

export async function runAirtableSync(
  env: AirtableSyncEnv,
  db: Db,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<{ contacts: number; submissions: number } | null> {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  if (!token || !baseId) return null; // integration not configured — off, not an error

  const orgId = env.AIRTABLE_ORG_ID;
  if (!orgId) {
    throw new Error(
      "airtable sync: AIRTABLE_ORG_ID is required once AIRTABLE_TOKEN/AIRTABLE_BASE_ID are set — " +
        "one Airtable base serves exactly one org, and a configured-but-unscoped sync would push " +
        "one tenant's rows into another tenant's base",
    );
  }

  // DEC-725: a present watermark means an incremental push (only rows
  // changed since the last successful tick); an absent watermark means a
  // full push — correct for the first sync and for a restore, so the
  // incremental path needs no separate bootstrap.
  const wmKey = watermarkKey(orgId);
  const storedMark = env.KV ? await env.KV.get(wmKey) : null;
  const mark = storedMark ? parseWatermark(wmKey, storedMark) : null;
  const lookbackMark = mark ? new Date(mark.getTime() - WATERMARK_LOOKBACK_MS) : null;

  const contacts = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      title: schema.contact.title,
    })
    .from(schema.contact)
    .where(
      lookbackMark
        ? and(eq(schema.contact.orgId, orgId), gt(schema.contact.updatedAt, lookbackMark))
        : eq(schema.contact.orgId, orgId),
    )
    .limit(MAX_SYNC_ROWS + 1);
  if (contacts.length > MAX_SYNC_ROWS) {
    throw new Error(`airtable sync: contact table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
  }

  const subs = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      status: schema.submission.status,
      eventId: schema.submission.eventId,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(
      lookbackMark
        ? and(eq(schema.event.orgId, orgId), gt(schema.submission.updatedAt, lookbackMark))
        : eq(schema.event.orgId, orgId),
    )
    .limit(MAX_SYNC_ROWS + 1);
  if (subs.length > MAX_SYNC_ROWS) {
    throw new Error(`airtable sync: submission table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
  }

  // DEC-450 wave-64 amendment: an incremental tick only reads children (the
  // participant and submission_track tables) for the submissions this tick
  // is actually pushing, not org-wide. `subs` above is already the
  // watermark-scoped set — deriving the pushed id set from it and scoping
  // both child reads by inArray(..., chunkIds(pushedIds)) means (a) a tick
  // pushing three changed submissions no longer scans every participant/
  // submission_track row in the org, and (b) MAX_SYNC_ROWS now measures the
  // children of the pushed set, not the whole org, so a large org's child
  // tables no longer make every tick — including empty ticks — throw.
  const pushedIds = subs.map((s) => s.id);
  const speakersBySub = new Map<string, string[]>();
  const tracksBySub = new Map<string, string[]>();

  if (pushedIds.length > 0) {
    // DEC-981/DEC-974: only ACTIVE_INVITE_STATUSES participants may be
    // published to the customer's Airtable base as a speaker — a declined
    // co-presenter must never appear in the Speakers cell, the same class of
    // defect DEC-974 closed on the admin agenda. orderBy makes the joined
    // Speakers string deterministic across runs so an unchanged submission
    // never re-upserts with a permuted string and fires the customer's
    // Airtable automations on a non-change.
    let partsTotal = 0;
    for (const batch of chunkIds(pushedIds)) {
      const parts = await db
        .select({
          submissionId: schema.participant.submissionId,
          firstName: schema.contact.firstName,
          lastName: schema.contact.lastName,
        })
        .from(schema.participant)
        .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
        .where(
          and(
            inArray(schema.participant.submissionId, batch),
            inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
          ),
        )
        .orderBy(asc(schema.participant.order), asc(schema.contact.id))
        .limit(MAX_SYNC_ROWS + 1);
      partsTotal += parts.length;
      if (partsTotal > MAX_SYNC_ROWS) {
        throw new Error(`airtable sync: participant table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
      }
      for (const p of parts) {
        const list = speakersBySub.get(p.submissionId) ?? [];
        list.push(`${p.firstName} ${p.lastName}`.trim());
        speakersBySub.set(p.submissionId, list);
      }
    }

    // DEC-725 amendment: deterministic order (track.position then id) so the
    // Tracks cell — like the Speakers cell above — never permutes between
    // runs and re-fires the customer's automations on a non-change.
    let tracksTotal = 0;
    for (const batch of chunkIds(pushedIds)) {
      const subTracks = await db
        .select({
          submissionId: schema.submissionTrack.submissionId,
          name: schema.track.name,
        })
        .from(schema.submissionTrack)
        .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
        .where(inArray(schema.submissionTrack.submissionId, batch))
        .orderBy(asc(schema.track.position), asc(schema.track.id))
        .limit(MAX_SYNC_ROWS + 1);
      tracksTotal += subTracks.length;
      if (tracksTotal > MAX_SYNC_ROWS) {
        throw new Error(`airtable sync: submission_track table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
      }
      for (const t of subTracks) {
        const list = tracksBySub.get(t.submissionId) ?? [];
        list.push(t.name);
        tracksBySub.set(t.submissionId, list);
      }
    }
  }

  const contactRecords = contacts.map((c) => contactRecord(c, now));
  const submissionRecords = subs.map((s) =>
    submissionRecord(
      {
        id: s.id,
        ref: formatRef(s.recordPrefix, s.seq),
        title: s.title,
        status: s.status,
        speakers: (speakersBySub.get(s.id) ?? []).join(", "),
        tracks: (tracksBySub.get(s.id) ?? []).join(", "),
      },
      now,
    ),
  );

  const nContacts = await upsertBatches(fetchImpl, token, baseId, "Contacts", contactRecords, sleep);
  const nSubs = await upsertBatches(fetchImpl, token, baseId, "Submissions", submissionRecords, sleep);

  // DEC-725: the watermark advances only once BOTH upserts have succeeded —
  // a failed tick must not advance the clock, so a retried tick re-covers
  // the rows the failed tick never actually pushed.
  if (env.KV) {
    await env.KV.put(wmKey, now.toISOString());
  }

  console.log(`airtable sync: upserted ${nContacts} contacts, ${nSubs} submissions`);
  return { contacts: nContacts, submissions: nSubs };
}
