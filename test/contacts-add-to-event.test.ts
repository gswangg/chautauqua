// CRM-10 (DEC-156, DEC-149): POST /api/v1/contacts/:id/add-to-event pushes a
// contact directly into an event as an accepted, organizer-invited
// submission — no email. Mounts the real contactsRoutes sub-app against a
// table-aware fake db (see fakeDb below), mirroring
// test/status-bulk-full-match.test.ts's pattern (no D1 test harness exists
// in stage 1).
//
// P1 fix (w1-f): pushContactToEvent now creates the submission as 'pending'
// and drives it to 'accepted' through updateSubmissionStatuses (the same
// path triage/bulk-accept uses) so the acceptance planner actually fires —
// previously it inserted status:'accepted' directly, which skipped planning
// entirely and left a CRM-pushed contact with zero onboarding tasks,
// invisible on the Speakers onboarding grid. The old select-queue fake db
// couldn't model the extra selects/inserts that planning performs, so this
// is now a small in-memory table double instead.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
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

/** In-memory table double: select()/insert()/update() are table-identity
 * aware (comparing against schema.* table objects, same trick as
 * test/status-bulk-full-match.test.ts) so the whole chain
 * (requireOwnedContact -> getEventForOrg -> createSubmission ->
 * updateSubmissionStatuses -> runAcceptancePlanning) resolves against
 * shared state instead of a fixed call-order queue. WHERE conditions are
 * ignored — every table here only ever holds rows relevant to the single
 * contact/event/submission under test, so "return the whole table" is
 * equivalent to "return the filtered rows" for these tests' purposes.
 */
function fakeDb(seedContacts: unknown[], seedEvents: unknown[]) {
  const state = {
    contact: [...seedContacts] as any[],
    event: [...seedEvents] as any[],
    submission: [] as any[],
    participant: [] as any[],
    task: [] as any[],
    taskAssignment: [] as any[],
    form: [] as any[],
    formField: [] as any[],
  };
  const inserts: { table: unknown; vals: any }[] = [];
  const updates: { table: unknown; setVals: any }[] = [];

  function rowsFor(table: unknown): any[] {
    if (table === schema.contact) return state.contact;
    if (table === schema.event) return state.event;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    return [];
  }

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.contact) return state.contact;
    if (table === schema.event) return state.event;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.form) return state.form;
    if (table === schema.formField) return state.formField;
    return undefined;
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: () => chain,
      limit: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain(rowsFor(table)),
    }),
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        inserts.push({ table, vals });
        const arr = stateArrayFor(table);
        if (arr) arr.push({ ...(vals as object) });
      },
    }),
    update: (table: unknown) => ({
      set: (setVals: unknown) => ({
        where: async () => {
          updates.push({ table, setVals });
          const arr = stateArrayFor(table);
          if (arr && arr[0]) Object.assign(arr[0], setVals as object);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, updates, state };
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
  it("creates an accepted submission + visible participant, runs acceptance planning, no email", async () => {
    const { db, inserts, state } = fakeDb([CONTACT_ORG_A], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-1" }),
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { submissionId: string };
    expect(json.submissionId).toBeTruthy();

    const submissionInsert = inserts.find((i) => i.table === schema.submission)!.vals as any;
    expect(submissionInsert.eventId).toBe("event-1");
    expect(submissionInsert.contentStatus).toBe("pending");
    expect(submissionInsert.title).toBe("Invited: Ada Lovelace");
    // Final state, after updateSubmissionStatuses drives pending -> accepted.
    expect(state.submission[0].status).toBe("accepted");
    expect(state.submission[0].acceptedAt).toBeInstanceOf(Date);

    const participantInsert = inserts.find((i) => i.table === schema.participant)!.vals as any;
    expect(participantInsert.submissionId).toBe(submissionInsert.id);
    expect(participantInsert.contactId).toBe("contact-1");
    expect(participantInsert.visible).toBe(true);

    // P1 fix (w1-f): acceptance planning actually fired — the contact got
    // every DEC-009 default onboarding task assigned (previously zero,
    // because the direct status:'accepted' insert skipped planning).
    // (This fake's task table select() can't filter by title/eventId, so a
    // second getOrCreateTask lookup sees the first inserted task row as an
    // "existing" match regardless of title — the fake under-creates
    // distinct task rows relative to real D1. The count that matters here
    // is taskAssignment: DEC-009's planner still queues one assignment per
    // default onboarding task for this contact.)
    expect(state.taskAssignment).toHaveLength(DEFAULT_ONBOARDING_TASKS.length);
    for (const assignment of state.taskAssignment) {
      expect(assignment.contactId).toBe("contact-1");
      expect(assignment.status).toBe("pending");
    }

    // Push-to-event never sends email (product principle 4) — no mailer is
    // even importable from this path (see the source-scan test below); no
    // insert ever targets an email_log-shaped table above.
  });

  it("honors an explicit title", async () => {
    const { db, inserts } = fakeDb([CONTACT_ORG_A], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-1", title: "Keynote: Ada" }),
    );

    expect(res.status).toBe(201);
    expect((inserts.find((i) => i.table === schema.submission)!.vals as any).title).toBe("Keynote: Ada");
  });

  it("404s when the event doesn't exist in the caller's org", async () => {
    const { db, inserts } = fakeDb([CONTACT_ORG_A], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-1/add-to-event", { eventId: "event-other-org" }),
    );

    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("404s when the contact doesn't belong to the caller's org", async () => {
    const { db, inserts } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/contact-from-org-b/add-to-event", { eventId: "event-1" }),
    );

    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("403s a non-organizer (reviewer) session before any db access", async () => {
    const { db, inserts } = fakeDb([], []);
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
// modules push-to-event's own code path actually touches — which now
// includes updateSubmissionStatuses's acceptance-planning module (P1 fix,
// w1-f), not just createSubmission.
const sourceModules = import.meta.glob(
  ["../src/server/repo/submissions/create.ts", "../src/server/repo/submissions/status.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("product principle 4: no mailer import reachable from push-to-event's repo write", () => {
  it("createSubmission + updateSubmissionStatuses (used by pushContactToEvent) do not import a mailer", () => {
    const entries = Object.entries(sourceModules);
    expect(entries.length).toBe(2);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
    }
  });
});
