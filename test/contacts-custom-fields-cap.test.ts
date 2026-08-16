// DEC-417 amendment (wave 2, task w2-e): customFields on POST /contacts and
// PATCH /contacts/:id used to walk Object.entries and call checkLen ONLY
// when `typeof value === "string"` -- a number/array/object value silently
// skipped validation and was cast `as Record<string,string>` straight into
// custom_fields_json, later read back by contactLabels as if it were a
// string. Nothing bounded key length or key COUNT either. This exercises
// all three new refusals (non-string value, over-length key, too many keys)
// on both routes, plus the still-passing string happy path. Reuses the
// in-memory table-double fakeDb pattern from test/contacts-create-duplicate.test.ts
// (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_NAME_LENGTH } from "../src/forms/validate";
import { MAX_CONTACT_CUSTOM_FIELDS } from "../src/domain/contact-labels";
// DEC-422 amendment: refusal copy is single-sourced -- assert against the
// shared grammar helpers, never a hand-typed "Max N" string.
import { overCapCountMessage } from "../src/domain/cap-copy";
import { overBudgetBy } from "../src/domain/count-copy";

const ORG_A = "org-a";

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

/** In-memory table double, adapted from test/contacts-create-duplicate.test.ts:
 * select()/insert()/update() are table-identity aware; WHERE/JOIN conditions
 * are ignored. */
function fakeDb(seedContacts: unknown[]) {
  const state = {
    contact: [...seedContacts] as any[],
  };
  const inserts: { table: unknown; vals: any }[] = [];
  const updates: { table: unknown; vals: any }[] = [];

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.contact) return state.contact;
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
          updates.push({ table, vals: setVals });
          const arr = stateArrayFor(table);
          if (arr && arr.length > 0) Object.assign(arr[arr.length - 1], setVals as object);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, updates, state };
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

function jsonRequest(method: string, path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function manyKeys(n: number): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < n; i++) obj[`k${i}`] = "v";
  return obj;
}

describe("customFields refuses instead of skipping invalid entries (DEC-417 amendment, wave 2)", () => {
  describe("POST /api/v1/contacts", () => {
    it("refuses a non-string custom field value", async () => {
      const { db, inserts } = fakeDb([]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const res = await app.request(
        jsonRequest("POST", "/api/v1/contacts", {
          firstName: "Marcus",
          lastName: "Okafor",
          email: "marcus@example.com",
          customFields: { shirtSize: 42 },
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.["customFields.shirtSize"]).toBe("must be a string");
      expect(inserts.find((i) => i.table === schema.contact)).toBeUndefined();
    });

    it("refuses a custom field key longer than MAX_NAME_LENGTH", async () => {
      const { db, inserts } = fakeDb([]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const longKey = "k".repeat(MAX_NAME_LENGTH + 1);
      const res = await app.request(
        jsonRequest("POST", "/api/v1/contacts", {
          firstName: "Marcus",
          lastName: "Okafor",
          email: "marcus@example.com",
          customFields: { [longKey]: "value" },
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.[`customFields.${longKey}`]).toBe(overBudgetBy(longKey.length, MAX_NAME_LENGTH));
      expect(inserts.find((i) => i.table === schema.contact)).toBeUndefined();
    });

    it("refuses more than MAX_CONTACT_CUSTOM_FIELDS keys", async () => {
      const { db, inserts } = fakeDb([]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const res = await app.request(
        jsonRequest("POST", "/api/v1/contacts", {
          firstName: "Marcus",
          lastName: "Okafor",
          email: "marcus@example.com",
          customFields: manyKeys(MAX_CONTACT_CUSTOM_FIELDS + 1),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.customFields).toBe(
        overCapCountMessage(MAX_CONTACT_CUSTOM_FIELDS + 1, MAX_CONTACT_CUSTOM_FIELDS, "custom field"),
      );
      expect(inserts.find((i) => i.table === schema.contact)).toBeUndefined();
    });

    it("still accepts string custom field values (happy path)", async () => {
      const { db, state } = fakeDb([]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const res = await app.request(
        jsonRequest("POST", "/api/v1/contacts", {
          firstName: "Marcus",
          lastName: "Okafor",
          email: "marcus@example.com",
          customFields: { shirtSize: "L", dietary: "vegan" },
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { customFields: Record<string, string> };
      expect(body.customFields).toEqual({ shirtSize: "L", dietary: "vegan" });
      expect(state.contact).toHaveLength(1);
    });
  });

  describe("PATCH /api/v1/contacts/:id", () => {
    it("refuses a non-string custom field value", async () => {
      const { db, updates } = fakeDb([EXISTING_CONTACT]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const res = await app.request(
        jsonRequest("PATCH", "/api/v1/contacts/contact-existing", {
          customFields: { shirtSize: ["L"] },
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.["customFields.shirtSize"]).toBe("must be a string");
      expect(updates).toHaveLength(0);
    });

    it("refuses a custom field key longer than MAX_NAME_LENGTH", async () => {
      const { db, updates } = fakeDb([EXISTING_CONTACT]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const longKey = "k".repeat(MAX_NAME_LENGTH + 1);
      const res = await app.request(
        jsonRequest("PATCH", "/api/v1/contacts/contact-existing", {
          customFields: { [longKey]: "value" },
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.[`customFields.${longKey}`]).toBe(overBudgetBy(longKey.length, MAX_NAME_LENGTH));
      expect(updates).toHaveLength(0);
    });

    it("refuses more than MAX_CONTACT_CUSTOM_FIELDS keys", async () => {
      const { db, updates } = fakeDb([EXISTING_CONTACT]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const res = await app.request(
        jsonRequest("PATCH", "/api/v1/contacts/contact-existing", {
          customFields: manyKeys(MAX_CONTACT_CUSTOM_FIELDS + 1),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.customFields).toBe(
        overCapCountMessage(MAX_CONTACT_CUSTOM_FIELDS + 1, MAX_CONTACT_CUSTOM_FIELDS, "custom field"),
      );
      expect(updates).toHaveLength(0);
    });

    it("still accepts string custom field values (happy path)", async () => {
      const { db, state } = fakeDb([EXISTING_CONTACT]);
      const app = appWithDbAndAuth(db, ORGANIZER_A);
      const res = await app.request(
        jsonRequest("PATCH", "/api/v1/contacts/contact-existing", {
          customFields: { shirtSize: "M" },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { customFields: Record<string, string> };
      expect(body.customFields).toEqual({ shirtSize: "M" });
      expect(state.contact[0].customFieldsJson).toBe(JSON.stringify({ shirtSize: "M" }));
    });
  });
});
