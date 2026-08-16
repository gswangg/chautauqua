// DEC-450 wave-33 amendment: proves WATERMARK_LOOKBACK_MS actually re-covers
// a row whose commit lands after the tick's `now` capture but before its
// SELECT — the class of loss the amendment closes. Uses the SAME real-SQL
// harness as test/submission-touch-on-rename.test.ts (node:sqlite +
// drizzle-orm/sqlite-proxy) so the actual watermark-scoped SELECTs run, not a
// hand-simulated filter.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { runAirtableSync, WATERMARK_LOOKBACK_MS, type AirtableSyncEnv } from "../src/sync/airtable";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  title text,
  bio text,
  headshot_url text,
  headshot_file_id text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table event (
  id text primary key,
  org_id text,
  record_prefix text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text not null default 'none',
  created_at integer,
  updated_at integer,
  unique (submission_id, contact_id)
);
create table track (
  id text primary key,
  event_id text,
  name text,
  color text,
  position integer,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table submission_track (
  submission_id text,
  track_id text,
  created_at integer
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

const ORG_A = "org-a";
const T0 = 1_700_000_000_000;

function seedEvent(sqlite: DatabaseSync, ts: number) {
  sqlite.exec(`
    insert into event (id, org_id, record_prefix, created_at, updated_at)
      values ('event-1', '${ORG_A}', 'SES', ${ts}, ${ts});
  `);
}

function insertContact(sqlite: DatabaseSync, id: string, ts: number) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, id, "Test", `${id}@x.com`, ts, ts);
}

function makeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function collectingFetch(patch: Array<{ table: string; body: unknown }>): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    const table = decodeURIComponent(String(url).split("/").pop() ?? "");
    patch.push({ table, body: JSON.parse(String(init.body)) });
    return { ok: true, text: async () => "" } as Response;
  }) as typeof fetch;
}

function pushedContactIds(patch: Array<{ table: string; body: unknown }>): string[] {
  const contactsPatch = patch.find((p) => p.table === "Contacts")?.body as
    | { records: Array<{ fields: { ChautauquaId: string } }> }
    | undefined;
  return contactsPatch ? contactsPatch.records.map((r) => r.fields.ChautauquaId) : [];
}

describe("airtable watermark lookback (DEC-450 wave-33 amendment)", () => {
  it("includes a contact whose updated_at is 1 minute before the stored watermark", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    // Watermark will be stored as T0 + 10_000. Contact's updated_at is 1
    // minute (60_000ms) BEFORE that mark -- inside the 5-minute lookback.
    insertContact(sqlite, "c-recent", T0 - 50_000);

    const kv = makeKv();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const noSleep = async () => {};

    // First tick: nothing seeded yet at watermark time except sentinel work
    // to set the mark. Use a contact created well before T0 so it's part of
    // the initial full push, establishing the watermark at T0.
    await runAirtableSync(env, db, async () => ({ ok: true, text: async () => "" }) as Response, new Date(T0), noSleep);
    expect(kv.store.get(`airtable:watermark:${ORG_A}`)).toBe(new Date(T0).toISOString());

    // Simulate a write that committed AFTER the SELECT of a tick whose `now`
    // was captured at T0 + 60_000, but whose updated_at (T0 - 50_000, i.e.
    // 1 minute before the *next* stored watermark of T0 + 10_000) predates
    // that capture -- the lost-update scenario. Store watermark at
    // T0 + 10_000 to model this precisely.
    kv.store.set(`airtable:watermark:${ORG_A}`, new Date(T0 + 10_000).toISOString());
    // c-recent has updated_at = T0 - 50_000, i.e. 60_000ms before the mark.

    const patch: Array<{ table: string; body: unknown }> = [];
    const r = await runAirtableSync(env, db, collectingFetch(patch), new Date(T0 + 20_000), noSleep);
    expect(r).not.toBeNull();
    expect(pushedContactIds(patch)).toContain("c-recent");
  });

  it("excludes a contact whose updated_at is 10 minutes before the stored watermark", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertContact(sqlite, "c-stale", T0 - 600_000);

    const kv = makeKv();
    kv.store.set(`airtable:watermark:${ORG_A}`, new Date(T0).toISOString());
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const noSleep = async () => {};

    const patch: Array<{ table: string; body: unknown }> = [];
    const r = await runAirtableSync(env, db, collectingFetch(patch), new Date(T0 + 20_000), noSleep);
    expect(r).not.toBeNull();
    expect(pushedContactIds(patch)).not.toContain("c-stale");
  });

  it("returns null with zero fetchImpl calls when AIRTABLE_TOKEN/AIRTABLE_BASE_ID are absent", async () => {
    const { db } = makeTestDb();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return { ok: true, text: async () => "" } as Response;
    }) as typeof fetch;
    const env: AirtableSyncEnv = {};

    const r = await runAirtableSync(env, db, fetchImpl, new Date(T0), async () => {});

    expect(r).toBeNull();
    expect(calls).toBe(0);
  });

  it("writes `now` (not now - lookback) back to KV as the new watermark", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertContact(sqlite, "c1", T0);

    const kv = makeKv();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const noSleep = async () => {};
    const now = new Date(T0 + 123_456);

    await runAirtableSync(env, db, async () => ({ ok: true, text: async () => "" }) as Response, now, noSleep);

    expect(kv.store.get(`airtable:watermark:${ORG_A}`)).toBe(now.toISOString());
    expect(kv.store.get(`airtable:watermark:${ORG_A}`)).not.toBe(
      new Date(now.getTime() - WATERMARK_LOOKBACK_MS).toISOString(),
    );
  });
});

describe("airtable watermark validation (DEC-725)", () => {
  it("throws naming the KV key and offending value on a garbage stored watermark, pushes nothing, and does not advance the cursor", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertContact(sqlite, "c1", T0);

    const kv = makeKv();
    const garbage = "not-a-date";
    kv.store.set(`airtable:watermark:${ORG_A}`, garbage);
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const noSleep = async () => {};

    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return { ok: true, text: async () => "" } as Response;
    }) as typeof fetch;

    await expect(runAirtableSync(env, db, fetchImpl, new Date(T0 + 20_000), noSleep)).rejects.toThrow(
      /airtable:watermark:org-a.*not-a-date/,
    );
    expect(calls).toBe(0);
    // the cursor must not advance past the corrupt value
    expect(kv.store.get(`airtable:watermark:${ORG_A}`)).toBe(garbage);
  });

  it("syncs incrementally with a valid ISO watermark", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertContact(sqlite, "c-recent", T0 - 50_000);
    insertContact(sqlite, "c-stale", T0 - 600_000);

    const kv = makeKv();
    kv.store.set(`airtable:watermark:${ORG_A}`, new Date(T0).toISOString());
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const noSleep = async () => {};

    const patch: Array<{ table: string; body: unknown }> = [];
    const r = await runAirtableSync(env, db, collectingFetch(patch), new Date(T0 + 20_000), noSleep);

    expect(r).not.toBeNull();
    expect(pushedContactIds(patch)).toContain("c-recent");
    expect(pushedContactIds(patch)).not.toContain("c-stale");
    expect(kv.store.get(`airtable:watermark:${ORG_A}`)).toBe(new Date(T0 + 20_000).toISOString());
  });

  it("full-pushes when the watermark is absent", async () => {
    const { db, sqlite } = makeTestDb();
    seedEvent(sqlite, T0);
    insertContact(sqlite, "c-old", T0 - 10_000_000);

    const kv = makeKv();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_A, KV: kv };
    const noSleep = async () => {};

    const patch: Array<{ table: string; body: unknown }> = [];
    const r = await runAirtableSync(env, db, collectingFetch(patch), new Date(T0), noSleep);

    expect(r).not.toBeNull();
    expect(pushedContactIds(patch)).toContain("c-old");
    expect(kv.store.get(`airtable:watermark:${ORG_A}`)).toBe(new Date(T0).toISOString());
  });
});
