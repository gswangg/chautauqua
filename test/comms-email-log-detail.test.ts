// DEC-833: GET /api/v1/events/:eventId/email-log/:emailId — the "Show what
// was sent" audit route. getEmailLogById is already org-scoped
// (src/server/repo/email.ts:184); this route additionally asserts the
// stored row's eventId matches the :eventId in the path, so an id belonging
// to a different event within the SAME org still 404s (object-level
// ownership, not just org scoping).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EmailLogRow } from "../src/server/repo/email";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

function row(overrides: Partial<EmailLogRow> = {}): EmailLogRow {
  return {
    id: "log-1",
    eventId: "evt-1",
    eventName: "DevCon",
    templateId: null,
    contactId: "ct-1",
    toEmail: "ada@example.com",
    subject: "You are in!",
    bodyText: "Hi Ada, welcome aboard.",
    bodyHtml: null,
    icsText: null,
    icsFilename: null,
    provider: "dev",
    status: "sent",
    sentAt: 1700000000000,
    ...overrides,
  };
}

const getEmailLogByIdMock = vi.fn(async (_db: unknown, id: string, _orgId: string) => {
  if (id === "log-1") return row();
  if (id === "log-foreign-event") return row({ id: "log-foreign-event", eventId: "evt-2" });
  if (id === "log-claim") {
    return row({
      id: "log-claim",
      bodyText: `Hi Ada, click https://events.example.com/claim/${"a".repeat(20)} to set your password.`,
      bodyHtml: `<p>Click <a href="https://events.example.com/claim/${"a".repeat(20)}">here</a></p>`,
    });
  }
  if (id === "log-reset") {
    return row({
      id: "log-reset",
      bodyText: `Hi Ada, reset your password: https://events.example.com/reset/${"b".repeat(20)}`,
      bodyHtml: `<p><a href="https://events.example.com/reset/${"b".repeat(20)}">Reset password</a></p>`,
    });
  }
  return null;
});

vi.mock("../src/server/repo/email", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
  return {
    ...actual,
    getEmailLogById: getEmailLogByIdMock,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

async function buildCommsApp() {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

describe("GET /api/v1/events/:eventId/email-log/:emailId (DEC-833)", () => {
  it("returns the full stored row, org-scoped through getEmailLogById", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/evt-1/email-log/log-1`, { method: "GET" }, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(row());
    expect(getEmailLogByIdMock).toHaveBeenCalledWith(expect.anything(), "log-1", ORG_A);
  });

  it("404s when the stored row's eventId does not match the path event, even though it belongs to the same org", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/email-log/log-foreign-event`,
      { method: "GET" },
      {},
    );

    expect(res.status).toBe(404);
  });

  it("404s when getEmailLogById returns null (unknown id, or belongs to a different org)", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/evt-1/email-log/unknown`, { method: "GET" }, {});

    expect(res.status).toBe(404);
  });

  // DEC-949: the organizer-readable audit view never renders a live claim
  // grant — a stored /claim/<token> URL is redacted on the way out.
  it("redacts a claim URL in bodyText and bodyHtml", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/evt-1/email-log/log-claim`, { method: "GET" }, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { bodyText: string; bodyHtml: string | null };
    expect(body.bodyText).toBe("Hi Ada, click https://events.example.com/claim/<redacted> to set your password.");
    expect(body.bodyText).not.toContain("aaaaaaaaaaaaaaaaaaaa");
    expect(body.bodyHtml).toBe('<p>Click <a href="https://events.example.com/claim/<redacted>">here</a></p>');
  });

  // DEC-949 (wave 34 amendment): a stored /reset/<token> URL — the
  // password-reset link src/routes/auth-reset.tsx mails — is just as much
  // a live account-takeover credential as a claim link, and is redacted
  // the same way through the real route (not just the pure helper).
  it("redacts a reset URL in bodyText and bodyHtml", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/evt-1/email-log/log-reset`, { method: "GET" }, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { bodyText: string; bodyHtml: string | null };
    expect(body.bodyText).toBe("Hi Ada, reset your password: https://events.example.com/reset/<redacted>");
    expect(body.bodyText).not.toContain("bbbbbbbbbbbbbbbbbbbb");
    expect(body.bodyHtml).toBe('<p><a href="https://events.example.com/reset/<redacted>">Reset password</a></p>');
  });
});
