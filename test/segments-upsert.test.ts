// DEC-809 (amendment wave 38): POST /segments upserts on org-scoped name
// collision instead of twinning, and the collision is now a DB contract
// (segment_org_id_name_idx, migrations/0031_segment_name_unique.sql)
// enforced by a single atomic onConflictDoUpdate rather than a
// findSegmentByNameForOrg read followed by an insert-or-patch.

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { registerErrorHandler, ApiError } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function makeApp(mount: (app: Hono<AppEnv>) => void, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("auth", auth);
    await next();
  });
  mount(app);
  return app;
}

interface FakeRow {
  id: string;
  orgId: string;
  name: string;
  rulesJson: string;
  createdAt: number;
  updatedAt: number;
}

afterEach(() => {
  vi.doUnmock("../src/server/repo/contacts");
  vi.resetModules();
});

async function buildSegmentsApp(auth: AuthInfo = ORGANIZER_A) {
  const rows: FakeRow[] = [];
  let nextId = 1;
  let nextTime = 1;

  vi.doMock("../src/server/repo/contacts", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
    return {
      ...actual,
      findSegmentForOrg: vi.fn(async (_db: unknown, id: string, orgId: string) => {
        return rows.find((r) => r.id === id && r.orgId === orgId) ?? null;
      }),
      // Mirrors the real repo's atomic insert-or-update-by-(orgId,name):
      // createdAt === updatedAt on the returned row iff this call minted it.
      upsertSegmentByName: vi.fn(async (_db: unknown, orgId: string, name: string, rules: unknown[]) => {
        const existing = rows.find((r) => r.orgId === orgId && r.name === name);
        const now = nextTime++;
        if (existing) {
          existing.rulesJson = JSON.stringify(rules);
          existing.updatedAt = now;
          return existing;
        }
        const row: FakeRow = { id: `seg${nextId++}`, orgId, name, rulesJson: JSON.stringify(rules), createdAt: now, updatedAt: now };
        rows.push(row);
        return row;
      }),
      // Mirrors the real repo's unique-index collision surfacing (DEC-809
      // amendment): renaming onto another row's name in the same org 400s.
      patchSegment: vi.fn(async (_db: unknown, id: string, patch: { name?: string; rules?: unknown[] }) => {
        const row = rows.find((r) => r.id === id);
        if (!row) throw new Error(`segment ${id} not found`);
        if (patch.name !== undefined) {
          const collision = rows.find((r) => r.id !== id && r.orgId === row.orgId && r.name === patch.name);
          if (collision) {
            throw new ApiError("invalid", "A segment with this name already exists", { name: "A segment with this name already exists" });
          }
          row.name = patch.name;
        }
        if (patch.rules !== undefined) row.rulesJson = JSON.stringify(patch.rules);
        return row;
      }),
    };
  });
  const { contactsRoutes } = await import("../src/routes/api/contacts");
  return { app: makeApp((app) => app.route("/api/v1", contactsRoutes), auth), rows };
}

describe("POST /api/v1/segments upsert-by-name (DEC-809)", () => {
  it("a second save with the same name updates the existing row instead of inserting a twin", async () => {
    const { app, rows } = await buildSegmentsApp();

    const first = await app.request("/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "VIP speakers", rules: [{ field: "company", op: "eq", value: "Acme" }] }),
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { id: string };

    const second = await app.request("/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "VIP speakers", rules: [{ field: "company", op: "eq", value: "Zenith" }] }),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { id: string; rules: unknown[] };

    // Same id — the re-save is a save, not a twin.
    expect(secondBody.id).toBe(firstBody.id);
    // Only one row for this org exists after two saves.
    expect(rows.filter((r) => r.orgId === ORG_A && r.name === "VIP speakers")).toHaveLength(1);
    // Rules were updated to the second save's rules.
    expect(secondBody.rules).toEqual([{ field: "company", op: "eq", value: "Zenith" }]);
  });

  it("the same-name lookup is org-scoped: another org's same-named segment is untouched", async () => {
    const { app, rows } = await buildSegmentsApp();
    rows.push({ id: "seg-other-org", orgId: ORG_B, name: "VIP speakers", rulesJson: "[]", createdAt: 0, updatedAt: 0 });

    const res = await app.request("/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "VIP speakers", rules: [] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).not.toBe("seg-other-org");
    expect(rows.filter((r) => r.name === "VIP speakers")).toHaveLength(2);
  });
});

describe("PATCH /api/v1/segments/:id rename collision (DEC-809 amendment)", () => {
  it("renaming onto an existing name in the same org is a loud 400, not a 500", async () => {
    const { app } = await buildSegmentsApp();

    const a = await app.request("/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Keynote speakers", rules: [] }),
    });
    const b = await app.request("/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Panelists", rules: [] }),
    });
    const bBody = (await b.json()) as { id: string };
    void a;

    const rename = await app.request(`/api/v1/segments/${bBody.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Keynote speakers" }),
    });
    expect(rename.status).toBe(400);
    const body = (await rename.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.name).toBeTruthy();
  });
});

// DEC-554 (amendment, wave 11): the write-door test for the shared
// isSegmentField predicate lives in test/segment-rules-bounds.test.ts
// (static-import pattern, matching that file's existing POST/PATCH route
// coverage) rather than here -- this file's per-test vi.doMock +
// vi.resetModules() cycle proved to leak module identity across tests
// (an ApiError thrown from a PATCH handler here, following an earlier
// test in this file whose own request errored, intermittently failed
// `instanceof ApiError` in registerErrorHandler and surfaced as an
// unrelated 500; reproducible with a two-test minimal repro, unrelated to
// this task's domain change). Flagging as a pre-existing harness gap
// rather than working around it inside this file.

describe("migrations/0031_segment_name_unique.sql shape", () => {
  it("de-collides existing rows before creating the unique index", () => {
    const sql = readFileSync(join(__dirname, "..", "migrations", "0031_segment_name_unique.sql"), "utf8");
    const updateIdx = sql.search(/UPDATE\s+`segment`/i);
    const createIdx = sql.search(/CREATE\s+UNIQUE\s+INDEX\s+`segment_org_id_name_idx`/i);
    expect(updateIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(updateIdx);
  });
});
