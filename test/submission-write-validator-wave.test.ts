// DEC-598 (wave-34 amendment): POST /events/:eventId/submissions and PATCH
// /submissions/:id each serialize three independent field validators
// (parseTrackIdsField/parseFormatField/parseAudienceLevelField, plus
// getSubmissionContent on PATCH) that consume nothing from each other and
// sit behind an authz gate that has already resolved. This test proves
// concurrency BEHAVIOURALLY (an instrumented fake repo layer whose
// validator reads resolve only after an artificial delay, tracking the
// maximum number of simultaneously in-flight statements) -- mirroring
// test/reviewer-queue-round-trip-depth.test.ts's DEC-338 pattern -- rather
// than a source grep. It also pins that a doubly-invalid body (bad trackId
// AND bad format) still surfaces the trackIds error (declaration-order
// re-throw, not whichever settles first), and that no write statement is
// ever in flight concurrently with another write.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_ID = "event-1";
const SUB_ID = "sub-1";

interface Tracker {
  inFlight: number;
  max: number;
}

function makeReadTracker(): Tracker {
  return { inFlight: 0, max: 0 };
}

/** Resolves `value` after an artificial macrotask delay, tracking the
 * maximum number of simultaneously in-flight calls against `tracker`. */
function delayed<T>(tracker: Tracker, value: T, ms = 8): Promise<T> {
  tracker.inFlight += 1;
  tracker.max = Math.max(tracker.max, tracker.inFlight);
  return new Promise<T>((resolve) => setTimeout(resolve, ms)).then((v) => {
    tracker.inFlight -= 1;
    return v ?? value;
  });
}

interface WriteLog {
  active: number;
  maxActive: number;
  overlapDetected: boolean;
  order: string[];
}

function makeWriteLog(): WriteLog {
  return { active: 0, maxActive: 0, overlapDetected: false, order: [] };
}

/** Every write-phase statement (writes AND the sequential reads embedded in
 * the write phase, e.g. getEventFieldIdByRole inside writeRoleAnswer) route
 * through this so the test can pin strict non-overlap. */
async function trackedWrite<T>(log: WriteLog, name: string, value: T, ms = 4): Promise<T> {
  log.active += 1;
  log.maxActive = Math.max(log.maxActive, log.active);
  if (log.active > 1) log.overlapDetected = true;
  log.order.push(name);
  return new Promise<T>((resolve) => setTimeout(resolve, ms)).then((v) => {
    log.active -= 1;
    return v ?? value;
  });
}

const waveTracker = makeReadTracker();
const writeLog = makeWriteLog();

function resetTrackers() {
  waveTracker.inFlight = 0;
  waveTracker.max = 0;
  writeLog.active = 0;
  writeLog.maxActive = 0;
  writeLog.overlapDetected = false;
  writeLog.order = [];
}

const VALID_TRACK_ID = "track-1";
const VALID_FORMAT = "talk";
const VALID_AUDIENCE = "beginner";

vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
    "../src/server/repo/submissions",
  );
  return {
    ...actual,
    getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_ID ? ORG_A : null)),
    getSubmissionOwnership: vi.fn(async (_db: unknown, id: string) =>
      id === SUB_ID ? { orgId: ORG_A, eventId: EVENT_ID } : null,
    ),
    getSubmissionContent: vi.fn(async (_db: unknown, id: string) =>
      delayed(waveTracker, id === SUB_ID ? { title: "Old title", description: "Old desc" } : null),
    ),
    createSubmission: vi.fn(async () => trackedWrite(writeLog, "createSubmission", SUB_ID)),
    updateSubmissionFields: vi.fn(async () => trackedWrite(writeLog, "updateSubmissionFields", undefined)),
    getSubmissionDetail: vi.fn(async () => trackedWrite(writeLog, "getSubmissionDetail", { id: SUB_ID })),
  };
});

vi.mock("../src/server/repo/submit.ts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submit")>("../src/server/repo/submit");
  return {
    ...actual,
    getEventTracks: vi.fn(async () => delayed(waveTracker, [{ id: VALID_TRACK_ID, name: "Track One" }])),
    replaceSubmissionTracks: vi.fn(async () => trackedWrite(writeLog, "replaceSubmissionTracks", undefined)),
    upsertSubmissionAnswers: vi.fn(async () => trackedWrite(writeLog, "upsertSubmissionAnswers", undefined)),
    deleteSubmissionAnswer: vi.fn(async () => trackedWrite(writeLog, "deleteSubmissionAnswer", undefined)),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    getFormatFieldOptions: vi.fn(async () => delayed(waveTracker, [VALID_FORMAT])),
  };
});

vi.mock("../src/server/repo/form-roles", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/form-roles")>(
    "../src/server/repo/form-roles",
  );
  return {
    ...actual,
    getFieldOptionsByRole: vi.fn(async (_db: unknown, _eventId: string, role: string) =>
      delayed(waveTracker, role === "session_format" ? [VALID_FORMAT] : [VALID_AUDIENCE]),
    ),
    getEventFieldIdByRole: vi.fn(async (_db: unknown, _eventId: string, role: string) =>
      trackedWrite(writeLog, "getEventFieldIdByRole", `field-${role}`),
    ),
  };
});

vi.mock("../src/server/repo/users", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
  return {
    ...actual,
    resolveActorName: vi.fn(async () => trackedWrite(writeLog, "resolveActorName", "Actor Name")),
  };
});

vi.mock("../src/server/repo/revisions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/revisions")>("../src/server/repo/revisions");
  return {
    ...actual,
    appendSubmissionRevision: vi.fn(async () => trackedWrite(writeLog, "appendSubmissionRevision", undefined)),
    ensureBaselineRevision: vi.fn(async () => trackedWrite(writeLog, "ensureBaselineRevision", undefined)),
  };
});

vi.mock("../src/server/repo/ics-sequence", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/ics-sequence")>(
    "../src/server/repo/ics-sequence",
  );
  return {
    ...actual,
    bumpIcsSequences: vi.fn(async () => trackedWrite(writeLog, "bumpIcsSequences", undefined)),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  resetTrackers();
});

async function buildApp(auth: AuthInfo) {
  const { submissionsRoutes } = await import("../src/routes/api/submissions");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

describe("DEC-598 (wave-34 amendment): submission write doors issue ONE validation wave", () => {
  it("POST create: trackIds/format/audienceLevel validators overlap (max in-flight >= 2)", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        title: "A talk",
        trackIds: [VALID_TRACK_ID],
        format: VALID_FORMAT,
        audienceLevel: VALID_AUDIENCE,
      }),
    });
    expect(res.status).toBe(201);
    expect(waveTracker.max).toBeGreaterThanOrEqual(2);
  });

  it("PATCH: trackIds/format/audienceLevel/content validators overlap (max in-flight >= 2)", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/submissions/${SUB_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        trackIds: [VALID_TRACK_ID],
        format: VALID_FORMAT,
        audienceLevel: VALID_AUDIENCE,
      }),
    });
    expect(res.status).toBe(200);
    expect(waveTracker.max).toBeGreaterThanOrEqual(2);
  });

  it("POST create: a doubly-invalid body (bad trackId AND bad format) still surfaces the trackIds error", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        title: "A talk",
        trackIds: ["not-a-real-track"],
        format: "not-a-real-format",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.message).toBe("trackIds must belong to this event");
    expect(body.error.fields).toEqual({ trackIds: "Unknown track id: not-a-real-track" });
  });

  it("PATCH: a doubly-invalid body (bad trackId AND bad format) still surfaces the trackIds error", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/submissions/${SUB_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        trackIds: ["not-a-real-track"],
        format: "not-a-real-format",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.message).toBe("trackIds must belong to this event");
    expect(body.error.fields).toEqual({ trackIds: "Unknown track id: not-a-real-track" });
  });

  it("PATCH: every write statement stays strictly sequential (never overlaps another write)", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/submissions/${SUB_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        title: "New title",
        trackIds: [VALID_TRACK_ID],
        format: VALID_FORMAT,
        audienceLevel: VALID_AUDIENCE,
      }),
    });
    expect(res.status).toBe(200);
    expect(writeLog.overlapDetected).toBe(false);
    expect(writeLog.maxActive).toBe(1);
    // Every write fired, in the route's declared order.
    expect(writeLog.order).toEqual([
      "updateSubmissionFields",
      "ensureBaselineRevision",
      "resolveActorName",
      "appendSubmissionRevision",
      "bumpIcsSequences",
      "replaceSubmissionTracks",
      "getEventFieldIdByRole",
      "upsertSubmissionAnswers",
      "getEventFieldIdByRole",
      "upsertSubmissionAnswers",
      "getSubmissionDetail",
    ]);
  });

  it("POST create: every write statement stays strictly sequential (never overlaps another write)", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        title: "A talk",
        trackIds: [VALID_TRACK_ID],
        format: VALID_FORMAT,
        audienceLevel: VALID_AUDIENCE,
      }),
    });
    expect(res.status).toBe(201);
    expect(writeLog.overlapDetected).toBe(false);
    expect(writeLog.maxActive).toBe(1);
    expect(writeLog.order).toEqual([
      "createSubmission",
      "replaceSubmissionTracks",
      "getEventFieldIdByRole",
      "upsertSubmissionAnswers",
      "getEventFieldIdByRole",
      "upsertSubmissionAnswers",
      "getSubmissionDetail",
    ]);
  });
});
