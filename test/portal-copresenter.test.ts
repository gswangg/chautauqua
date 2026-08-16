// DEC-604: a speaker may self-add a co-presenter to their own submission.
// Covers the repo layer (src/server/repo/portal-edit.ts:addCoPresenter —
// validation, existing-contact resolution writes NOTHING to the contact,
// fresh-contact creation, the 5-co-presenter cap, and the
// (submission_id, contact_id) uniqueIndex surfacing as a field error never
// a 500) and the shared role-label vocabulary. Route-layer coverage
// (csrf/edit-lock/re-render) lives in test/portal-copresenter-route.test.ts
// — vi.mock is file-scoped/hoisted, so mocking portal-edit there would
// otherwise shadow the real addCoPresenter this file exercises directly.

import { describe, expect, it } from "vitest";
import { addCoPresenter, getPortalParticipants } from "../src/server/repo/portal-edit";
import {
  participantRoleLabel,
  PARTICIPANT_ROLE_OPTIONS,
  MAX_PARTICIPANTS_PER_SUBMISSION,
} from "../src/domain/participant-roles";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    // DEC-558 (wave 75): findContactByEmail now orders by (createdAt, id)
    // before .limit(1) so a duplicate-email pair resolves deterministically.
    // Ordering is a no-op for this fake (the queued row sets are already in
    // the order each scenario intends), it just has to exist in the chain.
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Fake db mirroring test/api-participants.test.ts's pattern: a queue of
 * select() row sets consumed in call order, and every insert()/update()
 * recorded. Throws on update() — addCoPresenter must never write to an
 * existing contact (DEC-604). */
function fakeDb(selectQueue: unknown[][], insertReturning: unknown[]) {
  let call = 0;
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          onConflictDoNothing: () => ({
            returning: async () => insertReturning,
          }),
        };
      },
    }),
    // DEC-725 amendment: addCoPresenter now also bumps the owning
    // submission's updated_at (submissions/touch.ts) — allowed here, but
    // still throws for any update() against `contact` (DEC-604: never
    // writes to an existing contact).
    update: (table: unknown) => {
      if (table === schema.submission) {
        return { set: () => ({ where: () => Promise.resolve() }) };
      }
      throw new Error("addCoPresenter must never call db.update() (DEC-604: never writes to an existing contact)");
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

const BASE_INPUT = {
  submissionId: "sub-1",
  orgId: "org-1",
  firstName: "Marcus",
  lastName: "Okafor",
  email: "Marcus@Example.com",
  role: "co-presenter",
};

describe("addCoPresenter repo layer (DEC-604)", () => {
  it("rejects blank first/last name and invalid email/role without touching the db", async () => {
    const { db } = fakeDb([], []);
    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: "  ",
      lastName: "",
      email: "not-an-email",
      role: "president",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.firstName).toBeTruthy();
    expect(result.errors.lastName).toBeTruthy();
    expect(result.errors.email).toBeTruthy();
    expect(result.errors.role).toBeTruthy();
  });

  it("creates a fresh contact (name+email only) when no existing contact matches, case-insensitively", async () => {
    // select order: [0] participant count, [1] findContactByEmail -> no match
    const { db, inserts } = fakeDb([[{ count: 1 }], []], [{ id: "participant-1" }]);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(true);

    const contactInsert = inserts.find((v) => "email" in v && "firstName" in v && !("submissionId" in v));
    expect(contactInsert).toBeTruthy();
    expect(contactInsert.email).toBe("marcus@example.com"); // normalized
    expect(contactInsert.firstName).toBe("Marcus");
    expect(contactInsert.lastName).toBe("Okafor");
    expect(contactInsert.title ?? null).toBeNull();
    expect(contactInsert.company ?? null).toBeNull();

    const participantInsert = inserts.find((v) => "submissionId" in v);
    expect(participantInsert.role).toBe("co-presenter");
    // DEC-317 Amendment (wave 37): a speaker-named co-presenter is an
    // untrusted write path — lands 'invited' (portal-visible, not active),
    // exactly like the organizer's own add-participant path.
    expect(participantInsert.inviteStatus).toBe("invited");
    // DEC-656 (amends DEC-604): recorded, not published — never visible=true.
    expect(participantInsert.visible).toBe(false);
  });

  it("resolves an existing contact by case-insensitive email and writes NO field onto it", async () => {
    const existingContact = { id: "contact-9", title: "Staff Engineer", company: "Acme" };
    // select order: [0] participant count, [1] findContactByEmail -> match
    const { db, inserts } = fakeDb([[{ count: 1 }], [existingContact]], [{ id: "participant-2" }]);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(true);

    // Only the participant insert should have happened — no contact insert,
    // and fakeDb.update() throws if it were ever called.
    expect(inserts.length).toBe(1);
    expect(inserts[0].contactId).toBe("contact-9");
    expect(inserts[0].titleAtTime).toBe("Staff Engineer");
    expect(inserts[0].orgAtTime).toBe("Acme");
  });

  it("caps at 5 co-presenters and surfaces the cap as a field error, not a crash", async () => {
    const { db } = fakeDb([[{ count: MAX_PARTICIPANTS_PER_SUBMISSION }]], []);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(Object.values(result.errors).some((m) => /maximum/i.test(m))).toBe(true);
  });

  // DEC-422/DEC-604 amendment (w12-b): the refusal must never present a
  // stored count as though it were a position inside a remaining
  // allowance (e.g. never "already has 12 of the maximum 6 participants").
  // Exercised at both boundaries: the submission already exactly AT the
  // cap (the organizer's door alone could never overshoot it, since it
  // never checked before) and already ABOVE it (the gap this task closes —
  // the organizer's invite door was previously uncapped).
  it("names the cap grammar's own copy at count === cap, never a stored-count-as-position phrasing", async () => {
    const { db } = fakeDb([[{ count: MAX_PARTICIPANTS_PER_SUBMISSION }]], []);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.role).toMatch(/participant/i);
    expect(result.errors.role).not.toMatch(
      new RegExp(`already has ${MAX_PARTICIPANTS_PER_SUBMISSION} of the maximum`),
    );
  });

  it("names the cap grammar's own copy at count > cap (organizer door already over), never a bare stored count", async () => {
    const overCount = MAX_PARTICIPANTS_PER_SUBMISSION + 6;
    const { db } = fakeDb([[{ count: overCount }]], []);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.role).toMatch(/participant/i);
    expect(result.errors.role).not.toMatch(new RegExp(`already has ${overCount} of the maximum`));
  });

  it("surfaces the (submission_id, contact_id) uniqueIndex conflict as a validation error, never a 500", async () => {
    // select order: [0] participant count, [1] findContactByEmail -> match
    const existingContact = { id: "contact-9", title: null, company: null };
    // insertReturning=[] simulates onConflictDoNothing firing (duplicate).
    const { db } = fakeDb([[{ count: 1 }], [existingContact]], []);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.email).toBeTruthy();
  });
});

function makeJoinChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("addCoPresenter + getPortalParticipants echo rule (DEC-866)", () => {
  it("writes the SUBMITTED first/last as nameAtTime when the email matches an existing contact", async () => {
    const existingContact = { id: "contact-9", title: "Staff Engineer", company: "Acme" };
    // select order: [0] participant count, [1] findContactByEmail -> match
    const { db, inserts } = fakeDb([[{ count: 1 }], [existingContact]], [{ id: "participant-2" }]);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(true);

    expect(inserts.length).toBe(1);
    expect(inserts[0].contactId).toBe("contact-9");
    // The submitted name, not the matched contact's identity.
    expect(inserts[0].nameAtTime).toBe("Marcus Okafor");
  });

  it("writes the SUBMITTED first/last as nameAtTime when a fresh contact is created", async () => {
    // select order: [0] participant count, [1] findContactByEmail -> no match
    const { db, inserts } = fakeDb([[{ count: 1 }], []], [{ id: "participant-1" }]);
    const result = await addCoPresenter(db, BASE_INPUT);
    expect(result.ok).toBe(true);

    const participantInsert = inserts.find((v) => "submissionId" in v);
    expect(participantInsert.nameAtTime).toBe("Marcus Okafor");
  });

  it("getPortalParticipants renders nameAtTime in preference to the joined contact name", async () => {
    const db = {
      select: () =>
        makeJoinChain([
          {
            id: "p-1",
            firstName: "Jane",
            lastName: "Doe",
            email: "marcus@example.com",
            role: "co-presenter",
            order: 0,
            visible: false,
            nameAtTime: "Marcus Okafor",
          },
        ]),
    } as unknown as AppEnv["Variables"]["db"];
    const result = await getPortalParticipants(db, "sub-1");
    expect(result).toEqual([
      {
        id: "p-1",
        name: "Marcus Okafor",
        email: "marcus@example.com",
        role: "co-presenter",
        roleLabel: participantRoleLabel("co-presenter"),
        visible: false,
      },
    ]);
  });

  it("getPortalParticipants falls back to the live contact name when nameAtTime is null", async () => {
    const db = {
      select: () =>
        makeJoinChain([
          {
            id: "p-2",
            firstName: "Jordan",
            lastName: "Lee",
            email: "jordan@example.com",
            role: "speaker",
            order: 0,
            visible: true,
            nameAtTime: null,
          },
        ]),
    } as unknown as AppEnv["Variables"]["db"];
    const result = await getPortalParticipants(db, "sub-1");
    expect(result[0]!.name).toBe("Jordan Lee");
  });
});

describe("participant role vocabulary (DEC-604): one exported source", () => {
  it("resolves every vocabulary value to its own label", () => {
    for (const opt of PARTICIPANT_ROLE_OPTIONS) {
      expect(participantRoleLabel(opt.value)).toBe(opt.label);
    }
  });

  it("passes an out-of-vocabulary (organizer free-text) role through unchanged rather than dropping it", () => {
    expect(participantRoleLabel("keynote wrangler")).toBe("keynote wrangler");
  });
});
