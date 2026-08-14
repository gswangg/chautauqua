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

const BATCH = 10;
const API = "https://api.airtable.com/v0";
const MAX_RETRIES = 3;
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
        const waitMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000 * attempt;
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

// DEC-450: hard cap on rows read per sync tick. A cap that's silently
// truncated would drop rows without anyone noticing; instead we throw,
// naming the table and the cap, so an org that outgrows this needs a real
// design (pagination, incremental sync) rather than silent data loss.
export const MAX_SYNC_ROWS = 10_000;

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
  const mark = storedMark ? new Date(storedMark) : null;

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
      mark
        ? and(eq(schema.contact.orgId, orgId), gt(schema.contact.updatedAt, mark))
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
      mark
        ? and(eq(schema.event.orgId, orgId), gt(schema.submission.updatedAt, mark))
        : eq(schema.event.orgId, orgId),
    )
    .limit(MAX_SYNC_ROWS + 1);
  if (subs.length > MAX_SYNC_ROWS) {
    throw new Error(`airtable sync: submission table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
  }

  // DEC-981/DEC-974: only ACTIVE_INVITE_STATUSES participants may be
  // published to the customer's Airtable base as a speaker — a declined
  // co-presenter must never appear in the Speakers cell, the same class of
  // defect DEC-974 closed on the admin agenda. orderBy makes the joined
  // Speakers string deterministic across runs so an unchanged submission
  // never re-upserts with a permuted string and fires the customer's
  // Airtable automations on a non-change.
  const parts = await db
    .select({
      submissionId: schema.participant.submissionId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(
      and(
        eq(schema.event.orgId, orgId),
        inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
      ),
    )
    .orderBy(asc(schema.participant.order), asc(schema.contact.id))
    .limit(MAX_SYNC_ROWS + 1);
  if (parts.length > MAX_SYNC_ROWS) {
    throw new Error(`airtable sync: participant table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
  }
  const speakersBySub = new Map<string, string[]>();
  for (const p of parts) {
    const list = speakersBySub.get(p.submissionId) ?? [];
    list.push(`${p.firstName} ${p.lastName}`.trim());
    speakersBySub.set(p.submissionId, list);
  }

  // DEC-725 amendment: deterministic order (track.position then id) so the
  // Tracks cell — like the Speakers cell above — never permutes between
  // runs and re-fires the customer's automations on a non-change.
  const subTracks = await db
    .select({
      submissionId: schema.submissionTrack.submissionId,
      name: schema.track.name,
    })
    .from(schema.submissionTrack)
    .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
    .innerJoin(schema.submission, eq(schema.submissionTrack.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.event.orgId, orgId))
    .orderBy(asc(schema.track.position), asc(schema.track.id))
    .limit(MAX_SYNC_ROWS + 1);
  if (subTracks.length > MAX_SYNC_ROWS) {
    throw new Error(`airtable sync: submission_track table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
  }
  const tracksBySub = new Map<string, string[]>();
  for (const t of subTracks) {
    const list = tracksBySub.get(t.submissionId) ?? [];
    list.push(t.name);
    tracksBySub.set(t.submissionId, list);
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
