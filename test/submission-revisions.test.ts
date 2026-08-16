// CNT-11 / DEC-158 (task w3-b): session content version history + restore.
// Covers both write paths that append submission_revision rows (organizer
// PATCH /submissions/:id and portal-edit's locked-field sync), the
// GET/POST(restore) endpoints, and org-scoped 404s (no IDOR).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { saveSubmissionEdits } from "../src/server/repo/portal-edit";

// ---------------------------------------------------------------------------
// Select-queue fake db (mirrors test/api-submissions.test.ts's pattern: no
// wrangler/D1 harness exists in stage 1 unit tests).
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
      leftJoin: () => chain,
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
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], updates, inserts };
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

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };
const SPEAKER_A: AuthInfo = { userId: "u-speaker-a", role: "speaker", orgId: ORG_A, contactId: "contact-1" };

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
  orgId: ORG_A,
  startDate: "2024-01-01",
};

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function postRequest(path: string, body?: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("PATCH /api/v1/submissions/:id appends submission_revision rows (DEC-158)", () => {
  it("the first edit of a never-edited submission also stamps a baseline (AS_SUBMITTED_EDITOR) row", async () => {
    // Edit 1: "Old Title"/"Old description" -> "Edit One Title"/"Edit one description".
    // countRevisions reports 0 -> ensureBaselineRevision fires.
    const { db: db1, inserts: inserts1 } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ title: "Old Title", description: "Old description", createdAt: new Date(500) }], // getSubmissionContent (before)
      [{ count: 0 }], // countRevisions (ensureBaselineRevision)
      [{ email: "organizer@example.com", contactId: null }], // resolveActorName
      [{ ...DETAIL_ROW, title: "Edit One Title", description: "Edit one description" }], // getSubmissionDetail
      [], // participants
      [], // tracks
      [], // answers
    ]);
    const res1 = await appWithDbAndAuth(db1, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { title: "Edit One Title", description: "Edit one description" }),
    );
    expect(res1.status).toBe(200);
    expect(inserts1).toHaveLength(2);
    expect(inserts1[0].vals).toMatchObject({
      submissionId: "sub-1",
      editorUserId: null,
      editorName: "As submitted",
      title: "Old Title",
      description: "Old description",
      createdAt: new Date(500),
    });
    expect(inserts1[1].vals).toMatchObject({
      submissionId: "sub-1",
      editorUserId: "u-organizer-a",
      editorName: "organizer@example.com",
      title: "Edit One Title",
      description: "Edit one description",
    });

    // Edit 2: "Edit One Title" -> "Edit Two Title". countRevisions now
    // reports 1 (baseline + edit-1 already exist) -> no second baseline.
    const { db: db2, inserts: inserts2 } = fakeDb([
      [SUBMISSION_ORG_A],
      [{ title: "Edit One Title", description: "Edit one description", createdAt: new Date(500) }],
      [{ count: 2 }], // countRevisions
      [{ email: "organizer@example.com", contactId: null }],
      [{ ...DETAIL_ROW, title: "Edit Two Title", description: "Edit two description" }],
      [],
      [],
      [],
    ]);
    const res2 = await appWithDbAndAuth(db2, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { title: "Edit Two Title", description: "Edit two description" }),
    );
    expect(res2.status).toBe(200);
    expect(inserts2).toHaveLength(1);
    expect(inserts2[0].vals).toMatchObject({
      title: "Edit Two Title",
      description: "Edit two description",
    });
  });

  it("a PATCH with no actual title/description change appends nothing", async () => {
    const { db, inserts, updates } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ title: "Same Title", description: "Same description" }], // getSubmissionContent (before)
      [{ ...DETAIL_ROW, title: "Same Title", description: "Same description" }], // getSubmissionDetail
      [], // participants
      [], // tracks
      [], // answers
    ]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { title: "Same Title", description: "Same description" }),
    );
    expect(res.status).toBe(200);
    // The PATCH still runs its update (fail-loud contract: an explicit
    // no-diff PATCH isn't rejected), but no history row is appended.
    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(0);
  });
});

describe("GET /api/v1/submissions/:id/revisions (DEC-158)", () => {
  it("returns a standard list envelope, organizer-only", async () => {
    const items = [
      { id: "rev-2", editorName: "organizer@example.com", title: "Edit Two Title", description: "d2", createdAt: new Date(2000) },
      { id: "rev-1", editorName: "organizer@example.com", title: "Edit One Title", description: "d1", createdAt: new Date(1000) },
    ];
    const { db } = fakeDb([[SUBMISSION_ORG_A], items, [{ count: 2 }]]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/revisions"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json).toMatchObject({ total: 2, page: 1, perPage: 200 });
    expect(json.items).toHaveLength(2);
  });

  it("403s a speaker caller", async () => {
    const { db } = fakeDb([]);
    const res = await appWithDbAndAuth(db, SPEAKER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/revisions"),
    );
    expect(res.status).toBe(403);
  });

  // DEC-460/461: the true row count (from countRevisions) is reported even
  // when the caller requests a perPage far beyond MAX_PER_PAGE — the bound
  // caps what's returned, not what's counted.
  it("caps perPage at 200 (MAX_PER_PAGE) and reports the true total", async () => {
    const items = [
      { id: "rev-1", editorName: "organizer@example.com", title: "T", description: "d", createdAt: new Date(1000) },
    ];
    const { db } = fakeDb([[SUBMISSION_ORG_A], items, [{ count: 500 }]]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/revisions?perPage=100000"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.perPage).toBe(200);
    expect(json.total).toBe(500);
  });
});

describe("POST /api/v1/submissions/:id/revisions/:revisionId/restore (DEC-158)", () => {
  it("reverts description while keeping the first edit's title, and appends a third row attributed to the restorer", async () => {
    // Current state (post edit-2): title "Edit Two Title", description "Edit two description".
    // Restoring rev-1 (title "Edit One Title", description "Edit one description").
    const { db, inserts, updates } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "rev-1", editorName: "speaker@example.com", title: "Edit One Title", description: "Edit one description", createdAt: new Date(1000) }], // getRevision
      [{ title: "Edit Two Title", description: "Edit two description" }], // getSubmissionContent (before restore)
      [{ email: "restorer@example.com", contactId: null }], // resolveActorName (restorer)
      [{ ...DETAIL_ROW, title: "Edit One Title", description: "Edit one description" }], // getSubmissionDetail
      [], // participants
      [], // tracks
      [], // answers
    ]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/submissions/sub-1/revisions/rev-1/restore"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.title).toBe("Edit One Title");
    expect(json.description).toBe("Edit one description");

    // DEC-519: a real content change also bumps ics_sequence (second update
    // call, on top of the title/description field update).
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ title: "Edit One Title", description: "Edit one description" });

    // The restore itself lands its own history row, attributed to the
    // restorer (not the original edit-1 author).
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toMatchObject({
      submissionId: "sub-1",
      editorUserId: "u-organizer-a",
      editorName: "restorer@example.com",
      title: "Edit One Title",
      description: "Edit one description",
    });
  });

  it("404s a revision id that doesn't belong to this submission (no IDOR)", async () => {
    const { db, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [], // getRevision: no row scoped to (submissionId, revisionId) -> null
    ]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/submissions/sub-1/revisions/not-mine/restore"),
    );
    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("403s a speaker caller (organizer-only)", async () => {
    const { db, inserts } = fakeDb([]);
    const res = await appWithDbAndAuth(db, SPEAKER_A).request(
      postRequest("/api/v1/submissions/sub-1/revisions/rev-1/restore"),
    );
    expect(res.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });

  // DEC-158 wave-59 amendment: restoring a revision whose content already
  // equals the current row (most commonly the newest one) is a guaranteed
  // no-op — refuse loudly instead of a silent unchanged 200.
  it("400s restoring a revision identical to the current content", async () => {
    const { db, inserts, updates } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "rev-2", editorName: "organizer@example.com", title: "Current Title", description: "Current description", createdAt: new Date(2000) }], // getRevision
      [{ title: "Current Title", description: "Current description" }], // getSubmissionContent (before)
    ]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/submissions/sub-1/revisions/rev-2/restore"),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.message).toBe("This version is identical to what is there now — nothing to restore.");
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Portal-edit locked-field sync also appends (DEC-158) — direct
// saveSubmissionEdits call, mirroring test/portal-edit-speaker-locked.test.ts's
// table-keyed fake db.
// ---------------------------------------------------------------------------

function makeTableFakeDb(data: {
  submissionRows: unknown[];
  contactRows: unknown[];
  revisionCountRows?: unknown[];
}) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.submission) return data.submissionRows;
    if (table === schema.contact) return data.contactRows;
    if (table === schema.submissionAnswer) return [];
    // countRevisions (ensureBaselineRevision) — default to "already has
    // revisions" so tests that don't care about the baseline path don't
    // have to supply this.
    if (table === schema.submissionRevision) return data.revisionCountRows ?? [{ count: 1 }];
    throw new Error("fake db: unexpected table in select");
  }

  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    select() {
      return { from: (table: unknown) => chainFor(rowsFor(table)) };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: () => {
              updates.push({ table, values });
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      };
    },
    delete() {
      throw new Error("fake db: delete not supported in this test");
    },
  };

  return { db: db as unknown as Db, updates, inserts };
}

describe("portal-edit locked-field sync appends a submission_revision (DEC-158)", () => {
  it("appends a row attributed to the speaker contact's full name when title/description change", async () => {
    const { db, inserts } = makeTableFakeDb({
      submissionRows: [{ title: "Old Title", description: "Old description" }],
      contactRows: [{ firstName: "Jane", lastName: "Doe" }],
    });

    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "New Title", description: "New description" },
      null,
      [],
    );

    const revisionInsert = inserts.find((i) => i.table === schema.submissionRevision);
    expect(revisionInsert).toBeDefined();
    expect(revisionInsert!.values).toMatchObject({
      submissionId: "s1",
      editorUserId: null,
      editorName: "Jane Doe",
      title: "New Title",
      description: "New description",
    });
  });

  it("also stamps a baseline row on a never-edited submission (DEC-158 wave-59)", async () => {
    const { db, inserts } = makeTableFakeDb({
      submissionRows: [{ title: "Old Title", description: "Old description", createdAt: new Date(700) }],
      contactRows: [{ firstName: "Jane", lastName: "Doe" }],
      revisionCountRows: [{ count: 0 }],
    });

    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "New Title", description: "New description" },
      null,
      [],
    );

    const revisionInserts = inserts.filter((i) => i.table === schema.submissionRevision);
    expect(revisionInserts).toHaveLength(2);
    expect(revisionInserts[0]!.values).toMatchObject({
      submissionId: "s1",
      editorUserId: null,
      editorName: "As submitted",
      title: "Old Title",
      description: "Old description",
      createdAt: new Date(700),
    });
    expect(revisionInserts[1]!.values).toMatchObject({
      editorName: "Jane Doe",
      title: "New Title",
      description: "New description",
    });
  });

  it("appends nothing when title/description don't actually change", async () => {
    const { db, inserts } = makeTableFakeDb({
      submissionRows: [{ title: "Same Title", description: "Same description" }],
      contactRows: [{ firstName: "Jane", lastName: "Doe" }],
    });

    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "Same Title", description: "Same description" },
      null,
      [],
    );

    expect(inserts.find((i) => i.table === schema.submissionRevision)).toBeUndefined();
  });
});
