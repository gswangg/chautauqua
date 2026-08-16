// DEC-370/DEC-338/DEC-902 (w61-i): the files library read was an eight-deep
// strict ladder with ZERO Promise.all -- over real D1 that ladder IS the
// measured 117-145ms. listEventDeliverableFiles now issues its reads as TWO
// declared Promise.all waves: wave 1 holds every read keyed only on
// (eventId, params) -- the event row, computeKindCounts, and the two
// root-page queries; wave 2 holds every read keyed on the PAGE's own
// resolved ids -- the chain-tip size sum, the page's lead-speaker names, and
// the page's own deliverable version chains. batchContactNames stays a
// solitary third step (a real sequential dependency on wave 2's chain
// resolution, not an unowned ladder rung).
//
// This test proves the concurrency BEHAVIOURALLY -- an instrumented fake
// `Db` whose every SELECT resolves only after an artificial delay, tracking
// the maximum number of simultaneously in-flight statements plus a wave
// counter incremented whenever in-flight rises 0->1 -- mirroring
// test/agenda-round-trip-depth.test.ts's approach (DEC-338's own ruling:
// prove it behaviourally, never with a source grep). A second test pins the
// returned envelope shape byte-identical.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { listEventDeliverableFiles } from "../src/server/repo/files-library";

interface Tracker {
  inFlight: number;
  max: number;
  waves: number;
}

/** A minimal chainable fake SELECT builder: every drizzle-style chain method
 * returns the same thenable object, which resolves only on `await` (via
 * `.then`) after a real macrotask delay -- so genuinely concurrent callers
 * overlap in wall-clock time and genuinely sequential callers never do. Rows
 * are looked up by the table object passed to `.from()`, mirroring
 * test/agenda-round-trip-depth.test.ts's counting fake. A single mega-row is
 * registered per table (rather than one row shape per distinct query)
 * because the SAME table (file, participant) backs several differently-
 * projected queries in this module -- every field any of those queries reads
 * lives on the one registered row, and each query's drizzle `.select({...})`
 * column picker is not itself evaluated by this fake (only real drizzle
 * evaluates projections), so returning the full row is harmless. */
function makeInstrumentedDb(rowsByTable: Map<unknown, unknown[]>, tracker: Tracker): Db {
  function selectChain(state: { table: unknown }) {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "selectDistinct", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit"]) {
      self[method] = (arg?: unknown) => {
        if (method === "from") state.table = arg;
        return self;
      };
    }
    self.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      if (tracker.inFlight === 0) tracker.waves += 1;
      tracker.inFlight += 1;
      tracker.max = Math.max(tracker.max, tracker.inFlight);
      return new Promise<void>((r) => setTimeout(r, 8))
        .then(() => {
          tracker.inFlight -= 1;
          resolve(rowsByTable.get(state.table) ?? []);
        })
        .catch((e: unknown) => {
          tracker.inFlight -= 1;
          reject(e);
        });
    };
    return self;
  }
  return {
    select: (_cols?: unknown) => selectChain({ table: undefined }),
    selectDistinct: (_cols?: unknown) => selectChain({ table: undefined }),
    insert: () => {
      throw new Error("makeInstrumentedDb: no write path expected in listEventDeliverableFiles");
    },
    update: () => {
      throw new Error("makeInstrumentedDb: no write path expected in listEventDeliverableFiles");
    },
    delete: () => {
      throw new Error("makeInstrumentedDb: no write path expected in listEventDeliverableFiles");
    },
  } as unknown as Db;
}

const NOW = new Date(0);

// One mega-row per table -- see makeInstrumentedDb's doc comment above for
// why a single row can safely stand in for every differently-projected
// query against that table.
function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  rows.set(schema.event, [{ recordPrefix: "SES" }]);
  rows.set(schema.file, [
    {
      id: "file-1",
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck.pdf",
      previousFileId: null,
      createdAt: NOW,
      sizeBytes: 1000,
      uploadedByContactId: "contact-1",
      versionNo: 1,
      submissionSeq: 1,
      submissionTitle: "Talk One",
      kind_: "presentation",
      count: 1,
      sum: 1000,
    },
  ]);
  rows.set(schema.participant, [
    {
      submissionId: "sub-1",
      contactId: "contact-2",
      order: 0,
      firstName: "Jane",
      lastName: "Speaker",
      id: "file-2",
      createdAt: NOW,
      filename: "headshot.jpg",
      sizeBytes: 500,
      uploadedByContactId: null,
      count: 1,
    },
  ]);
  rows.set(schema.contact, [
    { id: "contact-1", firstName: "Upload", lastName: "Er" },
    { id: "contact-2", firstName: "Jane", lastName: "Speaker" },
  ]);
  return rows;
}

describe("DEC-370/DEC-338/DEC-902 (w61-i): listEventDeliverableFiles collapses its waterfall", () => {
  it("has 3+ repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 20, kinds: [], q: null });
    // Wave 1 holds the event row, computeKindCounts' first read, the
    // deliverable-roots page query and the headshot-roots page query
    // simultaneously -- 4 statements in flight. A fully serial ladder could
    // never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(3);
  });

  it("issues at most 3 waves (2 declared Promise.all waves + batchContactNames' real sequential dependency)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 20, kinds: [], q: null });
    expect(tracker.waves).toBeLessThanOrEqual(3);
  });

  it("pins the returned envelope shape (items, kindCounts, total, page, perPage) unchanged", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const result = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 20, kinds: [], q: null });
    expect(result).toEqual({
      items: [
        {
          rootFileId: "file-1",
          latestFileId: "file-1",
          filename: "deck.pdf",
          kind: "presentation",
          submissionId: "sub-1",
          submissionRef: "SES-001",
          submissionTitle: "Talk One",
          speakerName: "Jane Speaker",
          uploadedAt: NOW.getTime(),
          versionCount: 1,
          versionNo: 1,
          sizeBytes: 1000,
          uploaderName: "Upload Er",
        },
        {
          rootFileId: "file-2",
          latestFileId: "file-2",
          filename: "headshot.jpg",
          kind: "headshot",
          submissionId: "",
          submissionRef: "",
          submissionTitle: "",
          speakerName: "Jane Speaker",
          uploadedAt: NOW.getTime(),
          versionCount: 1,
          versionNo: 1,
          sizeBytes: 500,
          uploaderName: "Jane Speaker",
        },
      ],
      total: 2,
      totalSizeBytes: 1500,
      page: 1,
      perPage: 20,
      kindCounts: {
        presentation: 1,
        poster: 0,
        handout: 0,
        recording: 0,
        headshot: 1,
      },
    });
  });
});
