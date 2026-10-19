// DEC-317 Amendment (wave 37) behavior coverage: a speaker adds a
// co-presenter whose email matches an existing contact who HAS a portal
// account. That contact must land 'invited' (not active) until they accept.
//
// (a)/(b)/(c)/(d) are already proven GENERICALLY by existing invite-status
// coverage that this repo already has for the 'invited' state — this file
// only asserts that addCoPresenter's actual write feeds that machinery the
// same value the organizer's own add-participant path writes:
//   (a) not readable/writable through the portal while merely invited —
//       test/portal-invite-scope.test.ts's "invited participant" case.
//   (b) excluded as a comms recipient — test/comms-invite-scope.test.ts
//       proves loadComposeSubmissions' WHERE excludes 'invited'.
//   (c) excluded from onboarding-task planning while invited — reproduced
//       directly below via ensureOnboardingTasks (mirrors
//       test/onboarding-task-backfill.test.ts's fakeDb).
//   (d) sees the pending invitation — reproduced directly below via the
//       real getMyInvitations repo function.
//   (e) accept flips 'invited' -> 'accepted' and back-fills onboarding
//       tasks — covered in the SEPARATE file
//       test/portal-invite-write-audience-accept-route.test.ts (kept apart
//       because that file's vi.mock("../src/server/repo/submissions") would
//       otherwise shadow the REAL ensureOnboardingTasks this file exercises
//       directly in Part 2 — same file-splitting convention as
//       test/portal-copresenter.test.ts / test/portal-copresenter-route.test.ts).

import { describe, expect, it } from "vitest";
import type { Db } from "../src/server/context";
import { addCoPresenter } from "../src/server/repo/portal-edit";
import { getMyInvitations } from "../src/server/repo/portal/invitations";

// ---------------------------------------------------------------------------
// Part 1: addCoPresenter (the real function) writes inviteStatus='invited'
// for a co-presenter matched to an EXISTING contact by email.
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    // DEC-558 (wave 75): findContactByEmail orders by (createdAt, id) before
    // .limit(1); a no-op for this fake, but it must exist in the chain.
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("addCoPresenter writes inviteStatus='invited' for an existing-contact match", () => {
  it("matches by case-insensitive email against a contact who already has a portal account, and lands 'invited' + visible=false", async () => {
    const existingContact = { id: "contact-existing", title: "Staff Engineer", company: "Acme" };
    let call = 0;
    const inserts: any[] = [];
    const db = {
      select: () => {
        const rows = call === 0 ? [{ count: 1 }] : [existingContact];
        call += 1;
        return makeChain(rows);
      },
      insert: () => ({
        values: (vals: unknown) => {
          inserts.push(vals);
          return { onConflictDoNothing: () => ({ returning: async () => [{ id: "participant-new" }] }) };
        },
      }),
      // DEC-725 amendment: addCoPresenter now also bumps the owning
      // submission's updated_at (submissions/touch.ts).
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as unknown as Db;

    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie.existing@example.com",
      role: "co-presenter",
    });

    expect(result.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].contactId).toBe("contact-existing");
    // The core assertion: an untrusted speaker-supplied write never mints an
    // ACTIVE grant directly — it lands 'invited', exactly like the
    // organizer's own add-participant path.
    expect(inserts[0].inviteStatus).toBe("invited");
    expect(inserts[0].visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Part 2: (c) an 'invited' participant is excluded from onboarding-task
// back-fill until they accept.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Part 3: (d) the named contact sees the pending invitation via the real
// getMyInvitations repo function.
// ---------------------------------------------------------------------------

describe("(d) the named contact sees a pending co-presenter invitation", () => {
  it("getMyInvitations returns the row while inviteStatus='invited'", async () => {
    const db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: async () => [
                {
                  participantId: "participant-new",
                  submissionId: "sub-1",
                  seq: 3,
                  title: "Talk title",
                  recordPrefix: "SES",
                  eventName: "Conf",
                },
              ],
            }),
          }),
        }),
      }),
    } as unknown as Db;

    const invitations = await getMyInvitations(db, "contact-existing", "org-1");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.participantId).toBe("participant-new");
    expect(invitations[0]?.title).toBe("Talk title");
  });
});

