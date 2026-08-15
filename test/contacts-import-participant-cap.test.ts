// DEC-604 amendment (findings wave 15, task-w15-b): closes the CSV-roster-
// import door against MAX_PARTICIPANTS_PER_SUBMISSION. Before this change,
// POST /api/v1/contacts/import with an eventId + sessionTitle ran
// applyImportRows, then pushContactsToEvent, which made ONE submission and
// handed every remaining contact to insertActiveParticipants -- a bare
// chunked INSERT with no count read, so a 200-row roster CSV could write
// 199 participants onto one submission against a cap of 6.
//
// Fake-db harness reused from test/contacts-import-roster-batch.test.ts
// (same rowMatches/conditionColumnValues drizzle-condition-walking idiom).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import { MAX_PARTICIPANTS_PER_SUBMISSION } from "../src/domain/participant-roles";
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

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function conditionColumnValues(cond: unknown): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  let currentCol: string | null = null;
  function walk(node: unknown, seen = new Set<unknown>(), depth = 0): void {
    if (depth > 12 || node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    const n = node as Record<string, unknown>;
    if (typeof n.name === "string" && n.name.length > 0 && /^[a-z][a-z0-9_]*$/.test(n.name)) {
      currentCol = n.name;
    }
    if (n.value !== undefined && typeof n.value !== "object") {
      if (currentCol) {
        const key = snakeToCamel(currentCol);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(JSON.stringify(n.value));
      }
    }
    if (Array.isArray(n.queryChunks)) for (const c of n.queryChunks) walk(c, seen, depth + 1);
    if (Array.isArray(n.value)) for (const c of n.value) walk(c, seen, depth + 1);
  }
  walk(cond);
  return map;
}

function rowMatches(row: Record<string, unknown>, cond: unknown): boolean {
  const wants = conditionColumnValues(cond);
  for (const [key, allowed] of wants) {
    if (!(key in row)) continue;
    if (!allowed.has(JSON.stringify(row[key]))) return false;
  }
  return true;
}

function fakeDb(seedContacts: unknown[], seedEvents: unknown[], seedSubmissions: unknown[] = [], seedParticipants: unknown[] = []) {
  const state = {
    contact: [...seedContacts] as any[],
    event: [...seedEvents] as any[],
    submission: [...seedSubmissions] as any[],
    participant: [...seedParticipants] as any[],
    task: [] as any[],
    taskAssignment: [] as any[],
    form: [] as any[],
    formField: [] as any[],
  };
  const inserts: { table: unknown; vals: any }[] = [];

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

  function joinedRows(primary: any[], joinTable: unknown): any[] {
    const joined = stateArrayFor(joinTable);
    if (!joined) return primary;
    if (joinTable === schema.submission) {
      // Submission fields are merged in FIRST so the participant's own
      // same-named columns (e.g. contactId) always win -- schema.submission
      // and schema.participant both have a contactId column with different
      // meanings (submission's primary submitter vs. this join row's
      // participant), and a naive {...p, ...submission} spread would let
      // every participant row silently collapse onto the submission's own
      // contactId.
      return primary.map((p) => ({ ...(joined.find((s) => s.id === p.submissionId) ?? {}), ...p }));
    }
    return primary;
  }

  function makeChain(table: unknown, initialRows: any[]) {
    let rows = initialRows;
    let joined: unknown;
    const chain: any = {
      innerJoin: (joinTable: unknown) => {
        joined = joinTable;
        rows = joinedRows(rows, joinTable);
        return chain;
      },
      where: (cond: unknown) => {
        rows = rows.filter((r) => rowMatches(r, cond));
        return chain;
      },
      limit: (n: number) => {
        rows = rows.slice(0, n);
        return chain;
      },
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    void table;
    void joined;
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain(table, [...(stateArrayFor(table) ?? [])]),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const list = Array.isArray(vals) ? (vals as Record<string, unknown>[]) : [vals as Record<string, unknown>];
        const write = async () => {
          for (const v of list) {
            inserts.push({ table, vals: v });
            const arr = stateArrayFor(table);
            if (arr) arr.push({ ...v });
          }
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          onConflictDoNothing: (_target?: unknown) => {
            const p = write();
            return Object.assign(p, {
              returning: async (_sel?: unknown) => {
                await p;
                return [{ id: (vals as any).id, order: 0 }];
              },
            });
          },
          onConflictDoUpdate: (opts: { set: Record<string, unknown> }) => ({
            then: (resolve: (v: void) => void, reject?: (e: unknown) => void) => {
              const upsertAll = async () => {
                const arr = stateArrayFor(table);
                if (!arr) return;
                for (const v of list) {
                  const row = arr.find((r) => r.id === v.id);
                  if (!row) continue;
                  for (const key of Object.keys(opts.set)) row[key] = v[key];
                }
              };
              return upsertAll().then(resolve, reject);
            },
          }),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (setVals: unknown) => ({
        where: async (cond: unknown) => {
          const arr = stateArrayFor(table);
          if (!arr) return;
          for (const row of arr) {
            if (rowMatches(row, cond)) Object.assign(row, setVals as object);
          }
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, state };
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

function csvFor(count: number): string {
  const header = "Email,First,Last";
  const rows = Array.from({ length: count }, (_, i) => `p${i}@example.com,First${i},Last${i}`);
  return [header, ...rows].join("\n") + "\n";
}

const mapping = { Email: "email", First: "firstName", Last: "lastName" };

describe("POST /api/v1/contacts/import + eventId: MAX_PARTICIPANTS_PER_SUBMISSION door (DEC-604 amendment, w15-b)", () => {
  it("refuses a roster import whose batch would exceed the cap, WITHOUT writing any contact row or submission", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const overCount = MAX_PARTICIPANTS_PER_SUBMISSION + 1;
    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: csvFor(overCount),
        mapping,
        eventId: "event-1",
        sessionTitle: "Lightning talks",
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.eventId).toBeTruthy();
    expect(body.error.fields?.eventId).toContain("import without choosing an event");

    // NO write happened at all -- neither a contact row nor a submission.
    expect(state.contact).toHaveLength(0);
    expect(state.submission).toHaveLength(0);
    expect(state.participant).toHaveLength(0);
  });

  it("succeeds when the batch lands exactly at the cap", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: csvFor(MAX_PARTICIPANTS_PER_SUBMISSION),
        mapping,
        eventId: "event-1",
        sessionTitle: "Lightning talks",
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; addedToEvent: number };
    expect(body.created).toBe(MAX_PARTICIPANTS_PER_SUBMISSION);
    expect(body.addedToEvent).toBe(MAX_PARTICIPANTS_PER_SUBMISSION);
    expect(state.submission).toHaveLength(1);
    expect(state.participant).toHaveLength(MAX_PARTICIPANTS_PER_SUBMISSION);
  });

  it("is NOT falsely refused when the file's surplus rows are already on the event roster", async () => {
    // Seed MAX_PARTICIPANTS_PER_SUBMISSION contacts already accepted+active
    // participants of an existing submission on event-1 -- these are already
    // "on the roster", so re-importing them (plus one brand-new contact)
    // should NOT count toward the new batch's cap.
    const existingContacts = Array.from({ length: MAX_PARTICIPANTS_PER_SUBMISSION }, (_, i) => ({
      id: `existing-${i}`,
      orgId: ORG_A,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `p${i}@example.com`,
      phone: null,
      company: null,
      title: null,
      bio: null,
      headshotUrl: null,
      socialLinksJson: null,
      notes: null,
      customFieldsJson: null,
      createdAt: new Date(1),
      updatedAt: new Date(1),
    }));
    const existingSubmission = {
      id: "sub-existing",
      eventId: "event-1",
      contactId: "existing-0",
      title: "Prior session",
      status: "accepted",
      contentStatus: "pending",
      acceptedAt: new Date(1),
      createdAt: new Date(1),
      updatedAt: new Date(1),
    };
    const existingParticipants = existingContacts.map((c, i) => ({
      id: `part-${i}`,
      submissionId: "sub-existing",
      contactId: c.id,
      role: "speaker",
      order: i,
      visible: true,
      inviteStatus: "none",
      titleAtTime: null,
      orgAtTime: null,
      createdAt: new Date(1),
      updatedAt: new Date(1),
    }));

    const { db, state } = fakeDb([...existingContacts], [EVENT_ORG_A], [existingSubmission], existingParticipants);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    // Re-import the same MAX_PARTICIPANTS_PER_SUBMISSION emails (already on
    // the roster) plus exactly ONE new contact -- the real to-add count is 1,
    // well under the cap, even though the file itself has
    // MAX_PARTICIPANTS_PER_SUBMISSION + 1 rows.
    const csvText = csvFor(MAX_PARTICIPANTS_PER_SUBMISSION) + "brandnew@example.com,New,Person\n";

    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText,
        mapping,
        eventId: "event-1",
        sessionTitle: "Second session",
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; addedToEvent: number };
    expect(body.addedToEvent).toBe(1);
    expect(body.created).toBe(1);
    expect(body.updated).toBe(MAX_PARTICIPANTS_PER_SUBMISSION);
    // A second submission was created for the one new participant.
    expect(state.submission).toHaveLength(2);
  });

  it("dry run reports the same refusal (never applies)", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const overCount = MAX_PARTICIPANTS_PER_SUBMISSION + 1;
    const res = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: csvFor(overCount),
        mapping,
        eventId: "event-1",
        sessionTitle: "Lightning talks",
        dryRun: true,
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.eventId).toBeTruthy();
    expect(state.contact).toHaveLength(0);
    expect(state.submission).toHaveLength(0);
  });
});
