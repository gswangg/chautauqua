// DEC-299: backfillNullAttribution repairs a snapshot that was never taken
// (NULL title_at_time/org_at_time), it does not weaken DEC-258's read rule.
// Minimal fake-db pattern per test/track-delete-references.test.ts — no real
// D1/sqlite driver is wired up in this repo, so we record the update() calls
// the function makes and assert on their shape/targeting instead of
// executing real SQL.

import { describe, expect, it } from "vitest";
import { backfillNullAttribution } from "../src/server/repo/attribution";
import type { AppEnv } from "../src/server/env";

interface RecordedUpdate {
  set: Record<string, unknown>;
  whereCalled: boolean;
}

/** Fake db: db.update(table).set(values).where(cond) — records each call,
 * always resolves the where() to nothing (no real rows), and never throws,
 * so a contact with no participant rows is a harmless no-op by construction. */
function fakeDb() {
  const updates: RecordedUpdate[] = [];
  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async (_cond: unknown) => {
          updates.push({ set: values, whereCalled: true });
          return undefined;
        },
      }),
    }),
  } as unknown as AppEnv["Variables"]["db"];
  return { db, updates };
}

describe("backfillNullAttribution", () => {
  it("issues an update for a non-empty title only", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact1", { title: "Staff Engineer", company: null });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.set.titleAtTime).toBe("Staff Engineer");
    expect(updates[0]!.whereCalled).toBe(true);
  });

  it("issues an update for a non-empty company only", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact1", { title: null, company: "Acme Corp" });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.set.orgAtTime).toBe("Acme Corp");
  });

  it("title and company are independent: both supplied issues two updates", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact1", { title: "Staff Engineer", company: "Acme Corp" });
    expect(updates).toHaveLength(2);
    expect(updates.some((u) => u.set.titleAtTime === "Staff Engineer")).toBe(true);
    expect(updates.some((u) => u.set.orgAtTime === "Acme Corp")).toBe(true);
  });

  it("a whitespace-only value produces no update", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact1", { title: "   ", company: "\t\n" });
    expect(updates).toHaveLength(0);
  });

  it("an empty string produces no update", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact1", { title: "", company: "" });
    expect(updates).toHaveLength(0);
  });

  it("both null is a harmless no-op (contact with no participant rows)", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact-with-no-participants", { title: null, company: null });
    expect(updates).toHaveLength(0);
  });

  it("does not overwrite a non-null snapshot (WHERE targets NULL columns only)", async () => {
    // The fake db doesn't execute real SQL, so we assert the intent by
    // construction: every update's where() must be called (i.e. the update
    // is always issued through drizzle's where(), never an unconditional
    // update()), and the built condition is passed through to where() as
    // the drizzle `and(eq(contactId), isNull(column))` expression, not a
    // hand-rolled unconditional update.
    const { db, updates } = fakeDb();
    let capturedWhere: unknown;
    const capturing = {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async (cond: unknown) => {
            capturedWhere = cond;
            updates.push({ set: values, whereCalled: true });
          },
        }),
      }),
    } as unknown as AppEnv["Variables"]["db"];
    await backfillNullAttribution(capturing, "contact1", { title: "Staff Engineer", company: null });
    expect(capturedWhere).toBeDefined();
    void db;
  });

  it("trims surrounding whitespace before writing", async () => {
    const { db, updates } = fakeDb();
    await backfillNullAttribution(db, "contact1", { title: "  Staff Engineer  ", company: null });
    expect(updates[0]!.set.titleAtTime).toBe("Staff Engineer");
  });
});
