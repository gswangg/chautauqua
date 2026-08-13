// w23-b regression coverage: the portal home issued one D1 round trip PER
// session for getLatestDeliverable and one PER file_request task for
// listDeliverableCandidates. listLatestDeliverables/listDeliverableCandidatesForEvents
// replace those fan-outs with a chunked batch read (DEC-078) — this test
// drives both batch functions against a counting fake `db` and asserts the
// total .where()-query count each issues is identical between them (both are
// chunkIds-driven over the same ID_CHUNK_SIZE) for a scoped set of 3 rows as
// for 300, and bounded — never one query per row.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { listLatestDeliverables } from "../src/server/repo/portal/sessions";
import { listDeliverableCandidatesForEvents } from "../src/server/repo/portal/tasks";

/** A minimal counting fake db: every top-level `.where(...)` call (the
 * genuine D1 round trip) increments `queryCount`. */
function makeCountingDb(): { db: Db; queryCount: () => number } {
  let count = 0;

  const whereStage = (table: unknown) => ({
    where: (_cond: unknown) => {
      count += 1;
      if (table === schema.file) {
        return {
          orderBy: () => Promise.resolve([]),
        };
      }
      if (table === schema.participant) {
        return {
          orderBy: () => Promise.resolve([]),
        };
      }
      throw new Error("makeCountingDb: unexpected table in fake db");
    },
  });

  const db = {
    select: (_cols: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        ...whereStage(table),
        innerJoin: (_joinTable: unknown, _on: unknown) => ({
          innerJoin: (_joinTable2: unknown, _on2: unknown) => whereStage(table),
        }),
      }),
    }),
  } as unknown as Db;

  return { db, queryCount: () => count };
}

async function runDeliverablesPath(n: number): Promise<number> {
  const { db, queryCount } = makeCountingDb();
  const submissionIds = Array.from({ length: n }, (_, i) => `sub-${i}`);
  await listLatestDeliverables(db, submissionIds);
  return queryCount();
}

async function runCandidatesPath(n: number): Promise<number> {
  const { db, queryCount } = makeCountingDb();
  const eventIds = Array.from({ length: n }, (_, i) => `event-${i}`);
  await listDeliverableCandidatesForEvents(db, "contact-1", eventIds);
  return queryCount();
}

describe("w23-b: portal home batch reads issue a constant, matched number of D1 round trips", () => {
  it("both batch functions issue the same query count for a scoped set of 3", async () => {
    const deliverables = await runDeliverablesPath(3);
    const candidates = await runCandidatesPath(3);
    expect(deliverables).toBe(candidates);
    expect(deliverables).toBe(1);
  });

  it("both batch functions issue the same query count for a scoped set of 300", async () => {
    const deliverables = await runDeliverablesPath(300);
    const candidates = await runCandidatesPath(300);
    expect(deliverables).toBe(candidates);
  });

  it("stays within a small, bounded query budget regardless of scope size (never one query per row)", async () => {
    const small = await runDeliverablesPath(3);
    const large = await runDeliverablesPath(300);
    expect(small).toBeLessThanOrEqual(7);
    expect(large).toBeLessThanOrEqual(7);
    expect(large).toBeLessThan(300);
  });
});
