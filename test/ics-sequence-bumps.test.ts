// DEC-519: ics_sequence must bump on every write that changes a field the
// VEVENT serializes (title/description -> SUMMARY/DESCRIPTION; room name ->
// LOCATION for every submission currently scheduled there), and must NOT
// bump on a no-op write. This test ENUMERATES every write path this task
// owns rather than sampling one: organizer PATCH title, organizer PATCH
// description, revision restore, portal edit of title, and room rename --
// plus a no-op variant of each. All bumps are asserted to route through the
// single canonical home in src/server/repo/ics-sequence.ts (DEC-492).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };
const UNRELATED_SUBMISSION_ID = "sub-unrelated";

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

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function appWithAuth<T extends { Variables: AppEnv["Variables"] }>(
  routes: Hono<AppEnv>,
  auth: AuthInfo,
  db: unknown,
) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db as Db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", routes);
  return app;
}

const DETAIL_ROW = {
  id: "sub-1",
  status: "pending",
  title: "T",
  description: "D",
};

// ---------------------------------------------------------------------------
// 1/2. organizer PATCH /submissions/:id — title change, description change,
// and a no-op change (same values re-sent).
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/submissions/:id (DEC-519)", () => {
  async function setup(before: { title: string; description: string | null }) {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return {
        ...actual,
        getSubmissionOwnership: vi.fn(async () => ({ eventId: "event-1", orgId: ORG_A })),
        getSubmissionContent: vi.fn(async () => before),
        updateSubmissionFields: vi.fn(async () => {}),
        getSubmissionDetail: vi.fn(async () => DETAIL_ROW),
      };
    });
    vi.doMock("../src/server/repo/users", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
      return { ...actual, resolveActorName: vi.fn(async () => "organizer@example.com") };
    });
    vi.doMock("../src/server/repo/revisions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/revisions")>(
        "../src/server/repo/revisions",
      );
      return { ...actual, appendSubmissionRevision: vi.fn(async () => {}), ensureBaselineRevision: vi.fn(async () => {}) };
    });
    const icsSeq = await import("../src/server/repo/ics-sequence");
    const bumpSpy = vi.spyOn(icsSeq, "bumpIcsSequences").mockImplementation(async () => {});
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    return { submissionsRoutes, bumpSpy };
  }

  it("bumps ics_sequence exactly once for the edited submission when title changes", async () => {
    const { submissionsRoutes, bumpSpy } = await setup({ title: "Old Title", description: "D" });
    const res = await appWithAuth(submissionsRoutes, ORGANIZER_A, {}).request(
      patchRequest("/api/v1/submissions/sub-1", { title: "New Title" }),
    );
    expect(res.status).toBe(200);
    expect(bumpSpy).toHaveBeenCalledTimes(1);
    expect(bumpSpy).toHaveBeenCalledWith(expect.anything(), ["sub-1"]);
    // The bump call's id set never names any other submission.
    expect(bumpSpy.mock.calls[0]?.[1]).not.toContain(UNRELATED_SUBMISSION_ID);
  });

  it("bumps ics_sequence exactly once for the edited submission when description changes", async () => {
    const { submissionsRoutes, bumpSpy } = await setup({ title: "T", description: "Old description" });
    const res = await appWithAuth(submissionsRoutes, ORGANIZER_A, {}).request(
      patchRequest("/api/v1/submissions/sub-1", { description: "New description" }),
    );
    expect(res.status).toBe(200);
    expect(bumpSpy).toHaveBeenCalledTimes(1);
    expect(bumpSpy).toHaveBeenCalledWith(expect.anything(), ["sub-1"]);
  });

  it("does NOT bump on a no-op write (same title/description re-sent)", async () => {
    const { submissionsRoutes, bumpSpy } = await setup({ title: "Same Title", description: "Same description" });
    const res = await appWithAuth(submissionsRoutes, ORGANIZER_A, {}).request(
      patchRequest("/api/v1/submissions/sub-1", { title: "Same Title", description: "Same description" }),
    );
    expect(res.status).toBe(200);
    expect(bumpSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. POST /submissions/:id/revisions/:revisionId/restore
// ---------------------------------------------------------------------------

describe("POST /api/v1/submissions/:id/revisions/:revisionId/restore (DEC-519)", () => {
  async function setup(revision: { title: string; description: string | null }, before: { title: string; description: string | null }) {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return {
        ...actual,
        getSubmissionOwnership: vi.fn(async () => ({ eventId: "event-1", orgId: ORG_A })),
        getSubmissionContent: vi.fn(async () => before),
        updateSubmissionFields: vi.fn(async () => {}),
        getSubmissionDetail: vi.fn(async () => DETAIL_ROW),
      };
    });
    vi.doMock("../src/server/repo/users", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
      return { ...actual, resolveActorName: vi.fn(async () => "organizer@example.com") };
    });
    vi.doMock("../src/server/repo/revisions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/revisions")>(
        "../src/server/repo/revisions",
      );
      return {
        ...actual,
        getRevision: vi.fn(async () => ({
          id: "rev-1",
          editorName: "speaker@example.com",
          title: revision.title,
          description: revision.description,
          createdAt: new Date(1000),
        })),
        appendSubmissionRevision: vi.fn(async () => {}),
        // Explicitly stubbed (never spread from `actual`, DEC-158 wave-59):
        // a stale `actual` reference captured before a later test's
        // vi.resetModules() would otherwise resolve schema.submissionRevision
        // against a discarded module-cache generation and mismatch the fake
        // db's table-identity check. Restore doesn't call this anyway.
        ensureBaselineRevision: vi.fn(async () => {}),
      };
    });
    const icsSeq = await import("../src/server/repo/ics-sequence");
    const bumpSpy = vi.spyOn(icsSeq, "bumpIcsSequences").mockImplementation(async () => {});
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    return { submissionsRoutes, bumpSpy };
  }

  it("bumps ics_sequence exactly once when the restored snapshot differs from the current content", async () => {
    const { submissionsRoutes, bumpSpy } = await setup(
      { title: "Old Title", description: "Old description" },
      { title: "Current Title", description: "Current description" },
    );
    const res = await appWithAuth(submissionsRoutes, ORGANIZER_A, {}).request(
      postRequest("/api/v1/submissions/sub-1/revisions/rev-1/restore"),
    );
    expect(res.status).toBe(200);
    expect(bumpSpy).toHaveBeenCalledTimes(1);
    expect(bumpSpy).toHaveBeenCalledWith(expect.anything(), ["sub-1"]);
    expect(bumpSpy.mock.calls[0]?.[1]).not.toContain(UNRELATED_SUBMISSION_ID);
  });

  // DEC-158 wave-59 amendment: restoring a snapshot identical to the current
  // content is now a loud 400 refusal (not a silent 200 no-op) — so it
  // certainly doesn't bump ics_sequence.
  it("400s (refuses) restoring a snapshot identical to the current content, and does NOT bump", async () => {
    const same = { title: "Same Title", description: "Same description" };
    const { submissionsRoutes, bumpSpy } = await setup(same, same);
    // Bespoke app (not the shared appWithAuth helper): errorResponse's
    // `err instanceof ApiError` check must run against the SAME module-cache
    // generation that threw it — a statically-imported registerErrorHandler
    // would hold a stale ApiError class after this file's vi.resetModules().
    const { registerErrorHandler } = await import("../src/server/http");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", {} as Db);
      c.set("auth", ORGANIZER_A);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);
    const res = await app.request(postRequest("/api/v1/submissions/sub-1/revisions/rev-1/restore"));
    expect(res.status).toBe(400);
    expect(bumpSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. portal-edit saveSubmissionEdits (speaker edit of a locked title field)
// ---------------------------------------------------------------------------

function makeTableFakeDb(
  freshSchema: typeof schema,
  data: { submissionRows: unknown[]; contactRows: unknown[] },
) {
  function rowsFor(table: unknown): unknown[] {
    if (table === freshSchema.submission) return data.submissionRows;
    if (table === freshSchema.contact) return data.contactRows;
    if (table === freshSchema.submissionAnswer) return [];
    // countRevisions (ensureBaselineRevision, DEC-158 wave-59): report
    // "already has revisions" so this test's own baseline is untouched.
    if (table === freshSchema.submissionRevision) return [{ count: 1 }];
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
    update() {
      return { set: () => ({ where: () => Promise.resolve() }) };
    },
    insert() {
      return { values: () => Promise.resolve() };
    },
    delete() {
      throw new Error("fake db: delete not supported in this test");
    },
  };

  return db as unknown as Db;
}

describe("saveSubmissionEdits (portal edit, DEC-519)", () => {
  it("bumps ics_sequence exactly once when the speaker edits the locked title field", async () => {
    const icsSeq = await import("../src/server/repo/ics-sequence");
    const bumpSpy = vi.spyOn(icsSeq, "bumpIcsSequences").mockImplementation(async () => {});
    const { saveSubmissionEdits } = await import("../src/server/repo/portal-edit");
    const freshSchema = await import("../src/db/schema");

    const db = makeTableFakeDb(freshSchema as unknown as typeof schema, {
      submissionRows: [{ title: "Old Title", description: "Old description" }],
      contactRows: [{ firstName: "Jane", lastName: "Doe" }],
    });

    await saveSubmissionEdits(db, "s1", "c1", { title: "New Title", description: "New description" }, null, []);

    expect(bumpSpy).toHaveBeenCalledTimes(1);
    expect(bumpSpy).toHaveBeenCalledWith(db, ["s1"]);
    expect(bumpSpy.mock.calls[0]?.[1]).not.toContain(UNRELATED_SUBMISSION_ID);
  });

  it("does NOT bump when title/description don't actually change (no-op)", async () => {
    const icsSeq = await import("../src/server/repo/ics-sequence");
    const bumpSpy = vi.spyOn(icsSeq, "bumpIcsSequences").mockImplementation(async () => {});
    const { saveSubmissionEdits } = await import("../src/server/repo/portal-edit");
    const freshSchema = await import("../src/db/schema");

    const db = makeTableFakeDb(freshSchema as unknown as typeof schema, {
      submissionRows: [{ title: "Same Title", description: "Same description" }],
      contactRows: [{ firstName: "Jane", lastName: "Doe" }],
    });

    await saveSubmissionEdits(db, "s1", "c1", { title: "Same Title", description: "Same description" }, null, []);

    expect(bumpSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. PATCH /rooms/:roomId — bumps every submission scheduled into that room
// via the set-based bumpIcsSequencesForRoom helper, only when the name
// actually changes.
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/rooms/:roomId (DEC-519)", () => {
  function roomLookupDb(eventId: string) {
    return {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ eventId }] }) }),
      }),
    };
  }

  async function setup(before: { name: string }, updated: { name: string }) {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        getEventForOrg: vi.fn(async () => ({ id: "event-1", orgId: ORG_A })),
        getRoomForEvent: vi.fn(async () => ({ id: "room-1", eventId: "event-1", ...before })),
        updateRoom: vi.fn(async () => ({ id: "room-1", eventId: "event-1", ...updated })),
      };
    });
    const icsSeq = await import("../src/server/repo/ics-sequence");
    const roomBumpSpy = vi.spyOn(icsSeq, "bumpIcsSequencesForRoom").mockImplementation(async () => {});
    const { eventsRoutes } = await import("../src/routes/api/events");
    return { eventsRoutes, roomBumpSpy };
  }

  it("bumps every submission scheduled into the room when its name actually changes", async () => {
    const { eventsRoutes, roomBumpSpy } = await setup({ name: "Old Room Name" }, { name: "New Room Name" });
    const res = await appWithAuth(eventsRoutes, ORGANIZER_A, roomLookupDb("event-1")).request(
      patchRequest("/api/v1/rooms/room-1", { name: "New Room Name" }),
    );
    expect(res.status).toBe(200);
    expect(roomBumpSpy).toHaveBeenCalledTimes(1);
    expect(roomBumpSpy).toHaveBeenCalledWith(expect.anything(), "room-1");
  });

  it("does NOT bump when the room is renamed to the same string (no-op)", async () => {
    const { eventsRoutes, roomBumpSpy } = await setup({ name: "Same Room Name" }, { name: "Same Room Name" });
    const res = await appWithAuth(eventsRoutes, ORGANIZER_A, roomLookupDb("event-1")).request(
      patchRequest("/api/v1/rooms/room-1", { name: "Same Room Name" }),
    );
    expect(res.status).toBe(200);
    expect(roomBumpSpy).not.toHaveBeenCalled();
  });

  it("does NOT bump a capacity-only PATCH that never touches the name", async () => {
    const { eventsRoutes, roomBumpSpy } = await setup({ name: "Room A" }, { name: "Room A" });
    const res = await appWithAuth(eventsRoutes, ORGANIZER_A, roomLookupDb("event-1")).request(
      patchRequest("/api/v1/rooms/room-1", { capacity: 42 }),
    );
    expect(res.status).toBe(200);
    expect(roomBumpSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. PATCH /events/:eventId timezone — bumps every submission with a
// schedule_slot in that event via the set-based bumpIcsSequencesForEvent
// helper, only when the timezone string actually changed (DEC-519 wave-11
// amendment). Explicitly refused: name, location, startDate, endDate.
// ---------------------------------------------------------------------------

const EVENT_ROW = {
  id: "event-1",
  orgId: ORG_A,
  name: "Conf",
  slug: "conf",
  startDate: "2026-06-01",
  endDate: "2026-06-10",
  location: null,
  timezone: "America/New_York",
  recordPrefix: "EV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

describe("PATCH /api/v1/events/:eventId timezone (DEC-519 wave-11 amendment)", () => {
  // Empty-result fake db for the DEC-844 window-narrowing side effect
  // (listSlotsOutsideWindow/listBreaksOutsideWindow) — the window itself
  // never changes in these tests, so both report zero.
  function windowLookupDb() {
    const chain: Record<string, unknown> = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => [],
      then: (resolve: (v: unknown[]) => void) => resolve([]),
    };
    return { select: () => chain };
  }

  async function setup(existing: typeof EVENT_ROW, updatedTimezone: string | undefined) {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
        "../src/server/repo/events",
      );
      return {
        ...actual,
        isSlugTaken: vi.fn(async () => false),
        getEventForOrg: vi.fn(async () => existing),
        updateEvent: vi.fn(async (_db: unknown, _eventId: string, _orgId: string, patch: Record<string, unknown>) => {
          const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
          return { ...existing, ...defined };
        }),
      };
    });
    const icsSeq = await import("../src/server/repo/ics-sequence");
    const eventBumpSpy = vi.spyOn(icsSeq, "bumpIcsSequencesForEvent").mockImplementation(async () => {});
    const { eventsRoutes } = await import("../src/routes/api/events");
    void updatedTimezone;
    return { eventsRoutes, eventBumpSpy };
  }

  it("bumps once when the timezone actually changes", async () => {
    const { eventsRoutes, eventBumpSpy } = await setup(EVENT_ROW, "Europe/London");
    const res = await appWithAuth(eventsRoutes, ORGANIZER_A, windowLookupDb()).request(
      patchRequest(`/api/v1/events/${EVENT_ROW.id}`, { timezone: "Europe/London" }),
    );
    expect(res.status).toBe(200);
    expect(eventBumpSpy).toHaveBeenCalledTimes(1);
    expect(eventBumpSpy).toHaveBeenCalledWith(expect.anything(), EVENT_ROW.id);
  });

  it("does NOT bump when the same timezone string is re-sent", async () => {
    const { eventsRoutes, eventBumpSpy } = await setup(EVENT_ROW, EVENT_ROW.timezone);
    const res = await appWithAuth(eventsRoutes, ORGANIZER_A, windowLookupDb()).request(
      patchRequest(`/api/v1/events/${EVENT_ROW.id}`, { timezone: EVENT_ROW.timezone }),
    );
    expect(res.status).toBe(200);
    expect(eventBumpSpy).not.toHaveBeenCalled();
  });

  it("does NOT bump on a name-only PATCH that never touches timezone", async () => {
    const { eventsRoutes, eventBumpSpy } = await setup(EVENT_ROW, undefined);
    const res = await appWithAuth(eventsRoutes, ORGANIZER_A, windowLookupDb()).request(
      patchRequest(`/api/v1/events/${EVENT_ROW.id}`, { name: "New Conf Name" }),
    );
    expect(res.status).toBe(200);
    expect(eventBumpSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// bumpIcsSequencesForEvent itself: a single atomic UPDATE ... WHERE id IN
// (SELECT submission_id FROM schedule_slot JOIN submission ON ... WHERE
// submission.event_id = ?) — never a read-then-loop (DEC-078/DEC-492).
// Structurally, only submissions that appear in schedule_slot can ever be
// selected (an unscheduled submission is never in that join), and the
// eventId equality scopes the join to submissions of exactly one event (a
// scheduled submission in a different event is excluded by that filter).
// ---------------------------------------------------------------------------

describe("bumpIcsSequencesForEvent (DEC-519 wave-11/DEC-492: atomic set-based, never read-then-loop)", () => {
  it("issues exactly one UPDATE on schema.submission, scoped via a schedule_slot/submission join filtered on event_id", async () => {
    const { bumpIcsSequencesForEvent } = await import("../src/server/repo/ics-sequence");
    const freshSchema = await import("../src/db/schema");
    const selectFromCalls: unknown[] = [];
    const joinCalls: unknown[] = [];
    const whereArgs: unknown[] = [];
    const updateCalls: { table: unknown; setValue: unknown; whereArg: unknown }[] = [];

    const subqueryChain = {
      from: (table: unknown) => {
        selectFromCalls.push(table);
        return subqueryChain;
      },
      innerJoin: (table: unknown, on: unknown) => {
        joinCalls.push(table);
        void on;
        return subqueryChain;
      },
      where: (arg: unknown) => {
        whereArgs.push(arg);
        return subqueryChain;
      },
    };

    const db = {
      select: () => subqueryChain,
      update: (table: unknown) => ({
        set: (setValue: unknown) => ({
          where: (whereArg: unknown) => {
            updateCalls.push({ table, setValue, whereArg });
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as Db;

    await bumpIcsSequencesForEvent(db, "event-42");

    // Exactly one UPDATE statement, on the submission table, never a
    // per-submission loop.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.table).toBe(freshSchema.submission);
    // Driven from schedule_slot -> an unscheduled submission (no
    // schedule_slot row) can never appear in this subquery's result set.
    expect(selectFromCalls).toContain(freshSchema.scheduleSlot);
    expect(joinCalls).toContain(freshSchema.submission);
    // Filtered on submission.event_id = 'event-42' -> a scheduled
    // submission belonging to a different event is excluded.
    const whereSql = whereArgs[0] as { queryChunks: unknown[] } | undefined;
    expect(whereSql).toBeTruthy();
    const chunks = whereSql?.queryChunks ?? [];
    // One chunk wraps the literal value "event-42" (a drizzle Param); another
    // references the submission.eventId column (identified by its .name, not
    // by JSON.stringify — the column object is circular via .table).
    const paramChunk = chunks.find(
      (chunk): chunk is { value: unknown } =>
        typeof chunk === "object" && chunk !== null && "value" in chunk && (chunk as { value: unknown }).value === "event-42",
    );
    expect(paramChunk).toBeTruthy();
    const columnChunk = chunks.find(
      (chunk): chunk is { name: string } =>
        typeof chunk === "object" && chunk !== null && "name" in chunk && (chunk as { name: unknown }).name === "event_id",
    );
    expect(columnChunk).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// bumpIcsSequencesForRoom itself: a single atomic UPDATE ... WHERE id IN
// (SELECT ...) — never a read-then-loop (DEC-078/DEC-492).
// ---------------------------------------------------------------------------

describe("bumpIcsSequencesForRoom (DEC-519/DEC-492: atomic set-based, never read-then-loop)", () => {
  it("issues exactly one UPDATE on schema.submission, scoped via a schedule_slot subquery keyed by room_id", async () => {
    const { bumpIcsSequencesForRoom } = await import("../src/server/repo/ics-sequence");
    const freshSchema = await import("../src/db/schema");
    const selectCalls: unknown[] = [];
    const updateCalls: { table: unknown; setValue: unknown; whereArg: unknown }[] = [];

    const subqueryChain = {
      from: (table: unknown) => {
        selectCalls.push(table);
        return {
          where: () => subqueryChain,
        };
      },
    };

    const db = {
      select: () => subqueryChain,
      update: (table: unknown) => ({
        set: (setValue: unknown) => ({
          where: (whereArg: unknown) => {
            updateCalls.push({ table, setValue, whereArg });
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as Db;

    await bumpIcsSequencesForRoom(db, "room-1");

    // Exactly one UPDATE statement, on the submission table, never a
    // per-submission loop.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.table).toBe(freshSchema.submission);
    // The select against schedule_slot is what scopes the affected set --
    // proves the bump is derived FROM the room's own schedule slots, not a
    // blanket update.
    expect(selectCalls).toContain(freshSchema.scheduleSlot);
  });
});

// ---------------------------------------------------------------------------
// 7. upsertSlot / unscheduleSlot (src/server/repo/agenda/slots.ts) -- the
// defect this task fixes. upsertSlot previously called bumpIcsSequences
// unconditionally, so a drag that lands back in place (or the SPA's
// optimistic re-PUT) churned every subscriber's calendar and
// submission.updatedAt (the Airtable sync cursor) with nothing to say. Both
// writes now use a real in-memory sqlite db (node:sqlite, matching
// test/api-views-cap.test.ts's established pattern) so the `setWhere` /
// `.returning()` UPSERT differential runs through actual SQL, not a
// hand-rolled fake that would just assert its own mock back.
// ---------------------------------------------------------------------------

const SLOT_DDL = `
create table schedule_slot (
  id text primary key,
  submission_id text unique,
  room_id text,
  day text,
  start_min integer,
  end_min integer,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  form_id text,
  seq integer,
  title text,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text not null default 'pending',
  content_status text not null default 'pending',
  accepted_at integer,
  ics_sequence integer not null default 0,
  external_ref text,
  created_at integer,
  updated_at integer
);
`;

function makeSlotTestDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SLOT_DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return db as unknown as Db;
}

async function insertSlotTestSubmission(db: Db, id: string) {
  await db.insert(schema.submission).values({
    id,
    eventId: "event-1",
    seq: 1,
    title: "T",
    icsSequence: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as never);
}

describe("upsertSlot / unscheduleSlot (DEC-519 wave-6 amendment: no-op differential)", () => {
  it("does NOT bump ics_sequence when the identical slot is PUT twice", async () => {
    const { upsertSlot } = await import("../src/server/repo/agenda/slots");
    const db = makeSlotTestDb();
    await insertSlotTestSubmission(db, "sub-1");
    const input = { day: "2026-06-01", startMin: 60, endMin: 90, roomId: "room-1" };
    await upsertSlot(db, "sub-1", input);
    const afterFirst = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(afterFirst[0]?.icsSequence).toBe(1);

    // Second PUT: identical values (the SPA's optimistic re-PUT / a drag
    // that lands back in place).
    await upsertSlot(db, "sub-1", input);
    const afterSecond = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(afterSecond[0]?.icsSequence).toBe(1); // unchanged, not 2
  });

  it("bumps ics_sequence when the room actually changes", async () => {
    const { upsertSlot } = await import("../src/server/repo/agenda/slots");
    const db = makeSlotTestDb();
    await insertSlotTestSubmission(db, "sub-1");
    await upsertSlot(db, "sub-1", { day: "2026-06-01", startMin: 60, endMin: 90, roomId: "room-1" });
    await upsertSlot(db, "sub-1", { day: "2026-06-01", startMin: 60, endMin: 90, roomId: "room-2" });
    const rows = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(rows[0]?.icsSequence).toBe(2);
  });

  it("bumps ics_sequence when the time actually changes", async () => {
    const { upsertSlot } = await import("../src/server/repo/agenda/slots");
    const db = makeSlotTestDb();
    await insertSlotTestSubmission(db, "sub-1");
    await upsertSlot(db, "sub-1", { day: "2026-06-01", startMin: 60, endMin: 90, roomId: "room-1" });
    await upsertSlot(db, "sub-1", { day: "2026-06-01", startMin: 61, endMin: 90, roomId: "room-1" });
    const rows = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(rows[0]?.icsSequence).toBe(2);
  });

  it("bumps ics_sequence on the initial insert (an insert always returns a row)", async () => {
    const { upsertSlot } = await import("../src/server/repo/agenda/slots");
    const db = makeSlotTestDb();
    await insertSlotTestSubmission(db, "sub-1");
    await upsertSlot(db, "sub-1", { day: "2026-06-01", startMin: 60, endMin: 90, roomId: "room-1" });
    const rows = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(rows[0]?.icsSequence).toBe(1);
  });

  it("unscheduleSlot does NOT bump when there is no slot to delete", async () => {
    const { unscheduleSlot } = await import("../src/server/repo/agenda/slots");
    const db = makeSlotTestDb();
    await insertSlotTestSubmission(db, "sub-with-no-slot");
    await unscheduleSlot(db, "sub-with-no-slot");
    const rows = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(rows[0]?.icsSequence).toBe(0); // untouched
  });

  it("unscheduleSlot bumps when an existing slot is actually deleted", async () => {
    const { upsertSlot, unscheduleSlot } = await import("../src/server/repo/agenda/slots");
    const db = makeSlotTestDb();
    await insertSlotTestSubmission(db, "sub-1");
    await upsertSlot(db, "sub-1", { day: "2026-06-01", startMin: 60, endMin: 90, roomId: "room-1" });
    await unscheduleSlot(db, "sub-1");
    const rows = (await db.select().from(schema.submission)) as { icsSequence: number }[];
    expect(rows[0]?.icsSequence).toBe(2); // 1 from the insert, 1 from the delete
  });
});
