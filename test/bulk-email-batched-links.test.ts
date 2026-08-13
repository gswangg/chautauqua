// DEC-530 (wave-44 amendment): POST /contacts/bulk-email used to call
// resolvePortalLink (the SINGULAR resolver) inside its per-contact render
// loop — up to MAX_BULK_EMAIL_RECIPIENTS (100) sequential KV round trips,
// exactly the shape the wave-42 amendment removed from both
// src/routes/comms.ts send paths by introducing resolvePortalLinks (the
// batched Promise.all form). This file guards that CRM bulk email now takes
// the same batched path: one resolvePortalLinks call per request, and the
// KV port never sees a strictly-serial (one-at-a-time) sequence of
// per-recipient round trips.

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

const RECIPIENT_COUNT = 20;
const ALL_CONTACTS: ContactRow[] = Array.from({ length: RECIPIENT_COUNT }, (_, i) =>
  contactRow({ id: `ct_${i + 1}`, firstName: `Speaker${i + 1}`, lastName: "Test" }),
);

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
      if (orgId !== "org1") return [];
      return ALL_CONTACTS.filter((c) => ids.includes(c.id));
    }),
    // Every recipient is userless, so every recipient's portal link goes
    // through the claim-token-minting branch of resolvePortalLinks below.
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

// ---------------------------------------------------------------------------
// 1. resolvePortalLinks (the batched helper) is called exactly once per
//    request, regardless of recipient count — not once per recipient.
// ---------------------------------------------------------------------------

const resolvePortalLinksSpy = vi.fn(async (_kv: unknown, recipients: { contactId: string }[], _eventId: string, origin: string) => {
  return new Map(recipients.map((r) => [r.contactId, `${origin}/claim/fake-token-${r.contactId}`]));
});

vi.mock("../src/server/repo/portal-link", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-link")>("../src/server/repo/portal-link");
  return {
    ...actual,
    resolvePortalLinks: (...args: Parameters<typeof resolvePortalLinksSpy>) => resolvePortalLinksSpy(...args),
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

function postJson(app: Hono<AppEnv>, path: string, body: unknown, kv: unknown = {}) {
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

describe("POST /contacts/bulk-email resolves portal links via ONE batched call (DEC-530)", () => {
  it("calls resolvePortalLinks exactly once for a 20-recipient send, not once per recipient", async () => {
    resolvePortalLinksSpy.mockClear();
    const app = buildApp();
    const contactIds = ALL_CONTACTS.map((c) => c.id);

    const res = await postJson(app, "/contacts/bulk-email", {
      contactIds,
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: unknown[] };
    expect(body.sent).toBe(RECIPIENT_COUNT);
    expect(resolvePortalLinksSpy).toHaveBeenCalledTimes(1);
    // The single call receives the full recipient set, not a 1-element slice.
    expect(resolvePortalLinksSpy.mock.calls[0]?.[1]).toHaveLength(RECIPIENT_COUNT);
  });

  it("calls resolvePortalLinks exactly once for the preview path too", async () => {
    resolvePortalLinksSpy.mockClear();
    const app = buildApp();
    const contactIds = ALL_CONTACTS.map((c) => c.id);

    const res = await postJson(app, "/contacts/bulk-email/preview", {
      contactIds,
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See {portal_link}",
    });

    expect(res.status).toBe(200);
    expect(resolvePortalLinksSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Against the REAL resolvePortalLinks (unmocked): the KV port never sees
//    a strictly-serial per-recipient sequence — every mint runs inside one
//    Promise.all instead of the loop awaiting kv on each iteration.
// ---------------------------------------------------------------------------

describe("POST /contacts/bulk-email KV round trips are batched, not serial (DEC-530)", () => {
  it("mints all claim tokens concurrently — peak in-flight KV calls exceeds 1", async () => {
    vi.doUnmock("../src/server/repo/portal-link");
    vi.resetModules();

    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
      return {
        ...actual,
        findContactsForOrg: vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
          if (orgId !== "org1") return [];
          return ALL_CONTACTS.filter((c) => ids.includes(c.id));
        }),
        findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
      };
    });
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
          orgId === "org1" && eventId === "ev1" ? { id: "ev1", name: "DevCon" } : null,
        ),
      };
    });
    vi.doMock("../src/server/context", async () => {
      const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
      return { ...actual, makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })) };
    });

    const { contactsRoutes: freshRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", freshRoutes);

    let inFlight = 0;
    let peakInFlight = 0;
    const delay = () => new Promise((resolve) => setTimeout(resolve, 5));
    const fakeKv = {
      async get(_key: string) {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await delay();
        inFlight -= 1;
        return null; // DEC-949: no prior grant.
      },
      async put(_key: string, _value: string) {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await delay();
        inFlight -= 1;
      },
      async delete() {},
    };

    const contactIds = ALL_CONTACTS.map((c) => c.id);
    const res = await postJson(
      app,
      "/contacts/bulk-email",
      {
        contactIds,
        eventId: "ev1",
        subject: "Hi {speaker_name}",
        bodyText: "See {portal_link}",
      },
      fakeKv,
    );

    expect(res.status).toBe(200);
    // A strictly-serial per-recipient loop (the pre-fix shape) would never
    // have more than one KV call in flight at a time (peakInFlight === 1).
    // The batched Promise.all form issues every recipient's calls
    // concurrently, so the peak must exceed 1.
    expect(peakInFlight).toBeGreaterThan(1);
  });
});
