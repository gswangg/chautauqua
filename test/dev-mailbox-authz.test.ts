// DEC-546: /dev/mailbox is organizer-only and scoped to the viewer's org.
// The wave-18 "public by design" disposition (docs/verification-log/
// task-w18-b-dev-mailbox-authz-stage1.md et al) rested on a false premise --
// re-read the RATIONALE, not the verdict (field guide, w34). This asserts
// the guard both ways: role-gated at the app.use() boundary (guardDevMailbox
// in src/server/app.ts) and org-scoped inside the repo layer (email.ts).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";

// Two messages, one per org, so an org-A organizer's cross-org id/ics probe
// exercises the real org-scoping path rather than a hand-waved mock.
const ORG_A_ROW = {
  id: "email-a",
  eventId: "event-a",
  eventName: "Org A Con",
  templateId: null,
  contactId: null,
  toEmail: "a@org-a.test",
  subject: "Org A message",
  bodyText: "hi",
  bodyHtml: null,
  icsText: "BEGIN:VCALENDAR...",
  icsFilename: "invite.ics",
  provider: "dev",
  status: "sent",
  sentAt: 1700000000000,
};
const ORG_B_ROW = { ...ORG_A_ROW, id: "email-b", eventId: "event-b", eventName: "Org B Con" };
const ROWS_BY_ORG: Record<string, typeof ORG_A_ROW> = { "org-a": ORG_A_ROW, "org-b": ORG_B_ROW };

vi.mock("../src/server/repo/email", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
  return {
    ...actual,
    listEmailLog: vi.fn(async (_db: unknown, params: { orgId?: string }) => {
      const row = params.orgId ? ROWS_BY_ORG[params.orgId] : undefined;
      return { items: row ? [row] : [], total: row ? 1 : 0 };
    }),
    getEmailLogById: vi.fn(async (_db: unknown, id: string, orgId: string) => {
      const row = ROWS_BY_ORG[orgId];
      return row && row.id === id ? row : null;
    }),
  };
});

const { devMailboxRoutes } = await import("../src/routes/dev/mailbox");

function buildApp(auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    if (auth) c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  guardDevMailbox(app);
  app.route("/", devMailboxRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-org-a", role: "organizer", orgId: "org-a" };
const ORGANIZER_B: AuthInfo = { userId: "u-org-b", role: "organizer", orgId: "org-b" };
const SPEAKER: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: "org-a" };
const REVIEWER: AuthInfo = { userId: "u-reviewer", role: "reviewer", orgId: "org-a" };

const DEV_ENV = { DEV_MODE: "1" } as unknown as AppEnv["Bindings"];
const PROD_ENV = {} as unknown as AppEnv["Bindings"];

const ROUTES = ["/dev/mailbox", "/dev/mailbox/email-a", "/dev/mailbox/email-a/ics"];

describe("DEC-546: /dev/mailbox is organizer-only", () => {
  it("anonymous redirects to /login (302) on all three routes", async () => {
    const app = buildApp(undefined);
    for (const path of ROUTES) {
      const res = await app.request(path, {}, DEV_ENV);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/login");
    }
  });

  it("speaker gets 403 on all three routes", async () => {
    const app = buildApp(SPEAKER);
    for (const path of ROUTES) {
      const res = await app.request(path, {}, DEV_ENV);
      expect(res.status).toBe(403);
    }
  });

  it("reviewer gets 403 on all three routes", async () => {
    const app = buildApp(REVIEWER);
    for (const path of ROUTES) {
      const res = await app.request(path, {}, DEV_ENV);
      expect(res.status).toBe(403);
    }
  });

  it("organizer gets 200 on all three routes", async () => {
    const app = buildApp(ORGANIZER_A);
    for (const path of ROUTES) {
      const res = await app.request(path, {}, DEV_ENV);
      expect(res.status).toBe(200);
    }
  });
});

describe("DEC-546: /dev/mailbox is org-scoped", () => {
  it("an organizer of org B gets 404 on an org-A message id and its /ics", async () => {
    const app = buildApp(ORGANIZER_B);
    const detail = await app.request("/dev/mailbox/email-a", {}, DEV_ENV);
    expect(detail.status).toBe(404);
    const ics = await app.request("/dev/mailbox/email-a/ics", {}, DEV_ENV);
    expect(ics.status).toBe(404);
  });

  it("an organizer of org B still gets 200 on their own org's message id", async () => {
    const app = buildApp(ORGANIZER_B);
    const detail = await app.request("/dev/mailbox/email-b", {}, DEV_ENV);
    expect(detail.status).toBe(200);
  });
});

describe("DEC-546/DEC-005: with DEV_MODE unset every route still 404s for an organizer", () => {
  it("404s (existence-hiding wins over the authz gate) on all three routes", async () => {
    const app = buildApp(ORGANIZER_A);
    for (const path of ROUTES) {
      const res = await app.request(path, {}, PROD_ENV);
      expect(res.status).toBe(404);
    }
  });
});
