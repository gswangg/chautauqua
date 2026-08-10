// w12-c PLANNER items #1 and #2 (docs/verification-log.md): before w13,
// there was no admin API path that (1) created a co-presenter participant
// row with invite_status='invited', or (2) toggled participant.visible
// after submission-create time — both were only ever reachable via a
// direct `wrangler d1 execute --local` write from the walkthrough scripts.
// This exercises the new repo functions (src/server/repo/submissions.ts)
// against a minimal fake db that records every select/insert/update call,
// mirroring the fakeDb pattern used by test/headshot-gate.test.ts.

import { describe, expect, it } from "vitest";
import {
  getParticipantOwnership,
  inviteCoPresenter,
  setParticipantVisible,
} from "../src/server/repo/submissions";

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectResults: unknown[][]) {
  let call = 0;
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const db = {
    select: () => {
      const rows = selectResults[call] ?? [];
      call += 1;
      return makeSelectChain(rows);
    },
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push(vals);
        },
      }),
    }),
  };
  return { db: db as any, inserts, updates };
}

describe("inviteCoPresenter (w12-c PLANNER #1)", () => {
  it("creates a new contact and the first participant row, order 0, invite_status='invited'", async () => {
    const { db, inserts } = fakeDb([
      [], // findOrCreateContact: no existing contact
      [], // no existing participants -> maxOrder undefined
    ]);

    const participantId = await inviteCoPresenter(db, "sub_1", "org_1", {
      email: "new-copresenter@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });

    expect(participantId).toBeTruthy();
    expect(inserts).toHaveLength(2);
    const [contactInsert, participantInsert] = inserts as any[];
    expect(contactInsert.email).toBe("new-copresenter@example.com");
    expect(participantInsert).toMatchObject({
      submissionId: "sub_1",
      contactId: contactInsert.id,
      role: "speaker",
      order: 0,
      visible: true,
      inviteStatus: "invited",
    });
  });

  it("reuses an existing contact and appends after the current max order, without a contact insert", async () => {
    const { db, inserts } = fakeDb([
      [{ id: "contact-existing" }], // findOrCreateContact: matched by org+email
      [{ maxOrder: 2 }], // two existing participants, highest order 2
    ]);

    await inviteCoPresenter(db, "sub_2", "org_1", {
      email: "existing@example.com",
      firstName: "Alan",
      lastName: "Turing",
    });

    expect(inserts).toHaveLength(1); // no contact insert
    const [participantInsert] = inserts as any[];
    expect(participantInsert).toMatchObject({
      submissionId: "sub_2",
      contactId: "contact-existing",
      role: "speaker",
      order: 3,
      visible: true,
      inviteStatus: "invited",
    });
  });
});

describe("setParticipantVisible / getParticipantOwnership (w12-c PLANNER #2)", () => {
  it("setParticipantVisible writes visible=false via update().set()", async () => {
    const { db, updates } = fakeDb([]);
    await setParticipantVisible(db, "p1", false);
    expect(updates).toHaveLength(1);
    expect((updates[0] as any).visible).toBe(false);
  });

  it("setParticipantVisible writes visible=true via update().set()", async () => {
    const { db, updates } = fakeDb([]);
    await setParticipantVisible(db, "p1", true);
    expect((updates[0] as any).visible).toBe(true);
  });

  it("getParticipantOwnership returns the participant/submission/org scope when found", async () => {
    const { db } = fakeDb([[{ id: "p1", submissionId: "sub_1", orgId: "org_1" }]]);
    const scope = await getParticipantOwnership(db, "p1");
    expect(scope).toEqual({ id: "p1", submissionId: "sub_1", orgId: "org_1" });
  });

  it("getParticipantOwnership returns null when the participant doesn't exist", async () => {
    const { db } = fakeDb([[]]);
    const scope = await getParticipantOwnership(db, "missing");
    expect(scope).toBeNull();
  });
});
