// DEC-856 (wave 60 amendment): the bulk-email refusal must name the person,
// not their opaque contactId. All three refusal sites in
// src/routes/api/contacts/bulk-email.ts (preview, the pre-mint preflight in
// POST /contacts/bulk-email, and the post-mint re-check) build their fields
// map keyed by the recipient's EMAIL with a value naming them and every
// missing merge-field token, and the ApiError's own message leads with the
// count and the token(s).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";

function contactRow(overrides: Partial<ContactRow> & { id: string; firstName: string; lastName: string; email: string }): ContactRow {
  return {
    orgId: "org1",
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

const ADA = contactRow({ id: "ct_ada", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
const GRACE = contactRow({ id: "ct_grace", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" });

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return [ADA, GRACE].filter((c) => ids.includes(c.id));
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

const mailerSendMock = vi.fn(async () => {});
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
  app.route("/api/v1", contactsRoutes);
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

type ErrorEnvelope = { error: { code: string; message: string; fields?: Record<string, string> } };

describe("bulk-email refusal names the recipient (DEC-856 wave 60 amendment)", () => {
  it("preview: keys fields by email, names the person + token, and no ULID leaks into the message or keys", async () => {
    const app = buildApp();
    const res = await postJson(app, "/api/v1/contacts/bulk-email/preview", {
      contactIds: ["ct_ada", "ct_grace"],
      eventId: "ev1",
      subject: "Congrats on {talk_title}",
      bodyText: "Hi {speaker_name}",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toBeDefined();
    const fields = body.error.fields ?? {};
    expect(Object.keys(fields).sort()).toEqual(["ada@example.com", "grace@example.com"]);
    expect(fields["ada@example.com"]).toBe("Ada Lovelace is missing {talk_title}");
    expect(fields["grace@example.com"]).toBe("Grace Hopper is missing {talk_title}");
    expect(body.error.message).toContain("2 of 2 recipients are missing {talk_title}");
    expect(body.error.message).not.toMatch(/ct_ada|ct_grace/);
    expect(JSON.stringify(body)).not.toMatch(/ct_ada|ct_grace/);
  });

  it("send: the pre-mint preflight refuses by email/name before any KV write", async () => {
    const app = buildApp();
    const puts: unknown[] = [];
    const res = await app.request(
      "/api/v1/contacts/bulk-email",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          contactIds: ["ct_ada"],
          eventId: "ev1",
          subject: "Congrats on {talk_title}",
          bodyText: "Hi {speaker_name}",
        }),
      },
      { KV: { put: (...a: unknown[]) => puts.push(a), get: () => null, delete: () => {} }, PUBLIC_BASE_URL: "https://events.example.com" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    const fields = body.error.fields ?? {};
    expect(fields["ada@example.com"]).toBe("Ada Lovelace is missing {talk_title}");
    expect(Object.keys(fields)).not.toContain("ct_ada");
    // zero KV writes -- the refusal happened before minting.
    expect(puts).toHaveLength(0);
    expect(mailerSendMock).not.toHaveBeenCalled();
  });
});
