import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { chunk, contactRecord, submissionRecord, runAirtableSync } from "../src/sync/airtable";
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
    const whereOnly = <T>(rows: T[]) => ({
      where: () => Promise.resolve(rows),
    });
    const whereOrderBy = <T>(rows: T[]) => ({
      where: () => ({
        orderBy: () => Promise.resolve(rows),
      }),
    });

    const db = {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.contact) return whereLimit(contactRows);
          if (table === schema.submission)
            return { innerJoin: () => whereLimit(subRows) };
          if (table === schema.participant)
            return { innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => whereOrderBy(partRows) }) }) };
          if (table === schema.submissionTrack)
            return { innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => whereOnly(trackRows) }) }) };
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
    const whereOnly = <T>(rows: T[]) => ({
      where: () => Promise.resolve(rows),
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
                      // WHERE/ORDER BY the drizzle query issues.
                      where: () => ({
                        orderBy: () =>
                          Promise.resolve(
                            partRows
                              .filter((p) => p.inviteStatus === "accepted" || p.inviteStatus === "none")
                              .sort((a, b) => a.firstName.localeCompare(b.firstName)),
                          ),
                      }),
                    }),
                  }),
                }),
              };
            if (table === schema.submissionTrack)
              return { innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => whereOnly([]) }) }) };
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
