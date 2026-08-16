// DEC-340 (wave 46 amendment): POST /api/v1/tasks/:id/assign must build its
// response grid from the CALLER's query string via parseOnboardingGridQuery
// (the same parser GET .../onboarding uses), not a hand-written literal.
// Same route-level mocking pattern as test/tasks-assign-org-scope.test.ts:
// Hono app mounted directly with a stamped auth var, repo layer mocked, no
// D1/wrangler dependency in stage 1.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { ContactRow } from "../src/server/repo/contacts";

const ORG_A = "org-a";
const TASK_ID = "task-1";
const EVENT_ID = "event-1";

const CONTACT_A1 = "contact-a1";

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
};

const getOnboardingGridCalls: { eventId: string; params: unknown }[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) =>
      taskId === TASK_ID ? { orgId: ORG_A, eventId: EVENT_ID } : null,
    ),
    assignTask: vi.fn(async () => {}),
    getOnboardingGrid: vi.fn(async (_db: unknown, eventId: string, params: unknown) => {
      getOnboardingGridCalls.push({ eventId, params });
      return {
        tasks: [],
        rows: [],
        total: 0,
        page: 1,
        perPage: 50,
        counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
      };
    }),
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

// See test/tasks-assign-org-scope.test.ts for why this beforeAll exists: the
// first dynamic import of src/routes/tasks.ts pays the whole transform cost
// of the route module + its repo barrel, which can blow past vitest's
// default per-test timeout if billed inside the first `it`.
beforeAll(async () => {
  await import("../src/routes/tasks");
}, 60_000);

afterEach(() => {
  vi.clearAllMocks();
  getOnboardingGridCalls.length = 0;
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

function assignRequest(qs: string) {
  return new Request(`http://test/api/v1/tasks/${TASK_ID}/assign${qs}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ contactIds: [CONTACT_A1] }),
  });
}

describe("DEC-340: POST /tasks/:id/assign echoes the caller's grid query", () => {
  it("passes the caller's page/perPage/q/status/overdueOnly/inviteStatus through to getOnboardingGrid", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      assignRequest("?page=3&perPage=25&q=ana&status=pending&overdueOnly=1&inviteStatus=accepted"),
    );
    expect(res.status).toBe(200);
    expect(getOnboardingGridCalls).toHaveLength(1);
    const call = getOnboardingGridCalls[0]!;
    expect(call.eventId).toBe(EVENT_ID);
    expect(call.params).toMatchObject({
      page: 3,
      perPage: 25,
      q: "ana",
      status: "pending",
      overdueOnly: true,
      inviteStatus: "accepted",
    });
  });

  it("includes inviteStatus in the params object (present, not omitted)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest("?inviteStatus=declined"));
    expect(res.status).toBe(200);
    const call = getOnboardingGridCalls[0]!;
    expect(call.params).toHaveProperty("inviteStatus");
    expect((call.params as { inviteStatus: unknown }).inviteStatus).toBe("declined");
  });

  it("defaults to page 1 / no filters when the caller sends no grid query, matching today's behaviour", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest(""));
    expect(res.status).toBe(200);
    const call = getOnboardingGridCalls[0]!;
    expect(call.params).toMatchObject({
      page: 1,
      q: null,
      taskId: null,
      status: null,
      overdueOnly: false,
      inviteStatus: null,
    });
  });

  it("throws the accumulate-then-throw ApiError('invalid') shape for a bad status token, naming the field", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(assignRequest("?status=bogus"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.status).toMatch(/pending/);
    expect(getOnboardingGridCalls).toHaveLength(0);
  });
});
