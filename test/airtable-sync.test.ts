import { describe, expect, it } from "vitest";
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

    const db = {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.contact) return Promise.resolve(contactRows);
          if (table === schema.submission) return { innerJoin: () => Promise.resolve(subRows) };
          if (table === schema.participant) return { innerJoin: () => Promise.resolve(partRows) };
          if (table === schema.submissionTrack) return { innerJoin: () => Promise.resolve(trackRows) };
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
      { AIRTABLE_TOKEN: "t", AIRTABLE_BASE_ID: "b" },
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
