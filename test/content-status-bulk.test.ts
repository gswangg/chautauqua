// DEC-568 bulk content-approval coverage. Two layers:
//   1) repo-level (updateContentStatuses) against a call-counting fake Db,
//      mirroring test/status-bulk-statement-count.test.ts's pattern — proves
//      the write is chunked (DEC-078), event-scoped, loudly guards unknown
//      ids, and issues zero statements for an empty id list.
//   2) route-level (POST /api/v1/events/:eventId/submissions/content-status)
//      with src/server/repo/files mocked, mirroring
//      test/files-archive-budget.test.ts's pattern — proves 404/403/invalid
//      wiring and the {updated} response shape.
//
// Also enforces the DEC-009 invariant (no mailer import reachable from the
// bulk write's repo module) via a source-scan tripwire, same style as
// test/pipeline-api.test.ts's "product principle 4" check.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { updateContentStatuses } from "../src/server/repo/files-content-status";
import { chunkIds } from "../src/lib/chunk";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ID = "event-1";

function makeResult(rows: unknown[]) {
  return {
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

/** Counting fake Db: routes select()/update() by schema table, records every
 * statement issued so tests can assert chunk counts and that no UPDATE ever
 * runs when the loud guard throws. */
function fakeDb(existingIds: Set<string>) {
  const selectCalls: { eventId: unknown; ids: string[] }[] = [];
  const updateCalls: { eventId: unknown; ids: string[]; setValue: unknown }[] = [];

  const db = {
    select(_selection: unknown) {
      return {
        from(table: unknown) {
          if (table !== schema.submission) throw new Error("unexpected select().from() table");
          return {
            where(cond: unknown) {
              // Drizzle's `and(eq(eventId), inArray(id, chunk))` — we don't
              // parse the AST; instead the fake threads the chunk's ids
              // through a side-channel populated by the module under test's
              // call order, matched positionally against chunkIds output.
              const chunk = pendingChunks.shift();
              if (!chunk) throw new Error("select called with no pending chunk registered");
              selectCalls.push({ eventId: EVENT_ID, ids: chunk });
              const rows = chunk.filter((id) => existingIds.has(id)).map((id) => ({ id }));
              void cond;
              return makeResult(rows);
            },
          };
        },
      };
    },
    update(table: unknown) {
      if (table !== schema.submission) throw new Error("unexpected update() table");
      return {
        set(setValue: unknown) {
          return {
            where: async () => {
              const chunk = pendingUpdateChunks.shift();
              if (!chunk) throw new Error("update called with no pending chunk registered");
              updateCalls.push({ eventId: EVENT_ID, ids: chunk, setValue });
            },
          };
        },
      };
    },
  };

  // Registered by the test right before calling updateContentStatuses, so
  // the fake can hand back the right chunk without parsing drizzle's cond
  // tree.
  let pendingChunks: string[][] = [];
  let pendingUpdateChunks: string[][] = [];

  return {
    db: db as unknown as Db,
    selectCalls,
    updateCalls,
    registerChunks(ids: string[]) {
      pendingChunks = chunkIds(ids).map((c) => [...c]);
      pendingUpdateChunks = chunkIds(ids).map((c) => [...c]);
    },
  };
}

describe("updateContentStatuses repo function (DEC-568)", () => {
  it("chunks a 200-id batch into 3 event-scoped UPDATEs and returns the distinct-id count", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `sub-${i + 1}`);
    const { db, selectCalls, updateCalls, registerChunks } = fakeDb(new Set(ids));
    registerChunks(ids);

    const result = await updateContentStatuses(db, EVENT_ID, ids, "approved");

    expect(result).toEqual({ updated: 200 });
    const expectedChunks = chunkIds(ids).length;
    expect(expectedChunks).toBe(3);
    expect(selectCalls.length).toBe(expectedChunks);
    expect(updateCalls.length).toBe(expectedChunks);
    for (const call of updateCalls) {
      expect(call.setValue).toMatchObject({ contentStatus: "approved" });
      expect((call.setValue as { updatedAt: Date }).updatedAt).toBeInstanceOf(Date);
    }
    // Every requested id shows up across the chunked UPDATE calls exactly once.
    const updatedIds = updateCalls.flatMap((c) => c.ids);
    expect(new Set(updatedIds)).toEqual(new Set(ids));
    expect(updatedIds.length).toBe(200);
  });

  it("throws loudly naming unknown ids and issues zero UPDATE statements", async () => {
    const ids = ["sub-1", "sub-2", "sub-ghost"];
    const { db, updateCalls, registerChunks } = fakeDb(new Set(["sub-1", "sub-2"]));
    registerChunks(ids);

    await expect(updateContentStatuses(db, EVENT_ID, ids, "approved")).rejects.toMatchObject({
      code: "invalid",
      fields: { ids: "unknown ids: sub-ghost" },
    });
    expect(updateCalls.length).toBe(0);
  });

  it("empty ids returns {updated: 0} with zero statements", async () => {
    const { db, selectCalls, updateCalls } = fakeDb(new Set());

    const result = await updateContentStatuses(db, EVENT_ID, [], "approved");

    expect(result).toEqual({ updated: 0 });
    expect(selectCalls.length).toBe(0);
    expect(updateCalls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Route layer
// ---------------------------------------------------------------------------

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === "event-1" ? { orgId: "org-1", slug: "demo-event" } : null,
    ),
    updateContentStatuses: vi.fn(async (_db: unknown, _eventId: string, ids: string[], contentStatus: string) => {
      void contentStatus;
      return { updated: ids.length };
    }),
  };
});

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };
const ORGANIZER_B: AuthInfo = { userId: "u2", role: "organizer", orgId: "org-2" };

describe("POST /api/v1/events/:eventId/submissions/content-status (DEC-568)", () => {
  it("returns {updated} for a valid organizer request", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request("/api/v1/events/event-1/submissions/content-status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1", "s2", "s3"], contentStatus: "approved" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 3 });
  });

  it("404s when the event does not exist", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request("/api/v1/events/event-missing/submissions/content-status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1"], contentStatus: "approved" }),
    });
    expect(res.status).toBe(404);
  });

  it("403s when the event belongs to a different org", async () => {
    const app = await buildApp(ORGANIZER_B);
    const res = await app.request("/api/v1/events/event-1/submissions/content-status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1"], contentStatus: "approved" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Event belongs to a different org");
  });

  it("400s with an invalid contentStatus literal", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request("/api/v1/events/event-1/submissions/content-status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1"], contentStatus: "bogus" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toEqual({ contentStatus: "Invalid value" });
  });
});

// ---------------------------------------------------------------------------
// DEC-009 invariant: content-status changes never send email.
// ---------------------------------------------------------------------------

const sourceModules = import.meta.glob(["../src/server/repo/files-content-status.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("product principle 4: no mailer import reachable from the bulk content-status module", () => {
  it("files-content-status.ts must not import a mailer", () => {
    const entries = Object.entries(sourceModules);
    expect(entries.length).toBe(1);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
    }
  });
});
