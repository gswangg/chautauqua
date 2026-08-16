// DEC-070: organizer participant-management endpoints (closes w12-c open
// PLANNER items #1-#2). POST /api/v1/submissions/:id/participants invites a
// participant onto an existing submission ({contactId, role?} body, DEC-070
// shapes); PATCH /api/v1/submissions/:id/participants/:participantId
// toggles visibility. Both are requireOrganizer + csrfJson, org-scoped
// through submission -> event -> org (and, for the invite, through the
// contact's own org), and both return the participant serialized like
// src/server/repo/submissions/detail.ts rows. Mounts the real
// submissionsRoutes sub-app against a minimal fake db that records every
// select/insert/update call in order, mirroring the fakeDb pattern used by
// test/exports-cross-org.test.ts and test/headshot-gate.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_PARTICIPANTS_PER_SUBMISSION } from "../src/domain/participant-roles";

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

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every insert()/update() write. `insertReturning`, when given,
 * simulates the DB-computed row (id/order) an
 * INSERT ... ON CONFLICT DO NOTHING ... RETURNING call yields — DEC-556's
 * inviteParticipant no longer computes `order` in JS, so the fake db is
 * what decides what the atomic insert "returns". An empty array simulates
 * the ON CONFLICT branch firing (duplicate). */
function fakeDb(selectQueue: unknown[][], insertReturning?: unknown[]) {
  let call = 0;
  const inserts: any[] = [];
  const updates: any[] = [];
  const deletes: any[] = [];
  const db = {
    delete: (table: unknown) => ({
      where: async (cond: unknown) => {
        deletes.push({ table, cond });
        return { meta: { changes: 1 } };
      },
    }),
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          onConflictDoNothing: () => ({
            returning: async () => insertReturning ?? [],
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
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, updates, deletes };
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
const SPEAKER_A: AuthInfo = { userId: "u-speaker-a", role: "speaker", orgId: ORG_A, contactId: "contact-1" };

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/submissions/:id/participants (DEC-070 invite)", () => {
  it("invites a contact onto the submission: visible=true, inviteStatus='invited', order=max+1", async () => {
    const { db, inserts } = fakeDb(
      [
        [SUBMISSION_ORG_A], // getSubmissionOwnership
        [CONTACT_ORG_A], // findContactForOrg
      ],
      [{ id: "p-new", order: 3 }], // DB-computed via the ON CONFLICT ... RETURNING (order=max+1=3)
    );
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }));

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json).toMatchObject({
      id: "p-new",
      contactId: "contact-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "speaker",
      order: 3,
      visible: true,
      inviteStatus: "invited",
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      submissionId: "sub-1",
      contactId: "contact-1",
      role: "speaker",
      visible: true,
      inviteStatus: "invited",
    });
  });

  it("accepts an explicit role, overriding the 'speaker' default", async () => {
    const { db, inserts } = fakeDb([[SUBMISSION_ORG_A], [CONTACT_ORG_A]], [{ id: "p-new", order: 0 }]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1", role: "moderator" }),
    );

    expect(res.status).toBe(201);
    expect((inserts[0] as any).role).toBe("moderator");
  });

  it("rejects a duplicate (submissionId, contactId) pair with ApiError('invalid', fields.contactId)", async () => {
    const { db, inserts } = fakeDb(
      [
        [SUBMISSION_ORG_A], // getSubmissionOwnership
        [CONTACT_ORG_A], // findContactForOrg
      ],
      [], // ON CONFLICT DO NOTHING fired: RETURNING is empty
    );
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }));

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields.contactId).toBeTruthy();
    expect(inserts).toHaveLength(1);
  });

  it("rejects a contact from a different org with ApiError('invalid', fields.contactId)", async () => {
    const { db, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [], // findContactForOrg: not found in this org
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-from-org-b" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields.contactId).toBeTruthy();
    expect(inserts).toHaveLength(0);
  });

  it("404s a genuinely different org's organizer on a real submission id (cross-org isolation)", async () => {
    const orgBOrganizer: AuthInfo = { userId: "u-org-b", role: "organizer", orgId: "org-b" };
    const { db, inserts } = fakeDb([[SUBMISSION_ORG_A]]); // submission belongs to org-a
    const app = appWithDbAndAuth(db, orgBOrganizer);

    const res = await app.request(jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }));

    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("404s a nonexistent submission id", async () => {
    const { db } = fakeDb([[]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("/api/v1/submissions/missing/participants", { contactId: "contact-1" }));

    expect(res.status).toBe(404);
  });

  it("403s a speaker-session caller before any db access (requireOrganizer)", async () => {
    const { db, inserts } = fakeDb([]);
    const app = appWithDbAndAuth(db, SPEAKER_A);

    const res = await app.request(jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }));

    expect(res.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });

  // DEC-784: role is validated against PARTICIPANT_ROLE_OPTIONS -- an
  // unknown value is a loud field error, never a silent default.
  it("rejects an unknown role with ApiError('invalid', fields.role) and writes nothing", async () => {
    // Role is validated before the contact lookup, so only the ownership
    // select is ever queued.
    const { db, inserts } = fakeDb([[SUBMISSION_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1", role: "wizard" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields.role).toBeTruthy();
    expect(inserts).toHaveLength(0);
  });

  // DEC-422/DEC-604 amendment (w12-b): closes the gap where this organizer
  // door had no cap check at all -- a 7th participant (the submission
  // already carries MAX_PARTICIPANTS_PER_SUBMISSION rows) is a named 400,
  // and inviteParticipant's pre-write COUNT means no insert is ever
  // attempted.
  it("rejects a 7th organiser invite once the submission is already at MAX_PARTICIPANTS_PER_SUBMISSION, writing nothing", async () => {
    const { db, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [CONTACT_ORG_A], // findContactForOrg
      [{ count: MAX_PARTICIPANTS_PER_SUBMISSION }], // inviteParticipant's pre-write COUNT
      [{ count: MAX_PARTICIPANTS_PER_SUBMISSION }], // route's post-refusal getParticipantCount (message only)
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("/api/v1/submissions/sub-1/participants", { contactId: "contact-1" }));

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields.contactId).toBeTruthy();
    // Never a stored-count-as-position phrasing (e.g. "already has 6 of
    // the maximum 6 participants") -- the message names the would-be total.
    expect(json.error.fields.contactId).not.toMatch(
      new RegExp(`already has ${MAX_PARTICIPANTS_PER_SUBMISSION} of the maximum`),
    );
    expect(inserts).toHaveLength(0);
  });
});

describe("PATCH /api/v1/submissions/:id/participants/:participantId (DEC-070 visibility toggle)", () => {
  const PARTICIPANT_SCOPE = { id: "p1", submissionId: "sub-1", orgId: ORG_A };
  // Raw join row shape returned by getParticipantRow's select (participant
  // innerJoin contact) — the repo formats firstName/lastName into `name`.
  const PARTICIPANT_ROW_AFTER = {
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

  it("toggles visible=false and returns the participant row", async () => {
    const { db, updates } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [PARTICIPANT_SCOPE], // getParticipantOwnership
      [PARTICIPANT_ROW_AFTER], // getParticipantRow (post-update reread)
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1/participants/p1", { visible: false }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json).toMatchObject({
      id: "p1",
      contactId: "contact-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      visible: false,
      inviteStatus: "invited",
    });
    // DEC-725 amendment: one write to the participant row, one to the
    // owning submission's updated_at (submissions/touch.ts).
    expect(updates).toHaveLength(2);
    expect((updates[0] as any).visible).toBe(false);
    expect((updates[1] as any).updatedAt).toBeInstanceOf(Date);
  });

  it("rejects a non-boolean visible field", async () => {
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A], [PARTICIPANT_SCOPE]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1/participants/p1", { visible: "nope" }));

    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("404s a genuinely different org's organizer on a real submission id (cross-org isolation)", async () => {
    const orgBOrganizer: AuthInfo = { userId: "u-org-b", role: "organizer", orgId: "org-b" };
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A]]);
    const app = appWithDbAndAuth(db, orgBOrganizer);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1/participants/p1", { visible: false }));

    expect(res.status).toBe(404);
    expect(updates).toHaveLength(0);
  });

  it("404s a participant that doesn't belong to the given submission", async () => {
    const { db, updates } = fakeDb([
      [SUBMISSION_ORG_A],
      [{ id: "p1", submissionId: "sub-OTHER", orgId: ORG_A }],
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1/participants/p1", { visible: false }));

    expect(res.status).toBe(404);
    expect(updates).toHaveLength(0);
  });

  it("403s a speaker-session caller before any db access (requireOrganizer)", async () => {
    const { db, updates } = fakeDb([]);
    const app = appWithDbAndAuth(db, SPEAKER_A);

    const res = await app.request(patchRequest("/api/v1/submissions/sub-1/participants/p1", { visible: false }));

    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  // DEC-789 write half: organizer-only write against the closed
  // none|invited|accepted|declined set, same authz as the visible write.
  it("accepts inviteStatus from the closed set, bumps updatedAt via the same write path", async () => {
    const { db, updates } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [PARTICIPANT_SCOPE], // getParticipantOwnership
      [{ ...PARTICIPANT_ROW_AFTER, visible: true, inviteStatus: "accepted" }], // getParticipantRow reread
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/submissions/sub-1/participants/p1", { inviteStatus: "accepted" }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.inviteStatus).toBe("accepted");
    // DEC-725 amendment: one write to the participant row, one to the
    // owning submission's updated_at (submissions/touch.ts).
    expect(updates).toHaveLength(2);
    expect((updates[0] as any).inviteStatus).toBe("accepted");
    expect((updates[1] as any).updatedAt).toBeInstanceOf(Date);
  });

  it("rejects an inviteStatus outside the closed set with a loud 400 and writes nothing", async () => {
    const { db, updates } = fakeDb([[SUBMISSION_ORG_A], [PARTICIPANT_SCOPE]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/submissions/sub-1/participants/p1", { inviteStatus: "maybe" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields.inviteStatus).toBeTruthy();
    expect(updates).toHaveLength(0);
  });
});

const sourceModules = import.meta.glob(
  ["../src/routes/api/submissions.ts", "../src/server/repo/participants.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("product principle 4: no mailer import reachable from the participant-invite path", () => {
  it("neither the route module nor the participants repo module import a mailer", () => {
    const entries = Object.entries(sourceModules);
    // Tripwire: fails if the glob stops matching (making the assertions
    // below vacuous) or a new module is added to this path without being
    // considered against the "invites never auto-email" invariant.
    expect(entries.length).toBe(2);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
      expect(source, `${path} must not reference Mailer`).not.toMatch(/Mailer/);
    }
  });
});

// User-filed (gate-8 cycle): the detail page's Remove co-presenter action
// shipped with no server half — DELETE /submissions/:id/participants/:pid
// did not exist and the SPA render test mocks the API, so it only surfaced
// live. These pin the route: scoped delete, lead protection, 404 scoping.
describe("DELETE /api/v1/submissions/:id/participants/:participantId", () => {
  function deleteRequest(path: string) {
    return new Request(`http://local${path}`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });
  }

  const P_LEAD = { id: "p-lead", submissionId: "sub-1", orgId: ORG_A };
  const P_CO = { id: "p-co", submissionId: "sub-1", orgId: ORG_A };
  const LEAD_ROLE_ROWS = [
    { id: "p-lead", role: "speaker" },
    { id: "p-co", role: "co_presenter" },
  ];

  it("removes a co-presenter and reports the deleted count", async () => {
    const { db, deletes } = fakeDb([[SUBMISSION_ORG_A], [P_CO], LEAD_ROLE_ROWS]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/submissions/sub-1/participants/p-co"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 1 });
    expect(deletes.length).toBe(1);
  });

  it("refuses to remove the lead participant with a named field error", async () => {
    const { db, deletes } = fakeDb([[SUBMISSION_ORG_A], [P_LEAD], LEAD_ROLE_ROWS]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/submissions/sub-1/participants/p-lead"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.role).toBe("Cannot remove the lead");
    expect(deletes.length).toBe(0);
  });

  it("404s a participant that belongs to a different submission", async () => {
    const { db, deletes } = fakeDb([[SUBMISSION_ORG_A], [{ id: "p-x", submissionId: "sub-OTHER", orgId: ORG_A }]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(deleteRequest("/api/v1/submissions/sub-1/participants/p-x"));
    expect(res.status).toBe(404);
    expect(deletes.length).toBe(0);
  });
});
