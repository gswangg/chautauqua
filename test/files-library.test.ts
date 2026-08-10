// DEC-159/DEC-160 coverage: the central files library repo query
// (listEventDeliverableFiles/resolveLatestVersions) exercised against an
// in-memory fake DB that evaluates the actual drizzle eq/inArray conditions
// the repo builds (no D1 test harness exists in this repo — same rationale
// and pattern as test/contacts-import.test.ts), plus the archive route's
// authz/validation/ZIP-response wiring with a mocked repo + fake R2 bucket
// (pattern from test/reviewer-file-access.test.ts).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "or"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    or: (...conds: unknown[]): Marker => ({ __marker: "or", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
  };
});

const {
  listEventDeliverableFiles,
  resolveLatestVersions,
} = await import("../src/server/repo/files");

// ---------------------------------------------------------------------------
// Generic in-memory fake DB across the event/submission/file/participant/
// contact tables — real select/where/limit semantics evaluated against the
// mocked eq/and/or/inArray markers above.
// ---------------------------------------------------------------------------

const TABLE_SCHEMAS = { event: schema.event, submission: schema.submission, file: schema.file, participant: schema.participant, contact: schema.contact };

function colKey(col: unknown): string {
  for (const tableObj of Object.values(TABLE_SCHEMAS)) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return key;
    }
  }
  throw new Error("fake db: condition referenced a column not on a known table");
}

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") return row[colKey(m.col)] === m.val;
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.vals.includes(row[colKey(m.col)]);
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

function project(row: Record<string, unknown>, fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [outKey, col] of Object.entries(fields)) out[outKey] = row[colKey(col)];
  return out;
}

interface Seed {
  event: Record<string, unknown>[];
  submission: Record<string, unknown>[];
  file: Record<string, unknown>[];
  participant: Record<string, unknown>[];
  contact: Record<string, unknown>[];
}

function makeFakeFilesDb(seed: Seed) {
  const byTable = new Map<unknown, Record<string, unknown>[]>([
    [schema.event, seed.event],
    [schema.submission, seed.submission],
    [schema.file, seed.file],
    [schema.participant, seed.participant],
    [schema.contact, seed.contact],
  ]);

  const db = {
    select(fields?: Record<string, unknown>) {
      let source: Record<string, unknown>[] = [];
      let whereCond: unknown = null;
      const run = () => {
        const filtered = whereCond ? source.filter((r) => evalCond(whereCond, r)) : source.slice();
        return fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
      };
      const chain: any = {
        from: (table: unknown) => {
          source = byTable.get(table) ?? [];
          return chain;
        },
        where: (cond: unknown) => {
          whereCond = cond;
          return chain;
        },
        limit: async (n: number) => run().slice(0, n),
        then: (resolve: (v: unknown[]) => void) => resolve(run()),
      };
      return chain;
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

// ---------------------------------------------------------------------------
// Fixture: mirrors the shape of the DEC-145 seed's slides.pdf version chain
// (Priya Raman's accepted submission, presentation file replaced once).
// ---------------------------------------------------------------------------

function baseSeed(): Seed {
  const now = new Date("2026-01-05T00:00:00Z");
  const later = new Date("2026-01-06T00:00:00Z");
  return {
    event: [{ id: "event-1", orgId: "org-1", slug: "demo-event", recordPrefix: "SES" }],
    submission: [{ id: "sub-1", eventId: "event-1", seq: 14, title: "Scaling Vector Search" }],
    file: [
      {
        id: "file-v1",
        submissionId: "sub-1",
        kind: "presentation",
        filename: "slides-v1.pdf",
        previousFileId: null,
        createdAt: now,
      },
      {
        id: "file-v2",
        submissionId: "sub-1",
        kind: "presentation",
        filename: "slides.pdf",
        previousFileId: "file-v1",
        createdAt: later,
      },
    ],
    participant: [
      { submissionId: "sub-1", contactId: "contact-priya", order: 0, role: "speaker" },
      { submissionId: "sub-1", contactId: "contact-other", order: 1, role: "speaker" },
    ],
    contact: [
      { id: "contact-priya", firstName: "Priya", lastName: "Raman" },
      { id: "contact-other", firstName: "Someone", lastName: "Else" },
    ],
  };
}

describe("listEventDeliverableFiles (DEC-159)", () => {
  it("surfaces one row per version chain: latest filename, versionCount 2, lead speaker Priya Raman", async () => {
    const db = makeFakeFilesDb(baseSeed());
    const items = await listEventDeliverableFiles(db, "event-1");
    expect(items).toHaveLength(1);
    const chain = items[0];
    expect(chain).toMatchObject({
      rootFileId: "file-v1",
      latestFileId: "file-v2",
      filename: "slides.pdf",
      kind: "presentation",
      submissionId: "sub-1",
      submissionRef: "SES-014",
      submissionTitle: "Scaling Vector Search",
      speakerName: "Priya Raman",
      versionCount: 2,
    });
    expect(chain?.uploadedAt).toBe(new Date("2026-01-06T00:00:00Z").getTime());
  });

  it("returns an empty list for an event with no submissions", async () => {
    const seed = baseSeed();
    seed.submission = [];
    seed.file = [];
    const db = makeFakeFilesDb(seed);
    expect(await listEventDeliverableFiles(db, "event-1")).toEqual([]);
  });

  it("keeps unrelated single-version files as their own one-item chain", async () => {
    const seed = baseSeed();
    seed.submission.push({ id: "sub-2", eventId: "event-1", seq: 20, title: "Other Talk" });
    seed.file.push({
      id: "file-poster",
      submissionId: "sub-2",
      kind: "poster",
      filename: "poster.png",
      previousFileId: null,
      createdAt: new Date("2026-01-07T00:00:00Z"),
    });
    seed.participant.push({ submissionId: "sub-2", contactId: "contact-other", order: 0, role: "speaker" });
    const db = makeFakeFilesDb(seed);
    const items = await listEventDeliverableFiles(db, "event-1");
    expect(items).toHaveLength(2);
    const poster = items.find((i) => i.rootFileId === "file-poster");
    expect(poster).toMatchObject({ versionCount: 1, latestFileId: "file-poster", speakerName: "Someone Else" });
  });
});

describe("resolveLatestVersions (DEC-160)", () => {
  it("resolves an older-version id to its chain's latest file row", async () => {
    const db = makeFakeFilesDb(baseSeed());
    const resolved = await resolveLatestVersions(db, "event-1", ["file-v1"]);
    expect(resolved.get("file-v1")).toMatchObject({ id: "file-v2", filename: "slides.pdf" });
  });

  it("throws (no silent skip) when a requested id isn't a deliverable of the event", async () => {
    const db = makeFakeFilesDb(baseSeed());
    await expect(resolveLatestVersions(db, "event-1", ["file-v2", "not-a-real-file"])).rejects.toThrow();
  });
});

// Route-level archive-endpoint coverage (authz/validation/ZIP response) with
// repo mocked lives in test/files-archive-route.test.ts — kept in a separate
// file because vi.mock("../src/server/repo/files") hoists file-wide and
// would otherwise shadow the real repo functions exercised directly above.
