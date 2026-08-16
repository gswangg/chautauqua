// AIA-07 / DEC-155: explicit publish affordance for the agenda. No draft
// state — publish just returns { placed, public, heldBack } (DEC-595: the
// public count runs through src/server/repo/public/gates.ts's
// visibleSessionConditions(), the SAME predicate every other gated read
// uses) and lets the global bumpPublicVersionMiddleware (src/server/
// pubcache.ts) do the actual purge, matching the established pattern in
// src/routes/api/submissions.ts's PATCH /submissions/:id (no separate
// purge call in the route handler itself). A minimal fake db stands in for
// D1 (see test/agenda-room-ownership.test.ts for the established pattern).
// See test/agenda-publish-counts.test.ts for the heldBack > 0 case.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { agendaRoutes } from "../src/routes/agenda";
import { registerErrorHandler } from "../src/server/http";
import { bumpPublicVersionMiddleware, readPublicVersion } from "../src/server/pubcache";
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
    kv,
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

describe("POST /events/:eventId/agenda/publish (AIA-07, DEC-155)", () => {
  const organizer: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  const eventRow = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

  it("200s with { placed, public, heldBack } counting through the same public gate, and purges the public cache", async () => {
    const harness = appWithDb(organizer, [
      [eventRow], // getEventInfo
      [], // rooms
      [], // tracks
      [
        { id: "sub1", seq: 1, title: "Talk 1" },
        { id: "sub2", seq: 2, title: "Talk 2" },
      ], // submissionRows (accepted)
      // DEC-557 wave-69 amendment: listBreaksForEvent joined getAgendaPayload's
      // rooms/tracks/accepted Promise.all wave as its 4th member, so its
      // db.select() lands here — ahead of loadAcceptedSessions' own internal
      // trackRows/participantRows/slotRows batch. Empty: no breaks, so no
      // break_overlap conflicts, and the publish counts are unchanged.
      [], // scheduleBreak (listBreaksForEvent)
      [], // trackRows batch
      [], // participantRows batch
      [
        { submissionId: "sub1", roomId: "room1", day: "2026-08-10", startMin: 540, endMin: 600 },
      ], // slotRows batch — only sub1 is placed
      [{ id: "sub1" }], // countPubliclyVisible — sub1 passes the public gate
    ]);

    const before = await readPublicVersion(harness.kv);
    const res = await postPublish(harness);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { placed: number; public: number; heldBack: number };
    expect(body.placed).toBe(1);
    expect(body.public).toBe(1);
    expect(body.heldBack).toBe(0);

    const after = await readPublicVersion(harness.kv);
    expect(after).not.toBe(before);
  });

  it("404s when the event doesn't exist", async () => {
    const harness = appWithDb(organizer, [[]]);
    const res = await postPublish(harness);
    expect(res.status).toBe(404);
  });

  it("404s when the event belongs to a different org (existence-hiding, never 403)", async () => {
    const harness = appWithDb(organizer, [[{ ...eventRow, orgId: "org-other" }]]);
    const res = await postPublish(harness);
    expect(res.status).toBe(404);
  });

  it("403s for a reviewer (organizer-only)", async () => {
    const reviewer: AuthInfo = { userId: "u2", role: "reviewer", orgId: "org1" };
    const harness = appWithDb(reviewer, [[eventRow]]);
    const res = await postPublish(harness);
    expect(res.status).toBe(403);
  });

  it("403s for a speaker (organizer-only)", async () => {
    const speaker: AuthInfo = { userId: "u3", role: "speaker", orgId: "org1" };
    const harness = appWithDb(speaker, [[eventRow]]);
    const res = await postPublish(harness);
    expect(res.status).toBe(403);
  });
});
