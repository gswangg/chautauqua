// DEC-598 (task w3-h, closes CNT-D6): PATCH /api/v1/submissions/:id gains an
// optional trackIds full-set replace, validated against the event's own
// tracks and applied through the same submission_track writer
// (replaceSubmissionTracks in src/server/repo/submit.ts) portal-edit uses.
// Mirrors test/submission-revisions.test.ts's fake-db pattern (no wrangler/D1
// harness exists in stage 1 unit tests) but adds delete() support since
// replaceSubmissionTracks issues a delete before its insert.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    $dynamic: () => chain,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: any[] = [];
  const inserts: any[] = [];
  const deletes: any[] = [];
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
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        inserts.push({ table, vals });
      },
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push(table);
      },
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], updates, inserts, deletes };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

const EVENT_TRACKS = [
  { id: "t1", name: "Track One" },
  { id: "t2", name: "Track Two" },
  { id: "t3", name: "Track Three" },
];

const DETAIL_ROW = {
  id: "sub-1",
  eventId: "event-1",
  formId: null,
  seq: 1,
  title: "T",
  description: "D",
  trackId: null,
  status: "pending",
  contentStatus: "pending",
  acceptedAt: null,
  icsSequence: 0,
  createdAt: new Date(1000),
  updatedAt: new Date(2000),
  recordPrefix: "TALK",
};

describe("PATCH /api/v1/submissions/:id trackIds (DEC-598, closes CNT-D6)", () => {
  it("replaces the full track set in one call — adds t2/t3 and drops t1", async () => {
    const { db, deletes, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      EVENT_TRACKS, // getEventTracks (validation)
      [{ title: "T", description: "D" }], // getSubmissionContent (before)
      [DETAIL_ROW], // getSubmissionDetail: submission+event
      [], // participants
      [{ trackId: "t2" }, { trackId: "t3" }], // tracks (post-replace, as if committed)
      [], // answers
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { trackIds: ["t2", "t3"] }),
    );

    expect(res.status).toBe(200);
    // The full-set replace deletes every existing submission_track row, then
    // inserts exactly the new set — never a diff of adds/removes.
    expect(deletes).toHaveLength(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toEqual([
      { submissionId: "sub-1", trackId: "t2", createdAt: expect.any(Date) },
      { submissionId: "sub-1", trackId: "t3", createdAt: expect.any(Date) },
    ]);

    const json = (await res.json()) as any;
    expect(json.trackIds).toEqual(["t2", "t3"]);
  });

  it("removes every track when trackIds is an empty array (a full-set replace, not a no-op)", async () => {
    const { db, deletes, inserts } = fakeDb([
      [SUBMISSION_ORG_A],
      EVENT_TRACKS,
      [{ title: "T", description: "D" }],
      [DETAIL_ROW],
      [],
      [], // no tracks left
      [],
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { trackIds: [] }),
    );

    expect(res.status).toBe(200);
    expect(deletes).toHaveLength(1);
    // Nothing to insert for an empty replacement set.
    expect(inserts).toHaveLength(0);
  });

  it("400s an unknown track id with a fields entry, never a silent drop", async () => {
    const { db, deletes, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      EVENT_TRACKS, // getEventTracks (validation) — "not-a-real-track" isn't in this set
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { trackIds: ["t1", "not-a-real-track"] }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("trackIds");
    // Rejected outright — no partial write.
    expect(deletes).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("403s a cross-org caller before ever touching tracks", async () => {
    const { db, deletes, inserts } = fakeDb([
      [{ eventId: "event-1", orgId: "org-b" }], // getSubmissionOwnership — belongs to a different org
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { trackIds: ["t1"] }),
    );

    expect(res.status).toBe(403);
    expect(deletes).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });
});
