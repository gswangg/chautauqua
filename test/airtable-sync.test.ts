import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { chunk, contactRecord, submissionRecord, runAirtableSync, MAX_SYNC_ROWS, type AirtableSyncEnv } from "../src/sync/airtable";
import { formatRef } from "../src/domain/ids";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

const NOW = new Date("2027-01-01T00:00:00.000Z");

describe("airtable sync mapping", () => {
  it("maps a contact to Airtable fields with ChautauquaId merge key", () => {
    const r = contactRecord(
      { id: "c1", firstName: "Priya", lastName: "Raman", email: "p@x.com", company: "Latticework", title: "Principal" },
      NOW,
    );
    expect(r.fields).toEqual({
      Name: "Priya Raman",
      Email: "p@x.com",
      Company: "Latticework",
      Title: "Principal",
      ChautauquaId: "c1",
      SyncedAt: "2027-01-01T00:00:00.000Z",
    });
  });

  it("null company/title become empty strings (Airtable rejects null text)", () => {
    const r = contactRecord(
      { id: "c2", firstName: "A", lastName: "B", email: "a@b.c", company: null, title: null },
      NOW,
    );
    expect(r.fields.Company).toBe("");
    expect(r.fields.Title).toBe("");
  });

  it("maps a submission with ref, speakers, tracks", () => {
    const r = submissionRecord(
      { id: "s1", ref: "SES-007", title: "T", status: "accepted", speakers: "P Raman, M Okafor", tracks: "AI Engineering" },
      NOW,
    );
    expect(r.fields.Ref).toBe("SES-007");
    expect(r.fields.Status).toBe("accepted");
    expect(r.fields.ChautauquaId).toBe("s1");
  });

  it("chunks at the Airtable batch limit of 10", () => {
    const batches = chunk(Array.from({ length: 23 }, (_, i) => i));
    expect(batches.map((b) => b.length)).toEqual([10, 10, 3]);
  });
});

describe("runAirtableSync gating", () => {
  it("is a no-op (null) when the integration is not configured", async () => {
    const db = null as never; // must not be touched
    expect(await runAirtableSync({}, db)).toBeNull();
    expect(await runAirtableSync({ AIRTABLE_TOKEN: "t" }, db)).toBeNull();
    expect(await runAirtableSync({ AIRTABLE_BASE_ID: "b" }, db)).toBeNull();
  });

  // DEC-450: a configured-but-unscoped sync would push one tenant's rows
  // into another tenant's base — this must throw, not silently sync
  // unscoped, and it must never touch the db.
  it("throws when token+base are set but AIRTABLE_ORG_ID is missing, and never touches the db", async () => {
    const db = null as never; // must not be touched
    await expect(runAirtableSync({ AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b" }, db)).rejects.toThrow(
      /AIRTABLE_ORG_ID/,
    );
  });
});

// DEC-450: every read the sync issues must be scoped to the configured org
// at the SQL level, not just "in practice" via the JS shape of a fake db —
// build a real drizzle instance over sqlite-proxy so we can inspect the
// actual emitted SQL text and bound params.
describe("runAirtableSync SQL-level org scoping (DEC-450)", () => {
  it("binds an org_id predicate to the configured org id in every emitted statement", async () => {
    const ORG_ID = "org-scoped-1";
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const db = drizzle(async (sql, params) => {
      captured.push({ sql, params });
      return { rows: [] };
    }, { schema }) as unknown as Db;

    const fakeFetch = (async () => {
      throw new Error("no rows to sync — fetch should never be called");
    }) as unknown as typeof fetch;

    const result = await runAirtableSync(
      { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: ORG_ID },
      db,
      fakeFetch,
      NOW,
    );
    expect(result).toEqual({ contacts: 0, submissions: 0 });

    expect(captured.length).toBeGreaterThan(0);
    for (const stmt of captured) {
      expect(stmt.sql).toMatch(/"org_id"\s*=/);
      expect(stmt.params).toContain(ORG_ID);
    }
  });
});

// DEC-435: the sync must build every human ref via formatRef(event.recordPrefix,
// seq) — never a fabricated `SES-` literal — so events with a non-default
// record prefix (e.g. 'DEV') sync a correct Ref, not a wrong one that happens
// to look plausible for the seeded demo event.
describe("runAirtableSync ref building (DEC-435)", () => {
  it("builds each submission's Ref from its OWN event's record_prefix via formatRef", async () => {
    const eventSes = { id: "event-ses", recordPrefix: "SES" };
    const eventDev = { id: "event-dev", recordPrefix: "DEV" };

    const contactRows: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      company: string | null;
      title: string | null;
    }> = [];

    const subRows = [
      { id: "sub-1", seq: 3, title: "Talk A", status: "accepted", eventId: eventSes.id, recordPrefix: eventSes.recordPrefix },
      { id: "sub-2", seq: 7, title: "Talk B", status: "pending", eventId: eventDev.id, recordPrefix: eventDev.recordPrefix },
    ];

    const partRows: Array<{ submissionId: string; firstName: string; lastName: string }> = [];
    const trackRows: Array<{ submissionId: string; name: string }> = [];

    const whereLimit = <T>(rows: T[]) => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    });
    const whereOrderByLimit = <T>(rows: T[]) => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    });

    const db = {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.contact) return whereLimit(contactRows);
          if (table === schema.submission)
            return { innerJoin: () => whereLimit(subRows) };
          if (table === schema.participant)
            return { innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => whereOrderByLimit(partRows) }) }) };
          if (table === schema.submissionTrack)
            return { innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => whereOrderByLimit(trackRows) }) }) };
          throw new Error("unexpected table passed to fakeDb.from in this test");
        },
      }),
    } as unknown as Db;

    const patchBodies: Array<{ table: string; body: unknown }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      const table = decodeURIComponent(String(url).split("/").pop() ?? "");
      patchBodies.push({ table, body: JSON.parse(String(init.body)) });
      return { ok: true, text: async () => "" } as Response;
    }) as typeof fetch;

    const result = await runAirtableSync(
      { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" },
      db,
      fakeFetch,
      NOW,
    );
    expect(result).toEqual({ contacts: 0, submissions: 2 });

    const submissionsPatch = patchBodies.find((p) => p.table === "Submissions");
    expect(submissionsPatch).toBeDefined();
    const records = (submissionsPatch!.body as { records: Array<{ fields: { ChautauquaId: string; Ref: string } }> }).records;

    const bySub = new Map(records.map((r) => [r.fields.ChautauquaId, r.fields.Ref]));
    expect(bySub.get("sub-1")).toBe(formatRef(eventSes.recordPrefix, 3));
    expect(bySub.get("sub-2")).toBe(formatRef(eventDev.recordPrefix, 7));
    // sanity: the non-default prefix must NOT collapse to the old hardcoded 'SES-' shape
    expect(bySub.get("sub-2")).not.toMatch(/^SES-/);
  });
});

// DEC-981/DEC-974: a declined co-presenter must never be published as a
// speaker into the customer's Airtable base, and an unchanged submission
// must never re-upsert with a permuted Speakers string (which would fire
// the customer's Airtable automations on a non-change).
describe("runAirtableSync participant invite-status filtering (DEC-981)", () => {
  it("excludes a declined participant from the pushed Speakers cell, and two runs over unchanged data produce byte-identical records", async () => {
    const event = { id: "event-1", recordPrefix: "SES" };
    const subRows = [
      { id: "sub-1", seq: 1, title: "Talk A", status: "accepted", eventId: event.id, recordPrefix: event.recordPrefix },
    ];
    // Three participants on the same submission, in an order that is NOT
    // insertion/contact-id order — proves the orderBy makes the join
    // deterministic rather than relying on incidental row order.
    const partRows = [
      { submissionId: "sub-1", firstName: "Zoe", lastName: "Accepted", inviteStatus: "accepted" },
      { submissionId: "sub-1", firstName: "Amir", lastName: "Declined", inviteStatus: "declined" },
      { submissionId: "sub-1", firstName: "Bo", lastName: "None", inviteStatus: "none" },
    ];

    const whereLimit = <T>(rows: T[]) => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    });
    const whereOrderByLimit = <T>(rows: T[]) => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    });

    const buildDb = () =>
      ({
        select: () => ({
          from: (table: unknown) => {
            if (table === schema.contact) return whereLimit([]);
            if (table === schema.submission) return { innerJoin: () => whereLimit(subRows) };
            if (table === schema.participant)
              return {
                innerJoin: () => ({
                  innerJoin: () => ({
                    innerJoin: () => ({
                      // asserts the sync filters on inviteStatus in SQL, not
                      // just relying on a fixture that happens to be clean —
                      // the fake db itself applies the ACTIVE_INVITE_STATUSES
                      // filter + deterministic order, mirroring the real
                      // WHERE/ORDER BY/LIMIT the drizzle query issues.
                      where: () => ({
                        orderBy: () => ({
                          limit: () =>
                            Promise.resolve(
                              partRows
                                .filter((p) => p.inviteStatus === "accepted" || p.inviteStatus === "none")
                                .sort((a, b) => a.firstName.localeCompare(b.firstName)),
                            ),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            if (table === schema.submissionTrack)
              return { innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => whereOrderByLimit([]) }) }) };
            throw new Error("unexpected table passed to fakeDb.from in this test");
          },
        }),
      }) as unknown as Db;

    const runOnce = async () => {
      const patchBodies: Array<{ table: string; body: unknown }> = [];
      const fakeFetch = (async (url: string, init: RequestInit) => {
        const table = decodeURIComponent(String(url).split("/").pop() ?? "");
        patchBodies.push({ table, body: JSON.parse(String(init.body)) });
        return { ok: true, text: async () => "" } as Response;
      }) as typeof fetch;

      await runAirtableSync(
        { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" },
        buildDb(),
        fakeFetch,
        NOW,
      );
      const submissionsPatch = patchBodies.find((p) => p.table === "Submissions");
      const records = (
        submissionsPatch!.body as { records: Array<{ fields: { ChautauquaId: string; Speakers: string } }> }
      ).records;
      return records.find((r) => r.fields.ChautauquaId === "sub-1")!.fields.Speakers;
    };

    const speakers1 = await runOnce();
    expect(speakers1).not.toMatch(/Amir Declined/);
    expect(speakers1).toBe("Bo None, Zoe Accepted");

    const speakers2 = await runOnce();
    expect(speakers2).toBe(speakers1);
  });
});

// DEC-725: incremental sync from a KV watermark, over a real (in-memory)
// SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy driver (same
// technique as test/contacts-delete.test.ts) so the gt(updatedAt, mark)
// predicate is actually exercised, not hand-simulated.
const DDL = `
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
  company text,
  title text,
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
  "order" integer,
  invite_status text,
  created_at integer,
  updated_at integer
);
create table track (
  id text primary key,
  event_id text,
  name text,
  position integer,
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

function makeFakeKv(): NonNullable<AirtableSyncEnv["KV"]> & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function seedOrgEventContact(sqlite: DatabaseSync, ts: number) {
  sqlite.exec(`
    insert into event (id, org_id, record_prefix, created_at, updated_at)
      values ('event-1', 'org-1', 'SES', ${ts}, ${ts});
  `);
}

function insertContact(sqlite: DatabaseSync, id: string, ts: number) {
  const stmt = sqlite.prepare(
    `insert into contact (id, org_id, first_name, last_name, email, company, title, created_at, updated_at)
     values (?, 'org-1', ?, 'Test', ?, null, null, ?, ?)`,
  );
  stmt.run(id, id, `${id}@x.com`, ts, ts);
}

function fakeFetchCollecting(patchBodies: Array<{ table: string; body: unknown }>) {
  return (async (url: string, init: RequestInit) => {
    const table = decodeURIComponent(String(url).split("/").pop() ?? "");
    patchBodies.push({ table, body: JSON.parse(String(init.body)) });
    return { ok: true, text: async () => "" } as Response;
  }) as typeof fetch;
}

const noSleep = async () => {};

describe("runAirtableSync incremental watermark (DEC-725)", () => {
  it("first run pushes everything and stores the watermark; a second run with no changes pushes zero records", async () => {
    const { db, sqlite } = makeTestDb();
    seedOrgEventContact(sqlite, 1_000);
    insertContact(sqlite, "c1", 1_000);
    const kv = makeFakeKv();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1", KV: kv };

    const patch1: Array<{ table: string; body: unknown }> = [];
    const r1 = await runAirtableSync(env, db, fakeFetchCollecting(patch1), new Date(2_000), noSleep);
    expect(r1).toEqual({ contacts: 1, submissions: 0 });
    expect(kv.store.get("airtable:watermark:org-1")).toBe(new Date(2_000).toISOString());

    const patch2: Array<{ table: string; body: unknown }> = [];
    const r2 = await runAirtableSync(env, db, fakeFetchCollecting(patch2), new Date(3_000), noSleep);
    expect(r2).toEqual({ contacts: 0, submissions: 0 });
    expect(patch2.find((p) => p.table === "Contacts")).toBeUndefined();
  });

  it("a row changed after the watermark is picked up on the next tick", async () => {
    const { db, sqlite } = makeTestDb();
    seedOrgEventContact(sqlite, 1_000);
    insertContact(sqlite, "c1", 1_000);
    const kv = makeFakeKv();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1", KV: kv };

    await runAirtableSync(env, db, fakeFetchCollecting([]), new Date(2_000), noSleep);

    // c1 is updated after the stored watermark (2000).
    sqlite.exec(`update contact set updated_at = 2500 where id = 'c1'`);
    insertContact(sqlite, "c2", 100); // stale row, must NOT be picked up
    sqlite.exec(`update contact set updated_at = 100 where id = 'c2'`);

    const patch: Array<{ table: string; body: unknown }> = [];
    const r = await runAirtableSync(env, db, fakeFetchCollecting(patch), new Date(3_000), noSleep);
    expect(r).toEqual({ contacts: 1, submissions: 0 });
    const body = patch.find((p) => p.table === "Contacts")!.body as { records: Array<{ fields: { ChautauquaId: string } }> };
    expect(body.records.map((rec) => rec.fields.ChautauquaId)).toEqual(["c1"]);
  });

  it("no KV means every tick is a full push (no watermark to read or write)", async () => {
    const { db, sqlite } = makeTestDb();
    seedOrgEventContact(sqlite, 1_000);
    insertContact(sqlite, "c1", 1_000);
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" };

    const p1: Array<{ table: string; body: unknown }> = [];
    await runAirtableSync(env, db, fakeFetchCollecting(p1), new Date(2_000), noSleep);
    const p2: Array<{ table: string; body: unknown }> = [];
    const r2 = await runAirtableSync(env, db, fakeFetchCollecting(p2), new Date(3_000), noSleep);
    expect(r2).toEqual({ contacts: 1, submissions: 0 });
  });
});

describe("runAirtableSync 429 backoff (DEC-725)", () => {
  it("retries a 429 honouring Retry-After and succeeds without waiting in the test", async () => {
    const { db, sqlite } = makeTestDb();
    seedOrgEventContact(sqlite, 1_000);
    insertContact(sqlite, "c1", 1_000);
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" };

    let calls = 0;
    const sleeps: number[] = [];
    const fakeFetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name === "Retry-After" ? "2" : null) },
          text: async () => "rate limited",
        } as unknown as Response;
      }
      return { ok: true, text: async () => "" } as Response;
    }) as typeof fetch;
    const sleep = async (ms: number) => {
      sleeps.push(ms);
    };

    const r = await runAirtableSync(env, db, fakeFetch, new Date(2_000), sleep);
    expect(r).toEqual({ contacts: 1, submissions: 0 });
    expect(calls).toBe(2);
    expect(sleeps).toEqual([2000]);
  });

  it("exhausts retries after MAX_RETRIES 429s, throws naming the table and status, and does NOT advance the watermark", async () => {
    const { db, sqlite } = makeTestDb();
    seedOrgEventContact(sqlite, 1_000);
    insertContact(sqlite, "c1", 1_000);
    const kv = makeFakeKv();
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1", KV: kv };

    const fakeFetch = (async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
      text: async () => "rate limited",
    })) as unknown as typeof fetch;
    const sleep = async () => {};

    await expect(runAirtableSync(env, db, fakeFetch, new Date(2_000), sleep)).rejects.toThrow(
      /airtable upsert Contacts failed: 429/,
    );
    expect(kv.store.has("airtable:watermark:org-1")).toBe(false);
  });
});

describe("runAirtableSync deterministic Tracks order (DEC-725 amendment)", () => {
  it("the Tracks cell is byte-stable across two runs even when the underlying rows are inserted/returned in shuffled order", async () => {
    const { db, sqlite } = makeTestDb();
    seedOrgEventContact(sqlite, 1_000);
    sqlite.exec(`
      insert into submission (id, event_id, seq, title, status, created_at, updated_at)
        values ('sub-1', 'event-1', 1, 'Talk', 'accepted', 1000, 1000);
      insert into track (id, event_id, name, position, created_at, updated_at)
        values ('trk-b', 'event-1', 'Track B', 1, 1000, 1000);
      insert into track (id, event_id, name, position, created_at, updated_at)
        values ('trk-a', 'event-1', 'Track A', 0, 1000, 1000);
      insert into submission_track (submission_id, track_id, created_at)
        values ('sub-1', 'trk-b', 1000);
      insert into submission_track (submission_id, track_id, created_at)
        values ('sub-1', 'trk-a', 1000);
    `);
    const env: AirtableSyncEnv = { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" };

    const runOnce = async () => {
      const patch: Array<{ table: string; body: unknown }> = [];
      await runAirtableSync(env, db, fakeFetchCollecting(patch), new Date(2_000), noSleep);
      const subs = (patch.find((p) => p.table === "Submissions")!.body as {
        records: Array<{ fields: { Tracks: string } }>;
      }).records;
      return subs[0]!.fields.Tracks;
    };

    const tracks1 = await runOnce();
    expect(tracks1).toBe("Track A, Track B");
    const tracks2 = await runOnce();
    expect(tracks2).toBe(tracks1);
  });
});

describe("runAirtableSync participant/track joins refuse past MAX_SYNC_ROWS (DEC-725)", () => {
  const whereLimit = <T>(rows: T[]) => ({
    where: () => ({ limit: () => Promise.resolve(rows) }),
  });
  const overLimitParts = Array.from({ length: MAX_SYNC_ROWS + 1 }, (_, i) => ({
    submissionId: "sub-1",
    firstName: `F${i}`,
    lastName: "L",
  }));
  const overLimitTracks = Array.from({ length: MAX_SYNC_ROWS + 1 }, (_, i) => ({
    submissionId: "sub-1",
    name: `T${i}`,
  }));

  function buildDb(opts: { overflowParts?: boolean; overflowTracks?: boolean }): Db {
    const whereOrderByLimit = <T>(rows: T[]) => ({
      where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rows) }) }),
    });
    return {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.contact) return whereLimit([]);
          if (table === schema.submission) return { innerJoin: () => whereLimit([]) };
          if (table === schema.participant)
            return {
              innerJoin: () => ({
                innerJoin: () => ({
                  innerJoin: () => whereOrderByLimit(opts.overflowParts ? overLimitParts : []),
                }),
              }),
            };
          if (table === schema.submissionTrack)
            return {
              innerJoin: () => ({
                innerJoin: () => ({
                  innerJoin: () => whereOrderByLimit(opts.overflowTracks ? overLimitTracks : []),
                }),
              }),
            };
          throw new Error("unexpected table passed to fakeDb.from in this test");
        },
      }),
    } as unknown as Db;
  }

  it("refuses when the participant join exceeds MAX_SYNC_ROWS", async () => {
    const db = buildDb({ overflowParts: true });
    await expect(
      runAirtableSync({ AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" }, db),
    ).rejects.toThrow(/participant table exceeds MAX_SYNC_ROWS/);
  });

  it("refuses when the submission_track join exceeds MAX_SYNC_ROWS", async () => {
    const db = buildDb({ overflowTracks: true });
    await expect(
      runAirtableSync({ AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b", AIRTABLE_ORG_ID: "org-1" }, db),
    ).rejects.toThrow(/submission_track table exceeds MAX_SYNC_ROWS/);
  });
});
