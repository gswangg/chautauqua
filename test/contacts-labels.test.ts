// DEC-712 (task-w17-d): the directory list's derived Labels column is
// participant.role, resolved through the ONE imported vocabulary
// (participantRoleLabel), batched in ONE query per page — never a per-row
// query, never a free-text labels column. Covers both the pure dedup/order
// decision (deriveContactLabels) and the batched fetch (fetchContactLabels),
// mirroring test/contacts-add-to-event.test.ts's table-identity-aware fake
// db (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { deriveContactLabels, fetchContactLabels } from "../src/server/repo/contacts";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

describe("deriveContactLabels (DEC-712 pure dedup/order)", () => {
  it("resolves each stored role through PARTICIPANT_ROLE_OPTIONS and dedupes per contact, preserving first-seen order", () => {
    const out = deriveContactLabels([
      { contactId: "c1", role: "speaker" },
      { contactId: "c1", role: "moderator" },
      { contactId: "c1", role: "speaker" }, // duplicate role on a second submission -> not repeated
      { contactId: "c2", role: "co-presenter" },
    ]);
    expect(out.get("c1")).toEqual(["Speaker", "Moderator"]);
    expect(out.get("c2")).toEqual(["Co-presenter"]);
  });

  it("renders a role outside the vocabulary as-is (organizer-set free text)", () => {
    const out = deriveContactLabels([{ contactId: "c1", role: "keynote wrangler" }]);
    expect(out.get("c1")).toEqual(["keynote wrangler"]);
  });

  it("returns an empty map for no rows", () => {
    expect(deriveContactLabels([]).size).toBe(0);
  });
});

/** Table-identity-aware fake db (same trick as
 * test/contacts-add-to-event.test.ts): select().from(schema.participant)
 * always returns the seeded participant rows regardless of the inArray
 * where clause — the seed itself is exactly the rows relevant to the ids
 * under test, so "return the table" is equivalent to "return the filtered
 * rows" for this test's purposes. */
function fakeDb(participantRows: { contactId: string; role: string }[]): Db {
  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(table === schema.participant ? participantRows : []),
      }),
    }),
  };
  return db as unknown as Db;
}

describe("fetchContactLabels (DEC-712 ONE batched query)", () => {
  it("returns the two-role contact's deduped labels and [] for a contact with zero participant rows", async () => {
    const db = fakeDb([
      { contactId: "c1", role: "speaker" },
      { contactId: "c1", role: "panelist" },
    ]);
    const out = await fetchContactLabels(db, ["c1", "c-none"]);
    expect(out.get("c1")).toEqual(["Speaker", "Panelist"]);
    expect(out.get("c-none") ?? []).toEqual([]);
  });

  it("short-circuits to an empty map without querying for an empty id list", async () => {
    let queried = false;
    const db = {
      select: () => {
        queried = true;
        return { from: () => ({ where: () => Promise.resolve([]) }) };
      },
    } as unknown as Db;
    const out = await fetchContactLabels(db, []);
    expect(out.size).toBe(0);
    expect(queried).toBe(false);
  });
});
