// CRM-10 (DEC-156, DEC-149): POST /api/v1/contacts/:id/add-to-event pushes a
// contact directly into an event as an accepted, organizer-invited
// submission — no email. Mounts the real contactsRoutes sub-app against a
// select-queue fake db, mirroring test/api-participants.test.ts's pattern
// (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const CONTACT_ORG_A = {
  id: "contact-1",
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
  createdAt: new Date(1000),
  updatedAt: new Date(1000),
};

const EVENT_ORG_A = {
  id: "event-1",
  orgId: ORG_A,
  name: "Widgetcon",
  slug: "widgetcon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  brandingJson: null,
  createdAt: new Date(500),
  updatedAt: new Date(500),
};

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every insert()/update() write. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        inserts.push({ table, vals });
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };
const REVIEWER_A: AuthInfo = { userId: "u-reviewer-a", role: "reviewer", orgId: ORG_A };

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/contacts/:id/add-to-event (CRM-10, DEC-156)", () => {
  it("creates an accepted submission + visible participant, defaulting title, no email", async () => {
    const { db, inserts } = fakeDb([
      [CONTACT_ORG_A], // requireOwnedContact -> findContactForOrg
      [EVENT_ORG_A], // getEventForOrg
      [CONTACT_ORG_A], // findOrCreateContact: matched by email in-org
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-1" }),
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { submissionId: string };
    expect(json.submissionId).toBeTruthy();

    expect(inserts).toHaveLength(2);
    const submissionInsert = inserts[0]!.vals as any;
    expect(submissionInsert.eventId).toBe("event-1");
    expect(submissionInsert.status).toBe("accepted");
    expect(submissionInsert.contentStatus).toBe("pending");
    expect(submissionInsert.title).toBe("Invited: Ada Lovelace");

    const participantInsert = inserts[1]!.vals as any;
    expect(participantInsert.submissionId).toBe(submissionInsert.id);
    expect(participantInsert.contactId).toBe("contact-1");
    expect(participantInsert.visible).toBe(true);

    // Push-to-event never sends email (product principle 4) — no mailer is
    // even importable from this path; the fake db above records no writes
    // to an email_log table, which this insert-count assertion already
    // covers (submission + participant, nothing else).
  });

  it("honors an explicit title", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A], [EVENT_ORG_A], [CONTACT_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-1", title: "Keynote: Ada" }),
    );

    expect(res.status).toBe(201);
    expect((inserts[0]!.vals as any).title).toBe("Keynote: Ada");
  });

  it("404s when the event doesn't exist in the caller's org", async () => {
    const { db, inserts } = fakeDb([
      [CONTACT_ORG_A], // requireOwnedContact
      [], // getEventForOrg: not found
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-other-org" }),
    );

    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("404s when the contact doesn't belong to the caller's org", async () => {
    const { db, inserts } = fakeDb([
      [], // requireOwnedContact: not found in this org
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-from-org-b/add-to-event", { eventId: "event-1" }),
    );

    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("403s a non-organizer (reviewer) session before any db access", async () => {
    const { db, inserts } = fakeDb([]);
    const app = appWithDbAndAuth(db, REVIEWER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-1" }),
    );

    expect(res.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });
});

// contacts.ts (the route file) legitimately imports mail/render for the
// unrelated bulk-email endpoint, so the mailer tripwire only covers the
// modules push-to-event's own code path actually touches.
const sourceModules = import.meta.glob(
  ["../src/server/repo/submissions/create.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("product principle 4: no mailer import reachable from push-to-event's repo write", () => {
  it("createSubmission (used by pushContactToEvent) does not import a mailer", () => {
    const entries = Object.entries(sourceModules);
    expect(entries.length).toBe(1);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
    }
  });
});
