// DEC-182 (wave-32 amendment): POST /contacts/bulk-email must consume
// parseBoundedIdArray's deduped RESULT, not re-read the raw request body.
// Before the fix, a repeated contactId made the full-match check
// (`contacts.length !== contactIds.length`) compare a deduped
// findContactsForOrg result against the still-duplicated raw array, so the
// route 404'd with "One or more contacts not found" instead of sending —
// and if the repeat straddled a chunk boundary it would have double-mailed.
// This test proves: exactly one send per DISTINCT contact, and no 404.

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

const ALL_CONTACTS: ContactRow[] = [
  contactRow({ id: "ct_1", firstName: "Speaker1", lastName: "Test" }),
  contactRow({ id: "ct_2", firstName: "Speaker2", lastName: "Test" }),
];

// Mirrors real findContactsForOrg semantics: one row per DISTINCT matching
// id, regardless of how many times an id appears in the input array.
const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  const distinct = Array.from(new Set(ids));
  return ALL_CONTACTS.filter((c) => distinct.includes(c.id));
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
    createClaimToken: vi.fn(actual.createClaimToken),
  };
});

const mailerSendMock = vi.fn(async (_attempt: { to: { email: string } }) => {});
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
    { KV: { put: () => {}, get: () => null, delete: () => {} }, PUBLIC_BASE_URL: "https://events.example.com" },
  );
}

describe("POST /contacts/bulk-email with a repeated contactId (DEC-182)", () => {
  it("sends exactly one message per distinct contact and never 404s", async () => {
    const app = buildApp();
    const res = await postJson(app, "/contacts/bulk-email", {
      // ct_1 is repeated three times; parseBoundedIdArray must dedupe this
      // before the org-lookup and full-match check run.
      contactIds: ["ct_1", "ct_1", "ct_2", "ct_1"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: unknown[] };
    expect(body.sent).toBe(2);
    expect(body.failed).toHaveLength(0);
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
    const sentEmails = mailerSendMock.mock.calls.map((call) => call[0].to.email).sort();
    expect(sentEmails).toEqual(["ct_1@example.com", "ct_2@example.com"]);
  });
});
