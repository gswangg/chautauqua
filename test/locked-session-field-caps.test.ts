// DEC-124 amendment (wave 61): one character budget per locked session
// field (title, description), enforced by every writer and declared by
// every control. This pins:
//  1) projectFieldForAnswers' stamped `maximum` for BOTH locked session
//     fields equals the bound the organizer submissions route applies.
//  2) POST /events/:eventId/submissions and PATCH /submissions/:id both
//     refuse an over-budget title/description, naming the field.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { submissionsRoutes } from "../src/routes/api/submissions";
import {
  LOCKED_TITLE_MAX_LENGTH,
  LOCKED_ABSTRACT_MAX_LENGTH,
  projectFieldForAnswers,
  type FormFieldDef,
} from "../src/forms/types";

// (1) One enumeration over the two locked session fields: projectFieldForAnswers'
// stamped `maximum` must equal the bound the organizer route applies.
describe("projectFieldForAnswers' stamped maximum matches the organizer route's cap (DEC-124)", () => {
  const CASES: Array<{ name: "title" | "description"; routeCap: number }> = [
    { name: "title", routeCap: LOCKED_TITLE_MAX_LENGTH },
    { name: "description", routeCap: LOCKED_ABSTRACT_MAX_LENGTH },
  ];

  for (const { name, routeCap } of CASES) {
    it(`locked '${name}' field stamps maximum === ${routeCap}`, () => {
      const def: FormFieldDef = {
        id: `form-1:${name}`,
        section: "session",
        kind: name === "description" ? "long_text" : "text",
        label: name,
        required: true,
        position: 0,
      };
      const projected = projectFieldForAnswers(def);
      expect(projected.maximum).toBe(routeCap);
    });
  }
});

describe("POST /api/v1/events/:eventId/submissions refuses over-budget title/description (DEC-124)", () => {
  const ORGANIZER: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: "org-a" };

  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  function fakeDb(selectQueue: unknown[][]) {
    let call = 0;
    const db = {
      select: () => {
        const rows = selectQueue[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
      insert: () => ({ values: async () => {} }),
      update: () => ({ set: () => ({ where: async () => {} }) }),
    };
    return db as unknown as AppEnv["Variables"]["db"];
  }

  function appWithDb(db: AppEnv["Variables"]["db"]) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", ORGANIZER);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);
    return app;
  }

  function postRequest(body: unknown) {
    return new Request("http://local/api/v1/events/event-1/submissions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    });
  }

  it("refuses a 201-char title, naming 'title' in error.fields", async () => {
    const db = fakeDb([[{ orgId: "org-a" }]]); // getEventOrgId (assertEventOwnership)
    const app = appWithDb(db);

    const res = await app.request(postRequest({ title: "x".repeat(LOCKED_TITLE_MAX_LENGTH + 1) }));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields).toHaveProperty("title");
  });

  it(`refuses a ${LOCKED_ABSTRACT_MAX_LENGTH + 1}-char description, naming 'description' in error.fields`, async () => {
    const db = fakeDb([[{ orgId: "org-a" }]]); // getEventOrgId (assertEventOwnership)
    const app = appWithDb(db);

    const res = await app.request(
      postRequest({ title: "OK Title", description: "x".repeat(LOCKED_ABSTRACT_MAX_LENGTH + 1) }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields).toHaveProperty("description");
  });

  it(`accepts a title exactly LOCKED_TITLE_MAX_LENGTH (${LOCKED_TITLE_MAX_LENGTH}) chars`, async () => {
    const detailRow = {
      id: "sub-new",
      eventId: "event-1",
      formId: null,
      seq: 1,
      title: "x".repeat(LOCKED_TITLE_MAX_LENGTH),
      description: null,
      status: "pending",
      contentStatus: "pending",
      acceptedAt: null,
      icsSequence: 0,
      createdAt: new Date(1000),
      updatedAt: new Date(2000),
      recordPrefix: "TALK",
      orgId: "org-a",
      startDate: "2024-01-01",
      slotDay: null,
      slotStartMin: null,
      slotEndMin: null,
      slotRoomName: null,
    };
    const db = fakeDb([
      [{ orgId: "org-a" }], // getEventOrgId (assertEventOwnership)
      [detailRow], // getSubmissionDetail: submission+event
      [], // participants
      [], // tracks
      [], // answers
    ]);
    const app = appWithDb(db);

    const res = await app.request(postRequest({ title: "x".repeat(LOCKED_TITLE_MAX_LENGTH) }));

    // Not a 400 for length reasons -- the point pinned here is that the
    // LENGTH validation itself does not reject the exact-boundary value.
    expect(res.status).not.toBe(400);
  });
});

describe("PATCH /api/v1/submissions/:id refuses over-budget title/description (DEC-124)", () => {
  const ORG_A = "org-a";
  const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
  const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  function fakeDb(selectQueue: unknown[][]) {
    let call = 0;
    const updates: unknown[] = [];
    const db = {
      select: () => {
        const rows = selectQueue[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
      update: () => ({
        set: (vals: unknown) => ({
          where: async () => {
            updates.push(vals);
          },
        }),
      }),
      insert: () => ({ values: async () => {} }),
    };
    return { db: db as unknown as AppEnv["Variables"]["db"], updates };
  }

  function appWithDb(db: AppEnv["Variables"]["db"]) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", ORGANIZER_A);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);
    return app;
  }

  function patchRequest(body: unknown) {
    return new Request("http://local/api/v1/submissions/sub-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    });
  }

  it("refuses a 201-char title, naming 'title' in error.fields", async () => {
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A]]); // getSubmissionOwnership
    const app = appWithDb(db);

    const res = await app.request(patchRequest({ title: "x".repeat(LOCKED_TITLE_MAX_LENGTH + 1) }));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields).toHaveProperty("title");
    expect(updates).toHaveLength(0);
  });

  it(`refuses a ${LOCKED_ABSTRACT_MAX_LENGTH + 1}-char description, naming 'description' in error.fields`, async () => {
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A]]); // getSubmissionOwnership
    const app = appWithDb(db);

    const res = await app.request(
      patchRequest({ description: "x".repeat(LOCKED_ABSTRACT_MAX_LENGTH + 1) }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields).toHaveProperty("description");
    expect(updates).toHaveLength(0);
  });
});
