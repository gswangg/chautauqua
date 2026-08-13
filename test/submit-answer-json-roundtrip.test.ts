// DEC-718: a validator admitting a value the persistence layer cannot
// carry must fail at the write, loudly — not turn into a null in D1.
// upsertSubmissionAnswers asserts every cleaned value survives a
// JSON.stringify/JSON.parse round trip before it ever builds a row, and
// throws naming the offending field id if one does not.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { upsertSubmissionAnswers } from "../src/server/repo/submit";

function makeFakeDb() {
  const db = {
    select() {
      return { from: () => ({ where: () => [] }) };
    },
    insert(table: unknown) {
      return {
        values() {
          if (table === schema.submissionAnswer) {
            return { onConflictDoUpdate: () => Promise.resolve() };
          }
          return Promise.resolve();
        },
      };
    },
    delete() {
      return { where: () => Promise.resolve() };
    },
  };
  return db as unknown as Db;
}

describe("upsertSubmissionAnswers — DEC-718 write-time JSON round-trip assert", () => {
  it("persists ordinary string/number/boolean answers without throwing", async () => {
    const db = makeFakeDb();
    await expect(
      upsertSubmissionAnswers(db, "s1", {
        custom_text: "hello",
        custom_number: 42,
        custom_bool: true,
      }),
    ).resolves.toBeUndefined();
  });

  it("throws naming the field id for a value that does not survive a JSON round trip (NaN)", async () => {
    const db = makeFakeDb();
    await expect(
      upsertSubmissionAnswers(db, "s1", { custom_bad: NaN }),
    ).rejects.toThrow(/custom_bad/);
  });

  it("throws naming the field id for Infinity", async () => {
    const db = makeFakeDb();
    await expect(
      upsertSubmissionAnswers(db, "s1", { custom_bad: Infinity }),
    ).rejects.toThrow(/custom_bad/);
  });

  it("throws naming the field id for undefined", async () => {
    const db = makeFakeDb();
    await expect(
      upsertSubmissionAnswers(db, "s1", { custom_bad: undefined }),
    ).rejects.toThrow(/custom_bad/);
  });

  it("throws naming the field id for a function value", async () => {
    const db = makeFakeDb();
    await expect(
      upsertSubmissionAnswers(db, "s1", { custom_bad: () => 1 }),
    ).rejects.toThrow(/custom_bad/);
  });
});
