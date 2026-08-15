// DEC-598 (wave-10 amendment, task w10-c): trackIds are a SET at every
// boundary AND in the writer. A repeated valid track id must never raise
// SQLITE_CONSTRAINT on the [submissionId, trackId] primary key — the
// organizer POST/PATCH routes and the anonymous public CFP all dedupe
// before the cap check and before the writer, and the public CFP's cap
// refusal renders the shared cap-copy grammar (overCapCountMessage), never
// a bare number.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import { validateTrackChoice } from "../src/lib/submit-core";
import { extractTrackIds } from "../src/routes/public/submit-body";
import { overCapCountMessage } from "../src/domain/cap-copy";
import { MAX_SUBMISSION_TRACK_IDS } from "../src/domain/ids";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";

// -- pure-core boundary tests --------------------------------------------

describe("extractTrackIds dedupes at the public CFP body boundary (DEC-598)", () => {
  it("collapses a repeated trackIds field to one entry", () => {
    expect(extractTrackIds({ trackIds: ["t1", "t1", "t2"] })).toEqual(["t1", "t2"]);
  });

  it("dedupes a single repeated scalar value too", () => {
    expect(extractTrackIds({ trackIds: "t1" })).toEqual(["t1"]);
  });
});

describe("validateTrackChoice enforces the cap, unknown-track still wins (DEC-598)", () => {
  it("refuses over-cap with the shared cap-copy grammar, never a bare number", () => {
    const ids = Array.from({ length: MAX_SUBMISSION_TRACK_IDS + 1 }, (_, i) => `t${i}`);
    const result = validateTrackChoice(ids, ids);
    expect(result).toEqual({
      ok: false,
      error: overCapCountMessage(ids.length, MAX_SUBMISSION_TRACK_IDS, "track"),
    });
  });

  it("still reports 'not offered' when a selection is both unknown AND over-cap", () => {
    const ids = Array.from({ length: MAX_SUBMISSION_TRACK_IDS + 1 }, (_, i) => `t${i}`);
    const result = validateTrackChoice([...ids, "foreign"], ids);
    expect(result).toEqual({ ok: false, error: "Selected track is not offered by this form." });
  });

  it("allows exactly the cap", () => {
    const ids = Array.from({ length: MAX_SUBMISSION_TRACK_IDS }, (_, i) => `t${i}`);
    expect(validateTrackChoice(ids, ids)).toEqual({ ok: true });
  });
});

// -- organizer API routes --------------------------------------------------

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
  const inserts: any[] = [];
  const deletes: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        inserts.push({ table, vals });
      },
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push(table);
      },
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, deletes };
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

function jsonRequest(method: string, path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

const EVENT_TRACKS = [
  { id: "t1", name: "Track One" },
  { id: "t2", name: "Track Two" },
];

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

describe("POST /api/v1/events/:eventId/submissions dedupes trackIds (DEC-598)", () => {
  it("a repeated valid track id inserts ONE join row, never a 500", async () => {
    const { db, deletes, inserts } = fakeDb([
      [{ orgId: ORG_A }], // getEventOrgId
      EVENT_TRACKS, // getEventTracks (parseTrackIdsField)
      [DETAIL_ROW], // getSubmissionDetail: submission+event
      [], // participants
      [{ trackId: "t1" }], // tracks (post-write)
      [], // answers
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      jsonRequest("POST", "/api/v1/events/event-1/submissions", {
        title: "My talk",
        trackIds: ["t1", "t1", "t1"],
      }),
    );

    expect(res.status).toBe(201);
    // replaceSubmissionTracks issues a delete (no-op set) then one insert;
    // createSubmission's own submission-row insert is a separate call.
    expect(deletes).toHaveLength(1);
    const trackInserts = inserts.filter(
      (i) => Array.isArray(i.vals) && (i.vals as any[]).every((v) => "trackId" in v),
    );
    expect(trackInserts).toHaveLength(1);
    expect(trackInserts[0]!.vals).toEqual([{ submissionId: expect.any(String), trackId: "t1", createdAt: expect.any(Date) }]);

    const json = (await res.json()) as any;
    expect(json.trackIds).toEqual(["t1"]);
  });
});

describe("PATCH /api/v1/submissions/:id dedupes trackIds (DEC-598)", () => {
  it("a repeated valid track id replaces with ONE join row, never a 500", async () => {
    const { db, deletes, inserts } = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      EVENT_TRACKS, // getEventTracks (validation)
      [{ title: "T", description: "D" }], // getSubmissionContent (before)
      [DETAIL_ROW], // getSubmissionDetail: submission+event
      [], // participants
      [{ trackId: "t2" }], // tracks (post-replace)
      [], // answers
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      jsonRequest("PATCH", "/api/v1/submissions/sub-1", { trackIds: ["t2", "t2"] }),
    );

    expect(res.status).toBe(200);
    expect(deletes).toHaveLength(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toEqual([{ submissionId: "sub-1", trackId: "t2", createdAt: expect.any(Date) }]);
  });

  it("the cap counts DISTINCT ids — 1000 distinct ids repeated to 1001 raw entries still passes", async () => {
    const distinctIds = Array.from({ length: MAX_SUBMISSION_TRACK_IDS }, (_, i) => `t${i}`);
    const tracks = distinctIds.map((id) => ({ id, name: id }));
    const raw = [...distinctIds, distinctIds[0]]; // 1001 raw entries, 1000 distinct

    const { db, inserts } = fakeDb([
      [SUBMISSION_ORG_A],
      tracks,
      [{ title: "T", description: "D" }],
      [DETAIL_ROW],
      [],
      distinctIds.map((id) => ({ trackId: id })),
      [],
    ]);

    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      jsonRequest("PATCH", "/api/v1/submissions/sub-1", { trackIds: raw }),
    );

    expect(res.status).toBe(200);
    // Chunked by bound-parameter budget (DEC-528) — total rows across every
    // insert call is what matters, not the number of chunk calls.
    const totalRows = inserts.reduce((n, i) => n + (Array.isArray(i.vals) ? (i.vals as any[]).length : 0), 0);
    expect(totalRows).toBe(MAX_SUBMISSION_TRACK_IDS);
  });
});

// -- public (anonymous) CFP route ------------------------------------------

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
];

function publicChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function publicFakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: { table: unknown; vals: unknown }[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return publicChain(rows);
    },
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        inserts.push({ table, vals });
        return {
          then: (resolve: (v: unknown) => unknown) => Promise.resolve().then(resolve),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function fakeFilesBucket(): { bucket: R2Bucket } {
  const bucket = {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
  return { bucket };
}

const CSRF_TOKEN = "test-csrf-token";

function buildApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  return app;
}

function baseForm() {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", "ada@example.com");
  return form;
}

function submitRequest(form: FormData) {
  const headers: Record<string, string> = { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`, Origin: "http://local" };
  return new Request("http://local/submit/test-conf", { method: "POST", headers, body: form });
}

afterEach(() => {
  vi.resetModules();
});

describe("public CFP POST dedupes trackIds and never rolls back on a duplicate (DEC-598)", () => {
  it("a repeated valid trackId succeeds with ONE submission_track row, no rollback", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const TRACK_ROW = { id: "track-1", name: "Main Track" };
    const { db, inserts } = publicFakeDb([
      [EVENT_ROW], // getEventBySlug
      [FORM_ROW], // getDefaultForm
      FIELD_ROWS, // getFormFields
      [TRACK_ROW], // getEventTracks
      [], // findContactByEmail
      [{ seq: 1 }], // createSubmission read-back
      [], // createParticipant (n/a, insert-only) — read for participant insert if any
    ]);
    const { bucket } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const form = baseForm();
    form.append("trackIds", "track-1");
    form.append("trackIds", "track-1");

    const res = await app.request(submitRequest(form), undefined, {
      KV: fakeKv(),
      FILES: bucket,
      DEV_MODE: "1",
    } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200);
    const trackInserts = inserts.filter(
      (i) => Array.isArray(i.vals) && (i.vals as any[]).some((v) => "trackId" in v),
    );
    expect(trackInserts).toHaveLength(1);
    expect(trackInserts[0]!.vals).toEqual([{ submissionId: expect.any(String), trackId: "track-1", createdAt: expect.any(Date) }]);
  });

  it("over-cap on the public CFP re-renders with the shared cap-copy message, not a bare number", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const tracks = Array.from({ length: MAX_SUBMISSION_TRACK_IDS + 1 }, (_, i) => ({ id: `track-${i}`, name: `Track ${i}` }));
    const { db, inserts } = publicFakeDb([
      [EVENT_ROW], // getEventBySlug
      [FORM_ROW], // getDefaultForm
      FIELD_ROWS, // getFormFields
      tracks, // getEventTracks
    ]);
    const { bucket } = fakeFilesBucket();
    const app = buildApp(db);
    app.route("/", publicSubmitRoutes);

    const form = baseForm();
    for (const t of tracks) form.append("trackIds", t.id);

    const res = await app.request(submitRequest(form), undefined, {
      KV: fakeKv(),
      FILES: bucket,
      DEV_MODE: "1",
    } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(overCapCountMessage(MAX_SUBMISSION_TRACK_IDS + 1, MAX_SUBMISSION_TRACK_IDS, "track"));
    // Refused before any submission_track (or submission, or contact) row
    // could be written -- the only db insert observed is the pre-parseBody
    // per-IP rate-limit counter, which fires before validation ever runs.
    const trackInserts = inserts.filter(
      (i) => Array.isArray(i.vals) && (i.vals as any[]).some((v: any) => v && typeof v === "object" && "trackId" in v),
    );
    expect(trackInserts).toHaveLength(0);
  });
});
