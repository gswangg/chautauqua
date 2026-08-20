// DEC-909 wave-128 clauses (a)+(b): POST /api/v1/contacts's eventId branch
// (CRM-10, DEC-156/DEC-290) no longer requires a sessionTitle -- a roster
// add is a contact act, not a scheduling one (clause a) -- and when a title
// IS typed, an exact match against the event's existing sessions references
// that session instead of minting a duplicate (clause b). Mounts the real
// contactsRoutes sub-app against an in-memory table double, adapted from
// test/contacts-add-to-event.test.ts's fakeDb (that file's own successful-
// push tests are the nearest precedent for exercising the full
// createSubmission -> updateSubmissionStatuses -> acceptance-planning chain
// this route also drives) -- test/contacts-create-duplicate.test.ts's
// lighter fakeDb only ever exercises this route's refusal paths, never an
// actual successful push, so it isn't reused here.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

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

const EXISTING_SESSION = {
  id: "sub-existing",
  eventId: "event-1",
  formId: null,
  seq: 1,
  title: "Lightning talks",
  description: null,
  trackId: null,
  additionalTrackIdsJson: null,
  status: "accepted",
  contentStatus: "pending",
  acceptedAt: new Date(600),
  icsSequence: 0,
  externalRef: null,
  createdAt: new Date(600),
  updatedAt: new Date(600),
};

/** In-memory table double, adapted verbatim from
 * test/contacts-add-to-event.test.ts's fakeDb (see that file's header for
 * the WHERE-ignored / array-values rationale) -- the only addition is an
 * optional `seedSubmissions` param so a test can pre-seed the one session a
 * matching-title scenario needs to find. */
function fakeDb(seedContacts: unknown[], seedEvents: unknown[], seedSubmissions: unknown[] = []) {
  const state = {
    contact: [...seedContacts] as any[],
    event: [...seedEvents] as any[],
    submission: [...seedSubmissions] as any[],
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
    if (table === schema.form) return state.form;
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
      orderBy: () => chain,
      // DEC-909 clause b's findSubmissionByExactTitle does
      // .select().from(submission).where(...).limit(1) -- this fake ignores
      // WHERE (see header), so `.limit(n)` returns the TAIL of the live
      // rows array (the most recently touched row), the same heuristic
      // test/contacts-add-to-event.test.ts's fake uses for
      // getOrCreateTask/getOrCreateFormTaskForm. Correct here because each
      // scenario below seeds exactly the one submission (if any) relevant
      // to what it's testing.
      limit: (n: number) => ({
        innerJoin: () => chain,
        where: () => chain,
        then: (resolve: (v: unknown[]) => void) => resolve(rows.slice(-n)),
      }),
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain(rowsFor(table)),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        const write = async () => {
          for (const row of rows) {
            inserts.push({ table, vals: row });
            const arr = stateArrayFor(table);
            if (arr) arr.push({ ...(row as object) });
          }
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          onConflictDoNothing: () => {
            const p = write();
            return Object.assign(p, {
              returning: async (_sel?: unknown) => {
                await p;
                return rows.map((row: any) => ({ id: row.id, order: 0 }));
              },
            });
          },
        };
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

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/contacts eventId branch: optional session title (DEC-909 wave-128)", () => {
  it("clause (a): succeeds with no sessionTitle at all, minting a session with an empty title", async () => {
    const { db, inserts, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Marcus",
        lastName: "Okafor",
        email: "marcus@example.com",
        eventId: "event-1",
        // sessionTitle omitted entirely.
      }),
    );

    expect(res.status).toBe(201);
    expect(state.contact).toHaveLength(1);
    expect(state.submission).toHaveLength(1);
    const submissionInsert = inserts.find((i) => i.table === schema.submission)!.vals as any;
    // Never invented: an omitted title stays "", never a fallback like
    // 'Invited: Marcus Okafor'.
    expect(submissionInsert.title).toBe("");
    expect(state.submission[0].status).toBe("accepted");

    // Still a real, active roster membership: onboarding tasks fired.
    expect(state.taskAssignment).toHaveLength(DEFAULT_ONBOARDING_TASKS.length);
  });

  it("clause (a): succeeds with sessionTitle as a blank string", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Nadia",
        lastName: "Osei",
        email: "nadia@example.com",
        eventId: "event-1",
        sessionTitle: "   ",
      }),
    );

    expect(res.status).toBe(201);
    expect(state.submission).toHaveLength(1);
    expect(state.submission[0].title).toBe("");
  });

  it("clause (b): a typed title matching an existing session attaches to it and mints no new session", async () => {
    const { db, inserts, state } = fakeDb([], [EVENT_ORG_A], [{ ...EXISTING_SESSION }]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Priya",
        lastName: "Raman",
        email: "priya@example.com",
        eventId: "event-1",
        sessionTitle: "Lightning talks",
      }),
    );

    expect(res.status).toBe(201);
    // No new submission minted -- still exactly the one seeded session.
    expect(state.submission).toHaveLength(1);
    expect(inserts.find((i) => i.table === schema.submission)).toBeUndefined();

    // The new contact was attached as an ACTIVE participant on the EXISTING
    // session (DEC-829's ACTIVE predicate: visible, inviteStatus 'none' --
    // the same shape a batch roster import gives, not 'invited').
    const participantInsert = inserts.find((i) => i.table === schema.participant)!.vals as any;
    expect(participantInsert.submissionId).toBe("sub-existing");
    expect(participantInsert.visible).toBe(true);
    expect(participantInsert.inviteStatus).toBe("none");
    expect(participantInsert.role).toBe("speaker");
  });

  it("clause (b): a typed title with no match mints exactly one new session", async () => {
    const { db, inserts, state } = fakeDb([], [EVENT_ORG_A], []);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Jordan",
        lastName: "Ito",
        email: "jordan@example.com",
        eventId: "event-1",
        sessionTitle: "Scaling Kubernetes at 2am",
      }),
    );

    expect(res.status).toBe(201);
    expect(state.submission).toHaveLength(1);
    const submissionInsert = inserts.find((i) => i.table === schema.submission)!.vals as any;
    expect(submissionInsert.title).toBe("Scaling Kubernetes at 2am");
    expect(submissionInsert.eventId).toBe("event-1");
    expect(state.submission[0].status).toBe("accepted");
  });

  it("400s an over-cap sessionTitle even though the field is optional", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts", {
        firstName: "Sam",
        lastName: "Reyes",
        email: "sam@example.com",
        eventId: "event-1",
        sessionTitle: "x".repeat(201),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.sessionTitle).toBeTruthy();
    // A refused request writes nothing.
    expect(state.contact).toHaveLength(0);
    expect(state.submission).toHaveLength(0);
  });
});
