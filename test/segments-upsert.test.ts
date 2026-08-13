// DEC-809: POST /segments upserts on org-scoped name collision instead of
// twinning. A same-name re-save updates the existing row's rules (one row
// after two saves) rather than inserting a second segment.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
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

  vi.doMock("../src/server/repo/contacts", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
    return {
      ...actual,
      findSegmentByNameForOrg: vi.fn(async (_db: unknown, orgId: string, name: string) => {
        return rows.find((r) => r.orgId === orgId && r.name === name) ?? null;
      }),
      createSegment: vi.fn(async (_db: unknown, orgId: string, name: string, rules: unknown[]) => {
        const row: FakeRow = { id: `seg${nextId++}`, orgId, name, rulesJson: JSON.stringify(rules), createdAt: 0, updatedAt: 0 };
        rows.push(row);
        return row;
      }),
      patchSegment: vi.fn(async (_db: unknown, id: string, patch: { name?: string; rules?: unknown[] }) => {
        const row = rows.find((r) => r.id === id);
        if (!row) throw new Error(`segment ${id} not found`);
        if (patch.name !== undefined) row.name = patch.name;
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
