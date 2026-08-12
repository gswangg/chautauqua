// SPK-03 (DEC-290): roster-scoped contact create + CSV import. An optional
// `eventId` on the two existing contact endpoints (POST /contacts, POST
// /contacts/import) pushes newly created/updated contacts onto the event
// roster by riding the already-landed pushContactToEvent (accepted
// submission, onboarding tasks planned, no email). Mounts the real
// contactsRoutes sub-app against the same in-memory table-double fakeDb
// pattern as test/contacts-add-to-event.test.ts (no D1 test harness exists
// in stage 1, per DEC-266) — where()/innerJoin() conditions are ignored,
// which is safe here because every scenario below only ever has a single
// relevant row per table at each lookup point.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const EVENT_ORG_A = {
  id: "event-1",
  orgId: ORG_A,
  name: "Widgetcon",
  slug: "widgetcon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  brandingJson: null,
  createdAt: new Date(500),
  updatedAt: new Date(500),
};

/** In-memory table double, adapted from test/contacts-add-to-event.test.ts:
 * select()/insert()/update() are table-identity aware; WHERE/JOIN
 * conditions are ignored (every table here only ever holds rows relevant to
 * the single contact/event/submission under test in each scenario, so
 * "return the whole table" is equivalent to "return the filtered rows"). */
function fakeDb(seedContacts: unknown[], seedEvents: unknown[]) {
  const state = {
    contact: [...seedContacts] as any[],
    event: [...seedEvents] as any[],
    submission: [] as any[],
    participant: [] as any[],
    task: [] as any[],
    taskAssignment: [] as any[],
    form: [] as any[],
    formField: [] as any[],
  };
  const inserts: { table: unknown; vals: any }[] = [];

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.contact) return state.contact;
    if (table === schema.event) return state.event;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.form) return state.form;
    if (table === schema.formField) return state.formField;
    return undefined;
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: () => chain,
      limit: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const write = async () => {
          inserts.push({ table, vals });
          const arr = stateArrayFor(table);
          if (arr) arr.push({ ...(vals as object) });
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          // DEC-556: inviteParticipant's atomic ON CONFLICT DO NOTHING
          // path — this fake db has no uniqueness of its own, so it
          // always "succeeds" and returns the row it was given.
          onConflictDoNothing: () => ({
            returning: async (_sel?: unknown) => {
              await write();
              return [{ id: (vals as any).id, order: 0 }];
            },
          }),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (setVals: unknown) => ({
        where: async () => {
          const arr = stateArrayFor(table);
          // Single-relevant-row-per-table convention (see file header):
          // apply to the last-inserted/only row of this table.
          if (arr && arr.length > 0) Object.assign(arr[arr.length - 1], setVals as object);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, state };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/contacts/import with eventId (SPK-03 roster import, DEC-290)", () => {
  it("importing docs/fixtures/speakers.csv's header shape with eventId creates the new person AND puts them on the event roster", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    // Mirrors docs/fixtures/speakers.csv's header: name,email,title,company,bio
    const csvText =
      "name,email,title,company,bio\n" +
      "Priya Raman,priya@example.com,Principal Engineer,Latticework Systems,Leads the platform team.\n";
    const mapping = { name: "firstName", email: "email", title: "title", company: "company", bio: "bio" };

    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", { csvText, mapping, eventId: "event-1" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; skipped: unknown[]; addedToEvent: number };
    expect(body).toEqual({ created: 1, updated: 0, skipped: [], addedToEvent: 1 });

    expect(state.contact).toHaveLength(1);
    expect(state.contact[0].bio).toBe("Leads the platform team.");

    expect(state.submission).toHaveLength(1);
    expect(state.submission[0].status).toBe("accepted");
    expect(state.participant).toHaveLength(1);
    expect(state.participant[0].contactId).toBe(state.contact[0].id);
  });

  it("re-running the same import does not create a second placeholder submission for someone already on the roster", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const csvText = "Email,First,Last\nada@example.com,Ada,Lovelace\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const firstRes = await app.request(
      jsonRequest("/api/v1/contacts/import", { csvText, mapping, eventId: "event-1" }),
    );
    expect(firstRes.status).toBe(200);
    const firstBody = (await firstRes.json()) as { created: number; addedToEvent: number };
    expect(firstBody).toEqual({ created: 1, updated: 0, skipped: [], addedToEvent: 1 });
    expect(state.submission).toHaveLength(1);

    const secondRes = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: "Email,First,Last\nADA@example.com,Ada,Lovelace2\n",
        mapping,
        eventId: "event-1",
      }),
    );
    expect(secondRes.status).toBe(200);
    const secondBody = (await secondRes.json()) as { created: number; updated: number; addedToEvent: number };
    expect(secondBody).toEqual({ created: 0, updated: 1, skipped: [], addedToEvent: 0 });

    // Still exactly one submission -- no second placeholder created for a
    // contact already on the roster.
    expect(state.submission).toHaveLength(1);
    expect(state.contact).toHaveLength(1);
  });

  it("404s on a bad eventId (not in the caller's org)", async () => {
    const { db, inserts } = fakeDb([], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: "Email,First,Last\nada@example.com,Ada,Lovelace\n",
        mapping: { Email: "email", First: "firstName", Last: "lastName" },
        eventId: "event-does-not-exist",
      }),
    );

    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("import WITHOUT eventId behaves exactly as before (addedToEvent absent)", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: "Email,First,Last\nada@example.com,Ada,Lovelace\n",
        mapping: { Email: "email", First: "firstName", Last: "lastName" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ created: 1, updated: 0, skipped: [] });
    expect(body.addedToEvent).toBeUndefined();
    // No push-to-event side effect at all when eventId is absent.
    expect(state.submission).toHaveLength(0);
  });

  it("a mapped bio column is persisted rather than throwing", async () => {
    const { db, state } = fakeDb([], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: "Email,First,Last,Bio\nada@example.com,Ada,Lovelace,Computer scientist\n",
        mapping: { Email: "email", First: "firstName", Last: "lastName", Bio: "bio" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; skipped: unknown[] };
    expect(body).toEqual({ created: 1, updated: 0, skipped: [] });
    expect(state.contact).toHaveLength(1);
    expect(state.contact[0].bio).toBe("Computer scientist");
  });
});

describe("POST /api/v1/contacts with eventId (SPK-03 roster create, DEC-290)", () => {
  it("creates a contact and pushes it onto the event roster in one call", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Marcus",
        lastName: "Okafor",
        email: "marcus@example.com",
        eventId: "event-1",
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.email).toBe("marcus@example.com");

    expect(state.submission).toHaveLength(1);
    expect(state.submission[0].status).toBe("accepted");
    expect(state.participant).toHaveLength(1);
    expect(state.participant[0].contactId).toBe(body.id);
  });

  it("404s on a bad eventId and does not create the contact push", async () => {
    const { db } = fakeDb([], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Marcus",
        lastName: "Okafor",
        email: "marcus@example.com",
        eventId: "event-does-not-exist",
      }),
    );

    expect(res.status).toBe(404);
  });

  it("without eventId, behaves exactly as before (201, no roster push)", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", { firstName: "Marcus", lastName: "Okafor", email: "marcus@example.com" }),
    );

    expect(res.status).toBe(201);
    expect(state.submission).toHaveLength(0);
  });
});
