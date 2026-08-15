// DEC-755: the New submission dialog's Track and Format selectors were
// decoration — NewSubmissionModal held trackIds/format state but submit()
// never sent format, and even though trackIds rode the POST body via the
// SPA's follow-up PATCH, the create route itself silently accepted and
// dropped a trackIds field. This closes both gaps at the POST route: it now
// accepts trackIds (validated exactly like PATCH /submissions/:id, DEC-598)
// and format (validated against the event's default-form
// the event's default-form session_format-role field's options, DEC-592),
// and both are written through the ONE existing writer (replaceSubmission-
// Tracks / upsertSubmissionAnswers, DEC-717) — never a second create-only
// writer. Also covers findOrCreateContact's case-insensitive email match
// (DEC-755 3rd clause).
//
// Fake-db pattern (select-queue + insert/delete/update capture) mirrors
// test/submission-tracks-patch.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";

// Seed-local literal (DEC-592/DEC-755, wave 10 task w10-b) -- role is the
// ONE matcher; the id itself is never a shared constant.
const FORMAT_ROLE_FIELD_ID = "field_session_format";

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

function postRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string) {
  return new Request(`http://local${path}`, { method: "GET" });
}

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

const EVENT_TRACKS = [
  { id: "t1", name: "Track One" },
  { id: "t2", name: "Track Two" },
];

// getFieldOptionsByRole (src/server/repo/form-roles.ts) — the ONE query
// getFormatFieldOptions now delegates to — selects just optionsJson via a
// formField/form join filtered on role.
const FORMAT_OPTIONS_ROW = { optionsJson: JSON.stringify(["Talk", "Workshop"]) };

// getEventFieldIdByRole (form-roles.ts) — the write-time resolver that
// turns the role into the actual form_field id to upsert/delete against.
const FORMAT_FIELD_ID_ROW = { id: FORMAT_ROLE_FIELD_ID };

function detailRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    orgId: "org-a",
    startDate: "2024-01-01",
    ...overrides,
  };
}

describe("POST /api/v1/events/:eventId/submissions — trackIds + format (DEC-755)", () => {
  it("persists both track ids and the format answer, and a reload GET still shows them", async () => {
    const { db, deletes, inserts } = fakeDb([
      [{ orgId: ORG_A }], // assertEventOwnership -> getEventOrgId
      EVENT_TRACKS, // parseTrackIdsField -> getEventTracks
      [FORMAT_OPTIONS_ROW], // parseFormatField -> getFormatFieldOptions -> getFieldOptionsByRole
      [FORMAT_FIELD_ID_ROW], // writeFormatAnswer -> getEventFieldIdByRole
      [detailRow()], // getSubmissionDetail: submission+event
      [], // participants
      [{ trackId: "t1" }, { trackId: "t2" }], // tracks
      [{ formFieldId: FORMAT_ROLE_FIELD_ID, valueJson: JSON.stringify("Workshop") }], // answers
      [], // answer files (DEC-920)
      // --- reload GET ---
      [{ eventId: "event-1", orgId: ORG_A }], // getSubmissionOwnership
      [detailRow()], // getSubmissionDetail: submission+event
      [], // participants
      [{ trackId: "t1" }, { trackId: "t2" }], // tracks
      [{ formFieldId: FORMAT_ROLE_FIELD_ID, valueJson: JSON.stringify("Workshop") }], // answers
      [], // answer files (DEC-920)
    ]);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(
      postRequest("/api/v1/events/event-1/submissions", {
        title: "New talk",
        trackIds: ["t1", "t2"],
        format: "Workshop",
      }),
    );

    expect(res.status).toBe(201);
    const created = (await res.json()) as any;
    expect(created.trackIds).toEqual(["t1", "t2"]);
    expect(created.answers[FORMAT_ROLE_FIELD_ID]).toBe("Workshop");

    // ONE writer each: replaceSubmissionTracks does a delete+insert,
    // upsertSubmissionAnswers does one more insert — no second ad hoc
    // trackId/answer writer.
    expect(deletes).toHaveLength(1);
    const trackInsert = inserts.find((i) => i.table === schema.submissionTrack);
    expect(trackInsert?.vals).toEqual([
      { submissionId: expect.any(String), trackId: "t1", createdAt: expect.any(Date) },
      { submissionId: expect.any(String), trackId: "t2", createdAt: expect.any(Date) },
    ]);
    const answerInsert = inserts.find((i) => i.table === schema.submissionAnswer);
    expect(answerInsert).toBeDefined();

    const reload = await app.request(getRequest("/api/v1/submissions/sub-1"));
    expect(reload.status).toBe(200);
    const reloaded = (await reload.json()) as any;
    expect(reloaded.trackIds).toEqual(["t1", "t2"]);
    expect(reloaded.answers[FORMAT_ROLE_FIELD_ID]).toBe("Workshop");
  });

  it("400s an unknown track id with a fields.trackIds entry, never creating the submission", async () => {
    const { db, inserts } = fakeDb([
      [{ orgId: ORG_A }], // getEventOrgId
      EVENT_TRACKS, // getEventTracks — "not-a-real-track" isn't in this set
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/events/event-1/submissions", {
        title: "New talk",
        trackIds: ["t1", "not-a-real-track"],
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("trackIds");
    expect(inserts.find((i) => i.table === schema.submission)).toBeUndefined();
  });

  it("400s a format value that isn't one of the field's options, never creating the submission", async () => {
    const { db, inserts } = fakeDb([
      [{ orgId: ORG_A }], // getEventOrgId
      [FORMAT_OPTIONS_ROW], // getFormatFieldOptions — "Bogus" isn't Talk/Workshop
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/events/event-1/submissions", {
        title: "New talk",
        format: "Bogus",
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("format");
    expect(inserts.find((i) => i.table === schema.submission)).toBeUndefined();
  });

  it("400s a supplied format when the event's form has no session-format field", async () => {
    const { db } = fakeDb([
      [{ orgId: ORG_A }], // getEventOrgId
      [], // getFormatFieldOptions -> getFieldOptionsByRole — no such role on this event
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/events/event-1/submissions", {
        title: "New talk",
        format: "Workshop",
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.fields).toHaveProperty("format");
  });

  it("reuses an existing contact when the email differs only in case (DEC-755)", async () => {
    const { db, inserts } = fakeDb([
      [{ orgId: ORG_A }], // getEventOrgId
      [{ id: "contact-1", title: null, company: null }], // findOrCreateContact's lower(email) match
      [detailRow()], // getSubmissionDetail: submission+event
      [], // participants
      [], // tracks
      [], // answers
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      postRequest("/api/v1/events/event-1/submissions", {
        title: "New talk",
        contact: { email: "Jordan@Example.com", firstName: "Jordan", lastName: "Alvarez" },
      }),
    );

    expect(res.status).toBe(201);
    // No new contact row minted — only the submission + participant insert.
    expect(inserts.find((i) => i.table === schema.contact)).toBeUndefined();
    const participantInsert = inserts.find((i) => i.table === schema.participant);
    expect((participantInsert?.vals as { contactId: string }).contactId).toBe("contact-1");
  });
});
