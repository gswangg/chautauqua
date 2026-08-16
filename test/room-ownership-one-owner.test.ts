// DEC-248 (wave 4 amendment): roomBelongsToEvent must have exactly one
// exported declaration under src/ -- it was previously duplicated
// byte-identically in src/server/repo/agenda/rows.ts and
// src/server/repo/embeds.ts. The agenda repo is the room's home surface and
// keeps the single declaration; every other call site imports it.
//
// This test asserts (1) the scan invariant -- exactly one export -- fails
// loudly by naming every offending file if a second copy reappears, and (2)
// the predicate is actually wired end to end: a room from a FOREIGN event is
// refused on both the agenda slot-write path and the embed create path.

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const SRC_ROOT = join(__dirname, "..", "src");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full));
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("roomBelongsToEvent has exactly one owner (DEC-248 scan)", () => {
  it("exactly one `export ... function roomBelongsToEvent` exists under src/", () => {
    const files = listFiles(SRC_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/export\s+(async\s+)?function\s+roomBelongsToEvent\b/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `expected exactly one roomBelongsToEvent declaration, found: ${offenders.join(", ")}`).toHaveLength(1);
    expect(offenders[0]).toMatch(/src\/server\/repo\/agenda\/rows\.ts$/);
  });
});

describe("PUT /submissions/:id/slot refuses a foreign-event room (DEC-073 via the owned predicate)", () => {
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      as: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  function appWithDb(selects: unknown[][]) {
    let call = 0;
    const writeChain: any = {
      values: () => writeChain,
      set: () => writeChain,
      onConflictDoUpdate: async () => undefined,
      where: async () => undefined,
    };
    const db = {
      select: () => {
        const rows = selects[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
      insert: () => writeChain,
      update: () => writeChain,
    } as unknown as AppEnv["Variables"]["db"];

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", auth);
      await next();
    });
    return app;
  }

  it("400s with a roomId field error for a room belonging to a different event", async () => {
    const { agendaRoutes } = await import("../src/routes/agenda");
    const app = appWithDb([[{ eventId: "event1", orgId: "org1", status: "accepted" }], []]);
    app.route("/api/v1", agendaRoutes);

    const res = await app.request(
      "/api/v1/submissions/sub1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room-from-other-event" }),
      },
      {} as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roomId).toBeTruthy();
  });
});

describe("POST /api/v1/events/:eventId/embeds refuses a foreign-event roomId (DEC-839 via the owned predicate)", () => {
  const ORG_A = "org-a";
  const EVENT_ID = "event-1";
  const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

  it("400s naming roomId when the room belongs to a different event", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>("../src/server/repo/submissions");
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    vi.doMock("../src/server/repo/embeds", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/embeds")>("../src/server/repo/embeds");
      return { ...actual, countEmbeds: vi.fn(async () => 0) };
    });
    vi.doMock("../src/server/repo/agenda/rows", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/agenda/rows")>("../src/server/repo/agenda/rows");
      return { ...actual, roomBelongsToEvent: vi.fn(async () => false) };
    });

    const { embedsRoutes } = await import("../src/routes/api/embeds");

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", {} as AppEnv["Variables"]["db"]);
      c.set("auth", ORGANIZER_A);
      await next();
    });
    app.route("/api/v1", embedsRoutes);

    const res = await app.request(
      new Request(`http://local/api/v1/events/${EVENT_ID}/embeds`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ name: "Widget", surface: "sessions", format: "iframe", options: { roomId: "room-from-other-event" } }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.fields?.roomId).toBeTruthy();

    vi.doUnmock("../src/server/repo/submissions");
    vi.doUnmock("../src/server/repo/embeds");
    vi.doUnmock("../src/server/repo/agenda/rows");
  });
});
