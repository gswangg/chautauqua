// DEC-805: POST /api/v1/events/:eventId/portal-invites — "Inviting a
// speaker to the portal is a send, not a pill." Organizer-only, atomic
// preflight naming any contactId that isn't a participant on a submission
// in this event, one exported invitation template rendered through the
// shared merge/render machinery, sent through makeMailer, logged through
// d1EmailLogWriter so the send appears in Comms history like every other
// send.

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

const PARTICIPANTS = [
  { contactId: "ct-1", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
  { contactId: "ct-2", firstName: "Kay", lastName: "McNulty", email: "" },
];

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
    findParticipantContactsForEvent: vi.fn(async (_db: unknown, _eventId: string, contactIds: string[]) =>
      PARTICIPANTS.filter((p) => contactIds.includes(p.contactId)),
    ),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

// DEV_MODE="1" selects the real DevSinkMailer (see makeMailer/isDevMode) so
// a successful send's email_log row is written through the exact same
// d1EmailLogWriter compose uses — no mailer mock needed for the happy path.
function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"], DEV_MODE: "1" };
}

function fakeDbWithInsertLog() {
  const inserts: any[] = [];
  const db = {
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
  };
  return { db: db as never, inserts };
}

async function buildCommsApp(db: never) {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", db);
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

function post(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    `${ORIGIN}${path}`,
    { method: "POST", headers: { "content-type": "application/json", "x-chq-csrf": "1" }, body: JSON.stringify(body) },
    withEnv(new InMemoryKV()),
  );
}

describe("POST /api/v1/events/:eventId/portal-invites (DEC-805)", () => {
  it("sends the one exported invitation template and writes an email_log row", async () => {
    // patch the mock so this call only sees the one contact with an email
    const commsRepo = await import("../src/server/repo/comms");
    (commsRepo.findParticipantContactsForEvent as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_db: unknown, _eventId: string, contactIds: string[]) => PARTICIPANTS.filter((p) => contactIds.includes(p.contactId)),
    );

    const { db, inserts } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);

    const res = await post(app, "/api/v1/events/evt-1/portal-invites", { contactIds: ["ct-1"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: { email: string; message: string }[] };
    expect(body).toEqual({ sent: 1, skipped: 0, failed: [] });

    // email_log row written through the same d1EmailLogWriter compose uses
    // (DevSinkMailer, selected via DEV_MODE="1", writes on its own success
    // path — no mailer mock needed).
    expect(inserts).toHaveLength(1);
    expect(inserts[0].eventId).toBe("evt-1");
    expect(inserts[0].contactId).toBe("ct-1");
    expect(inserts[0].toEmail).toBe("grace@example.com");
    expect(inserts[0].status).toBe("sent");
    expect(inserts[0].subject).toBe("You're invited to the DevCon speaker portal");
    expect(inserts[0].bodyText).toContain("Hi Grace Hopper,");
    expect(inserts[0].bodyText).toContain("DevCon speaker portal");
    expect(inserts[0].bodyText).toMatch(/https:\/\/events\.example\.com\/claim\//);
  });

  it("rejects the whole call, naming any contactId that isn't a participant in this event", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);

    const res = await post(app, "/api/v1/events/evt-1/portal-invites", { contactIds: ["ct-1", "ct-foreign"] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).toContain("ct-foreign");

    // atomic: zero log rows for the rejected batch.
    expect(inserts).toHaveLength(0);
  });

  it("names a recipient with no email on file instead of silently dropping them", async () => {
    const { db, inserts } = fakeDbWithInsertLog();
    const app = await buildCommsApp(db);

    const res = await post(app, "/api/v1/events/evt-1/portal-invites", { contactIds: ["ct-2"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; skipped: number; failed: { email: string; message: string }[] };
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.failed).toHaveLength(1);
    const [failure] = body.failed;
    expect(failure?.message).toContain("Kay McNulty");
    expect(failure?.message).toContain("no email address");

    expect(inserts).toHaveLength(0);
  });
});
