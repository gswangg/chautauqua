// DEC-755 amendment (wave 43): POST /api/v1/contacts is find-or-REFUSE, never
// mint-a-duplicate. Contact identity within an org is (orgId, lower(email))
// on every find-or-create path (public CFP submit, portal co-presenter,
// sessionboard import, submissions/create.ts); this manual create path was
// the one hole -- it called createContact unconditionally. Mounts the real
// contactsRoutes sub-app against the same in-memory table-double fakeDb
// pattern as test/contacts-roster-import.test.ts (no D1 test harness exists
// in stage 1).

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

const EXISTING_CONTACT = {
  id: "contact-existing",
  orgId: ORG_A,
  firstName: "Priya",
  lastName: "Raman",
  email: "priya@example.com",
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

/** In-memory table double, adapted from test/contacts-roster-import.test.ts:
 * select()/insert()/update() are table-identity aware; WHERE/JOIN conditions
 * are ignored (every table here only ever holds rows relevant to the single
 * contact/event/submission under test in each scenario, so "return the whole
 * table" is equivalent to "return the filtered rows"). */
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
      // DEC-558 (wave 75): findContactByEmail orders by (createdAt, id)
      // before .limit(1); a no-op for this fake, but it must exist.
      orderBy: () => chain,
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

describe("POST /api/v1/contacts is find-or-REFUSE (DEC-755 amendment wave 43)", () => {
  it("refuses a same-address-different-case email with 409, naming the existing contact, and writes nothing", async () => {
    const { db, inserts, state } = fakeDb([EXISTING_CONTACT], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Priya",
        lastName: "Raman",
        email: "PRIYA@Example.com",
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toContain("Priya Raman");
    expect(body.error.fields).toEqual({ email: "Already on an existing contact" });

    // No second contact row minted.
    expect(state.contact).toHaveLength(1);
    expect(inserts.find((i) => i.table === schema.contact)).toBeUndefined();
  });

  it("still creates a genuinely different address (201)", async () => {
    // The fakeDb ignores WHERE clauses (see file header) -- it can only
    // model "some contact already exists in this org" vs "none does", not a
    // real per-email match. An empty seed here exercises the true no-match
    // path through the same findContactByEmail lookup the 409 test above
    // exercises for a match.
    const { db, state } = fakeDb([], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Marcus",
        lastName: "Okafor",
        email: "marcus@example.com",
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe("marcus@example.com");
    expect(state.contact).toHaveLength(1);
  });

  it("refuses the eventId add-to-event branch BEFORE pushContactToEvent, creating no session", async () => {
    const { db, inserts, state } = fakeDb([EXISTING_CONTACT], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Priya",
        lastName: "Raman",
        email: "priya@example.com",
        eventId: "event-1",
        sessionTitle: "Lightning talks",
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");

    expect(state.submission).toHaveLength(0);
    expect(state.participant).toHaveLength(0);
    expect(inserts.find((i) => i.table === schema.submission)).toBeUndefined();
    expect(inserts.find((i) => i.table === schema.contact)).toBeUndefined();
  });
});
