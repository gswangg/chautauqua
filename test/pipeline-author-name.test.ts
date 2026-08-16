// DEC-757 (wave-72 amendment): resolveAuthorName (src/server/repo/pipeline.ts)
// answers the same "what is this person called?" question as its sibling
// resolveActorName (src/server/repo/users.ts) with the same ladder:
// linked contact's "First Last" -> stored user.name -> user.email. A missing
// user row throws (fail loudly) — the literal "Unknown" is deleted.

import { describe, expect, it } from "vitest";
import { resolveAuthorName } from "../src/server/repo/pipeline";
import type { Db } from "../src/server/context";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return chain;
}

function queueDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as Db;
}

describe("resolveAuthorName (DEC-757 wave-72)", () => {
  it("returns 'First Last' for a user with a linked contact, even when a user.name is also stored (precedence unchanged)", async () => {
    const db = queueDb([
      [{ email: "organizer@example.com", contactId: "contact-1", name: "Ignored Name" }],
      [{ firstName: "Olive", lastName: "Organizer" }],
    ]);
    const name = await resolveAuthorName(db, "u-organizer");
    expect(name).toBe("Olive Organizer");
  });

  it("uses the stored user.name when there is no linked contact", async () => {
    const db = queueDb([[{ email: "reviewer@example.com", contactId: null, name: "Riley Reviewer" }]]);
    const name = await resolveAuthorName(db, "u-reviewer");
    expect(name).toBe("Riley Reviewer");
  });

  it("falls back to the user's email when there is no linked contact and no stored name", async () => {
    const db = queueDb([[{ email: "reviewer@example.com", contactId: null, name: null }]]);
    const name = await resolveAuthorName(db, "u-reviewer");
    expect(name).toBe("reviewer@example.com");
  });

  it("throws (fail loudly) rather than returning the literal 'Unknown' when the user row is missing", async () => {
    const db = queueDb([[]]);
    await expect(resolveAuthorName(db, "ghost-user")).rejects.toThrow();
  });
});
