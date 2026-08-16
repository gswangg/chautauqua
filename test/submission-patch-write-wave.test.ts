// DEC-155 (wave-68 amendment, P1-PERF): PATCH /api/v1/submissions/:id's
// write phase collapses seven sequential awaits into two waves. This file
// asserts the SHAPE of that collapse against a fake db that records
// statement order, without asserting any timing/perf number (a code read is
// not a measurement — docs/eval-findings/02-standing-rules.md).
/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { AS_SUBMITTED_EDITOR } from "../src/server/repo/revisions";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const DETAIL_ROW = {
  id: "sub-1",
  eventId: "event-1",
  formId: null,
  seq: 1,
  title: "Old Title",
  description: "Old description",
  trackId: null,
  status: "pending",
  contentStatus: "pending",
  acceptedAt: null,
  icsSequence: 0,
  createdAt: new Date(1000),
  updatedAt: new Date(2000),
  recordPrefix: "TALK",
  orgId: ORG_A,
  startDate: "2024-01-01",
  slotDay: null,
  slotStartMin: null,
  slotEndMin: null,
  slotRoomName: null,
};

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

/** Labels an update/insert/delete write call by inspecting the target table
 * and the values passed, so the test can assert relative ORDER of specific
 * writes without depending on internal call counts. */
function labelWrite(kind: "update" | "insert" | "delete", table: unknown, vals: unknown): string {
  if (table === schema.submission) {
    if (kind !== "update") throw new Error(`unexpected ${kind} on submission`);
    const v = vals as Record<string, unknown>;
    if ("icsSequence" in v) return "ics:bump";
    if ("title" in v || "description" in v) return "fields:update";
    return "tracks:touch";
  }
  if (table === schema.submissionRevision) {
    if (kind !== "insert") throw new Error(`unexpected ${kind} on submissionRevision`);
    const v = vals as { editorName: string };
    return v.editorName === AS_SUBMITTED_EDITOR ? "revision:baseline" : "revision:append";
  }
  if (table === schema.submissionTrack) {
    return kind === "delete" ? "tracks:delete" : "tracks:insert";
  }
  if (table === schema.submissionAnswer) {
    return kind === "delete" ? "answer:delete" : "answer:upsert";
  }
  throw new Error(`labelWrite: unrecognized table for ${kind}`);
}

/** fakeDb records every select (consumed positionally from selectQueue, same
 * convention as test/api-submissions.test.ts) AND every write (update /
 * insert / delete) into one shared, ordered `log` array, tagged with a
 * descriptive label. Because each repo write function's very first
 * statement is its own `await db.<verb>(...)`, and JS evaluates an array of
 * async-function calls left-to-right (each call runs synchronously up to
 * its first await, and `await`ing a thenable invokes that thenable's
 * `.then` synchronously as part of the await), writes issued in the same
 * settleInDeclarationOrder wave land in `log` in declaration order. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const log: string[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      log.push(`select:${call - 1}`);
      return makeChain(rows);
    },
    update: (table: unknown) => ({
      set: (vals: unknown) => ({
        where: () => ({
          then: (resolve: (v: undefined) => void) => {
            log.push(labelWrite("update", table, vals));
            resolve(undefined);
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const row = Array.isArray(vals) ? vals[0] : vals;
        return {
          then: (resolve: (v: undefined) => void) => {
            log.push(labelWrite("insert", table, row));
            resolve(undefined);
          },
          onConflictDoUpdate: () => ({
            then: (resolve: (v: undefined) => void) => {
              log.push(labelWrite("insert", table, row));
              resolve(undefined);
            },
          }),
        };
      },
    }),
    delete: (table: unknown) => ({
      where: () => ({
        then: (resolve: (v: undefined) => void) => {
          log.push(labelWrite("delete", table, undefined));
          resolve(undefined);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], log };
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

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/submissions/:id write-phase wave collapse (DEC-155 wave-68)", () => {
  it("(1) a title+description edit issues the baseline revision before the appended revision", async () => {
    const { db, log } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ title: "Old Title", description: "Old description" }], // getSubmissionContent
      [{ email: "organizer@example.com", contactId: null }], // resolveActorName
      [{ count: 0 }], // countRevisions (ensureBaselineRevision: no revisions yet -> baseline fires)
      [{ ...DETAIL_ROW, title: "New Title", description: "New description" }], // getSubmissionDetail main row
      [], // participants
      [], // tracks
      [], // answers
      [], // answerFiles
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/submissions/sub-1", { title: "New Title", description: "New description" }),
    );

    expect(res.status).toBe(200);
    const baselineIdx = log.indexOf("revision:baseline");
    const appendIdx = log.indexOf("revision:append");
    expect(baselineIdx).toBeGreaterThanOrEqual(0);
    expect(appendIdx).toBeGreaterThanOrEqual(0);
    expect(baselineIdx).toBeLessThan(appendIdx);
  });

  it("(2) getSubmissionDetail's read is the last statement — no write follows it", async () => {
    const { db, log } = fakeDb([
      [SUBMISSION_ORG_A],
      [{ title: "Old Title", description: "Old description" }],
      [{ email: "organizer@example.com", contactId: null }],
      [{ count: 0 }],
      [{ ...DETAIL_ROW, title: "New Title", description: "New description" }],
      [],
      [],
      [],
      [],
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/submissions/sub-1", { title: "New Title", description: "New description" }),
    );

    expect(res.status).toBe(200);
    const writeLabels = ["fields:update", "revision:baseline", "revision:append", "ics:bump", "tracks:insert", "tracks:delete", "tracks:touch", "answer:upsert", "answer:delete"];
    const lastWriteIdx = Math.max(...writeLabels.map((l) => log.lastIndexOf(l)).filter((i) => i >= 0));
    // getSubmissionDetail is the FIRST select whose index is >= the number
    // of selects issued in the pre-write read wave (4: ownership, content,
    // resolveActorName, countRevisions). Every select from that point on
    // (detail main row + its participants/tracks/answers/answerFiles
    // sub-queries) must come after every write.
    const detailSelects = log.filter((l) => l.startsWith("select:")).slice(4);
    expect(detailSelects.length).toBeGreaterThan(0);
    const firstDetailSelectIdx = log.indexOf(detailSelects[0]!);
    expect(firstDetailSelectIdx).toBeGreaterThan(lastWriteIdx);
  });

  it("(3) a title-only PATCH with an unchanged value issues no track/answer/revision/ics writes", async () => {
    const { db, log } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ title: "Old Title", description: "Old description" }], // getSubmissionContent (title patched to the SAME value)
      [{ email: "organizer@example.com", contactId: null }], // resolveActorName (hoisted whenever title is supplied)
      [{ ...DETAIL_ROW }], // getSubmissionDetail main row
      [], // participants
      [], // tracks
      [], // answers
      [], // answerFiles
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1", { title: "Old Title" }));

    expect(res.status).toBe(200);
    expect(log).toContain("fields:update");
    for (const forbidden of [
      "revision:baseline",
      "revision:append",
      "ics:bump",
      "tracks:insert",
      "tracks:delete",
      "tracks:touch",
      "answer:upsert",
      "answer:delete",
    ]) {
      expect(log).not.toContain(forbidden);
    }
  });

  it("(4) the 200 body is byte-identical in shape to the pre-collapse response for the same input", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A],
      [{ title: "Old Title", description: "Old description" }],
      [{ email: "organizer@example.com", contactId: null }],
      [{ count: 1 }], // already has a baseline revision
      [{ ...DETAIL_ROW, title: "New Title", description: "New description" }],
      [],
      [],
      [],
      [],
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/submissions/sub-1", { title: "New Title", description: "New description" }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json).toEqual({
      id: "sub-1",
      eventId: "event-1",
      ref: "TALK-001",
      title: "New Title",
      description: "New description",
      status: "pending",
      contentStatus: "pending",
      trackIds: [],
      formId: null,
      // acceptedAt/icsSequence left this wire shape under DEC-851's wave-5
      // amendment (an unread wire field is a lie) -- the DB columns are
      // untouched, so the fixture row above still carries them.
      createdAt: 1000,
      updatedAt: 2000,
      participants: [],
      answers: {},
      answerFiles: [],
      slot: null,
      reuploaded: false,
    });
  });
});
