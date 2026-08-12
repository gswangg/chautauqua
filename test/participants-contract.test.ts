// DEC-265: reload-equivalence contract for the participants endpoints.
// task-w2-f OPEN ITEM 1 was that a freshly invited co-presenter's POST
// response was missing name/email, so the SPA showed a blank row until the
// page reloaded (which re-fetches submission detail via
// src/server/repo/submissions/detail.ts, whose participant projection DOES
// include name/email). This file asserts the POST and PATCH responses are
// field-for-field identical in shape (and, for matching data, in value) to
// the submission-detail participant serialization, so the write-path
// response can be trusted without a reload.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { SubmissionDetailParticipant } from "../src/server/repo/submissions/detail";

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };

const CONTACT_ORG_A = {
  id: "contact-1",
  orgId: ORG_A,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: null,
  company: null,
  title: null,
  bio: null,
  headshotUrl: null,
  socialLinksJson: null,
  notes: null,
  customFieldsJson: null,
  createdAt: new Date(1000),
  updatedAt: new Date(1000),
};

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const updates: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          // DEC-556: inviteParticipant's atomic ON CONFLICT DO NOTHING
          // path — this fake db always "succeeds" and returns the
          // DB-computed id/order (order=0, no prior participants seeded).
          onConflictDoNothing: () => ({
            returning: async (_sel?: unknown) => [{ id: "p-new", order: 0 }],
          }),
        };
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
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, updates };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function jsonRequest(method: "POST" | "PATCH", path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

// The field set a submission-detail reload produces for a participant
// (src/server/repo/submissions/detail.ts SubmissionDetailParticipant),
// used below as the ground truth the write-path responses must match.
const DETAIL_PARTICIPANT_KEYS: (keyof SubmissionDetailParticipant)[] = [
  "id",
  "contactId",
  "name",
  "email",
  "role",
  "order",
  "visible",
  "inviteStatus",
];

describe("DEC-265: participant write-path responses are reload-equivalent", () => {
  it("POST /participants response deep-equals what a submission-detail reload would produce for that row", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [CONTACT_ORG_A], // findContactForOrg
      [], // duplicate check: none
      [{ maxOrder: -1 }], // no existing participants
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }),
    );
    expect(res.status).toBe(201);
    const posted = (await res.json()) as any;

    // What submissions/detail.ts would produce for this exact row on reload
    // (same id, contactId, contact name/email, role, order, visible,
    // inviteStatus — the values inviteParticipant just wrote).
    const reloadEquivalent: SubmissionDetailParticipant = {
      id: posted.id,
      contactId: "contact-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "speaker",
      order: 0,
      visible: true,
      inviteStatus: "invited",
    };

    expect(posted).toEqual(reloadEquivalent);
  });

  it("PATCH /participants/:id visibility response also carries name+email", async () => {
    const PARTICIPANT_SCOPE = { id: "p1", submissionId: "sub-1", orgId: ORG_A };
    const JOINED_ROW_AFTER_UPDATE = {
      id: "p1",
      contactId: "contact-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      role: "speaker",
      order: 0,
      visible: false,
      inviteStatus: "invited",
    };
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [PARTICIPANT_SCOPE], // getParticipantOwnership
      [JOINED_ROW_AFTER_UPDATE], // getParticipantRow post-update reread
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("PATCH", "/api/v1/submissions/sub-1/participants/p1", { visible: false }),
    );
    expect(res.status).toBe(200);
    const patched = (await res.json()) as any;

    expect(patched.name).toBe("Ada Lovelace");
    expect(patched.email).toBe("ada@example.com");
    expect(patched).toEqual({
      id: "p1",
      contactId: "contact-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "speaker",
      order: 0,
      visible: false,
      inviteStatus: "invited",
    });
  });

  it("POST response's key set equals the SubmissionDetailParticipant key set", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A],
      [CONTACT_ORG_A],
      [],
      [{ maxOrder: -1 }],
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }),
    );
    const posted = (await res.json()) as any;

    expect(new Set(Object.keys(posted))).toEqual(new Set(DETAIL_PARTICIPANT_KEYS));
  });
});
