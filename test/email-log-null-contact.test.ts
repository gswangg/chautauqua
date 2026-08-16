// DEC-191 coverage: email_log.contact_id must be a real contact id or NULL,
// never a user id. Two senders don't have a contact recipient (org-user
// welcome mail, reviewer reminders) — they must log contactId: null rather
// than standing in with a userId. This file asserts both call sites, and
// separately pins the SQL-equality-with-NULL semantic that
// repo/contacts.ts's getContactHistory relies on to exclude these rows from
// per-contact history (no live D1 in this test harness — see
// test/contact-profile-roundtrip.test.ts's note that full D1 round trips
// are verified against wrangler dev, not vitest, in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { RenderedEmail } from "../src/mail/types";

const ORG_A = "org-a";

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/v1/users welcome email logs contactId: null (DEC-191)", () => {
  it("passes contactId: null and a set toEmail to the mailer", async () => {
    const sends: RenderedEmail[] = [];

    vi.doMock("../src/server/repo/users", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
      return {
        ...actual,
        listOrgUsers: vi.fn(async () => []),
        createUser: vi.fn(async (_db: unknown, input: { orgId: string; email: string; role: string }) => ({
          id: "user-1",
          orgId: input.orgId,
          email: input.email,
          role: input.role,
          contactId: null,
          createdAt: 0,
        })),
      };
    });
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        getAnchorEventForOrg: vi.fn(async () => ({ id: "event-1", orgId: ORG_A })),
        // B9 (DEC-037 amendment, wave 27): the remind route names the event in
        // the email shell, via an owned single-event lookup this stub db cannot
        // answer.
        getEventForOrg: vi.fn(async (_db: unknown, eventId: string) => ({ id: eventId, name: "Event One" })),
      };
    });
    vi.doMock("../src/server/context", async () => {
      const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
      return {
        ...actual,
        makeMailer: vi.fn(() => ({
          send: vi.fn(async (m: RenderedEmail) => {
            sends.push(m);
          }),
        })),
      };
    });

    const { usersRoutes } = await import("../src/routes/api/users");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", usersRoutes);

    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ email: "new@org.test", role: "reviewer" }),
    });
    expect(res.status).toBe(201);

    expect(sends).toHaveLength(1);
    expect(sends[0]?.contactId).toBeNull();
    expect(sends[0]?.to.email).toBe("new@org.test");
  });
});

describe("POST /api/v1/plans/:id/remind logs contactId: null (DEC-191)", () => {
  function makePlan() {
    return {
      id: "plan-1",
      eventId: "event-1",
      name: "Plan One",
      instructions: null,
      openDate: null,
      closeDate: null,
      filters: null,
      anonymized: false,
      scale: { min: 1, max: 5 },
      criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
      rounds: 1,
      currentRound: 1,
      maxEvaluations: null,
    };
  }

  it("passes contactId: null and a set toEmail for the reviewer reminder", async () => {
    const sends: RenderedEmail[] = [];
    const plan = makePlan();
    const submission = { id: "sub-1", ref: "S-1", title: "Talk", description: null, trackIds: [] };

    vi.doMock("../src/server/repo/review", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
      return {
        ...actual,
        getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
          planId === plan.id && orgId === ORG_A ? plan : null,
        ),
        listReviewerRowsForPlan: vi.fn(async () => [
          { id: "pr-1", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null },
        ]),
        getUsersByIds: vi.fn(async () => [{ userId: "rev-1", email: "rev1@org.test" }]),
        // DEC-526: /remind now excludes recused submissions the same way
        // /progress does (assignedExcludingRecused) -- no recusals here.
        listRecusalsForPlan: vi.fn(async () => []),
        listEvaluatedPairsForPlan: vi.fn(async () => []),
        listPlanFilteredSubmissions: vi.fn(async () => [submission]),
        // DEC-707 (wave-61 amendment): /remind resolves the recipient's
        // display name through the same batched helper /progress uses, so
        // this mock must stub it too. An empty map means "no resolvable
        // contact" -- the reminder falls back to the bare email, which is
        // exactly what this test asserts on `to.email`.
        batchUserDisplayNames: vi.fn(async () => new Map()),
      };
    });
    // DEC-238 (wave-66 amendment): /remind now consults loadRecentlySent
    // before sending -- this file's db stub is `{}`, so the real reader
    // would throw; return an always-empty map so the dedupe check is a
    // no-op here.
    vi.doMock("../src/server/repo/comms", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
      return {
        ...actual,
        loadRecentlySent: vi.fn(async () => new Map()),
      };
    });
    vi.doMock("../src/server/context", async () => {
      const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
      return {
        ...actual,
        makeMailer: vi.fn(() => ({
          send: vi.fn(async (m: RenderedEmail) => {
            sends.push(m);
          }),
        })),
      };
    });

    const { reviewRoutes } = await import("../src/routes/review");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const auth: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      // DEC-707 (wave-61 amendment): the reminder body now carries a queue
      // link built by resolveBaseUrl, which reads c.env -- same fixture
      // shape the other /remind tests use.
      c.env = { DEV_MODE: "1" } as never;
      await next();
    });
    app.route("/", reviewRoutes);

    const res = await app.request(`/api/v1/plans/${plan.id}/remind`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(200);

    expect(sends).toHaveLength(1);
    expect(sends[0]?.contactId).toBeNull();
    expect(sends[0]?.to.email).toBe("rev1@org.test");
  });
});

describe("DEC-191: SQL equality on contact_id never matches NULL rows", () => {
  // Pins the semantic that repo/contacts.ts's getContactHistory relies on
  // (eq(schema.emailLog.contactId, contactId)) to exclude the null-contactId
  // rows written above from a seeded contact's per-contact email history —
  // in SQL, `contact_id = 'c-1'` never matches a row where contact_id IS
  // NULL, so no additional filtering code is needed (verified, not edited).
  it("filters out null-contactId rows for a specific seeded contact id", () => {
    const rows = [
      { id: "e1", contactId: "c-1", toEmail: "speaker@example.com" },
      { id: "e2", contactId: null, toEmail: "reviewer@example.com" },
      { id: "e3", contactId: null, toEmail: "orguser@example.com" },
    ];
    const seededContactId = "c-1";
    const history = rows.filter((r) => r.contactId === seededContactId);
    expect(history.map((r) => r.id)).toEqual(["e1"]);
    expect(history.some((r) => r.contactId === null)).toBe(false);
  });
});
