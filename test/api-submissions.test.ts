/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  chunkIds,
  isValidStatusLiteral,
  listSubmissions,
  parseListQuery,
  SORT_ORDERS,
} from "../src/server/repo/submissions";
import { likeContains } from "../src/server/repo/like";
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
      contentStatus: [],
      trackId: null,
      sort: "newest",
      includeAnswers: false,
      reuploaded: null,
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

  it("parses comma-separated status (DEC-843: unknown literals now throw loudly)", () => {
    expect(parseListQuery({ status: "pending,accepted" }).status).toEqual(["pending", "accepted"]);
    expect(() => parseListQuery({ status: "pending,bogus,declined" })).toThrow("bogus");
  });

  // DEC-843 (wave-62 amendment): a sort token is a filter token — an
  // unrecognised `?sort=` throws naming the token instead of silently
  // falling back to 'newest', exactly like the status sibling above.
  // Absent/empty still means the documented default.
  it("parses all four DEC-016 sorts, defaults to newest when absent, and throws on an unknown token", () => {
    for (const sort of SORT_ORDERS) {
      expect(parseListQuery({ sort }).sort).toBe(sort);
    }
    expect(parseListQuery({}).sort).toBe("newest");
    expect(() => parseListQuery({ sort: "bogus" })).toThrow("bogus");
  });

  it("reads trackId and includeAnswers=1", () => {
    expect(parseListQuery({ trackId: "t1" }).trackId).toBe("t1");
    expect(parseListQuery({ includeAnswers: "1" }).includeAnswers).toBe(true);
    expect(parseListQuery({ includeAnswers: "true" }).includeAnswers).toBe(false);
  });

  // DEC-881: reuploaded=1/0 filters to the single re-uploaded predicate;
  // absent means no filter; anything else fails loudly, same as status.
  it("parses reuploaded=1/0, defaults to null (no filter), and throws on an unknown token", () => {
    expect(parseListQuery({}).reuploaded).toBeNull();
    expect(parseListQuery({ reuploaded: "1" }).reuploaded).toBe(true);
    expect(parseListQuery({ reuploaded: "0" }).reuploaded).toBe(false);
    expect(() => parseListQuery({ reuploaded: "yes" })).toThrow("yes");
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
  it("stamps accepted_at exactly once, but re-fires planning on every re-entry into 'accepted' (DEC-278 wave-58 amendment)", () => {
    const now = 1000;
    const first = changeStatus({ status: "pending", acceptedAt: null }, "accepted", now);
    expect(first.fireAcceptance).toBe(true);
    expect(first.setsAcceptedAt).toBe(true);
    expect(first.acceptedAt).toBe(now);

    // Re-running while ALREADY 'accepted' (same status, no transition): no
    // re-fire, and acceptedAt stays put.
    const second = changeStatus({ status: "accepted", acceptedAt: first.acceptedAt }, "accepted", now + 500);
    expect(second.fireAcceptance).toBe(false);
    expect(second.setsAcceptedAt).toBe(false);
    expect(second.acceptedAt).toBe(now); // unchanged, never re-stamped

    // Un-accept then re-accept: accepted_at is still never cleared/re-stamped
    // (setsAcceptedAt stays false), but fireAcceptance fires again so a
    // co-speaker added while un-accepted still gets planned (the planner is
    // idempotent on (contact, task-title), so this is safe).
    const declined = changeStatus({ status: "accepted", acceptedAt: first.acceptedAt }, "declined", now + 1000);
    expect(declined.acceptedAt).toBe(now);
    const reaccepted = changeStatus({ status: "declined", acceptedAt: declined.acceptedAt }, "accepted", now + 2000);
    expect(reaccepted.fireAcceptance).toBe(true);
    expect(reaccepted.setsAcceptedAt).toBe(false);
    expect(reaccepted.acceptedAt).toBe(now);
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

describe("likeContains (pure LIKE-bind escaping for q/trackId filters, DEC-333/335/506)", () => {
  it("wraps in %...% without case-folding", () => {
    expect(likeContains("Hello World")).toBe("%Hello World%");
  });

  it("escapes %, _ and backslash with a leading backslash", () => {
    expect(likeContains("100%")).toBe("%100\\%%");
    expect(likeContains("a_b")).toBe("%a\\_b%");
    expect(likeContains("a\\b")).toBe("%a\\\\b%");
  });

  it("escapes all three special characters together", () => {
    expect(likeContains("50%_off\\now")).toBe("%50\\%\\_off\\\\now%");
  });
});

// DEC-335: listSubmissions is one paginated SQL statement — q/trackId
// narrowing is pushed into the WHERE clause as correlated EXISTS
// subqueries, not a separate candidate-id pass + JS-side pagination.
// Exercises listSubmissions against a fake db double (no wrangler/D1
// dependency in stage 1 unit tests), asserting exactly three queries run
// before per-page enrichment (event-prefix lookup, count, page) and that
// limit/offset made it onto the page query.
describe("listSubmissions: one paginated statement for q+trackId (DEC-333/335)", () => {
  function makeFakeDb(responses: unknown[]) {
    let cursor = 0;
    const calls: { method: string; args: unknown[] }[][] = [];
    function chain(): any {
      const thisCallLog: { method: string; args: unknown[] }[] = [];
      calls.push(thisCallLog);
      const obj: any = {};
      const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
      for (const m of passthrough) {
        obj[m] = (...args: unknown[]) => {
          thisCallLog.push({ method: m, args });
          return obj;
        };
      }
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    return { select: () => chain(), calls } as any;
  }

  it("issues exactly three queries before enrichment and applies limit/offset", async () => {
    const EVENT_ID = "event-1";
    const row = {
      id: "sub-1",
      title: "A Talk",
      seq: 1,
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 1),
      eventId: EVENT_ID,
      description: null,
      formId: null,
      trackId: "track-1",
      additionalTrackIdsJson: null,
      status: "submitted",
      contentStatus: "unset",
      acceptedAt: null,
      icsSequence: 0,
    };

    const responses = [
      [{ recordPrefix: "SES" }], // 1: event prefix lookup
      [{ count: 1 }], // 2: count
      [{ contentStatus: "pending", count: 1, reuploaded: 0 }], // 3: DEC-913 grouped counts
      [row], // 4: page
      [], // participant enrichment
      [], // submission_track enrichment
      [], // deliverable-count enrichment (DEC-341)
      [], // latestFile candidate enrichment (w15-f)
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, {
      page: 2,
      perPage: 5,
      q: "talk",
      status: [],
      contentStatus: [],
      trackId: "track-1",
      sort: "newest",
      includeAnswers: false,
      reuploaded: null,
    });

    // Exactly 9 db.select() calls total: 4 core (incl. DEC-913 grouped
    // counts) + 5 enrichment batches.
    expect(db.calls.length).toBe(9);
    expect(result.total).toBe(1);
    expect(result.items[0]!.id).toBe("sub-1");
    expect(result.contentStatusCounts).toEqual({ pending: 1, approved: 0, changes_requested: 0 });
    expect(result.reuploadedCount).toBe(0);

    const pageCallLog = db.calls[3]!;
    const limitCall = pageCallLog.find((c: { method: string }) => c.method === "limit");
    const offsetCall = pageCallLog.find((c: { method: string }) => c.method === "offset");
    expect(limitCall?.args).toEqual([5]);
    expect(offsetCall?.args).toEqual([5]); // (page 2 - 1) * perPage 5
  });

  // DEC-913: the grouped contentStatusCounts/reuploadedCount aggregate is
  // computed over the SAME base filter (eventId/q/trackId) with the
  // caller's own contentStatus/reuploaded narrowing stripped — so a
  // contentStatus-filtered call still reports the full unfiltered group
  // totals, and the chips can never disagree with which tab is active.
  it("computes contentStatusCounts/reuploadedCount over the base filter, ignoring the caller's own contentStatus/reuploaded narrowing", async () => {
    const EVENT_ID = "event-1";
    const responses = [
      [{ recordPrefix: "SES" }], // event prefix lookup
      [{ count: 0 }], // count (narrowed to contentStatus=approved -> 0 rows)
      [
        { contentStatus: "pending", count: 2, reuploaded: 1 },
        { contentStatus: "approved", count: 3, reuploaded: 0 },
        { contentStatus: "changes_requested", count: 1, reuploaded: 1 },
      ], // DEC-913 grouped counts: unaffected by the contentStatus filter below
      [], // page (no rows match contentStatus=approved... this test only cares about counts)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, {
      page: 1,
      perPage: 50,
      q: null,
      status: [],
      contentStatus: ["approved"] as any,
      trackId: null,
      sort: "newest",
      includeAnswers: false,
      reuploaded: null,
    });

    expect(result.contentStatusCounts).toEqual({ pending: 2, approved: 3, changes_requested: 1 });
    expect(result.reuploadedCount).toBe(2);
  });

  // w41-b (DEC-902 amendment): the worklist SESSION cell's subtitle needs
  // the submission's placed schedule_slot + room -- batched per id chunk the
  // SAME way deliverableCounts/latestFile are (one query per chunk, never a
  // per-row fetch). This exercises the batched query in isolation and
  // asserts a submission with no schedule_slot row reads back `scheduled:
  // null`.
  it("populates `scheduled` from one batched schedule_slot/room query, null for an unplaced submission", async () => {
    const EVENT_ID = "event-1";
    const placedRow = {
      id: "sub-1",
      title: "Placed Talk",
      seq: 1,
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 1),
      eventId: EVENT_ID,
      description: null,
      formId: null,
      trackId: null,
      additionalTrackIdsJson: null,
      status: "accepted",
      contentStatus: "pending",
      acceptedAt: null,
      icsSequence: 0,
    };
    const unplacedRow = { ...placedRow, id: "sub-2", title: "Unplaced Talk", seq: 2 };

    const responses = [
      [{ recordPrefix: "SES" }], // 1: event prefix lookup
      [{ count: 2 }], // 2: count
      [{ contentStatus: "pending", count: 2, reuploaded: 0 }], // 3: DEC-913 grouped counts
      [placedRow, unplacedRow], // 4: page
      [], // 5: participant enrichment
      [], // 6: submission_track enrichment
      [], // 7: deliverable-count enrichment (DEC-341)
      [], // 8: latestFile candidate enrichment (w15-f)
      [
        { submissionId: "sub-1", day: "2026-05-12", startMin: 600, endMin: 660, roomName: "Room 2A" },
      ], // 9: w41-b scheduled enrichment -- only sub-1 has a schedule_slot row
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, {
      page: 1,
      perPage: 50,
      q: null,
      status: [],
      contentStatus: [],
      trackId: null,
      sort: "newest",
      includeAnswers: false,
      reuploaded: null,
    });

    // Exactly ONE batched query for the scheduled enrichment (9 selects
    // total: 4 core + 5 enrichment batches, not a per-row fetch).
    expect(db.calls.length).toBe(9);

    const placed = result.items.find((i) => i.id === "sub-1");
    const unplaced = result.items.find((i) => i.id === "sub-2");
    expect(placed?.scheduled).toEqual({ day: "2026-05-12", startMin: 600, endMin: 660, roomName: "Room 2A" });
    expect(unplaced?.scheduled).toBeNull();
  });

  // w8-d (DEC-051/DEC-780 amendment, findings wave 8): the LIST payload's
  // `slot` field reuses the SAME batched schedule_slot/room enrichment as
  // `scheduled` above -- verbatim shape, no second join, no per-row lookup.
  // Compose step 1 reads this so the .ics-attach fact is visible before an
  // audience is chosen (never first refused at step 3).
  it("populates `slot` (DEC-780 shape) from the SAME batched schedule_slot/room enrichment as `scheduled`, null for an unscheduled submission", async () => {
    const EVENT_ID = "event-1";
    const placedRow = {
      id: "sub-1",
      title: "Placed Talk",
      seq: 1,
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 1),
      eventId: EVENT_ID,
      description: null,
      formId: null,
      trackId: null,
      additionalTrackIdsJson: null,
      status: "accepted",
      contentStatus: "pending",
      acceptedAt: null,
      icsSequence: 0,
    };
    const unplacedRow = { ...placedRow, id: "sub-2", title: "Unplaced Talk", seq: 2 };

    const responses = [
      [{ recordPrefix: "SES" }], // 1: event prefix lookup
      [{ count: 2 }], // 2: count
      [{ contentStatus: "pending", count: 2, reuploaded: 0 }], // 3: DEC-913 grouped counts
      [placedRow, unplacedRow], // 4: page
      [], // 5: participant enrichment
      [], // 6: submission_track enrichment
      [], // 7: deliverable-count enrichment (DEC-341)
      [], // 8: latestFile candidate enrichment (w15-f)
      [
        { submissionId: "sub-1", day: "2026-05-12", startMin: 600, endMin: 660, roomName: "Room 2A" },
      ], // 9: w41-b/w8-d scheduled+slot enrichment -- only sub-1 has a schedule_slot row
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, {
      page: 1,
      perPage: 50,
      q: null,
      status: [],
      contentStatus: [],
      trackId: null,
      sort: "newest",
      includeAnswers: false,
      reuploaded: null,
    });

    // No extra round trip: still exactly 9 db.select() calls (4 core + 5
    // enrichment batches) -- `slot` rides the same batch `scheduled` does.
    expect(db.calls.length).toBe(9);

    const placed = result.items.find((i) => i.id === "sub-1");
    const unplaced = result.items.find((i) => i.id === "sub-2");
    expect(placed?.slot).toEqual({ day: "2026-05-12", startMin: 600, endMin: 660, roomName: "Room 2A" });
    expect(placed?.slot).toEqual(placed?.scheduled);
    expect(unplaced?.slot).toBeNull();
  });
});

// DEC-913: GET .../submissions serves the grouped contentStatusCounts +
// reuploadedCount on the SAME response as the rows — the route test
// double for the repo-level assertion above.
describe("GET /api/v1/events/:eventId/submissions (DEC-913 grouped counts on the envelope)", () => {
  function makeFakeDb(responses: unknown[]) {
    let cursor = 0;
    function chain(): any {
      const obj: any = {};
      const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
      for (const m of passthrough) {
        obj[m] = (..._args: unknown[]) => obj;
      }
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    return { select: () => chain() } as any;
  }

  const ORGANIZER: AuthInfo = { userId: "u-organizer", role: "organizer", orgId: "org-a" };

  function appWithDb(db: unknown) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db as AppEnv["Variables"]["db"]);
      c.set("auth", ORGANIZER);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);
    return app;
  }

  it("returns contentStatusCounts/reuploadedCount on the envelope, computed once and unaffected by a contentStatus filter", async () => {
    const db = makeFakeDb([
      [{ orgId: "org-a" }], // getEventOrgId (assertEventOwnership)
      [{ recordPrefix: "SES" }], // event prefix lookup
      [{ count: 0 }], // count, narrowed to contentStatus=approved
      [
        { contentStatus: "pending", count: 2, reuploaded: 1 },
        { contentStatus: "approved", count: 3, reuploaded: 0 },
        { contentStatus: "changes_requested", count: 1, reuploaded: 1 },
      ], // DEC-913 grouped counts: base filter only, ignores the contentStatus narrowing below
      [], // page rows (none match contentStatus=approved in this fixture)
    ]);
    const app = appWithDb(db);

    const res = await app.request(
      new Request("http://local/api/v1/events/event-1/submissions?contentStatus=approved"),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.contentStatusCounts).toEqual({ pending: 2, approved: 3, changes_requested: 1 });
    expect(json.reuploadedCount).toBe(2);
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
      // DEC-155 (wave-60): resolveActorName is hoisted into the PATCH's ONE
      // pre-write read wave, so it is issued BEFORE ensureBaselineRevision's
      // countRevisions (which runs in the write phase, after the wave).
      [{ email: "organizer@example.com", contactId: null }], // resolveActorName (editor_name snapshot, DEC-158)
      [{ count: 1 }], // countRevisions (ensureBaselineRevision, DEC-158 wave-59: already has revisions)
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
    // DEC-519: a real content change also bumps ics_sequence (second update
    // call, on top of the title/description field update).
    expect(updates).toHaveLength(2);
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

    expect(res.status).toBe(404);
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
      const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
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
    // count, 4) DEC-913 grouped contentStatusCounts/reuploadedCount, 5) page
    // rows, 6) participant enrichment, 7) track enrichment, 8) answer
    // enrichment (only fetched when includeAnswers=1), 9) deliverable-count
    // enrichment (DEC-341), 10) latestFile candidate enrichment (w15-f).
    const db = chain([
      [{ orgId: ORG_A }],
      [{ recordPrefix: "TALK" }],
      [{ count: 1 }],
      [{ contentStatus: "pending", count: 1, reuploaded: 0 }],
      [submissionRow],
      [],
      [],
      [{ submissionId: "sub-1", formFieldId: "field-format", valueJson: JSON.stringify("Workshop") }],
      [], // deliverable-count enrichment (DEC-341)
      [], // latestFile candidate enrichment (w15-f)
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
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
      [{ contentStatus: "pending", count: 1, reuploaded: 0 }], // DEC-913 grouped counts
      [submissionRow],
      [],
      [],
      // no answers response: includeAnswers=false skips the answers query
      [], // deliverable-count enrichment (DEC-341)
      [], // latestFile candidate enrichment (w15-f)
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
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
    // routes/api/submissions.ts + repo/submissions.ts barrel + the 8 split
    // submissions/ modules (query, list, detail, create, status, seq,
    // history — DEC-892, touch — DEC-725 amendment wave 63) + the sibling
    // repo/participants.ts (DEC-070). This count is a tripwire: it fails if
    // the glob stops matching (which would make the assertions below
    // vacuous) or if a new submodule is added without being considered
    // against DEC-009 invariant #1.
    expect(entries.length).toBe(11);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
      expect(source, `${path} must not reference Mailer`).not.toMatch(/Mailer/);
    }
  });
});
