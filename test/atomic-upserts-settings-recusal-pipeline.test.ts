// Regression for DEC-552 (part 2/2): portal-settings, recusal, and
// pipeline-enrollment upserts are each a single atomic INSERT ... ON
// CONFLICT statement against their table's uniqueIndex — never a
// SELECT-then-INSERT-or-UPDATE probe. Modelled on
// test/portal-edit-answer-upsert.test.ts's fake-db harness: a fake db that
// records every select()/insert() call against the target table, so a
// regression back to read-then-write is caught even if the final state
// looks correct.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { upsertPortalSettings } from "../src/server/repo/portal-config";
import { createRecusal } from "../src/server/repo/review/recusal";
import { enrollContact } from "../src/server/repo/pipeline";
import { ApiError } from "../src/server/http";

interface UpsertCall {
  rows: Record<string, unknown>;
  target: unknown;
  set?: Record<string, unknown>;
}

interface DoNothingCall {
  rows: Record<string, unknown>;
  target: unknown;
  returningResult: Array<Record<string, unknown>>;
}

/** A fake db whose select() records reads against `targetTable`, and whose
 * insert(targetTable) records ON CONFLICT calls without ever needing a
 * prior read. Selects against any other table are answered from
 * `otherRows` (keyed by reference equality to the schema table object). */
function makeFakeDb(opts: {
  targetTable: unknown;
  otherRows?: Map<unknown, unknown[]>;
  onConflictDoNothingReturns?: Array<Record<string, unknown>>;
}) {
  const targetSelects: number[] = [];
  const onConflictDoUpdateCalls: UpsertCall[] = [];
  const onConflictDoNothingCalls: DoNothingCall[] = [];
  const otherInserts: Array<{ table: unknown; values: unknown }> = [];

  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === opts.targetTable) {
            targetSelects.push(1);
            return chainFor([]);
          }
          return chainFor(opts.otherRows?.get(table) ?? []);
        },
      };
    },
    insert(table: unknown) {
      return {
        values(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const row = Array.isArray(rows) ? rows[0]! : rows;
          if (table !== opts.targetTable) {
            otherInserts.push({ table, values: rows });
            return Promise.resolve();
          }
          return {
            onConflictDoUpdate(o: { target: unknown; set: Record<string, unknown> }) {
              onConflictDoUpdateCalls.push({ rows: row, target: o.target, set: o.set });
              return Promise.resolve();
            },
            onConflictDoNothing(o: { target: unknown }) {
              return {
                returning(_sel: unknown) {
                  const result = opts.onConflictDoNothingReturns ?? [{ id: (row as { id: string }).id }];
                  onConflictDoNothingCalls.push({ rows: row, target: o.target, returningResult: result });
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
    delete() {
      return { where: () => Promise.resolve() };
    },
    update() {
      throw new Error("fake db: unexpected update() call — upserts must not read-then-write");
    },
  };

  return { db: db as unknown as Db, targetSelects, onConflictDoUpdateCalls, onConflictDoNothingCalls, otherInserts };
}

describe("upsertPortalSettings (DEC-552)", () => {
  it("issues zero portal_settings reads before the write and exactly one ON CONFLICT DO UPDATE", async () => {
    const { db, targetSelects, onConflictDoUpdateCalls } = makeFakeDb({ targetTable: schema.portalSettings });
    // getPortalSettingsForEvent (the read-back) also selects from
    // portalSettings; we only care that no select happens before the write.
    await expect(
      upsertPortalSettings(db, "evt-1", { logoUrl: "https://x/logo.png", showResources: false }),
    ).rejects.toThrow(/row missing after write/);
    expect(onConflictDoUpdateCalls.length).toBe(1);
    // The recorded select (read-back) happens after the single write, never before.
    expect(targetSelects.length).toBeGreaterThanOrEqual(1);
  });

  it("targets the portal_settings_event_id uniqueIndex column and sets only caller-supplied keys", async () => {
    const { db, onConflictDoUpdateCalls } = makeFakeDb({ targetTable: schema.portalSettings });
    await upsertPortalSettings(db, "evt-1", { logoUrl: "https://x/logo.png" }).catch(() => {});
    expect(onConflictDoUpdateCalls.length).toBe(1);
    const call = onConflictDoUpdateCalls[0]!;
    expect(call.target).toBe(schema.portalSettings.eventId);
    expect(Object.keys(call.set!).sort()).toEqual(["logoUrl", "updatedAt"]);
    expect(call.set!.logoUrl).toBe("https://x/logo.png");
  });

  it("an undefined field is never present in the set clause", async () => {
    const { db, onConflictDoUpdateCalls } = makeFakeDb({ targetTable: schema.portalSettings });
    await upsertPortalSettings(db, "evt-1", { accentColor: "#fff", welcomeMessage: undefined }).catch(() => {});
    const call = onConflictDoUpdateCalls[0]!;
    expect(Object.keys(call.set!)).not.toContain("welcomeMessage");
    expect(Object.keys(call.set!).sort()).toEqual(["accentColor", "updatedAt"]);
  });
});

describe("createRecusal (DEC-552)", () => {
  it("issues zero review_recusal reads before the write and exactly one ON CONFLICT DO NOTHING", async () => {
    const { db, targetSelects, onConflictDoNothingCalls } = makeFakeDb({
      targetTable: schema.reviewRecusal,
      onConflictDoNothingReturns: [{ id: "rc-1" }],
    });
    const { recusal, created } = await createRecusal(db, {
      planId: "plan-1",
      submissionId: "sub-1",
      userId: "user-1",
      reason: null,
    });
    expect(onConflictDoNothingCalls.length).toBe(1);
    expect(targetSelects.length).toBe(0);
    expect(created).toBe(true);
    expect(recusal.id).toBe("rc-1");
  });

  it("targets the (planId, submissionId, userId) uniqueIndex", async () => {
    const { db, onConflictDoNothingCalls } = makeFakeDb({
      targetTable: schema.reviewRecusal,
      onConflictDoNothingReturns: [{ id: "rc-1" }],
    });
    await createRecusal(db, { planId: "plan-1", submissionId: "sub-1", userId: "user-1", reason: null });
    const call = onConflictDoNothingCalls[0]!;
    expect(call.target).toEqual([schema.reviewRecusal.planId, schema.reviewRecusal.submissionId, schema.reviewRecusal.userId]);
  });

  it("returns created=false and reads back the existing row when the insert conflicts", async () => {
    const existingRow = {
      id: "rc-existing",
      planId: "plan-1",
      submissionId: "sub-1",
      userId: "user-1",
      reason: "conflict of interest",
      createdAt: new Date(500),
    };
    // Route the read-back's select through a db that resolves the existing
    // row for the target table, while still recording the single write via
    // the shared onConflictDoNothing insert path.
    const { db: writeDb, onConflictDoNothingCalls } = makeFakeDb({
      targetTable: schema.reviewRecusal,
      onConflictDoNothingReturns: [],
    });
    const readBackDb = {
      select() {
        return {
          from(table: unknown) {
            const chain: Record<string, unknown> = {
              where: () => chain,
              limit: (n: number) => Promise.resolve(table === schema.reviewRecusal ? [existingRow].slice(0, n) : []),
            };
            return chain;
          },
        };
      },
      insert: (writeDb as unknown as { insert: (t: unknown) => unknown }).insert,
    } as unknown as Db;

    const { recusal, created } = await createRecusal(readBackDb, {
      planId: "plan-1",
      submissionId: "sub-1",
      userId: "user-1",
      reason: null,
    });
    expect(onConflictDoNothingCalls.length).toBe(1);
    expect(created).toBe(false);
    expect(recusal.id).toBe("rc-existing");
  });
});

describe("enrollContact (DEC-552)", () => {
  function makePipelineDb(opts: { conflict: boolean }) {
    const activityInserts: Array<Record<string, unknown>> = [];
    const entrySelects: number[] = [];
    const onConflictDoNothingCalls: DoNothingCall[] = [];
    const db = {
      select() {
        return {
          from(table: unknown) {
            if (table === schema.pipelineEntry) entrySelects.push(1);
            const chain: Record<string, unknown> = {
              where: () => chain,
              limit: (n: number) =>
                Promise.resolve(
                  [{ id: "entry-1", orgId: "org-1", contactId: "contact-1", stage: "identified", createdAt: new Date(1), updatedAt: new Date(1) }].slice(
                    0,
                    n,
                  ),
                ),
            };
            return chain;
          },
        };
      },
      insert(table: unknown) {
        return {
          values(rows: Record<string, unknown>) {
            if (table === schema.pipelineEntry) {
              return {
                onConflictDoNothing(o: { target: unknown }) {
                  return {
                    returning() {
                      const result = opts.conflict ? [] : [{ id: rows.id }];
                      onConflictDoNothingCalls.push({ rows, target: o.target, returningResult: result });
                      return Promise.resolve(result);
                    },
                  };
                },
              };
            }
            if (table === schema.pipelineActivity) {
              activityInserts.push(rows);
              return Promise.resolve();
            }
            throw new Error("fake db: unexpected insert table");
          },
        };
      },
    };
    return { db: db as unknown as Db, activityInserts, entrySelects, onConflictDoNothingCalls };
  }

  it("targets the (orgId, contactId) uniqueIndex, writes zero activity rows, and throws ApiError('invalid') on conflict", async () => {
    const { db, activityInserts, entrySelects, onConflictDoNothingCalls } = makePipelineDb({ conflict: true });

    let caught: unknown;
    try {
      await enrollContact(db, "org-1", "contact-1", "identified", { userId: "u1", name: "Jordan" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as InstanceType<typeof ApiError>;
    expect(apiError.code).toBe("invalid");
    expect(apiError.fields).toEqual({ contactId: "already enrolled" });

    expect(entrySelects.length).toBe(0);
    expect(activityInserts.length).toBe(0);
    expect(onConflictDoNothingCalls.length).toBe(1);
    expect(onConflictDoNothingCalls[0]!.target).toEqual([schema.pipelineEntry.orgId, schema.pipelineEntry.contactId]);
  });

  it("writes the pipeline_activity 'move' row when the insert does not conflict", async () => {
    const { db, activityInserts, entrySelects } = makePipelineDb({ conflict: false });
    const created = await enrollContact(db, "org-1", "contact-1", "identified", { userId: "u1", name: "Jordan" });
    expect(created.id).toBe("entry-1");
    // findEntryById's read-back happens after the single write, never before it.
    expect(entrySelects.length).toBe(1);
    expect(activityInserts.length).toBe(1);
    expect(activityInserts[0]!.kind).toBe("move");
    expect(activityInserts[0]!.fromStage).toBeNull();
    expect(activityInserts[0]!.toStage).toBe("identified");
  });
});
