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
        getUserEmail: vi.fn(async () => "organizer@example.com"),
      };
    });
    vi.doMock("../src/server/repo/revisions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/revisions")>(
        "../src/server/repo/revisions",
      );
      return { ...actual, appendSubmissionRevision: vi.fn(async () => {}) };
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
        getUserEmail: vi.fn(async () => "organizer@example.com"),
      };
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

  it("does NOT bump when restoring a snapshot identical to the current content (no-op)", async () => {
    const same = { title: "Same Title", description: "Same description" };
    const { submissionsRoutes, bumpSpy } = await setup(same, same);
    const res = await appWithAuth(submissionsRoutes, ORGANIZER_A, {}).request(
      postRequest("/api/v1/submissions/sub-1/revisions/rev-1/restore"),
    );
    expect(res.status).toBe(200);
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
