// Route-level test for CRM-11 (DEC-150): POST /contacts/bulk-email/preview
// shares its merge-field rendering with POST /contacts/bulk-email (no
// duplicated logic), caps output at 5 recipients, and rejects over-cap or
// foreign (not-org-owned) contactIds without ever writing to email_log.

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

const ALL_CONTACTS: ContactRow[] = Array.from({ length: 6 }, (_, i) =>
  contactRow({ id: `ct_${i + 1}`, firstName: `Speaker${i + 1}`, lastName: "Test" }),
);

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return ALL_CONTACTS.filter((c) => ids.includes(c.id));
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: (...args: Parameters<typeof findContactsForOrgMock>) => findContactsForOrgMock(...args),
    findAccountUserId: vi.fn(async () => null),
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
    // DEC-397 tests below assert on how many times the underlying kv.put is
    // called, so this delegates to the real implementation (which does call
    // kv.put) rather than returning a canned token with no KV write.
    createClaimToken: vi.fn(actual.createClaimToken),
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

describe("POST /contacts/bulk-email/preview (CRM-11, DEC-150)", () => {
  it("renders merge fields for recipients using the same helper as send, without sending mail", async () => {
    const app = buildApp();
    const res = await postJson(app, "/contacts/bulk-email/preview", {
      contactIds: ["ct_1", "ct_2"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { contactId: string; email: string; subject: string; bodyText: string }[] };
    expect(body.items).toHaveLength(2);
    const [first] = body.items;
    if (!first) throw new Error("expected a rendered item");
    expect(first.subject).toBe("Hi Speaker1 Test");
    expect(first.bodyText).toContain("DevCon");
    // DEC-397: preview never mints credentials — the fixed placeholder
    // token renders instead of a freshly minted claim token.
    expect(first.bodyText).toContain("/claim/example-one-time-link");
    expect(mailerSendMock).not.toHaveBeenCalled();
  });

  it("caps preview output at 5 recipients even when more contactIds are supplied", async () => {
    const app = buildApp();
    const res = await postJson(app, "/contacts/bulk-email/preview", {
      contactIds: ["ct_1", "ct_2", "ct_3", "ct_4", "ct_5", "ct_6"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "Body",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(5);
    expect(mailerSendMock).not.toHaveBeenCalled();
  });

  it("rejects a batch exceeding the 100-recipient cap", async () => {
    const app = buildApp();
    const contactIds = Array.from({ length: 101 }, (_, i) => `ct_${i}`);
    const res = await postJson(app, "/contacts/bulk-email/preview", {
      contactIds,
      eventId: "ev1",
      subject: "Hi",
      bodyText: "Body",
    });
    expect(res.status).toBe(400);
  });

  it("rejects contactIds that don't belong to this org (foreign/IDOR)", async () => {
    const app = buildApp();
    const res = await postJson(app, "/contacts/bulk-email/preview", {
      contactIds: ["ct_1", "ct_foreign"],
      eventId: "ev1",
      subject: "Hi",
      bodyText: "Body",
    });
    expect(res.status).toBe(404);
  });
});

// DEC-397: preview never mints credentials — verify against a fake KV that
// records every put() call.
describe("POST /contacts/bulk-email/preview vs /contacts/bulk-email — claim-token minting (DEC-397)", () => {
  function postJsonWithKv(app: Hono<AppEnv>, path: string, body: unknown, kv: { put: (...a: unknown[]) => unknown }) {
    return app.request(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify(body),
      },
      { KV: kv },
    );
  }

  it("preview performs zero KV puts and renders the fixed placeholder token", async () => {
    const app = buildApp();
    const puts: unknown[] = [];
    const fakeKv = { put: (...args: unknown[]) => puts.push(args) };

    const res = await postJsonWithKv(app, "/contacts/bulk-email/preview", {
      contactIds: ["ct_1", "ct_2"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See {portal_link}",
    }, fakeKv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { bodyText: string }[] };
    expect(puts).toHaveLength(0);
    for (const item of body.items) {
      expect(item.bodyText).toContain("/claim/example-one-time-link");
    }
  });

  it("send mints one claim token per userless recipient", async () => {
    const app = buildApp();
    const puts: unknown[] = [];
    const fakeKv = { put: (...args: unknown[]) => puts.push(args) };

    const res = await postJsonWithKv(app, "/contacts/bulk-email", {
      contactIds: ["ct_1", "ct_2"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See {portal_link}",
    }, fakeKv);

    expect(res.status).toBe(200);
    // findAccountUserId mock always returns null, so both recipients are
    // userless and each mints exactly one claim token.
    expect(puts).toHaveLength(2);
  });
});
