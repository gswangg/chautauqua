// DEC-071 regression: {portal_link} must render an absolute URL
// (`${origin}/portal` or `${origin}/claim/:token`) in every email — relative
// links are dead once opened outside the app's own origin. Covers both
// resolvePortalLinks call sites: src/routes/comms.ts (compose preview/send)
// and src/routes/api/contacts.ts (bulk-email), for both branches (existing
// user -> /portal, no user -> freshly minted /claim/:token).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const event = {
  id: "evt-1",
  orgId: ORG_A,
  name: "DevCon",
  slug: "devcon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  recordPrefix: "DEV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async () => event),
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => [
      {
        id: "sub-existing",
        title: "On Engines",
        seq: 1,
        participants: [{ contactId: "ct-existing", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
      },
      {
        id: "sub-new",
        title: "On Looms",
        seq: 2,
        participants: [{ contactId: "ct-new", firstName: "Bea", lastName: "Byte", email: "bea@example.com" }],
      },
    ]),
    findAccountUserId: vi.fn(async (_db: unknown, params: { email: string }) => (params.email === "ada@example.com" ? "user-ada" : null)),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string; email: string }[]) =>
      new Map(params.map((p) => [p.contactId, p.email === "ada@example.com" ? "user-ada" : null])),
    ),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    // DEC-912: buildRenderTargets now unconditionally loads schedule data
    // for `scheduled` — unrelated to this file's portal-link scope.
    loadIcsScheduleData: vi.fn(async () => new Map()),
  };
});

// DEC-792: stub the batched outstanding-task lookup used by buildRenderTargets
// for {task_list}/{due_date}.
vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: vi.fn(async () => [
      {
        id: "ct-existing",
        orgId: ORG_A,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
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
      },
      {
        id: "ct-new",
        orgId: ORG_A,
        firstName: "Bea",
        lastName: "Byte",
        email: "bea@example.com",
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
      },
    ]),
    findAccountUserId: vi.fn(async (_db: unknown, params: { email: string }) => (params.email === "ada@example.com" ? "user-ada" : null)),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string; email: string }[]) =>
      new Map(params.map((p) => [p.contactId, p.email === "ada@example.com" ? "user-ada" : null])),
    ),
  };
});

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; text: string }) => {
        sentMails.push(mail);
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
}

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

async function buildContactsApp() {
  const { contactsRoutes } = await import("../src/routes/api/contacts");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

describe("POST /api/v1/events/:eventId/compose/preview — absolute portal_link", () => {
  it("renders {origin}/portal for an existing user and {origin}/claim/:token for a new contact", async () => {
    const app = await buildCommsApp();
    const kv = new InMemoryKV();

    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-existing", "sub-new"],
          subject: "Update on {talk_title}",
          bodyText: "Hi {speaker_name}, see {portal_link}.",
        }),
      },
      withEnv(kv),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { contactId: string; text: string }[] };
    const forExisting = body.items.find((i) => i.contactId === "ct-existing");
    const forNew = body.items.find((i) => i.contactId === "ct-new");

    expect(forExisting?.text).toContain(`${ORIGIN}/portal`);
    expect(forExisting?.text).not.toMatch(/see \/portal/);

    expect(forNew?.text).toMatch(new RegExp(`${ORIGIN}/claim/[A-Za-z0-9_-]+`));
    expect(forNew?.text).not.toMatch(/see \/claim\//);
  });
});

describe("POST /api/v1/contacts/bulk-email — absolute portal_link", () => {
  it("renders {origin}/portal for an existing user and {origin}/claim/:token for a new contact", async () => {
    const app = await buildContactsApp();
    const kv = new InMemoryKV();

    const res = await app.request(
      `${ORIGIN}/api/v1/contacts/bulk-email`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          contactIds: ["ct-existing", "ct-new"],
          eventId: "evt-1",
          subject: "Hello {speaker_name}",
          bodyText: "See {portal_link} for {event_name}.",
        }),
      },
      withEnv(kv),
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(2);

    const existingMail = sentMails.find((m) => m.to.email === "ada@example.com");
    const newMail = sentMails.find((m) => m.to.email === "bea@example.com");

    expect(existingMail?.text).toContain(`${ORIGIN}/portal`);
    expect(newMail?.text).toMatch(new RegExp(`${ORIGIN}/claim/[A-Za-z0-9_-]+`));
  });
});
