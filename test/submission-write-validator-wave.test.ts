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
// re-throw, not whichever settles first).
//
// Write-phase discipline: POST create's writes stay strictly sequential
// (DEC-598 wave-34 amendment, unchanged). For PATCH, DEC-155's wave-68
// amendment SUPERSEDES the wave-34 "writes stay sequential" clause: the
// PATCH write phase issues as two waves (wave 1 = updateSubmissionFields +
// ensureBaselineRevision; wave 2 = appendSubmissionRevision,
// bumpIcsSequences, replaceSubmissionTracks, and the two role-answer
// writes), with ensureBaselineRevision strictly before
// appendSubmissionRevision and getSubmissionDetail a separate LAST await
// observing every write. resolveActorName and the two
// getEventFieldIdByRole lookups are READS hoisted into the pre-write wave
// (DEC-155 wave-60 amendment) — they route through the write log here only
// so their positions stay observable.

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

interface WriteEntry {
  name: string;
  /** In-flight tracked statements at the moment this one started (including
   * itself) — 1 means it issued alone. */
  activeAtStart: number;
  /** Names of tracked statements already COMPLETED when this one started —
   * proves wave boundaries (an awaited earlier wave has fully drained). */
  doneAtStart: string[];
}

interface WriteLog {
  active: number;
  maxActive: number;
  overlapDetected: boolean;
  order: string[];
  entries: WriteEntry[];
  done: string[];
}

function makeWriteLog(): WriteLog {
  return { active: 0, maxActive: 0, overlapDetected: false, order: [], entries: [], done: [] };
}

/** Every write-phase statement (writes AND the reads embedded in or hoisted
 * out of it, e.g. getEventFieldIdByRole) routes through this so the test can
 * pin the wave shape: which statements overlap, and which strictly follow
 * another's completion. */
async function trackedWrite<T>(log: WriteLog, name: string, value: T, ms = 4): Promise<T> {
  log.active += 1;
  log.maxActive = Math.max(log.maxActive, log.active);
  if (log.active > 1) log.overlapDetected = true;
  log.order.push(name);
  log.entries.push({ name, activeAtStart: log.active, doneAtStart: [...log.done] });
  return new Promise<T>((resolve) => setTimeout(resolve, ms)).then((v) => {
    log.active -= 1;
    log.done.push(name);
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
  writeLog.entries = [];
  writeLog.done = [];
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

  // DEC-155 (wave-68 amendment) SUPERSEDES DEC-598 wave-34's
  // "writes stay sequential" clause for PATCH /submissions/:id: the write
  // phase issues as two waves (wave 1 = updateSubmissionFields +
  // ensureBaselineRevision, different tables, neither observes the other;
  // wave 2 = appendSubmissionRevision, bumpIcsSequences,
  // replaceSubmissionTracks, and the two role-answer writes). The ONLY
  // genuinely ordered pair — ensureBaselineRevision stamps revision #1
  // before appendSubmissionRevision appends #2 — is held by the wave
  // boundary, and getSubmissionDetail stays a separate LAST await that
  // observes every write. resolveActorName and the two
  // getEventFieldIdByRole lookups are reads hoisted into the pre-write
  // read wave (DEC-155 wave-60 amendment).
  it("PATCH: writes issue as DEC-155 wave-68's two waves — baseline strictly before append, detail read last and alone", async () => {
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

    // Every statement fired, starting in the route's declared order:
    // hoisted read wave first, then wave 1, wave 2, and the detail read.
    expect(writeLog.order).toEqual([
      "resolveActorName",
      "getEventFieldIdByRole",
      "getEventFieldIdByRole",
      "updateSubmissionFields",
      "ensureBaselineRevision",
      "appendSubmissionRevision",
      "bumpIcsSequences",
      "replaceSubmissionTracks",
      "upsertSubmissionAnswers",
      "upsertSubmissionAnswers",
      "getSubmissionDetail",
    ]);

    const entry = (name: string, nth = 0): WriteEntry => {
      const found = writeLog.entries.filter((e) => e.name === name)[nth];
      if (!found) throw new Error(`no tracked entry: ${name}[${nth}]`);
      return found;
    };

    // Wave 1 genuinely batches: ensureBaselineRevision issues while
    // updateSubmissionFields is still in flight.
    expect(entry("ensureBaselineRevision").activeAtStart).toBeGreaterThanOrEqual(2);

    // Wave boundary: revision #1 (and the field update) fully landed
    // before revision #2 was issued.
    expect(entry("appendSubmissionRevision").doneAtStart).toContain("ensureBaselineRevision");
    expect(entry("appendSubmissionRevision").doneAtStart).toContain("updateSubmissionFields");

    // Wave 2 genuinely batches: its last member issues with the rest of
    // the wave still in flight.
    expect(entry("upsertSubmissionAnswers", 1).activeAtStart).toBeGreaterThanOrEqual(2);

    // The detail read stays a separate, LAST await: it issues alone, after
    // every write has completed (it observes all of them).
    const detail = entry("getSubmissionDetail");
    expect(detail.activeAtStart).toBe(1);
    for (const write of [
      "updateSubmissionFields",
      "ensureBaselineRevision",
      "appendSubmissionRevision",
      "bumpIcsSequences",
      "replaceSubmissionTracks",
      "upsertSubmissionAnswers",
    ]) {
      expect(detail.doneAtStart).toContain(write);
    }
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
