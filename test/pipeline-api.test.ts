// CRM sourcing pipeline API tests (CRM-07/08, DEC-157). Mounts the real
// pipelineRoutes sub-app against a select-queue fake db, mirroring
// test/contacts-add-to-event.test.ts's pattern (no D1 test harness exists
// in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { pipelineRoutes } from "../src/routes/api/pipeline";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";

const CONTACT_ORG_A = {
  id: "contact-1",
  orgId: ORG_A,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: null,
  company: "Acme",
  title: null,
  bio: null,
  headshotUrl: null,
  socialLinksJson: null,
  notes: null,
  customFieldsJson: null,
  createdAt: new Date(1000),
  updatedAt: new Date(1000),
};

const CONTACT_ORG_B = { ...CONTACT_ORG_A, id: "contact-b1", orgId: ORG_B };

const ORGANIZER_USER = { id: "u-organizer-a", email: "organizer@example.com", contactId: null };

const ENTRY_ROW = {
  id: "entry-1",
  orgId: ORG_A,
  contactId: "contact-1",
  stage: "identified",
  createdAt: new Date(2000),
  updatedAt: new Date(2000),
};

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every insert()/update() write. `pipelineEntryConflict` simulates
 * the pipeline_entry INSERT ... ON CONFLICT DO NOTHING resolving to an
 * empty `.returning()` result (a duplicate enrollment), per DEC-552's
 * atomic upsert on enrollContact — no more findEntryByContact pre-check. */
function fakeDb(selectQueue: unknown[][], opts: { pipelineEntryConflict?: boolean } = {}) {
  let call = 0;
  const inserts: any[] = [];
  const updates: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const record = { table, vals };
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              if (opts.pipelineEntryConflict) return [];
              inserts.push(record);
              return [{ id: (vals as any).id }];
            },
          }),
          then: (resolve: (v: unknown) => void) => {
            inserts.push(record);
            resolve(undefined);
          },
        };
      },
    }),
    update: (table: unknown) => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push({ table, vals });
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
  app.route("/api/v1", pipelineRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };
const REVIEWER_A: AuthInfo = { userId: "u-reviewer-a", role: "reviewer", orgId: ORG_A };
const SPEAKER_A: AuthInfo = { userId: "u-speaker-a", role: "speaker", orgId: ORG_A };

function jsonRequest(method: string, path: string, body?: unknown) {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/v1/pipeline", () => {
  it("lists entries joined with contact fields", async () => {
    const { db } = fakeDb([
      [ENTRY_ROW], // listPipelineForOrg: pipeline_entry rows
      [{ count: 1 }], // countPipelineForOrg
      [CONTACT_ORG_A], // listPipelineForOrg: contact batch
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/pipeline"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: any[]; total: number; page: number; perPage: number };
    expect(json.total).toBe(1);
    expect(json.items[0]).toMatchObject({
      id: "entry-1",
      contactId: "contact-1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Acme",
      stage: "identified",
      stageSince: ENTRY_ROW.updatedAt.getTime(),
      declineReason: null,
    });
  });

  // DEC-803: declined entries carry their decline reason, read from the
  // newest move-to-declined activity in ONE chunked query over the page's
  // declined entry ids (not per card) -- a non-declined entry never queries
  // pipeline_activity for a reason at all.
  it("hydrates declineReason from the newest move-to-declined activity for declined entries", async () => {
    const declinedEntry = { ...ENTRY_ROW, id: "entry-2", stage: "declined", updatedAt: new Date(9000) };
    const olderDeclineMove = {
      entryId: "entry-2",
      body: "Scheduling conflict",
      createdAt: new Date(5000),
    };
    const newerDeclineMove = {
      entryId: "entry-2",
      body: "Went with another speaker",
      createdAt: new Date(9000),
    };
    const { db } = fakeDb([
      [declinedEntry], // listPipelineForOrg: pipeline_entry rows
      [{ count: 1 }], // countPipelineForOrg
      [CONTACT_ORG_A], // contact batch (declinedEntry.contactId is still contact-1)
      [olderDeclineMove, newerDeclineMove], // declineReason activity batch (order not guaranteed)
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/pipeline"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: any[] };
    expect(json.items[0]).toMatchObject({
      stage: "declined",
      declineReason: "Went with another speaker",
    });
  });

  it("403s a non-organizer (reviewer) session", async () => {
    const { db } = fakeDb([]);
    const app = appWithDbAndAuth(db, REVIEWER_A);
    const res = await app.request(new Request("http://local/api/v1/pipeline"));
    expect(res.status).toBe(403);
  });

  it("403s a speaker session", async () => {
    const { db } = fakeDb([]);
    const app = appWithDbAndAuth(db, SPEAKER_A);
    const res = await app.request(new Request("http://local/api/v1/pipeline"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/pipeline (enroll)", () => {
  it("enrolls a contact and appends a 'move' activity from null", async () => {
    const { db, inserts } = fakeDb([
      [CONTACT_ORG_A], // findContactForOrg
      [ORGANIZER_USER], // resolveAuthorName: user lookup
      [ENTRY_ROW], // findEntryById after insert
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1", stage: "identified" }));
    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.contactId).toBe("contact-1");
    expect(json.stage).toBe("identified");

    expect(inserts).toHaveLength(2);
    expect((inserts[0]!.vals as any).contactId).toBe("contact-1");
    expect((inserts[0]!.vals as any).stage).toBe("identified");
    const activityInsert = inserts[1]!.vals as any;
    expect(activityInsert.kind).toBe("move");
    expect(activityInsert.fromStage).toBeNull();
    expect(activityInsert.toStage).toBe("identified");
  });

  it("defaults to 'identified' when stage is omitted", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A], [ORGANIZER_USER], [ENTRY_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1" }));
    expect(res.status).toBe(201);
    expect((inserts[0]!.vals as any).stage).toBe("identified");
  });

  it("400s a duplicate enrollment", async () => {
    const { db, inserts } = fakeDb(
      [
        [CONTACT_ORG_A], // findContactForOrg
        [ORGANIZER_USER], // resolveAuthorName
      ],
      { pipelineEntryConflict: true },
    );
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(inserts).toHaveLength(0);
  });

  it("404s a contact from a different org (org scoping / IDOR guard)", async () => {
    const { db, inserts } = fakeDb([
      [], // findContactForOrg: not found in this org
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline", { contactId: CONTACT_ORG_B.id }));
    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("400s an invalid stage", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1", stage: "won" }));
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("403s a non-organizer before any db access", async () => {
    const { db, inserts } = fakeDb([]);
    const app = appWithDbAndAuth(db, REVIEWER_A);
    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1" }));
    expect(res.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });

  // DEC-803 (wave-55 amendment): enrolling straight into 'declined' must
  // carry a reason, exactly as a PATCH move into it does -- rejected before
  // any write, not left to a hard-coded null in the 201 body.
  it("400s enrolling straight into 'declined' with no reason, writing NO row", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1", stage: "declined" }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields?.reason).toBeTruthy();
    expect(inserts).toHaveLength(0);
  });

  it("400s enrolling into 'declined' with a blank reason, writing NO row", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1", stage: "declined", reason: "   " }),
    );
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("201s enrolling into 'declined' with a reason, echoing it and writing the reason onto the move activity", async () => {
    const { db, inserts } = fakeDb([
      [CONTACT_ORG_A], // findContactForOrg
      [ORGANIZER_USER], // resolveAuthorName
      [{ ...ENTRY_ROW, stage: "declined" }], // findEntryById after insert
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/pipeline", {
        contactId: "contact-1",
        stage: "declined",
        reason: "Not a fit for this event",
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.stage).toBe("declined");
    expect(json.declineReason).toBe("Not a fit for this event");

    expect(inserts).toHaveLength(2);
    const activityInsert = inserts[1]!.vals as any;
    expect(activityInsert.kind).toBe("move");
    expect(activityInsert.toStage).toBe("declined");
    expect(activityInsert.body).toBe("Not a fit for this event");
  });

  // A follow-up read (GET /pipeline/:id list serialization path exercised
  // via GET /pipeline) surfaces the same reason the enroll echoed --
  // exercised at the repo level since GET /pipeline hydrates declineReason
  // from the newest move-to-declined activity, same table this write hit.
  it("a follow-up GET /pipeline read returns the same reason the enroll echoed", async () => {
    const declinedEntry = { ...ENTRY_ROW, stage: "declined" };
    const { db } = fakeDb([
      [declinedEntry], // listPipelineForOrg: pipeline_entry rows
      [{ count: 1 }], // countPipelineForOrg
      [CONTACT_ORG_A], // contact batch
      [{ entryId: "entry-1", body: "Not a fit for this event", createdAt: new Date(2000) }], // declineReason activity batch
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/pipeline"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: any[] };
    expect(json.items[0]).toMatchObject({ stage: "declined", declineReason: "Not a fit for this event" });
  });

  it("a non-declined enroll is unaffected -- still answers declineReason null with no reason required", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A], [ORGANIZER_USER], [ENTRY_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/pipeline", { contactId: "contact-1", stage: "identified" }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.declineReason).toBeNull();
    const activityInsert = inserts[1]!.vals as any;
    expect(activityInsert.body).toBeNull();
  });

  it("400s an over-length reason when enrolling into 'declined'", async () => {
    const { db, inserts } = fakeDb([[CONTACT_ORG_A]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/pipeline", {
        contactId: "contact-1",
        stage: "declined",
        reason: "x".repeat(5000),
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields?.reason).toBeTruthy();
    expect(inserts).toHaveLength(0);
  });
});

describe("PATCH /api/v1/pipeline/:id (move)", () => {
  it("moves an entry and appends a 'move' activity with from/to stages", async () => {
    const { db, inserts, updates } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [ORGANIZER_USER], // resolveAuthorName
      [{ ...ENTRY_ROW, stage: "contacted" }], // findEntryById after update
      [CONTACT_ORG_A], // findContactForOrg for response serialization
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "contacted" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.stage).toBe("contacted");

    expect(updates).toHaveLength(1);
    expect((updates[0]!.vals as any).stage).toBe("contacted");

    expect(inserts).toHaveLength(1);
    const activityInsert = inserts[0]!.vals as any;
    expect(activityInsert.kind).toBe("move");
    expect(activityInsert.fromStage).toBe("identified");
    expect(activityInsert.toStage).toBe("contacted");
  });

  it("404s an entry from a different org", async () => {
    const { db, updates } = fakeDb([[]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-other-org", { stage: "contacted" }));
    expect(res.status).toBe(404);
    expect(updates).toHaveLength(0);
  });

  // DEC-803: a move to 'declined' persists its reason as the move
  // activity's body -- previously hard-coded null.
  it("persists a reason as the move activity's body when moving to declined", async () => {
    const { db, inserts } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [ORGANIZER_USER], // resolveAuthorName
      [{ ...ENTRY_ROW, stage: "declined" }], // findEntryById after update
      [CONTACT_ORG_A], // findContactForOrg for response serialization
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "declined", reason: "Scheduling conflict" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.stage).toBe("declined");
    expect(json.declineReason).toBe("Scheduling conflict");

    expect(inserts).toHaveLength(1);
    const activityInsert = inserts[0]!.vals as any;
    expect(activityInsert.toStage).toBe("declined");
    expect(activityInsert.body).toBe("Scheduling conflict");
  });

  // DEC-803: rejected before any write, not left for the UI to enforce alone.
  it("400s a move to declined with a blank/missing reason, writing nothing", async () => {
    const { db, inserts, updates } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "declined" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields?.reason).toBeTruthy();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);

    const { db: db2, inserts: inserts2, updates: updates2 } = fakeDb([[ENTRY_ROW]]);
    const app2 = appWithDbAndAuth(db2, ORGANIZER_A);
    const res2 = await app2.request(
      jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "declined", reason: "   " }),
    );
    expect(res2.status).toBe(400);
    expect(inserts2).toHaveLength(0);
    expect(updates2).toHaveLength(0);
  });

  // A non-declined move never requires a reason and persists null body,
  // as before.
  it("persists a null body for a move that is not into declined", async () => {
    const { db, inserts } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [ORGANIZER_USER], // resolveAuthorName
      [{ ...ENTRY_ROW, stage: "contacted" }], // findEntryById after update
      [CONTACT_ORG_A], // findContactForOrg for response serialization
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "contacted" }));
    expect(res.status).toBe(200);
    const activityInsert = inserts[0]!.vals as any;
    expect(activityInsert.body).toBeNull();
  });

  it("403s a reviewer session", async () => {
    const { db } = fakeDb([]);
    const app = appWithDbAndAuth(db, REVIEWER_A);
    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "contacted" }));
    expect(res.status).toBe(403);
  });
});

// DEC-980: a fit edit after enrolment must never forge a stage move -- no
// activity row, no updatedAt/stageSince bump.
describe("PATCH /api/v1/pipeline/:id (fit-only, DEC-980)", () => {
  it("a fit-only PATCH (stage omitted) updates fitScore/rationale, writes zero pipeline_activity rows, and leaves updatedAt/stageSince unchanged", async () => {
    const { db, inserts, updates } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [{ ...ENTRY_ROW, fitScore: 4, rationale: "Great fit" }], // findEntryById after fit update
      [CONTACT_ORG_A], // findContactForOrg for response serialization
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { fitScore: 4, rationale: "Great fit" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.fitScore).toBe(4);
    expect(json.rationale).toBe("Great fit");
    expect(json.stage).toBe("identified");
    expect(json.updatedAt).toBe(ENTRY_ROW.updatedAt.getTime());
    expect(json.stageSince).toBe(ENTRY_ROW.updatedAt.getTime());

    // zero pipeline_activity inserts (only the fit update() call happened)
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect((updates[0]!.vals as any).fitScore).toBe(4);
  });

  it("a same-stage PATCH is likewise not a move", async () => {
    // NOTE (task w6-e, noUnusedLocals cleanup): `updates` used to be
    // destructured here unused. It plausibly should feed an
    // `expect(updates).toHaveLength(1)` assertion (the rationale field
    // write) -- not added here since inventing that assertion is outside
    // this task's scope. Flagged in the task report instead.
    const { db, inserts } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [{ ...ENTRY_ROW, rationale: "Updated note" }], // findEntryById after fit update
      [CONTACT_ORG_A], // findContactForOrg
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "identified", rationale: "Updated note" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.rationale).toBe("Updated note");
    expect(json.updatedAt).toBe(ENTRY_ROW.updatedAt.getTime());
    expect(inserts).toHaveLength(0);
  });

  it("a different-stage PATCH still writes the move row", async () => {
    const { db, inserts, updates } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [ORGANIZER_USER], // resolveAuthorName
      [{ ...ENTRY_ROW, stage: "contacted" }], // findEntryById after update
      [CONTACT_ORG_A], // findContactForOrg
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "contacted" }));
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(1);
    expect((inserts[0]!.vals as any).kind).toBe("move");
  });

  it("400s a PATCH carrying neither a stage change nor any fit key, naming the empty patch", async () => {
    const { db, inserts, updates } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(jsonRequest("PATCH", "/api/v1/pipeline/entry-1", { stage: "identified" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("invalid");
    expect(json.error.fields?.patch).toBeTruthy();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});

describe("GET /api/v1/pipeline/:id (detail)", () => {
  it("returns entry, contact, and newest-first activity", async () => {
    const olderMove = {
      id: "act-1",
      entryId: "entry-1",
      kind: "move",
      body: null,
      fromStage: null,
      toStage: "identified",
      authorUserId: "u-organizer-a",
      authorName: "Jordan Alvarez",
      createdAt: new Date(1000),
    };
    const newerNote = {
      id: "act-2",
      entryId: "entry-1",
      kind: "note",
      body: "Left a voicemail.",
      fromStage: null,
      toStage: null,
      authorUserId: "u-organizer-a",
      authorName: "Jordan Alvarez",
      createdAt: new Date(2000),
    };
    const { db } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [CONTACT_ORG_A], // findContactForOrg
      [newerNote, olderMove], // listActivityForEntry (already newest-first from orderBy(desc))
      [{ count: 2 }], // countActivityForEntry
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/pipeline/entry-1"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.entry.id).toBe("entry-1");
    expect(json.contact.firstName).toBe("Ada");
    // DEC-013 house list envelope (w56-e): activity is paged, not a bare array.
    expect(json.activity.total).toBe(2);
    expect(json.activity.items).toHaveLength(2);
    expect(json.activity.items[0].kind).toBe("note");
    expect(json.activity.items[1].kind).toBe("move");
  });

  // w56-e: 60 activity rows -> first page returns only perPage items,
  // newest-first, with the true total surfaced separately.
  it("pages a 60-row activity feed: first page returns perPage items newest-first with total 60", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `act-${i}`,
      entryId: "entry-1",
      kind: "note",
      body: `Note ${i}`,
      fromStage: null,
      toStage: null,
      authorUserId: "u-organizer-a",
      authorName: "Jordan Alvarez",
      createdAt: new Date(1000 + i),
    })).reverse(); // newest-first, matching the repo's orderBy(desc)

    const perPage = 50;
    const firstPage = rows.slice(0, perPage); // the fake db.select() chain ignores .limit()/.offset(), so we hand it the already-paged rows
    const { db } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [CONTACT_ORG_A], // findContactForOrg
      firstPage, // listActivityForEntry
      [{ count: 60 }], // countActivityForEntry
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request(`http://local/api/v1/pipeline/entry-1?perPage=${perPage}`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.activity.total).toBe(60);
    expect(json.activity.items).toHaveLength(perPage);
    expect(json.activity.items[0].body).toBe("Note 59");
    expect(json.activity.page).toBe(1);
    expect(json.activity.perPage).toBe(perPage);
  });
});

describe("POST /api/v1/pipeline/:id/notes", () => {
  it("appends a note activity", async () => {
    const { db, inserts } = fakeDb([
      [ENTRY_ROW], // requireOwnedEntry
      [ORGANIZER_USER], // resolveAuthorName
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      jsonRequest("POST", "/api/v1/pipeline/entry-1/notes", { body: "Left voicemail; follow up next week." }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.kind).toBe("note");
    expect(json.body).toBe("Left voicemail; follow up next week.");

    expect(inserts).toHaveLength(1);
    expect((inserts[0]!.vals as any).kind).toBe("note");
    expect((inserts[0]!.vals as any).entryId).toBe("entry-1");
  });

  it("400s an empty note body", async () => {
    const { db, inserts } = fakeDb([[ENTRY_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline/entry-1/notes", { body: "  " }));
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("403s a speaker session", async () => {
    const { db } = fakeDb([]);
    const app = appWithDbAndAuth(db, SPEAKER_A);
    const res = await app.request(jsonRequest("POST", "/api/v1/pipeline/entry-1/notes", { body: "hi" }));
    expect(res.status).toBe(403);
  });
});

// product principle 4: pipeline moves/notes never send email.
const sourceModules = import.meta.glob(["../src/server/repo/pipeline.ts", "../src/routes/api/pipeline.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("product principle 4: no mailer import reachable from the pipeline module", () => {
  it("neither the repo nor the route file imports a mailer", () => {
    const entries = Object.entries(sourceModules);
    expect(entries.length).toBe(2);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
    }
  });
});
