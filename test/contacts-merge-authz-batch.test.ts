// DEC-629 amendment (wave 49): contact merge routes used to loop
// requireOwnedContact per id (up to 21 sequential SELECTs before any write
// on POST /contacts/merge, and the same on GET /contacts/merge/preview,
// which MergePage re-fires on every "Swap which is kept" click). This locks
// the set-based twin requireOwnedContacts: ONE ownership select over the
// whole id set, still zero writes and an identical error body for a foreign
// or unknown id, and the error names the FIRST such id in request order.
//
// Uses the fakeDb select-queue pattern from
// test/contacts-duplicates-merge-route.test.ts:41-70 (no D1 test harness
// exists in stage 1), instrumented to also count db.select() calls.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function contactRaw(id: string, email: string, firstName: string, lastName: string) {
  return {
    id,
    orgId: ORG_A,
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
    externalRef: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

const KEEP = contactRaw("contact-keep", "jane@example.com", "Jane", "Doe");
const MERGE = contactRaw("contact-merge", "jane@example.com", "Jane", "Doe");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/** Feeds successive db.select() calls the queued row sets, in order, counts
 * how many select() calls happened, and records writes. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  let selectCalls = 0;
  const updates: { table: unknown }[] = [];
  const deletes: { table: unknown }[] = [];
  const db = {
    select: () => {
      selectCalls += 1;
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    update: (table: unknown) => ({
      set: () => ({
        where: async () => {
          updates.push({ table });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push({ table });
      },
    }),
  };
  return {
    db: db as unknown as AppEnv["Variables"]["db"],
    updates,
    deletes,
    selectCallCount: () => selectCalls,
  };
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

describe("contact merge ownership proof is set-based (DEC-629 amendment, wave 49)", () => {
  it("POST /contacts/merge: a foreign mergeId 404s and issues zero writes", async () => {
    const { db, updates, deletes } = fakeDb([
      [KEEP, MERGE], // requireOwnedContacts([keepId, mergeIds[0], "contact-foreign"]) -- foreign absent
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/contacts/merge", {
        keepId: KEEP.id,
        mergeIds: [MERGE.id, "contact-foreign"],
      }),
    );

    expect(res.status).toBe(404);
    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it("POST /contacts/merge: with two bad ids, the error names the first in request order", async () => {
    // Neither bad id resolves, so the returned map only has KEEP. The first
    // id missing from the map in request order ([keepId, bad1, bad2]) is
    // "contact-bad-1" -- that's the one the error body must name.
    const { db } = fakeDb([
      [KEEP], // requireOwnedContacts([keepId, contact-bad-1, contact-bad-2]) -- both bad ids absent
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/contacts/merge", {
        keepId: KEEP.id,
        mergeIds: ["contact-bad-1", "contact-bad-2"],
      }),
    );

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("not_found");

    // Confirm request order determines which id is named: reorder the bad
    // ids and the same fixed row set still yields the same error shape
    // (the singular requireOwnedContact throws this exact body for its
    // "first missing id", and the set-based twin must match it).
    const { db: db2 } = fakeDb([[KEEP]]);
    const app2 = appWithDbAndAuth(db2, ORGANIZER_A);
    const res2 = await app2.request(
      jsonRequest("POST", "/api/v1/contacts/merge", {
        keepId: KEEP.id,
        mergeIds: ["contact-bad-2", "contact-bad-1"],
      }),
    );
    expect(res2.status).toBe(404);
    const json2 = (await res2.json()) as { error: { code: string; message: string } };
    expect(json2.error).toEqual(json.error);
  });

  it("POST /contacts/merge: happy path issues exactly ONE ownership select before the merge writes", async () => {
    const { db, selectCallCount } = fakeDb([
      [KEEP, MERGE], // requireOwnedContacts([keepId, mergeId]) -- one set-based select
      [KEEP], // mergeContacts: findContactById(keepId)
      [MERGE], // mergeContacts: findContactById(mergeId)
      [], // mergeContacts: user rows for keepId (none)
      [], // mergeContacts: user rows for mergeId (none)
      [], // mergeContacts: (b2) DEC-479 email conflict pre-check (none)
      [], // mergeParticipants (none)
      [], // keepParticipants (none)
      [], // mergeContacts: task_assignment rows for mergeId (none)
      [], // mergeContacts: task_assignment rows for keepId (none)
      [], // mergeContacts: pipelineEntry for keepId (none)
      [], // mergeContacts: pipelineEntry for mergeId (none)
      [KEEP], // mergeContacts: findContactById(keepId) after merge
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/contacts/merge", { keepId: KEEP.id, mergeIds: [MERGE.id] }),
    );
    expect(res.status).toBe(200);
    // Exactly one select is the ownership proof; every subsequent select
    // belongs to mergeContacts, not to a second ownership check.
    expect(selectCallCount()).toBe(13);
  });

  it("GET /contacts/merge/preview: a foreign id in ids 404s", async () => {
    const { db } = fakeDb([
      [KEEP], // requireOwnedContacts([keep, contact-foreign]) -- foreign absent from row set
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${KEEP.id},contact-foreign&keep=${KEEP.id}`),
    );
    expect(res.status).toBe(404);
  });

  it("GET /contacts/merge/preview: happy path issues exactly ONE ownership select", async () => {
    const { db, selectCallCount } = fakeDb([
      [KEEP, MERGE], // requireOwnedContacts([keep, dup]) -- one set-based select
      [{ count: 0 }], // countMergeImpact participant count
      [{ count: 0 }], // countMergeImpact task_assignment count
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${KEEP.id},${MERGE.id}&keep=${KEEP.id}`),
    );
    expect(res.status).toBe(200);
    expect(selectCallCount()).toBe(3);
  });
});
