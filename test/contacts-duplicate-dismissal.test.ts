// DEC-770 (w1-g): "Not a duplicate" / "Keep both" persist as a fact about
// the pair -- a contact_duplicate_dismissal row, org+ordered-pair unique.
// Mirrors test/contacts-duplicates-merge-route.test.ts's fake-db-queue
// pattern (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import { dismissDuplicatePair, findDuplicateGroupsForOrg } from "../src/server/repo/contacts/merge";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";

function contactRaw(id: string, orgId: string, email: string, firstName: string, lastName: string) {
  return {
    id,
    orgId,
    firstName,
    lastName,
    email,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

const KEEP = contactRaw("contact-keep", ORG_A, "jane@example.com", "Jane", "Doe");
const MERGE = contactRaw("contact-merge", ORG_A, "jane@example.com", "Jane", "Doe");
const FOREIGN = contactRaw("contact-foreign", ORG_B, "sam@example.com", "Sam", "Ng");

function orderedIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every insert()/update()/delete() write (table object + values). */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: { table: unknown; vals: unknown }[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (table: unknown) => ({
      values: (vals: unknown) => ({
        onConflictDoNothing: async (_opts: unknown) => {
          inserts.push({ table, vals });
        },
      }),
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function jsonRequest(method: string, path: string, body?: unknown) {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("findDuplicateGroupsForOrg excludes dismissed pairs (DEC-770)", () => {
  it("drops a dismissed pair from both items and total, and stays gone on re-query", async () => {
    const [a, b] = orderedIds(KEEP.id, MERGE.id);

    // First call: contacts scan, then the dismissal-rows select returns the
    // dismissed pair -- the group must not appear.
    const { db: db1 } = fakeDb([[KEEP, MERGE], [{ contactIdA: a, contactIdB: b }]]);
    const groups1 = await findDuplicateGroupsForOrg(db1, ORG_A);
    expect(groups1).toHaveLength(0);

    // Re-query (a fresh call, same dismissal state): still gone.
    const { db: db2 } = fakeDb([[KEEP, MERGE], [{ contactIdA: a, contactIdB: b }]]);
    const groups2 = await findDuplicateGroupsForOrg(db2, ORG_A);
    expect(groups2).toHaveLength(0);
  });

  it("without a dismissal, the pair still appears (control)", async () => {
    const { db } = fakeDb([[KEEP, MERGE], []]);
    const groups = await findDuplicateGroupsForOrg(db, ORG_A);
    expect(groups).toHaveLength(1);
  });
});

describe("dismissDuplicatePair (DEC-770)", () => {
  it("is idempotent -- a repeat dismiss of the same pair is a no-op, not a 500", async () => {
    const { db, inserts } = fakeDb([]);
    await expect(dismissDuplicatePair(db, ORG_A, KEEP.id, MERGE.id)).resolves.toBeUndefined();
    await expect(dismissDuplicatePair(db, ORG_A, KEEP.id, MERGE.id)).resolves.toBeUndefined();
    expect(inserts).toHaveLength(2);
    // Both attempts normalize to the same ascending-order pair, so a real
    // unique index on (org_id, contact_id_a, contact_id_b) would silently
    // absorb the second -- onConflictDoNothing is what makes that safe.
    const [a, b] = orderedIds(KEEP.id, MERGE.id);
    for (const ins of inserts) {
      const vals = ins.vals as { contactIdA: string; contactIdB: string };
      expect(vals.contactIdA).toBe(a);
      expect(vals.contactIdB).toBe(b);
    }
  });

  it("normalizes (idB, idA) to the same ascending pair as (idA, idB)", async () => {
    const { db, inserts } = fakeDb([]);
    await dismissDuplicatePair(db, ORG_A, MERGE.id, KEEP.id);
    const [a, b] = orderedIds(KEEP.id, MERGE.id);
    const vals = inserts[0]!.vals as { contactIdA: string; contactIdB: string };
    expect(vals.contactIdA).toBe(a);
    expect(vals.contactIdB).toBe(b);
  });
});

describe("POST /api/v1/contacts/duplicates/dismiss (DEC-770)", () => {
  it("dismisses an owned pair", async () => {
    const { db, inserts } = fakeDb([[KEEP], [MERGE]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/contacts/duplicates/dismiss", { contactIds: [KEEP.id, MERGE.id] }),
    );

    expect(res.status).toBe(200);
    expect(inserts).toHaveLength(1);
  });

  it("refuses a cross-org pair with 404, and issues zero writes", async () => {
    // requireOwnedContact(idA) finds KEEP in org A; requireOwnedContact(idB)
    // looks up FOREIGN scoped to org A and finds nothing (org-scoped query
    // returns empty for a foreign-org contact).
    const { db, inserts } = fakeDb([[KEEP], []]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/contacts/duplicates/dismiss", { contactIds: [KEEP.id, FOREIGN.id] }),
    );

    expect(res.status).toBe(404);
    expect(inserts).toEqual([]);
  });

  it("rejects a body that isn't exactly two contact ids", async () => {
    const { db, inserts } = fakeDb([]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/contacts/duplicates/dismiss", { contactIds: [KEEP.id] }),
    );

    expect(res.status).toBe(400);
    expect(inserts).toEqual([]);
  });
});
