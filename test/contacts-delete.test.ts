// DEC-758: DELETE /api/v1/contacts/:id refuses honestly when anything
// depends on the contact (participant, task assignment, pipeline entry, or
// linked user account) — naming the counts in prose plus a per-kind
// `fields` entry, and otherwise deletes cleanly. Mounts the real
// contactsRoutes sub-app against a table-aware fake db, mirroring
// test/contacts-add-to-event.test.ts's pattern (no D1 test harness exists
// in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const CONTACT_ORG_A = {
  id: "contact-1",
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

function fakeDb(opts: {
  contacts?: unknown[];
  participants?: unknown[];
  taskAssignments?: unknown[];
  pipelineEntries?: unknown[];
  users?: unknown[];
}) {
  const state = {
    contact: [...(opts.contacts ?? [])] as any[],
    participant: [...(opts.participants ?? [])] as any[],
    taskAssignment: [...(opts.taskAssignments ?? [])] as any[],
    pipelineEntry: [...(opts.pipelineEntries ?? [])] as any[],
    user: [...(opts.users ?? [])] as any[],
  };
  const deletes: { table: unknown }[] = [];

  function rowsFor(table: unknown): any[] {
    if (table === schema.contact) return state.contact;
    if (table === schema.participant) return state.participant;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.pipelineEntry) return state.pipelineEntry;
    if (table === schema.user) return state.user;
    return [];
  }

  function makeChain(rows: unknown[], countCols: unknown) {
    // countContactReferences selects `{ count: sql count(*) }` — the fake
    // reports the row-array length as the count so it doesn't need to
    // understand drizzle's sql template, mirroring the shape callers read
    // (`rows[0]?.count`).
    const isCount = typeof countCols === "object" && countCols !== null && "count" in (countCols as object);
    const resultRows = isCount ? [{ count: rows.length }] : rows;
    const chain: any = {
      from: (table: unknown) => makeChain(rowsFor(table), countCols),
      where: () => chain,
      limit: async () => resultRows,
      then: (resolve: (v: unknown[]) => void) => resolve(resultRows),
    };
    return chain;
  }

  const db = {
    select: (cols?: unknown) => ({
      from: (table: unknown) => makeChain(rowsFor(table), cols),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push({ table });
        if (table === schema.contact) state.contact = [];
      },
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], deletes, state };
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

function deleteRequest(path: string) {
  return new Request(`http://local${path}`, {
    method: "DELETE",
    headers: { "x-chq-csrf": "1" },
  });
}

describe("DELETE /api/v1/contacts/:id (DEC-758)", () => {
  it("deletes a bare contact with no dependents", async () => {
    const { db, deletes, state } = fakeDb({ contacts: [CONTACT_ORG_A] });
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(204);
    expect(deletes.some((d) => d.table === schema.contact)).toBe(true);
    expect(state.contact).toHaveLength(0);
  });

  it("409s naming counts when the contact has a participant row, and leaves it in place", async () => {
    const { db, deletes, state } = fakeDb({
      contacts: [CONTACT_ORG_A],
      participants: [{ id: "p1", submissionId: "sub1", contactId: "contact-1" }],
    });
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("conflict");
    expect(json.error.message).toMatch(/1 submission/);
    expect(json.error.message).toMatch(/merge/i);
    expect(json.error.fields?.participants).toBe("1");
    // never deleted
    expect(deletes.some((d) => d.table === schema.contact)).toBe(false);
    expect(state.contact).toHaveLength(1);
  });

  it("409s naming multiple kinds when task assignments and a user account both reference the contact", async () => {
    const { db } = fakeDb({
      contacts: [CONTACT_ORG_A],
      taskAssignments: [{ id: "ta1", taskId: "t1", contactId: "contact-1" }],
      users: [{ id: "u1", orgId: ORG_A, contactId: "contact-1" }],
    });
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(json.error.message).toMatch(/1 task/);
    expect(json.error.message).toMatch(/1 user account/);
    expect(json.error.fields?.taskAssignments).toBe("1");
    expect(json.error.fields?.userAccounts).toBe("1");
  });

  it("404s when the contact belongs to a different org (existence-hiding, never 403)", async () => {
    const { db, deletes } = fakeDb({ contacts: [] });
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-from-org-b"));

    expect(res.status).toBe(404);
    expect(deletes).toHaveLength(0);
  });

  it("403s a non-organizer session before any db access", async () => {
    const { db, deletes } = fakeDb({ contacts: [CONTACT_ORG_A] });
    const app = appWithDbAndAuth(db, { userId: "u-reviewer-a", role: "reviewer", orgId: ORG_A });

    const res = await app.request(deleteRequest("/api/v1/contacts/contact-1"));

    expect(res.status).toBe(403);
    expect(deletes).toHaveLength(0);
  });
});
