// DEC-788 (w3-g): GET /contacts/duplicates/check warns about a duplicate at
// creation using the SAME pair-matching predicate GET /contacts/duplicates
// itself uses (findDuplicateGroups, imported not restated), including the
// (org, lower(email)) identity rule, and honors a dismissed pair (DEC-770).
// Mirrors test/contacts-duplicate-dismissal.test.ts's fake-db-queue pattern
// (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function contactRaw(id: string, email: string, firstName: string, lastName: string, company: string | null = null) {
  return { id, email, firstName, lastName, company, title: null };
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

/** Feeds successive db.select() calls the queued row sets, in order. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
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

function checkRequest(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new Request(`http://local/api/v1/contacts/duplicates/check?${qs}`, { method: "GET" });
}

describe("GET /api/v1/contacts/duplicates/check (DEC-788)", () => {
  it("reports a match found by the (org, lower(email)) identity rule", async () => {
    const existing = contactRaw("contact-a", "jane@example.com", "Jane", "Doe");
    const app = appWithDbAndAuth(fakeDb([[existing]]), ORGANIZER_A);

    const res = await app.request(
      checkRequest({ firstName: "Janey", lastName: "D", email: "JANE@Example.com", company: "" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; reason: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: "contact-a", reason: "email" });
  });

  it("reports no match when nothing in the directory is close", async () => {
    const existing = contactRaw("contact-a", "unrelated@example.com", "Sam", "Ng", "Acme");
    const app = appWithDbAndAuth(fakeDb([[existing]]), ORGANIZER_A);

    const res = await app.request(
      checkRequest({ firstName: "Priya", lastName: "Raman", email: "priya@example.com", company: "Latticework" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("excludes a match that is a dismissed pair (DEC-770)", async () => {
    // Two existing contacts already form their own name+company duplicate
    // pair, previously dismissed. A new candidate with the same name+company
    // would join that same bucket -- the dismissed pair must not surface.
    const a = contactRaw("contact-a", "a@example.com", "Ann", "Lee", "Acme");
    const b = contactRaw("contact-b", "b@example.com", "Ann", "Lee", "Acme");
    const [idA, idB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const app = appWithDbAndAuth(
      fakeDb([[a, b], [{ contactIdA: idA, contactIdB: idB }]]),
      ORGANIZER_A,
    );

    const res = await app.request(
      checkRequest({ firstName: "Ann", lastName: "Lee", email: "", company: "Acme" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("without a dismissal, the same name+company pair still surfaces (control)", async () => {
    const a = contactRaw("contact-a", "a@example.com", "Ann", "Lee", "Acme");
    const b = contactRaw("contact-b", "b@example.com", "Ann", "Lee", "Acme");
    const app = appWithDbAndAuth(fakeDb([[a, b], []]), ORGANIZER_A);

    const res = await app.request(
      checkRequest({ firstName: "Ann", lastName: "Lee", email: "", company: "Acme" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; reason: string }> };
    expect(body.items.map((i) => i.id).sort()).toEqual(["contact-a", "contact-b"]);
    expect(body.items.every((i) => i.reason === "name")).toBe(true);
  });
});
