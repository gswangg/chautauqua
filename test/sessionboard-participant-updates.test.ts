// DEC-528 (wave 49 amendment) regression: the Sessionboard participant
// UPDATE flush collapses to O(distinct (column-signature, value-tuple))
// statements, not O(rows). Before this change, flushParticipantUpdates
// issued one `UPDATE ... WHERE id = ?` per row -- a 500-row idempotent
// re-import paid 500 sequential D1 writes. Same table-identity-aware fake db
// technique as test/sessionboard-import-acceptance.test.ts, instrumented to
// count how many times db.update(...) is actually invoked (one call per
// emitted SQL statement).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { applySessionboardPlans } from "../src/server/repo/import/sessionboard";
import { externalRef, SESSIONBOARD_SOURCE } from "../src/domain/sessionboard";
import type { Db } from "../src/server/context";

function fakeDb(seed: {
  event: unknown[];
  submission?: unknown[];
  participant?: unknown[];
  contact?: unknown[];
}) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    participant: [...(seed.participant ?? [])] as any[],
    contact: [...(seed.contact ?? [])] as any[],
  };

  let updateStatementCount = 0;

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.event) return state.event;
    if (table === schema.submission) return state.submission;
    if (table === schema.participant) return state.participant;
    if (table === schema.contact) return state.contact;
    return undefined;
  }

  function snakeToCamel(s: string): string {
    return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  }
  function conditionColumnValues(cond: unknown): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    let currentCol: string | null = null;
    function walk(node: unknown, seen = new Set<unknown>(), depth = 0): void {
      if (depth > 14 || node === null || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      // inArray(...) nests its bound param objects inside a plain JS array
      // (not under a `.queryChunks`/`.value` property) -- descend into it
      // directly or an inArray WHERE never sees its own value list.
      if (Array.isArray(node)) {
        for (const c of node) walk(c, seen, depth + 1);
        return;
      }
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

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: (cond: unknown) => makeChain(rows.filter((r) => rowMatches(r as Record<string, unknown>, cond))),
      groupBy: () => chain,
      limit: (n: number) => makeChain(rows.slice(0, n)),
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const write = async () => {
          const rows = Array.isArray(vals) ? vals : [vals];
          const arr = stateArrayFor(table);
          if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
        };
        return {
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
          onConflictDoNothing: () => write(),
        };
      },
    }),
    update: (table: unknown) => {
      updateStatementCount++;
      return {
        set: (setVals: unknown) => ({
          where: (cond: unknown) => {
            const write = async () => {
              const arr = stateArrayFor(table);
              if (!arr) return;
              for (const r of arr) {
                if (rowMatches(r as Record<string, unknown>, cond)) Object.assign(r, setVals as object);
              }
            };
            return {
              then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
            };
          },
        }),
      };
    },
  };
  return { db: db as unknown as Db, state, getUpdateStatementCount: () => updateStatementCount };
}

const ORG_ID = "org-1";
const EVENT_ID = "event-1";
const SESSION_EXTERNAL_ID = "sb-sess-1";
const SESSION_REF = externalRef(SESSIONBOARD_SOURCE, SESSION_EXTERNAL_ID);
const SUBMISSION_ID = "submission-1";

const ROLES = ["speaker", "moderator", "panelist"];
const ORDERS = [0, 1];

describe("DEC-528 (wave 49 amendment): Sessionboard participant UPDATE flush collapses to O(distinct value tuples)", () => {
  it("40 rows spanning 3 distinct role values and 2 distinct order values issue a bounded statement count and land every row on its correct final role/order/updatedAt", async () => {
    const contactIds: string[] = [];
    const participants: unknown[] = [];
    const contacts: unknown[] = [];
    for (let i = 0; i < 40; i++) {
      const contactId = `contact-${i}`;
      contactIds.push(contactId);
      contacts.push({ id: contactId, orgId: ORG_ID, externalRef: externalRef(SESSIONBOARD_SOURCE, `sb-spk-${i}`) });
      participants.push({
        id: `participant-${i}`,
        submissionId: SUBMISSION_ID,
        contactId,
        role: "stale-role",
        order: 99,
        updatedAt: null,
      });
    }

    const { db, state, getUpdateStatementCount } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, externalRef: SESSION_REF }],
      participant: participants,
      contact: contacts,
    });

    const plans = contactIds.map((_, i) => ({
      row: i + 2,
      externalRef: null,
      values: {
        sessionExternalId: SESSION_EXTERNAL_ID,
        speakerExternalId: `sb-spk-${i}`,
        role: ROLES[i % ROLES.length]!,
        order: String(ORDERS[i % ORDERS.length]!),
      },
    }));

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: false,
      plans: plans as any,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(40);
    expect(result.skipped).toEqual([]);

    // Bounded by the distinct (role, order) value-tuple count (6), never by
    // the 40-row count -- the whole point of the collapse.
    const distinctValueTuples = ROLES.length * ORDERS.length;
    expect(getUpdateStatementCount()).toBeLessThanOrEqual(distinctValueTuples);
    expect(getUpdateStatementCount()).toBeGreaterThan(0);
    expect(getUpdateStatementCount()).toBeLessThan(40);

    for (let i = 0; i < 40; i++) {
      const row = state.participant.find((p: any) => p.id === `participant-${i}`);
      expect(row.role).toBe(ROLES[i % ROLES.length]);
      expect(row.order).toBe(ORDERS[i % ORDERS.length]);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }

    // Every touched row stamped with the SAME ts, across every group.
    const stamps = new Set(state.participant.map((p: any) => (p.updatedAt as Date).getTime()));
    expect(stamps.size).toBe(1);
  });
});
