// DEC-357: CSV-import roster-add is set-based. Previously
// POST /api/v1/contacts/import (with eventId) looped over every imported
// contactId, re-reading it with repo.findContactForOrg (a row the import
// pass just wrote and already proved org-owned) and pushing it with
// pushContactToEvent — each iteration its own full acceptance-planning
// pass (its own updateSubmissionStatuses call). This now does one chunked
// findContactsForOrg load (DEC-078, ID_CHUNK_SIZE=90) plus one
// pushContactsToEvent call that runs updateSubmissionStatuses exactly once.
//
// DEC-810 amendment (wave 59): pushContactsToEvent itself now creates
// exactly ONE submission for the whole batch (not one per contact), with
// every contact attached as an active participant of it -- so
// updateSubmissionStatuses's single pass is over ONE id, not K.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import * as repo from "../src/server/repo/contacts";
import * as schema from "../src/db/schema";
import { pushContactsToEvent } from "../src/server/repo/contacts/push";
import type { Db } from "../src/server/context";
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

// -----------------------------------------------------------------------
// Repo-level: pushContactsToEvent issues exactly ONE updateSubmissionStatuses
// pass (one select-chunk read against schema.submission) regardless of the
// number of contacts pushed.
// -----------------------------------------------------------------------

function statusCountingDb() {
  const submissionSelectCalls: unknown[] = [];
  const submissionUpdateCalls: { setValue: unknown }[] = [];
  const contactSelectCalls: unknown[] = [];
  const submissions: { id: string }[] = [];

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === schema.submission) {
            submissionSelectCalls.push(true);
            return { where: async () => submissions.map((s) => ({ id: s.id, status: "pending", acceptedAt: null })) };
          }
          const emptyChain = () => ({
            limit: async () => [],
            then: (resolve: (v: unknown[]) => void) => resolve([]),
          });
          if (table === schema.contact) {
            contactSelectCalls.push(true);
            // No pre-existing contact by email — findOrCreateContact inserts.
            return { where: emptyChain };
          }
          return { where: emptyChain };
        },
      };
    },
    insert(table: unknown) {
      return {
        values: async (vals: unknown) => {
          if (table === schema.submission) submissions.push(vals as { id: string });
          return undefined;
        },
      };
    },
    update(table: unknown) {
      return {
        set(setValue: unknown) {
          if (table === schema.submission) submissionUpdateCalls.push({ setValue });
          return { where: async () => undefined };
        },
      };
    },
  };
  return { db: db as unknown as Db, submissionSelectCalls, submissionUpdateCalls, contactSelectCalls };
}

describe("pushContactsToEvent (DEC-357, DEC-810 amendment wave 59): ONE session per batch", () => {
  it("creates exactly ONE submission for K contacts, and runs updateSubmissionStatuses's row-status read/update exactly ONCE (over that one id)", async () => {
    const { db, submissionSelectCalls, submissionUpdateCalls } = statusCountingDb();
    const contacts = [
      { id: "c-1", email: "a@example.com", firstName: "Ada", lastName: "Lovelace", title: null, company: null },
      { id: "c-2", email: "b@example.com", firstName: "Bea", lastName: "Neumann", title: null, company: null },
      { id: "c-3", email: "c@example.com", firstName: "Cy", lastName: "Turing", title: null, company: null },
    ];

    const id = await pushContactsToEvent(db, "event-1", ORG_A, contacts, "Lightning talks");

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    // ONE submission created for the whole batch -- not one per contact
    // (DEC-810 amendment, wave 59).
    expect(submissionSelectCalls).toHaveLength(1);
    expect(submissionUpdateCalls).toHaveLength(1);
    for (const call of submissionUpdateCalls) {
      const setValue = call.setValue as { status: string; acceptedAt: Date };
      expect(setValue.status).toBe("accepted");
      expect(setValue.acceptedAt).toBeInstanceOf(Date);
    }
  });

  it("throws for an empty contact list rather than silently minting a submission (callers must skip the call)", async () => {
    const { db } = statusCountingDb();
    await expect(pushContactsToEvent(db, "event-1", ORG_A, [], "Lightning talks")).rejects.toThrow();
  });

  // DEC-810: no fallback -- the batch's ONE session gets the exact
  // caller-supplied title, never an invented 'Invited: <First> <Last>'.
  it("applies the caller-supplied title to the batch's one session, with no fallback", async () => {
    const { db } = statusCountingDb();
    const insertedTitles: string[] = [];
    const wrapped = {
      ...db,
      insert(table: unknown) {
        const real = (db as any).insert(table);
        return {
          values: async (vals: any) => {
            if (table === schema.submission) insertedTitles.push(vals.title);
            return real.values(vals);
          },
        };
      },
    } as unknown as Db;

    await pushContactsToEvent(
      wrapped,
      "event-1",
      ORG_A,
      [
        { id: "c-1", email: "a@example.com", firstName: "Ada", lastName: "Lovelace", title: null, company: null },
        { id: "c-2", email: "b@example.com", firstName: "Bea", lastName: "Neumann", title: null, company: null },
      ],
      "Lightning talks",
    );

    // Exactly one submission insert -- one title, not one per contact.
    expect(insertedTitles).toEqual(["Lightning talks"]);
  });

  it("attaches every remaining contact as an active participant (inviteStatus 'none', not 'invited') of the one submission", async () => {
    const { db } = statusCountingDb();
    const insertedParticipants: any[] = [];
    const wrapped = {
      ...db,
      insert(table: unknown) {
        const real = (db as any).insert(table);
        return {
          values: async (vals: any) => {
            if (table === schema.participant) {
              const list = Array.isArray(vals) ? vals : [vals];
              insertedParticipants.push(...list);
            }
            return real.values(vals);
          },
        };
      },
    } as unknown as Db;

    const submissionId = await pushContactsToEvent(
      wrapped,
      "event-1",
      ORG_A,
      [
        { id: "c-1", email: "a@example.com", firstName: "Ada", lastName: "Lovelace", title: null, company: null },
        { id: "c-2", email: "b@example.com", firstName: "Bea", lastName: "Neumann", title: "Dr.", company: "Acme" },
        { id: "c-3", email: "c@example.com", firstName: "Cy", lastName: "Turing", title: null, company: null },
      ],
      "Lightning talks",
    );

    // All 3 contacts end up as participants of the one submission: c-1 (the
    // lead) via createSubmission's own participant insert (order 0), c-2/c-3
    // via insertActiveParticipants' chunked insert (order 1, 2).
    expect(insertedParticipants).toHaveLength(3);
    expect(insertedParticipants.every((p) => p.submissionId === submissionId)).toBe(true);
    expect(insertedParticipants.every((p) => p.role === "speaker")).toBe(true);
    expect(insertedParticipants.every((p) => p.visible === true)).toBe(true);
    expect(insertedParticipants.every((p) => p.inviteStatus === "none")).toBe(true);
    expect(insertedParticipants.map((p) => p.contactId)).toEqual(["c-1", "c-2", "c-3"]);
    expect(insertedParticipants.map((p) => p.order)).toEqual([0, 1, 2]);
    const bea = insertedParticipants.find((p) => p.contactId === "c-2");
    expect(bea.titleAtTime).toBe("Dr.");
    expect(bea.orgAtTime).toBe("Acme");
  });
});

// -----------------------------------------------------------------------
// findContactsForOrg: chunked (DEC-078, ID_CHUNK_SIZE=90) org-scoped load.
// -----------------------------------------------------------------------

describe("findContactsForOrg (DEC-357): chunked contact-load", () => {
  it("issues O(K/90) select statements, not one per id", async () => {
    const selectCalls: unknown[] = [];
    const ids = Array.from({ length: 95 }, (_, i) => `c-${i}`);
    const rowsById = new Map(
      ids.map((id) => [
        id,
        {
          id,
          orgId: ORG_A,
          firstName: "F",
          lastName: "L",
          email: `${id}@example.com`,
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
        },
      ]),
    );
    const CHUNK = 90; // ID_CHUNK_SIZE, DEC-078
    const db = {
      select() {
        return {
          from(table: unknown) {
            const callIndex = selectCalls.length;
            selectCalls.push(true);
            const batch = ids.slice(callIndex * CHUNK, callIndex * CHUNK + CHUNK);
            return { where: async () => batch.map((id) => rowsById.get(id)) };
          },
        };
      },
    } as unknown as Db;

    const rows = await repo.findContactsForOrg(db, ids, ORG_A);

    expect(rows).toHaveLength(95);
    // ID_CHUNK_SIZE=90 -> ceil(95/90) = 2 chunks.
    expect(selectCalls).toHaveLength(2);
  });

  it("returns [] with zero select statements for an empty id list", async () => {
    const selectCalls: unknown[] = [];
    const db = {
      select() {
        return { from: () => ({ where: async () => (selectCalls.push(true), []) }) };
      },
    } as unknown as Db;
    const rows = await repo.findContactsForOrg(db, [], ORG_A);
    expect(rows).toEqual([]);
    expect(selectCalls).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Route-level: POST /contacts/import with eventId wires findContactsForOrg +
// pushContactsToEvent exactly once each, and preserves the pre-change
// response shape / already-on-roster skip behavior.
// -----------------------------------------------------------------------

// Real per-row WHERE filtering (unlike the ignore-where convention used by
// the single-relevant-row tests elsewhere) — this test seeds multiple
// contacts/submissions at once, so "return the whole table" would be wrong.
// Filtering is driven by walking the real drizzle condition tree (same
// established pattern as test/agenda-room-ownership.test.ts /
// test/comms-invite-scope.test.ts) rather than hardcoding per-call-order
// responses, pairing each `col:<snake_case>` token with the `val:` tokens
// that follow it up to the next column, and matching against the row's
// camelCase field.
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
    if (!(key in row)) continue; // condition references a joined table's column
    if (!allowed.has(JSON.stringify(row[key]))) return false;
  }
  return true;
}

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

  // participant<->submission joins (listAcceptedContactIds) need both
  // tables' rows visible to rowMatches at once.
  function joinedRows(primary: any[], joinTable: unknown): any[] {
    const joined = stateArrayFor(joinTable);
    if (!joined) return primary;
    if (joinTable === schema.submission) {
      return primary.map((p) => ({ ...p, ...(joined.find((s) => s.id === p.submissionId) ?? {}) }));
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
      // DEC-491 amendment (wave 47): real drizzle .values() accepts a
      // single row OR an array of rows -- contacts/import.ts's chunked
      // create/update flush always passes an array. Each row in the list
      // is inserted into this table's state array.
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
          // DEC-556: inviteParticipant's atomic ON CONFLICT DO NOTHING
          // path (chained with .returning()) and getOrCreateTask's
          // ON CONFLICT DO NOTHING path (DEC-111 amendment, wave 48 —
          // awaited directly, no .returning()) — this fake db has no
          // uniqueness of its own, so it always "succeeds": the write
          // runs either way, whether or not .returning() is chained.
          onConflictDoNothing: (_target?: unknown) => {
            const p = write();
            return Object.assign(p, {
              returning: async (_sel?: unknown) => {
                await p;
                return [{ id: (vals as any).id, order: 0 }];
              },
            });
          },
          // DEC-491 amendment (wave 47): contacts/import.ts's update flush
          // -- "excluded.col" is resolved here as "the incoming row's own
          // value for that key", exactly what excluded means when the set
          // clause's key equals the referenced column name (always true
          // in import.ts).
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

describe("POST /api/v1/contacts/import with eventId (DEC-357 batch wiring, DEC-810 amendment wave 59)", () => {
  it("imports K new contacts as ONE session with K participants, via exactly one findContactsForOrg call and one pushContactsToEvent call", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const findSpy = vi.spyOn(repo, "findContactsForOrg");
    const pushSpy = vi.spyOn(repo, "pushContactsToEvent");

    const csvText =
      "Email,First,Last\n" +
      "a@example.com,Ada,Lovelace\n" +
      "b@example.com,Bea,Neumann\n" +
      "c@example.com,Cy,Turing\n";
    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const res = await app.request(jsonRequest("/api/v1/contacts/import", { csvText, mapping, eventId: "event-1", sessionTitle: "Lightning talks" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number; updated: number; addedToEvent: number };
    // addedToEvent is a PEOPLE count (3 contacts joined the roster), not a
    // session count -- there is exactly one session for the batch.
    expect(body).toEqual({ created: 3, updated: 0, skipped: [], addedToEvent: 3 });

    expect(state.contact).toHaveLength(3);
    expect(state.submission).toHaveLength(1);
    expect(state.submission[0].status).toBe("accepted");
    expect(state.submission[0].title).toBe("Lightning talks");
    expect(state.participant).toHaveLength(3);
    expect(state.participant.every((p: any) => p.submissionId === state.submission[0].id)).toBe(true);

    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect((pushSpy.mock.calls[0]?.[3] as unknown[]).length).toBe(3);

    findSpy.mockRestore();
    pushSpy.mockRestore();
  });

  it("skips a contact already on the roster and only pushes the new one", async () => {
    const { db, state } = fakeDb([], [EVENT_ORG_A]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const mapping = { Email: "email", First: "firstName", Last: "lastName" };

    const firstRes = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: "Email,First,Last\nada@example.com,Ada,Lovelace\n",
        mapping,
        eventId: "event-1",
        sessionTitle: "Lightning talks",
      }),
    );
    expect(firstRes.status).toBe(200);
    expect(((await firstRes.json()) as { addedToEvent: number }).addedToEvent).toBe(1);
    expect(state.submission).toHaveLength(1);

    const findSpy = vi.spyOn(repo, "findContactsForOrg");
    const pushSpy = vi.spyOn(repo, "pushContactsToEvent");

    const secondRes = await app.request(
      jsonRequest("/api/v1/contacts/import", {
        csvText: "Email,First,Last\nada@example.com,Ada,Lovelace\nbea@example.com,Bea,Neumann\n",
        mapping,
        eventId: "event-1",
        sessionTitle: "Lightning talks",
      }),
    );
    expect(secondRes.status).toBe(200);
    const secondBody = (await secondRes.json()) as { created: number; updated: number; addedToEvent: number };
    expect(secondBody).toEqual({ created: 1, updated: 1, skipped: [], addedToEvent: 1 });

    // Only the not-already-on-roster contact (bea) was pushed.
    expect((pushSpy.mock.calls[0]?.[3] as { email: string }[]).map((c) => c.email)).toEqual(["bea@example.com"]);
    expect(state.submission).toHaveLength(2);

    findSpy.mockRestore();
    pushSpy.mockRestore();
  });
});
