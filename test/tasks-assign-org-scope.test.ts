// DEC-120 regression: POST /api/v1/tasks/:id/assign must reject contact ids
// that belong to a different org, atomically (no partial task_assignment
// rows written), before calling assignTask. Repo layer is mocked so this is
// a pure route-level access-decision test — same pattern as
// test/task-file-access.test.ts (Hono app mounted directly with a stamped
// auth var, no D1/wrangler dependency in stage 1).

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { ContactRow } from "../src/server/repo/contacts";

const ORG_A = "org-a";
const TASK_ID = "task-1";
const EVENT_ID = "event-1";

const CONTACT_A1 = "contact-a1";
const CONTACT_A2 = "contact-a2";
const CONTACT_B1 = "contact-b1"; // belongs to ORG_B

function orgContactRow(id: string, orgId: string, firstName = "F", lastName = "L"): ContactRow {
  return {
    id,
    orgId,
    firstName,
    lastName,
    email: `${id}@example.com`,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

const ORG_A_CONTACTS: Record<string, ContactRow> = {
  [CONTACT_A1]: orgContactRow(CONTACT_A1, ORG_A, "Alice", "Anderson"),
  [CONTACT_A2]: orgContactRow(CONTACT_A2, ORG_A, "Bob", "Brown"),
};

// DEC-856: a 26-char Crockford-base32-shaped id, standing in for a real ULID
// -- the refusal must never echo an id shaped like this back to the caller.
const CONTACT_B1_ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const assignTaskCalls: { taskId: string; contactIds: string[] }[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) =>
      taskId === TASK_ID ? { orgId: ORG_A, eventId: EVENT_ID } : null,
    ),
    assignTask: vi.fn(async (_db: unknown, taskId: string, contactIds: string[]) => {
      assignTaskCalls.push({ taskId, contactIds });
    }),
    getOnboardingGrid: vi.fn(async () => ({
      tasks: [],
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
    })),
    // DEC-754 (wave 38 amendment): this suite exercises DEC-120's org-scope
    // check only -- the roster resolver is mocked to treat every id it's
    // asked about as ON the roster, so it never masks or interferes with
    // the org-scope assertions below.
    filterRosterContactIds: vi.fn(async (_db: unknown, _eventId: string, contactIds: string[]) => new Set(contactIds)),
  };
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: vi.fn(async (_db: unknown, ids: string[], orgId: string) =>
      ids
        .map((id) => ORG_A_CONTACTS[id])
        .filter((row): row is ContactRow => row !== undefined && row.orgId === orgId),
    ),
  };
});

// buildApp() dynamically imports the route module, and that first import pays
// the whole transform cost of src/routes/tasks.ts + its repo barrel (~3s on an
// idle machine). Billed inside the first `it`, that alone can exceed vitest's
// 5s default testTimeout when the full suite runs its files in parallel -- and
// a timed-out request still resolves later, pushing into assignTaskCalls after
// afterEach cleared it and failing the *next* test. Warm the module registry
// here, in a hook with its own generous timeout, so each test only measures
// request handling.
beforeAll(async () => {
  await import("../src/routes/tasks");
}, 60_000);

afterEach(() => {
  vi.clearAllMocks();
  assignTaskCalls.length = 0;
});

async function buildApp(auth: AuthInfo) {
  const { taskRoutes } = await import("../src/routes/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", taskRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function assignRequest(contactIds: unknown[]) {
  return new Request(`http://test/api/v1/tasks/${TASK_ID}/assign`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ contactIds }),
  });
}

describe("DEC-120: POST /tasks/:id/assign rejects cross-org contact ids", () => {
  it("assigns successfully when every contact id belongs to the caller's org", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest([CONTACT_A1, CONTACT_A2]));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      tasks: [],
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
    });
    expect(assignTaskCalls).toHaveLength(1);
    expect(assignTaskCalls[0]?.contactIds.sort()).toEqual([CONTACT_A1, CONTACT_A2].sort());
  });

  it("400s and writes zero assignments when a contact belongs to a different org", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest([CONTACT_A1, CONTACT_B1]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    // DEC-856 amendment: the refusal must never print the raw id -- it names
    // the resolved contact (the caller can act on) and counts the rest.
    expect(body.error.fields?.contactIds).not.toContain(CONTACT_B1);
    expect(body.error.fields?.contactIds).toContain("Alice Anderson");
    expect(body.error.fields?.contactIds).toMatch(/^1 selected row/);
    expect(assignTaskCalls).toHaveLength(0);
  });

  it("400s and writes zero assignments for a mixed valid+invalid batch (no partial assignment)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest([CONTACT_A1, CONTACT_A2, CONTACT_B1]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).not.toContain(CONTACT_B1);
    expect(body.error.fields?.contactIds).toContain("Alice Anderson");
    expect(body.error.fields?.contactIds).toContain("Bob Brown");
    expect(body.error.fields?.contactIds).toMatch(/^1 selected row/);
    expect(assignTaskCalls).toHaveLength(0);
  });

  it("400s with a stale-selection sentence (not an id list) when nothing resolves", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest([CONTACT_B1]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.fields?.contactIds).toContain("selection is stale");
    expect(body.error.fields?.contactIds).toContain("refresh");
    expect(body.error.fields?.contactIds).not.toContain(CONTACT_B1);
  });

  it("never echoes a ULID-shaped id anywhere in the response body", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest([CONTACT_A1, CONTACT_B1_ULID]));
    expect(res.status).toBe(400);
    const raw = await res.text();
    expect(raw).not.toMatch(/\b[0-9A-Za-z]{26}\b/);
  });
});
