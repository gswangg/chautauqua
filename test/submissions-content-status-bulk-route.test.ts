// w42-c (DEC-274): set-based content approval. POST
// /api/v1/events/:eventId/submissions/content-status mirrors
// updateSubmissionStatuses' shape — ONE UPDATE scoped by
// `submission.event_id = eventId AND submission.id IN (...)`. This test
// drives the real submissionsRoutes app (same fake-db recorder technique as
// test/submissions-status-parity.test.ts) and asserts that ids belonging to
// a DIFFERENT event never get written: updateContentStatuses' full-set
// guard (mirroring updateSubmissionStatuses) throws loudly naming the
// unknown ids rather than silently updating the subset that does match, so
// the route surfaces a 400 and issues no UPDATE at all.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ID = "event-1";
const ORG_ID = "org-1";
const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_ID };

// Generic fake db recorder (same pattern as
// test/submissions-status-parity.test.ts): each queued select() response is
// consumed in order; every update() call is recorded but never queued.
function makeFakeDb(selectResponses: unknown[][], updateCalls: { setValue: unknown }[]) {
  let cursor = 0;
  function selectChain(): any {
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "groupBy"];
    for (const m of passthrough) obj[m] = (..._args: unknown[]) => obj;
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = selectResponses[cursor];
      cursor += 1;
      if (value === undefined) {
        return Promise.reject(new Error(`fake db: no queued select response for query #${cursor}`)).catch(
          (e) => (reject ? reject(e) : Promise.reject(e)),
        );
      }
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return {
    select: () => selectChain(),
    update: (_table: unknown) => ({
      set: (setValue: unknown) => ({
        where: async () => {
          updateCalls.push({ setValue });
        },
      }),
    }),
  } as unknown as AppEnv["Variables"]["db"];
}

function app(db: AppEnv["Variables"]["db"]) {
  const honoApp = new Hono<AppEnv>();
  registerErrorHandler(honoApp);
  honoApp.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", AUTH);
    await next();
  });
  honoApp.route("/api/v1", submissionsRoutes);
  return honoApp;
}

describe("POST /events/:eventId/submissions/content-status (w42-c/DEC-274)", () => {
  it("refuses ids belonging to another event: 400, names the unknown id, and issues no UPDATE", async () => {
    const updateCalls: { setValue: unknown }[] = [];
    const db = makeFakeDb(
      [
        [{ orgId: ORG_ID }], // assertEventOwnership: getEventOrgId
        [], // updateContentStatuses' found-ids select — the requested id belongs to a different event, so it never matches this event's scope
      ],
      updateCalls,
    );

    const res = await app(db).request(`/api/v1/events/${EVENT_ID}/submissions/content-status`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["other-event-sub-1"], contentStatus: "approved" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.fields?.ids ?? body.error.message).toContain("other-event-sub-1");
    expect(updateCalls).toHaveLength(0);
  });

  it("accepts a request scoped entirely to this event and posts a set-based update, once", async () => {
    const updateCalls: { setValue: unknown }[] = [];
    const db = makeFakeDb(
      [
        [{ orgId: ORG_ID }], // assertEventOwnership
        [{ id: "sub-1" }, { id: "sub-2" }], // both ids found under this event
      ],
      updateCalls,
    );

    const res = await app(db).request(`/api/v1/events/${EVENT_ID}/submissions/content-status`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["sub-1", "sub-2"], contentStatus: "approved" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { updated: number };
    expect(body.updated).toBe(2);
    // ONE update statement for the whole batch — never a per-row loop.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.setValue).toMatchObject({ contentStatus: "approved" });
  });
});
