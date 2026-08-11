import { describe, expect, it } from "vitest";
import { chunk, contactRecord, submissionRecord, runAirtableSync } from "../src/sync/airtable";

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
