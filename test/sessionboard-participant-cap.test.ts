// DEC-604 (participant-cap amendment): the Sessionboard participants import
// door is one of the several doors that can add a participant row to a
// submission, and (like the organizer invite endpoint and the portal
// add-co-presenter form) it must never push a submission past
// MAX_PARTICIPANTS_PER_SUBMISSION. Per the ruling, this door SKIPS rather
// than refuses: rows that would exceed the cap land in `skipped` with a
// reason naming the submission and the cap, and the remaining rows still
// import. The count is enforced identically on the dryRun path (DEC-613:
// one planner, two modes) so the Review step's skipped set exactly predicts
// the real run's.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { applySessionboardPlans } from "../src/server/repo/import/sessionboard";
import { externalRef, SESSIONBOARD_SOURCE } from "../src/domain/sessionboard";
import { MAX_PARTICIPANTS_PER_SUBMISSION } from "../src/domain/participant-roles";
import type { Db } from "../src/server/context";

function fakeDb(seed: { event: unknown[]; submission?: unknown[]; participant?: unknown[]; contact?: unknown[] }) {
  const state = {
    event: [...seed.event] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    participant: [...(seed.participant ?? [])] as any[],
    contact: [...(seed.contact ?? [])] as any[],
  };

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
    update: (table: unknown) => ({
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
    }),
  };
  return { db: db as unknown as Db, state };
}

const ORG_ID = "org-1";
const EVENT_ID = "event-1";
const SESSION_EXTERNAL_ID = "sb-sess-1";
const SESSION_REF = externalRef(SESSIONBOARD_SOURCE, SESSION_EXTERNAL_ID);
const SUBMISSION_ID = "submission-1";

function seedAtCapMinusN(n: number) {
  // Seeds the submission with (MAX_PARTICIPANTS_PER_SUBMISSION - n) existing
  // participants, each paired with its own pre-existing contact so the row
  // loop's "unresolved speaker" branch never fires for them.
  const existingCount = MAX_PARTICIPANTS_PER_SUBMISSION - n;
  const contacts: unknown[] = [];
  const participants: unknown[] = [];
  for (let i = 0; i < existingCount; i++) {
    const contactId = `existing-contact-${i}`;
    contacts.push({ id: contactId, orgId: ORG_ID, externalRef: externalRef(SESSIONBOARD_SOURCE, `existing-spk-${i}`) });
    participants.push({
      id: `existing-participant-${i}`,
      submissionId: SUBMISSION_ID,
      contactId,
      role: "speaker",
      order: i,
      updatedAt: null,
    });
  }
  return { contacts, participants };
}

// Builds a plans array of `count` new-speaker rows, each resolving to a
// distinct, not-yet-linked contact -- every row is a candidate CREATE.
function newSpeakerPlans(count: number, contacts: unknown[]) {
  const plans: unknown[] = [];
  for (let i = 0; i < count; i++) {
    const externalId = `new-spk-${i}`;
    contacts.push({ id: `new-contact-${i}`, orgId: ORG_ID, externalRef: externalRef(SESSIONBOARD_SOURCE, externalId) });
    plans.push({
      row: i + 2,
      externalRef: null,
      values: {
        sessionExternalId: SESSION_EXTERNAL_ID,
        speakerExternalId: externalId,
      },
    });
  }
  return plans;
}

describe("DEC-604 (participant-cap amendment): Sessionboard participants import respects MAX_PARTICIPANTS_PER_SUBMISSION", () => {
  it("writes exactly up to the cap and reports the surplus rows in skipped with a reason naming the cap", async () => {
    const { contacts, participants } = seedAtCapMinusN(2);
    // Two headroom slots exist; offer 5 new-speaker rows -- 2 should create,
    // 3 should be skipped for the cap.
    const plans = newSpeakerPlans(5, contacts);

    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, externalRef: SESSION_REF }],
      participant: participants,
      contact: contacts,
    });

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: false,
      plans: plans as any,
    });

    expect(result.created).toBe(2);
    expect(result.skipped).toHaveLength(3);
    for (const s of result.skipped) {
      expect(s.reason).toContain(SUBMISSION_ID);
      expect(s.reason).toContain(String(MAX_PARTICIPANTS_PER_SUBMISSION));
    }
    // The third through fifth offered rows (CSV rows 4,5,6, since row=i+2)
    // are the surplus, since the first two consume the remaining headroom.
    expect(result.skipped.map((s) => s.row)).toEqual([4, 5, 6]);

    const finalParticipants = state.participant.filter((p: any) => p.submissionId === SUBMISSION_ID);
    expect(finalParticipants).toHaveLength(MAX_PARTICIPANTS_PER_SUBMISSION);
  });

  it("dryRun reports the identical skipped set and writes nothing", async () => {
    const { contacts, participants } = seedAtCapMinusN(2);
    const plans = newSpeakerPlans(5, contacts);

    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, externalRef: SESSION_REF }],
      participant: participants,
      contact: contacts,
    });

    const before = state.participant.length;

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: true,
      plans: plans as any,
    });

    expect(result.created).toBe(2);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.map((s) => s.row)).toEqual([4, 5, 6]);
    for (const s of result.skipped) {
      expect(s.reason).toContain(SUBMISSION_ID);
      expect(s.reason).toContain(String(MAX_PARTICIPANTS_PER_SUBMISSION));
    }

    // No writes at all on the dryRun path.
    expect(state.participant.length).toBe(before);
  });

  it("a CSV that stays under the cap is unaffected", async () => {
    const { contacts, participants } = seedAtCapMinusN(MAX_PARTICIPANTS_PER_SUBMISSION);
    // Full headroom (MAX slots available); offer exactly MAX-1 new rows.
    const plans = newSpeakerPlans(MAX_PARTICIPANTS_PER_SUBMISSION - 1, contacts);

    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, externalRef: SESSION_REF }],
      participant: participants,
      contact: contacts,
    });

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: false,
      plans: plans as any,
    });

    expect(result.created).toBe(MAX_PARTICIPANTS_PER_SUBMISSION - 1);
    expect(result.skipped).toEqual([]);

    const finalParticipants = state.participant.filter((p: any) => p.submissionId === SUBMISSION_ID);
    expect(finalParticipants).toHaveLength(MAX_PARTICIPANTS_PER_SUBMISSION - 1);
  });
});
