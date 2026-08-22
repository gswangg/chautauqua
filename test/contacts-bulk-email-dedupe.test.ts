// DEC-238 wave-14 amendment (CRM bulk-email dedupe): POST /contacts/bulk-email
// now shares compose/send's dedupe class — an intra-batch address collapse
// plus a cross-call COMPOSE_DEDUPE_WINDOW_MS window against email_log.
// Mirrors test/comms-send-dedupe.test.ts's loggedRows-backed
// repo.loadRecentlySent mock and test/contacts-bulk-email-mailer-failure.
// test.ts's contact/event mocking.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";
import { COMPOSE_DEDUPE_WINDOW_MS, dedupeKey } from "../src/domain/comms-dedupe";

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

// Two contact rows sharing ONE email address — the exact state the
// duplicate-merge tool exists to fix.
const CT_1 = contactRow({ id: "ct_1", firstName: "Ada", lastName: "Lovelace", email: "shared@example.com" });
const CT_2 = contactRow({ id: "ct_2", firstName: "Ada", lastName: "L.", email: "shared@example.com" });
const CT_SOLO = contactRow({ id: "ct_solo", firstName: "Grace", lastName: "Hopper", email: "solo@example.com" });

const findContactsForOrgMock = vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
  if (orgId !== "org1") return [];
  return [CT_1, CT_2, CT_SOLO].filter((c) => ids.includes(c.id));
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

// Stand-in email_log rows — the mocked repo.loadRecentlySent reader below
// reads from this array, so a second POST sees the first call's 'sent' row
// exactly as a real D1-backed reader would.
let loggedRows: { eventId: string; toEmail: string; subject: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(
      async (_db: unknown, eventId: string, keys: { email: string; subject: string }[], cutoffMs: number) => {
        const map = new Map<string, number>();
        for (const row of loggedRows) {
          if (row.eventId !== eventId) continue;
          if (row.sentAt < cutoffMs) continue;
          const hit = keys.some(
            (k) => k.email.trim().toLowerCase() === row.toEmail.trim().toLowerCase() && k.subject === row.subject,
          );
          if (!hit) continue;
          const key = dedupeKey(row.toEmail, row.subject);
          const existing = map.get(key);
          if (existing === undefined || row.sentAt > existing) map.set(key, row.sentAt);
        }
        return map;
      },
    ),
  };
});

const mailerSendMock = vi.fn(
  async (message: { to: { email: string }; subject: string; text: string; contactId: string }) => {
    loggedRows.push({ eventId: "ev1", toEmail: message.to.email, subject: message.subject, sentAt: Date.now() });
  },
);
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: (message: unknown) =>
        mailerSendMock(message as { to: { email: string }; subject: string; text: string; contactId: string }),
    })),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");

function fakeDb() {
  const db = { insert: () => ({ values: async () => {} }) };
  return db as never;
}

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", fakeDb());
    await next();
  });
  registerErrorHandler(app);
  app.route("/", contactsRoutes);
  return app;
}

function postJson(app: Hono<AppEnv>, body: unknown) {
  return app.request(
    "/contacts/bulk-email",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: {}, PUBLIC_BASE_URL: "https://events.example.com" },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  loggedRows = [];
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe("POST /contacts/bulk-email — dedupe (DEC-238 wave-14/wave-17 amendments)", () => {
  // DEC-238 wave-17 amendment: the intra-batch collapse is keyed on
  // (contactId, rendered subject, rendered body), never the address alone
  // -- CT_1 and CT_2 share an address but render DIFFERENT bodies
  // ({speaker_name} differs), so both are distinct identities and both
  // send. This replaces the wave-14 behaviour (address-alone collapse),
  // which silently dropped the second contact's own claim link -- see
  // test/contacts-bulk-email-skipped-log.route.test.ts for the case that
  // still legitimately collapses (a literal duplicate contactId).
  it("two contact rows sharing one email but rendering different bodies both send, with skipped===0", async () => {
    const app = buildApp();
    vi.setSystemTime(1_700_000_000_000);

    const res = await postJson(app, {
      contactIds: ["ct_1", "ct_2"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 2, skipped: 0, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
    const sentTo = mailerSendMock.mock.calls.map((args) => args[0].to.email).sort();
    expect(sentTo).toEqual(["shared@example.com", "shared@example.com"]);

    // Each contact received THEIR OWN rendered body -- ct_1's own claim
    // link is not silently replaced by ct_2's (the DEC-238 wave-17 defect:
    // an address-only collapse dropped the second contact's own portal
    // link entirely). Keyed by contactId, not delivery order.
    const byContact = new Map(mailerSendMock.mock.calls.map((args) => [args[0].contactId, args[0]]));
    const call1 = byContact.get("ct_1");
    const call2 = byContact.get("ct_2");
    if (!call1 || !call2) throw new Error("expected one send per contactId");
    expect(call1.subject).toBe("Hi Ada Lovelace");
    expect(call2.subject).toBe("Hi Ada L.");
    expect(call1.subject).not.toBe(call2.subject);
  });

  it("an immediate second identical POST sends zero and reports skipped for every recipient", async () => {
    const app = buildApp();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const first = await postJson(app, {
      contactIds: ["ct_1", "ct_solo"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(firstBody).toEqual({ sent: 2, skipped: 0, failed: [] });

    vi.setSystemTime(t0 + 40_000); // well inside the window
    const second = await postJson(app, {
      contactIds: ["ct_1", "ct_solo"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(secondBody).toEqual({ sent: 0, skipped: 2, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2); // only the first POST actually emailed
  });

  it("a second POST with a different subject still sends", async () => {
    const app = buildApp();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    await postJson(app, {
      contactIds: ["ct_solo"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    vi.setSystemTime(t0 + 40_000);
    const res = await postJson(app, {
      contactIds: ["ct_solo"],
      eventId: "ev1",
      subject: "A different subject {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 1, skipped: 0, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
  });

  it("a send outside the window is NOT skipped", async () => {
    const app = buildApp();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    await postJson(app, {
      contactIds: ["ct_solo"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });

    vi.setSystemTime(t0 + COMPOSE_DEDUPE_WINDOW_MS + 1_000);
    const res = await postJson(app, {
      contactIds: ["ct_solo"],
      eventId: "ev1",
      subject: "Hi {speaker_name}",
      bodyText: "See you at {event_name}: {portal_link}",
    });
    const body = (await res.json()) as { sent: number; skipped: number; failed: unknown[] };
    expect(body).toEqual({ sent: 1, skipped: 0, failed: [] });
    expect(mailerSendMock).toHaveBeenCalledTimes(2);
  });
});
