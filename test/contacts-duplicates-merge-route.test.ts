// CRM duplicate-merge P1 fix (w1-c, DEC-239): the client and server drifted
// on the DuplicateGroup wire shape (server: {contactIds, contacts}, client
// was reading group.ids), so a merge attempt threw a TypeError outside its
// try block and the dialog silently hung. This is a route-level contract
// test locking the exact wire shape, plus a merge roundtrip test through the
// real contactsRoutes sub-app, mirroring test/contacts-add-to-event.test.ts's
// fake-db-queue pattern (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
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
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

const KEEP = contactRaw("contact-keep", "jane@example.com", "Jane", "Doe");
const MERGE = contactRaw("contact-merge", "jane@example.com", "Jane", "Doe");

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every update()/delete() write (table object + values). */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: { table: unknown; vals: unknown }[] = [];
  const deletes: { table: unknown }[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    update: (table: unknown) => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push({ table, vals });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push({ table });
      },
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], updates, deletes };
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

describe("GET /api/v1/contacts/duplicates wire contract (DEC-239)", () => {
  it("exposes exactly contactIds + contacts[{id,firstName,lastName,email}] per group", async () => {
    // findDuplicateGroupsForOrg: one select of all org contacts.
    const { db } = fakeDb([[KEEP, MERGE]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/contacts/duplicates"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: { contactIds: string[]; contacts: unknown[] }[] };

    expect(json.items).toHaveLength(1);
    const group = json.items[0]!;
    expect(Object.keys(group).sort()).toEqual(["contactIds", "contacts"]);
    expect(group.contactIds.sort()).toEqual(["contact-keep", "contact-merge"].sort());
    for (const c of group.contacts as Record<string, unknown>[]) {
      expect(Object.keys(c).sort()).toEqual(["email", "firstName", "id", "lastName"]);
    }
  });
});

describe("POST /api/v1/contacts/merge roundtrip from a duplicates response (DEC-239)", () => {
  it("merges {keepId,mergeId} drawn from the duplicates payload, returns the merged row, and drops mergeId from a later list", async () => {
    // 1) Fetch duplicates.
    const { db: dupDb } = fakeDb([[KEEP, MERGE]]);
    const dupApp = appWithDbAndAuth(dupDb, ORGANIZER_A);
    const dupRes = await dupApp.request(new Request("http://local/api/v1/contacts/duplicates"));
    const dupJson = (await dupRes.json()) as { items: { contactIds: string[] }[] };
    const [keepId, mergeId] = dupJson.items[0]!.contactIds;
    expect(keepId).toBeTruthy();
    expect(mergeId).toBeTruthy();

    // 2) Merge, using exactly the ids the duplicates endpoint returned.
    const { db: mergeDb, updates, deletes } = fakeDb([
      [KEEP.id === keepId ? KEEP : MERGE], // requireOwnedContact(keepId)
      [KEEP.id === mergeId ? KEEP : MERGE], // requireOwnedContact(mergeId)
      [KEEP.id === keepId ? KEEP : MERGE], // mergeContacts: findContactById(keepId)
      [KEEP.id === mergeId ? KEEP : MERGE], // mergeContacts: findContactById(mergeId)
      [], // mergeContacts: user rows for keepId (none)
      [], // mergeContacts: user rows for mergeId (none)
      [], // mergeParticipants (none)
      [], // keepParticipants (none)
      [], // mergeContacts: task_assignment rows for mergeId (none)
      [], // mergeContacts: task_assignment rows for keepId (none)
      [], // mergeContacts: pipelineEntry for keepId (none)
      [], // mergeContacts: pipelineEntry for mergeId (none)
      [KEEP.id === keepId ? KEEP : MERGE], // mergeContacts: findContactById(keepId) after merge
    ]);
    const mergeApp = appWithDbAndAuth(mergeDb, ORGANIZER_A);
    const mergeRes = await mergeApp.request(jsonRequest("POST", "/api/v1/contacts/merge", { keepId, mergeId }));
    expect(mergeRes.status).toBe(200);
    const mergedJson = (await mergeRes.json()) as { id: string };
    expect(mergedJson.id).toBe(keepId);

    expect(deletes.some((d) => d.table === schema.contact)).toBe(true);
    expect(updates.some((u) => u.table === schema.contact)).toBe(true);

    // 3) The merged contact no longer surfaces in the duplicates listing
    // (proxy for "gone from the list" — the org now has a single contact
    // row, per the delete recorded above).
    const { db: afterDb } = fakeDb([[KEEP.id === keepId ? KEEP : MERGE]]);
    const afterApp = appWithDbAndAuth(afterDb, ORGANIZER_A);
    const afterRes = await afterApp.request(new Request("http://local/api/v1/contacts/duplicates"));
    const afterJson = (await afterRes.json()) as { items: unknown[] };
    expect(afterJson.items).toHaveLength(0);
  });
});
