// DEC-238 class 2 (organizer-triggered batch): POST /contacts/bulk-email
// must not abort the whole send when one recipient's mailer.send() throws —
// every other recipient still gets sent, and the response reports a
// structured {sent, failed} summary (never a 500). Mirrors the mocking
// pattern in test/contacts-bulk-email-preview-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";

function contactRow(overrides: Partial<ContactRow> & { id: string }): ContactRow {
  return {
    orgId: "org1",
    firstName: "First",
    lastName: "Last",
    email: `${overrides.id}@example.com`,
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
    ...overrides,
  };
}

const GOOD_CONTACT = contactRow({ id: "ct_good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" });
const BAD_CONTACT = contactRow({ id: "ct_bad", firstName: "Grace", lastName: "Hopper", email: "bad@example.com" });

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return [GOOD_CONTACT, BAD_CONTACT].filter((c) => ids.includes(c.id));
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: (...args: Parameters<typeof findContactsForOrgMock>) => findContactsForOrgMock(...args),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      orgId === "org1" && eventId === "ev1" ? { id: "ev1", name: "DevCon" } : null,
    ),
  };
});

vi.mock("../src/auth/claim", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/claim")>("../src/auth/claim");
  return {
    ...actual,
    createClaimToken: vi.fn(async () => "tok123"),
  };
});

const mailerSendMock = vi.fn(async (mail: { to: { email: string } }) => {
  if (mail.to.email === "bad@example.com") {
    throw new Error("simulated provider rejection");
  }
});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: mailerSendMock })),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", contactsRoutes);
  return app;
}

function postJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: {} },
  );
}

describe("POST /contacts/bulk-email — partial mailer failure (DEC-238 class 2)", () => {
  it("never 500s; sends the good recipient, reports the bad one in 'failed'", async () => {
    const app = buildApp();
    const res = await postJson(app, "/contacts/bulk-email", {
      contactIds: ["ct_good", "ct_bad"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sent: number;
      failed: { email: string; message: string }[];
      items: unknown[];
    };
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("bad@example.com");
    expect(body.failed[0]?.message).toContain("simulated provider rejection");
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
  });
});
