// DEC-595: publish must report the truth — the publicly-visible subset of
// placed sessions, not just the placement count (AIA-S2-D1: the toast said
// "5 sessions public" while the public agenda rendered 4, because
// `published` was payload.placed.length, a placement count never run
// through src/server/repo/public/gates.ts's visibleSessionConditions()).
// This suite asserts POST /events/:eventId/agenda/publish computes `public`
// through that SAME gate (imported, not re-derived) and reports the gap as
// `heldBack`. See test/agenda-publish.test.ts for the base 200/403/404
// contract tests.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { agendaRoutes } from "../src/routes/agenda";
import { registerErrorHandler } from "../src/server/http";
import { bumpPublicVersionMiddleware } from "../src/server/pubcache";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";

class InMemoryKV implements KVStore {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function appWithDb(auth: AuthInfo | null, selects: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selects[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.use("*", bumpPublicVersionMiddleware);
  app.route("/", agendaRoutes);

  const kv = new InMemoryKV();
  const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

function postPublish(harness: ReturnType<typeof appWithDb>, eventId = "event1") {
  return harness.request(`/events/${eventId}/agenda/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: "{}",
  });
}

describe("POST /events/:eventId/agenda/publish — truthful counts (DEC-595)", () => {
  const organizer: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  const eventRow = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-14", recordPrefix: "EV" };

  it("reports placed=N, public=N-1, heldBack=1 when one placed session is not content-approved", async () => {
    const harness = appWithDb(organizer, [
      [eventRow], // getEventInfo
      [], // rooms
      [], // tracks
      [
        { id: "sub1", seq: 1, title: "Talk 1" },
        { id: "sub2", seq: 2, title: "Talk 2" },
      ], // submissionRows (accepted)
      [], // trackRows batch
      [], // participantRows batch
      [
        { submissionId: "sub1", roomId: "room1", day: "2026-08-10", startMin: 540, endMin: 600 },
        { submissionId: "sub2", roomId: "room1", day: "2026-08-10", startMin: 600, endMin: 660 },
      ], // slotRows batch — both placed
      // countPubliclyVisible: only sub1 passes visibleSessionConditions()
      // (sub2 is placed but content_status != 'approved')
      [{ id: "sub1" }],
    ]);

    const res = await postPublish(harness);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      placed: number;
      public: number;
      heldBack: number;
      heldBackSessions: { submissionId: string; title: string }[];
    };
    expect(body.placed).toBe(2);
    expect(body.public).toBe(1);
    expect(body.heldBack).toBe(1);
    // DEC-595 wave-67 amendment: the receipt names the withheld session, not
    // just its count.
    expect(body.heldBackSessions).toEqual([{ submissionId: "sub2", title: "Talk 2" }]);
  });

  it("reports heldBack=0 when every placed session is publicly visible", async () => {
    const harness = appWithDb(organizer, [
      [eventRow], // getEventInfo
      [], // rooms
      [], // tracks
      [
        { id: "sub1", seq: 1, title: "Talk 1" },
        { id: "sub2", seq: 2, title: "Talk 2" },
      ], // submissionRows (accepted)
      [], // trackRows batch
      [], // participantRows batch
      [
        { submissionId: "sub1", roomId: "room1", day: "2026-08-10", startMin: 540, endMin: 600 },
        { submissionId: "sub2", roomId: "room1", day: "2026-08-10", startMin: 600, endMin: 660 },
      ], // slotRows batch — both placed
      // countPubliclyVisible: both pass the gate
      [{ id: "sub1" }, { id: "sub2" }],
    ]);

    const res = await postPublish(harness);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      placed: number;
      public: number;
      heldBack: number;
      heldBackSessions: { submissionId: string; title: string }[];
    };
    expect(body.placed).toBe(2);
    expect(body.public).toBe(2);
    expect(body.heldBack).toBe(0);
    expect(body.heldBackSessions).toEqual([]);
  });
});
