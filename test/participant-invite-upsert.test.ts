// Regression for DEC-556: inviteParticipant is a single atomic INSERT ...
// ON CONFLICT DO NOTHING against participant's (submission_id, contact_id)
// uniqueIndex — never a SELECT-then-INSERT probe (the old pre-check SELECT
// + max(order) SELECT could race a concurrent invite of the same contact).
// Modelled on test/portal-edit-answer-upsert.test.ts's fake-db harness: a
// fake db that counts select()/insert() calls against `participant`
// specifically, so a regression back to read-then-write is caught even if
// the final DB state looks correct.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { inviteParticipant, DUPLICATE_PARTICIPANT } from "../src/server/repo/participants";

interface DoNothingCall {
  row: Record<string, unknown>;
  target: unknown;
  returningResult: Array<Record<string, unknown>>;
}

function makeFakeDb(opts: { onConflictDoNothingReturns?: Array<Record<string, unknown>> } = {}) {
  const participantSelects: number[] = [];
  const doNothingCalls: DoNothingCall[] = [];

  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === schema.participant) {
            participantSelects.push(1);
            return chainFor([]);
          }
          throw new Error("fake db: unexpected table in select");
        },
      };
    },
    insert(table: unknown) {
      if (table !== schema.participant) {
        throw new Error("fake db: unexpected table in insert");
      }
      return {
        values(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const row = Array.isArray(rows) ? rows[0]! : rows;
          return {
            onConflictDoNothing(o: { target: unknown }) {
              return {
                returning(_sel?: unknown) {
                  const result =
                    opts.onConflictDoNothingReturns ??
                    [{ id: row.id, order: 0 }];
                  doNothingCalls.push({ row, target: o.target, returningResult: result });
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      // DEC-725 amendment (wave 63): inviteParticipant now also bumps the
      // owning submission's updated_at (see
      // src/server/repo/submissions/touch.ts) — a deliberate second write,
      // never against `participant` itself, so this fake db still throws
      // for any update() against participant (the read-then-write it must
      // never do) but allows the submission touch.
      if (table === schema.submission) {
        return { set: () => ({ where: () => Promise.resolve() }) };
      }
      throw new Error("fake db: unexpected update() call — inviteParticipant must not read-then-write");
    },
    delete() {
      throw new Error("fake db: unexpected delete() call");
    },
  };

  return { db: db as unknown as Db, participantSelects, doNothingCalls };
}

const baseInput = {
  submissionId: "sub1",
  contactId: "contact1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("inviteParticipant (DEC-556)", () => {
  it("performs zero selects against participant before exactly one insert", async () => {
    const { db, participantSelects, doNothingCalls } = makeFakeDb();
    const result = await inviteParticipant(db, baseInput);
    expect(participantSelects.length).toBe(0);
    expect(doNothingCalls.length).toBe(1);
    expect(result).not.toBe(DUPLICATE_PARTICIPANT);
  });

  it("ON CONFLICT target equals the schema uniqueIndex's (submissionId, contactId) columns", async () => {
    const { db, doNothingCalls } = makeFakeDb();
    await inviteParticipant(db, baseInput);
    expect(doNothingCalls[0]!.target).toEqual([
      schema.participant.submissionId,
      schema.participant.contactId,
    ]);
  });

  it("returns DUPLICATE_PARTICIPANT when .returning() is empty, without any select", async () => {
    const { db, participantSelects, doNothingCalls } = makeFakeDb({ onConflictDoNothingReturns: [] });
    const result = await inviteParticipant(db, baseInput);
    expect(result).toBe(DUPLICATE_PARTICIPANT);
    expect(participantSelects.length).toBe(0);
    expect(doNothingCalls.length).toBe(1);
  });
});
