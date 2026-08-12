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

import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../server/context";
import { formatRef } from "../domain/ids";

const BATCH = 10;
const API = "https://api.airtable.com/v0";

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

async function upsertBatches(
  fetchImpl: typeof fetch,
  token: string,
  baseId: string,
  table: string,
  records: AirtableRecord[],
): Promise<number> {
  let upserted = 0;
  for (const batch of chunk(records)) {
    const res = await fetchImpl(`${API}/${baseId}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["ChautauquaId"] },
        records: batch,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`airtable upsert ${table} failed: ${res.status} ${body.slice(0, 200)}`);
    }
    upserted += batch.length;
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
    .where(eq(schema.contact.orgId, orgId))
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
    .where(eq(schema.event.orgId, orgId))
    .limit(MAX_SYNC_ROWS + 1);
  if (subs.length > MAX_SYNC_ROWS) {
    throw new Error(`airtable sync: submission table exceeds MAX_SYNC_ROWS (${MAX_SYNC_ROWS}) for this org`);
  }

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
    .where(eq(schema.event.orgId, orgId));
  const speakersBySub = new Map<string, string[]>();
  for (const p of parts) {
    const list = speakersBySub.get(p.submissionId) ?? [];
    list.push(`${p.firstName} ${p.lastName}`.trim());
    speakersBySub.set(p.submissionId, list);
  }

  const subTracks = await db
    .select({
      submissionId: schema.submissionTrack.submissionId,
      name: schema.track.name,
    })
    .from(schema.submissionTrack)
    .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
    .innerJoin(schema.submission, eq(schema.submissionTrack.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.event.orgId, orgId));
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

  const nContacts = await upsertBatches(fetchImpl, token, baseId, "Contacts", contactRecords);
  const nSubs = await upsertBatches(fetchImpl, token, baseId, "Submissions", submissionRecords);
  console.log(`airtable sync: upserted ${nContacts} contacts, ${nSubs} submissions`);
  return { contacts: nContacts, submissions: nSubs };
}
