// DEC-900 amendment (findings wave 13): two dead controls on the admin
// submission detail page, both server-side gaps. The SPA already sends
// PATCH /api/v1/submissions/:id {audienceLevel} (SubmissionDetailPage.tsx:660)
// and PATCH /api/v1/submissions/:id/participants/:participantId {role}
// (SubmissionDetailPage.tsx:720), but the routes parsed neither — both fell
// into their empty-patch guards and 400'd keyed on the WRONG field
// (fields.title / fields.visible). This file covers the two new parse+write
// paths: audienceLevel mirrors the format contract exactly (DEC-755's
// wave-10 amendment), and role is validated against PARTICIPANT_ROLE_OPTIONS
// with the lead-participant protection this amendment adds.
//
// Fake-db pattern (select-queue + insert/update/delete capture) mirrors
// test/submissions-create-track-format.test.ts / test/submission-tracks-
// patch.test.ts — no wrangler/D1 harness exists in stage-1 unit tests.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    $dynamic: () => chain,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: unknown[] = [];
  const inserts: Array<{ table: unknown; vals: unknown }> = [];
  const deletes: unknown[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push(vals);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        inserts.push({ table, vals });
        const result: any = {
          onConflictDoUpdate: async (_opts: unknown) => undefined,
          then: (resolve: (v: unknown) => unknown) => resolve(undefined),
        };
        return result;
      },
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push(table);
      },
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], updates, inserts, deletes };
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

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

const AUDIENCE_LEVEL_FIELD_ID = "field_audience_level";
const AUDIENCE_LEVEL_OPTIONS_ROW = { optionsJson: JSON.stringify(["Beginner", "Intermediate"]) };
const AUDIENCE_LEVEL_FIELD_ID_ROW = { id: AUDIENCE_LEVEL_FIELD_ID };

const DETAIL_ROW = {
  id: "sub-1",
  eventId: "event-1",
  formId: null,
  seq: 1,
  title: "T",
  description: "D",
  trackId: null,
  status: "pending",
  contentStatus: "pending",
  acceptedAt: null,
  icsSequence: 0,
  createdAt: new Date(1000),
  updatedAt: new Date(2000),
  recordPrefix: "TALK",
  orgId: ORG_A,
  startDate: "2024-01-01",
};

describe("PATCH /api/v1/submissions/:id audienceLevel (DEC-900 amendment, findings wave 13)", () => {
  it("round-trips audienceLevel onto the audience_level-role field's answer", async () => {
    const { db, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [AUDIENCE_LEVEL_OPTIONS_ROW], // parseAudienceLevelField -> getFieldOptionsByRole
      [{ title: "T", description: "D" }], // getSubmissionContent (before)
      [AUDIENCE_LEVEL_FIELD_ID_ROW], // writeRoleAnswer -> getEventFieldIdByRole
      [DETAIL_ROW], // getSubmissionDetail: submission+event
      [], // participants
      [], // tracks
      [{ formFieldId: AUDIENCE_LEVEL_FIELD_ID, valueJson: JSON.stringify("Intermediate") }], // answers
      [], // answer files (DEC-920)
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { audienceLevel: "Intermediate" }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.answers[AUDIENCE_LEVEL_FIELD_ID]).toBe("Intermediate");
    const answerInsert = inserts.find((i) => i.table === schema.submissionAnswer);
    expect(answerInsert).toBeDefined();
  });

  it("audienceLevel: null deletes the answer row instead of upserting", async () => {
    const { db, deletes } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      // parseAudienceLevelField short-circuits on raw === null -- no
      // getFieldOptionsByRole select is issued.
      [{ title: "T", description: "D" }], // getSubmissionContent (before)
      [AUDIENCE_LEVEL_FIELD_ID_ROW], // writeRoleAnswer -> getEventFieldIdByRole
      [DETAIL_ROW], // getSubmissionDetail: submission+event
      [], // participants
      [], // tracks
      [], // answers (deleted)
      [], // answer files
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { audienceLevel: null }),
    );

    expect(res.status).toBe(200);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toBe(schema.submissionAnswer);
  });

  it("400s keyed audienceLevel with 'Not configured' when the event's form has no audience_level field", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [], // getFieldOptionsByRole -- no row for this role on this event's form
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { audienceLevel: "Intermediate" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields.audienceLevel).toBe("Not configured");
  });

  it("a body of ONLY {audienceLevel} does not trip the empty-patch guard", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A],
      [AUDIENCE_LEVEL_OPTIONS_ROW],
      [{ title: "T", description: "D" }],
      [AUDIENCE_LEVEL_FIELD_ID_ROW],
      [DETAIL_ROW],
      [],
      [],
      [{ formFieldId: AUDIENCE_LEVEL_FIELD_ID, valueJson: JSON.stringify("Beginner") }],
      [],
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1", { audienceLevel: "Beginner" }),
    );

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/v1/submissions/:id/participants/:participantId role (DEC-900 amendment, findings wave 13)", () => {
  it("persists a role change to a non-lead participant and returns the updated row", async () => {
    const { db, updates } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "p-2", submissionId: "sub-1", orgId: ORG_A }], // getParticipantOwnership
      [
        { id: "p-lead", role: "speaker" },
        { id: "p-2", role: "moderator" },
      ], // getSubmissionLeadParticipantId
      [
        {
          id: "p-2",
          contactId: "c-2",
          firstName: "Jordan",
          lastName: "Alvarez",
          email: "jordan@example.com",
          title: null,
          company: null,
          role: "co-presenter",
          order: 1,
          visible: true,
          inviteStatus: "accepted",
        },
      ], // getParticipantRow
      [{ status: "pending" }], // getSubmissionStatus (ensureOnboardingTasks guard)
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1/participants/p-2", { role: "co-presenter" }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.role).toBe("co-presenter");
    expect(updates).toContainEqual(expect.objectContaining({ role: "co-presenter" }));
  });

  it("400s keyed role when the target participant IS the submission's lead", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "p-lead", submissionId: "sub-1", orgId: ORG_A }], // getParticipantOwnership
      [
        { id: "p-lead", role: "speaker" },
        { id: "p-2", role: "moderator" },
      ], // getSubmissionLeadParticipantId
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1/participants/p-lead", { role: "co-presenter" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("role");
  });

  it("400s keyed role when the requested new value is the lead role", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "p-2", submissionId: "sub-1", orgId: ORG_A }], // getParticipantOwnership
      [
        { id: "p-lead", role: "speaker" },
        { id: "p-2", role: "moderator" },
      ], // getSubmissionLeadParticipantId
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1/participants/p-2", { role: "speaker" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("role");
  });

  it("400s keyed role for an unknown role value", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "p-2", submissionId: "sub-1", orgId: ORG_A }], // getParticipantOwnership
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1/participants/p-2", { role: "keynote-legend" }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("role");
  });

  it("re-words the empty-patch guard to name visible, inviteStatus and role", async () => {
    const { db } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "p-2", submissionId: "sub-1", orgId: ORG_A }], // getParticipantOwnership
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      patchRequest("/api/v1/submissions/sub-1/participants/p-2", {}),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.message).toBe("visible, inviteStatus or role is required");
  });
});
