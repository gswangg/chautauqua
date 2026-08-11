/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  chunkIds,
  isValidStatusLiteral,
  listSubmissions,
  parseListQuery,
  sortSubmissionRows,
  SORT_ORDERS,
} from "../src/server/repo/submissions";
import { changeStatus } from "../src/domain/status";
import { planAcceptance } from "../src/domain/acceptance";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

describe("parseListQuery (DEC-013 pagination + DEC-016 filters)", () => {
  it("defaults page=1, perPage=50, sort=newest, includeAnswers=false", () => {
    expect(parseListQuery({})).toEqual({
      page: 1,
      perPage: 50,
      q: null,
      status: [],
      trackId: null,
      sort: "newest",
      includeAnswers: false,
    });
  });

  it("parses page/perPage, clamping perPage to 200", () => {
    expect(parseListQuery({ page: "3", perPage: "500" })).toMatchObject({ page: 3, perPage: 200 });
  });

  it("falls back to defaults for non-positive or non-integer page/perPage", () => {
    expect(parseListQuery({ page: "0", perPage: "-5" })).toMatchObject({ page: 1, perPage: 50 });
    expect(parseListQuery({ page: "abc" })).toMatchObject({ page: 1 });
  });

  it("trims q and treats blank q as absent", () => {
    expect(parseListQuery({ q: "  hello  " }).q).toBe("hello");
    expect(parseListQuery({ q: "   " }).q).toBeNull();
  });

  it("parses comma-separated status, dropping unknown literals", () => {
    expect(parseListQuery({ status: "pending,accepted" }).status).toEqual(["pending", "accepted"]);
    expect(parseListQuery({ status: "pending,bogus,declined" }).status).toEqual(["pending", "declined"]);
  });

  it("parses all four DEC-016 sorts and falls back to newest", () => {
    for (const sort of SORT_ORDERS) {
      expect(parseListQuery({ sort }).sort).toBe(sort);
    }
    expect(parseListQuery({ sort: "bogus" }).sort).toBe("newest");
  });

  it("reads trackId and includeAnswers=1", () => {
    expect(parseListQuery({ trackId: "t1" }).trackId).toBe("t1");
    expect(parseListQuery({ includeAnswers: "1" }).includeAnswers).toBe(true);
    expect(parseListQuery({ includeAnswers: "true" }).includeAnswers).toBe(false);
  });
});

describe("isValidStatusLiteral (DEC-003 literals, write-path validation)", () => {
  it("accepts exactly the five DEC-003 literals", () => {
    for (const s of ["pending", "accept_queue", "decline_queue", "accepted", "declined"]) {
      expect(isValidStatusLiteral(s)).toBe(true);
    }
  });

  it("rejects unknown strings, non-strings, and undefined", () => {
    expect(isValidStatusLiteral("approved")).toBe(false);
    expect(isValidStatusLiteral(123)).toBe(false);
    expect(isValidStatusLiteral(undefined)).toBe(false);
    expect(isValidStatusLiteral(null)).toBe(false);
  });
});

describe("DEC-009 acceptance idempotence guard (pure logic, exercised via the domain cores this module composes)", () => {
  it("fires acceptance exactly once across repeated transitions into 'accepted'", () => {
    const now = 1000;
    const first = changeStatus({ status: "pending", acceptedAt: null }, "accepted", now);
    expect(first.fireAcceptance).toBe(true);
    expect(first.acceptedAt).toBe(now);

    // Re-running with the persisted acceptedAt (simulating a retry / re-accept).
    const second = changeStatus({ status: "accepted", acceptedAt: first.acceptedAt }, "accepted", now + 500);
    expect(second.fireAcceptance).toBe(false);
    expect(second.acceptedAt).toBe(now); // unchanged, never re-stamped

    // Un-accept then re-accept: still guarded because acceptedAt was never cleared.
    const declined = changeStatus({ status: "accepted", acceptedAt: first.acceptedAt }, "declined", now + 1000);
    expect(declined.acceptedAt).toBe(now);
    const reaccepted = changeStatus({ status: "declined", acceptedAt: declined.acceptedAt }, "accepted", now + 2000);
    expect(reaccepted.fireAcceptance).toBe(false);
  });

  it("planAcceptance is idempotent when re-run with previously-planned titles folded in", () => {
    const input = {
      submissionId: "s1",
      eventId: "e1",
      participantContactIds: ["c1"],
      existingTaskTitlesByContact: {},
    };
    const first = planAcceptance(input);
    expect(first.taskAssignments.length).toBeGreaterThan(0);

    const existingTaskTitlesByContact: Record<string, string[]> = {
      c1: first.taskAssignments.map((a) => a.taskTitle),
    };
    const second = planAcceptance({ ...input, existingTaskTitlesByContact });
    expect(second.taskAssignments).toEqual([]);
  });
});

describe("chunkIds (D1 bound-parameter batching for list-page enrichment queries)", () => {
  it("returns a single batch for input under the chunk size", () => {
    expect(chunkIds(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("splits into batches of at most 90 (DEC-078), preserving order and every id", () => {
    const ids = Array.from({ length: 91 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.length).toBe(2);
    expect(batches[0]!.length).toBe(90);
    expect(batches[1]!.length).toBe(1);
    expect(batches.flat()).toEqual(ids);
  });

  it("handles an exact multiple of the chunk size without a trailing empty batch", () => {
    const ids = Array.from({ length: 180 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.length).toBe(2);
    expect(batches.every((b) => b.length === 90)).toBe(true);
  });
});

describe("sortSubmissionRows (JS mirror of orderByForSort, used by the batched allowedIds fallback)", () => {
  const rows = [
    { id: "a", title: "Beta talk", seq: 3, createdAt: new Date("2026-01-02T00:00:00Z") },
    { id: "b", title: "Alpha talk", seq: 1, createdAt: new Date("2026-01-03T00:00:00Z") },
    { id: "c", title: "Gamma talk", seq: 2, createdAt: new Date("2026-01-01T00:00:00Z") },
  ];

  it("sorts newest (default) by createdAt desc", () => {
    expect(sortSubmissionRows(rows, "newest").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts oldest by createdAt asc", () => {
    expect(sortSubmissionRows(rows, "oldest").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts title alphabetically", () => {
    expect(sortSubmissionRows(rows, "title").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts ref by seq ascending", () => {
    expect(sortSubmissionRows(rows, "ref").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...rows];
    sortSubmissionRows(rows, "title");
    expect(rows).toEqual(copy);
  });
});

// Regression for the w8-c walkthrough's out-of-area defect: the q/trackId
// `allowedIds` inArray narrowing folded a single, unbatched id list into
// the main paginated query — same unbatched-inArray shape as the per-page
// enrichment queries chunkIds already fixes, and it would hit the same D1
// "too many SQL variables" ceiling once a filter matched >100 submissions
// in one event. Exercises listSubmissions' batched fallback end-to-end
// against a fake db double (no wrangler/D1 dependency in stage 1 unit
// tests) with 150 track-matching candidate ids.
describe("listSubmissions: batched allowedIds fallback (>ID_CHUNK_SIZE track matches)", () => {
  function makeFakeDb(responses: unknown[]) {
    let cursor = 0;
    function chain(): any {
      const obj: any = {};
      const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select"];
      for (const m of passthrough) obj[m] = () => obj;
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    return { select: () => chain() } as any;
  }

  it("returns correctly sorted+paginated results without a single unbatched inArray over all matches", async () => {
    const TRACK_ID = "track-1";
    const EVENT_ID = "event-1";
    const matchIds = Array.from({ length: 150 }, (_, i) => `sub-${String(i).padStart(3, "0")}`);

    function submissionRow(id: string, i: number) {
      return {
        id,
        title: `Talk ${id}`,
        seq: i,
        createdAt: new Date(2026, 0, 1, 0, 0, i),
        updatedAt: new Date(2026, 0, 1),
        eventId: EVENT_ID,
        description: null,
        formId: null,
        trackId: TRACK_ID,
        additionalTrackIdsJson: null,
        status: "submitted",
        contentStatus: "unset",
        acceptedAt: null,
        icsSequence: 0,
      };
    }
    const allRows = matchIds.map((id, i) => submissionRow(id, i));

    // Response queue mirrors listSubmissions' call order for this scenario
    // (q unset, trackId set, status unset, includeAnswers false):
    // 1) event lookup, 2) track-primary rows, 3) track-join rows,
    // 4/5) the two id-batches of the >ID_CHUNK_SIZE-match select fallback,
    // 6/7) participant + track enrichment (each single-batch since the
    // final page is only `perPage` ids).
    const responses = [
      [{ recordPrefix: "SES" }], // event lookup
      allRows.map((r) => ({ id: r.id })), // track-primary
      [], // track-join (no secondary-track matches in this fixture)
      allRows.slice(0, 90), // batch 1 of the id-scoped select
      allRows.slice(90), // batch 2 of the id-scoped select
      [], // participant enrichment for the returned page
      [], // submission_track enrichment for the returned page
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, {
      page: 1,
      perPage: 50,
      q: null,
      status: [],
      trackId: TRACK_ID,
      sort: "ref",
      includeAnswers: false,
    });

    expect(result.total).toBe(150);
    expect(result.items.length).toBe(50);
    // sort=ref -> ascending by seq, so the first page is sub-000..sub-049.
    expect(result.items[0]!.id).toBe("sub-000");
    expect(result.items[49]!.id).toBe("sub-049");
  });
});

describe("PATCH /api/v1/submissions/:id (CNT-09 admin session editing)", () => {
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
  };

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

  const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };
  const SPEAKER_A: AuthInfo = { userId: "u-speaker-a", role: "speaker", orgId: ORG_A, contactId: "contact-1" };

  function patchRequest(path: string, body: unknown) {
    return new Request(`http://local${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    });
  }

  it("organizer edits title and description", async () => {
    const { db, updates, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ title: "Old Title", description: "Old description" }], // getSubmissionContent (pre-edit snapshot, DEC-158)
      [{ email: "organizer@example.com" }], // getUserEmail (editor_name snapshot, DEC-158)
      [{ ...DETAIL_ROW, title: "New Title", description: "New description" }], // getSubmissionDetail: submission+event
      [], // participants
      [], // tracks
      [], // answers
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/submissions/sub-1", { title: "New Title", description: "New description" }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.title).toBe("New Title");
    expect(json.description).toBe("New description");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ title: "New Title", description: "New description" });
    // DEC-158: a real content change appends exactly one submission_revision row.
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toMatchObject({
      editorName: "organizer@example.com",
      title: "New Title",
      description: "New description",
    });
  });

  it("404s a genuinely different org's organizer on a real submission id (cross-org isolation)", async () => {
    const orgBOrganizer: AuthInfo = { userId: "u-org-b", role: "organizer", orgId: "org-b" };
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A]]);
    const app = appWithDbAndAuth(db, orgBOrganizer);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1", { title: "New Title" }));

    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("404s a nonexistent submission id", async () => {
    const { db, updates } = fakeDb([[]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/missing", { title: "New Title" }));

    expect(res.status).toBe(404);
    expect(updates).toHaveLength(0);
  });

  it("403s a speaker-session caller before any db access (requireOrganizer)", async () => {
    const { db, updates } = fakeDb([]);
    const app = appWithDbAndAuth(db, SPEAKER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1", { title: "New Title" }));

    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("rejects an empty patch (neither title nor description provided)", async () => {
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1", {}));

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(updates).toHaveLength(0);
  });

  // DEC-182: POST /events/:eventId/submissions/status bounds `ids` via
  // parseBoundedIdArray — no SQLITE_TOOBIG 500s, no silent element drops.
  describe("POST /events/:eventId/submissions/status (DEC-182 bulk-ids bound)", () => {
    function postRequest(path: string, body: unknown) {
      return new Request(`http://local${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify(body),
      });
    }

    it("400s with code 'invalid' when an id is absurdly oversized rather than 500ing", async () => {
      const { db } = fakeDb([[{ orgId: ORG_A }]]); // getEventOrgId
      const app = appWithDbAndAuth(db, ORGANIZER_A);

      const res = await app.request(
        postRequest("/api/v1/events/event-1/submissions/status", {
          ids: ["x".repeat(100000)],
          status: "accepted",
        }),
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe("invalid");
    });

    it("400s (not silently dropped) when an id element is a non-string", async () => {
      const { db } = fakeDb([[{ orgId: ORG_A }]]); // getEventOrgId
      const app = appWithDbAndAuth(db, ORGANIZER_A);

      const res = await app.request(
        postRequest("/api/v1/events/event-1/submissions/status", {
          ids: [123],
          status: "accepted",
        }),
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe("invalid");
    });
  });
});

const sourceModules = import.meta.glob(
  [
    "../src/routes/api/submissions.ts",
    "../src/server/repo/submissions.ts",
    "../src/server/repo/submissions/*.ts",
    "../src/server/repo/participants.ts",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("GET /api/v1/events/:eventId/submissions?includeAnswers=1 (DEC-243 answers pipeline route contract)", () => {
  // task w1-g: the production symptom was "toggling a column does nothing"
  // because the answers keyed by form_field_id never made it onto the
  // response item at all in some code paths. This is a route-level
  // regression test pinning the exact response shape the SPA's
  // formatAnswerValue(item.answers?.[col.fieldId]) lookup depends on.
  function chain(responses: unknown[]) {
    let cursor = 0;
    function link(): any {
      const obj: any = {};
      const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select"];
      for (const m of passthrough) obj[m] = () => obj;
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    return { select: () => link() } as unknown as AppEnv["Variables"]["db"];
  }

  function appWithDb(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", auth);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);
    return app;
  }

  const ORG_A = "org-a";
  const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

  it("carries answers keyed by form_field_id for a seeded dropdown field", async () => {
    const submissionRow = {
      id: "sub-1",
      title: "A talk",
      seq: 1,
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 1),
      eventId: "event-1",
      description: null,
      formId: "form-1",
      trackId: null,
      additionalTrackIdsJson: null,
      status: "pending",
      contentStatus: "pending",
      acceptedAt: null,
      icsSequence: 0,
    };

    // Call order for the simple (no q/trackId) path: 1) getEventOrgId
    // (assertEventOwnership), 2) event lookup for recordPrefix, 3) total
    // count, 4) page rows, 5) participant enrichment, 6) track enrichment,
    // 7) answer enrichment (only fetched when includeAnswers=1).
    const db = chain([
      [{ orgId: ORG_A }],
      [{ recordPrefix: "TALK" }],
      [{ count: 1 }],
      [submissionRow],
      [],
      [],
      [{ submissionId: "sub-1", formFieldId: "field-format", valueJson: JSON.stringify("Workshop") }],
    ]);
    const app = appWithDb(db, ORGANIZER_A);

    const res = await app.request(
      new Request("http://local/api/v1/events/event-1/submissions?includeAnswers=1"),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: Array<{ id: string; answers?: Record<string, unknown> }> };
    expect(json.items).toHaveLength(1);
    expect(json.items[0]!.answers).toEqual({ "field-format": "Workshop" });
  });

  it("omits the answers key entirely when includeAnswers is not set", async () => {
    const submissionRow = {
      id: "sub-1",
      title: "A talk",
      seq: 1,
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 1),
      eventId: "event-1",
      description: null,
      formId: "form-1",
      trackId: null,
      additionalTrackIdsJson: null,
      status: "pending",
      contentStatus: "pending",
      acceptedAt: null,
      icsSequence: 0,
    };
    const db = chain([
      [{ orgId: ORG_A }],
      [{ recordPrefix: "TALK" }],
      [{ count: 1 }],
      [submissionRow],
      [],
      [],
      // no 7th response consumed: includeAnswers=false skips the answers query
    ]);
    const app = appWithDb(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/events/event-1/submissions"));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: Array<{ id: string; answers?: Record<string, unknown> }> };
    expect(json.items[0]).not.toHaveProperty("answers");
  });
});

describe("DEC-009 invariant #1: no mailer import reachable from the status-change path", () => {
  it("neither the route module nor any repo submodule import a mailer", () => {
    const entries = Object.entries(sourceModules);
    // routes/api/submissions.ts + repo/submissions.ts barrel + the 6 split
    // submissions/ modules (query, list, detail, create, status, seq) + the
    // sibling repo/participants.ts (DEC-070). This count is a tripwire: it
    // fails if the glob stops matching (which would make the assertions
    // below vacuous) or if a new submodule is added without being
    // considered against DEC-009 invariant #1.
    expect(entries.length).toBe(9);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
      expect(source, `${path} must not reference Mailer`).not.toMatch(/Mailer/);
    }
  });
});
