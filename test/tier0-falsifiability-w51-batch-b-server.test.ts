// DEC-358 wave-51 amendment (task-w51-c): batch-B remainder, SERVER half.
// Four claims, each independently verified against this worker's own
// runtime read of the cited file before writing the assertion below. All
// four resolved TRUE on read -- no fix landed in this commit; every block
// exercises the real exported function (or a real request through the real
// sub-app) so a revert of the cited behaviour fails this file, never a
// query-shape or call-order grep.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import type { KVStore } from "../src/auth/claim";
import { ApiError } from "../src/server/http";
import * as schema from "../src/db/schema";

// ---------------------------------------------------------------------------
// Item 1: reviewer plan window on the lone-submission read + matching file
// authz -- src/routes/review/reviewer.ts:288, src/server/repo/files-authz.ts
// :185-209 (DEC-018). CONFIRMED TRUE on read: GET /api/v1/review/submissions/
// :id checks isPlanOpen BEFORE the scope lookup (organizers exempt), and
// reviewerCanAccessSubmissionFile filters candidatePlans through the same
// isPlanOpen gate before authorising a download.
// ---------------------------------------------------------------------------

const ITEM1_ORG_A = "org-a";
const ITEM1_EVENT_ID = "event-1";
const ITEM1_SUB_1 = { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] };
const ITEM1_PAST_OPEN = Date.UTC(2020, 0, 1);
const ITEM1_PAST_CLOSE = Date.UTC(2020, 0, 2);

function item1MakePlan(id: string, openDate: number | null, closeDate: number | null) {
  return {
    id,
    eventId: ITEM1_EVENT_ID,
    name: `Plan ${id}`,
    instructions: null,
    openDate,
    closeDate,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    timezone: "UTC",
  };
}
const ITEM1_CLOSED_PLAN = item1MakePlan("plan-closed", ITEM1_PAST_OPEN, ITEM1_PAST_CLOSE);
const ITEM1_UNBOUNDED_PLAN = item1MakePlan("plan-open", null, null);

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      orgId === ITEM1_ORG_A ? [ITEM1_CLOSED_PLAN, ITEM1_UNBOUNDED_PLAN].find((p) => p.id === planId) ?? null : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) =>
      [ITEM1_CLOSED_PLAN, ITEM1_UNBOUNDED_PLAN].find((p) => p.id === planId) ?? null,
    ),
    listPlanIdsForReviewer: vi.fn(async () => [ITEM1_CLOSED_PLAN.id, ITEM1_UNBOUNDED_PLAN.id]),
    getSubmissionSummaryInEvent: vi.fn(async (_db: unknown, submissionId: string, eventId: string) =>
      eventId === ITEM1_EVENT_ID && submissionId === ITEM1_SUB_1.id ? ITEM1_SUB_1 : null,
    ),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
    getEvaluation: vi.fn(async () => null),
    hasRecusal: vi.fn(async () => null),
  };
});

describe("item 1: reviewer-plan window gates the lone-submission read (DEC-018)", () => {
  const ORG_A = ITEM1_ORG_A;
  const EVENT_ID = ITEM1_EVENT_ID;
  const SUB_1 = ITEM1_SUB_1;
  const CLOSED_PLAN = ITEM1_CLOSED_PLAN;
  const UNBOUNDED_PLAN = ITEM1_UNBOUNDED_PLAN;

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function buildApp(auth: AuthInfo) {
    const { reviewRoutes } = await import("../src/routes/review");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewRoutes);
    return app;
  }

  const reviewer: AuthInfo = { userId: "rev-1", role: "reviewer", orgId: ORG_A };

  it("closed plan: reviewer GET /review/submissions/:id 409s before any scope lookup", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/submissions/${SUB_1.id}?planId=${CLOSED_PLAN.id}`);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("This review plan is not currently open");
  });

  it("unbounded (open) plan: reviewer GET succeeds and returns the submission", async () => {
    const app = await buildApp(reviewer);
    const res = await app.request(`/api/v1/review/submissions/${SUB_1.id}?planId=${UNBOUNDED_PLAN.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { submissionId?: string; id?: string };
    expect(body.id ?? body.submissionId).toBe(SUB_1.id);
  });

  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }
  function makeQueueDb(responses: unknown[][]): Db {
    let call = 0;
    return {
      select: () => {
        const rows = responses[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
    } as unknown as Db;
  }
  const now = new Date("2026-01-01T00:00:00Z");
  function evaluationPlanRow(id: string, openDate: Date | null, closeDate: Date | null) {
    return {
      id,
      eventId: EVENT_ID,
      name: `Plan ${id}`,
      instructions: null,
      openDate,
      closeDate,
      filtersJson: null,
      anonymized: false,
      scaleJson: JSON.stringify({ min: 1, max: 5 }),
      criteriaJson: JSON.stringify([]),
      rounds: 1,
      currentRound: 1,
      roundCriteriaJson: null,
      maxEvaluations: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  it("reviewerCanAccessSubmissionFile: a closed plan is dropped from candidatePlans -- false", async () => {
    const { reviewerCanAccessSubmissionFile } = await import("../src/server/repo/files-authz");
    const CLOSED = "plan-closed-file";
    const db = makeQueueDb([
      [{ planId: CLOSED }],
      [{ plan: evaluationPlanRow(CLOSED, new Date("2020-01-01T00:00:00Z"), new Date("2020-01-02T00:00:00Z")), timezone: "UTC" }],
    ]);
    const inScope = await reviewerCanAccessSubmissionFile(
      db,
      "user-1",
      EVENT_ID,
      SUB_1.id,
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(inScope).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Item 2: updateEvent's slug guard -- src/server/repo/events.ts:224-259
// (DEC-111). CONFIRMED TRUE on read: a raw D1 "UNIQUE constraint failed:
// event.slug" thrown by the UPDATE (isUniqueViolation) is caught and
// re-thrown as ApiError("invalid", "Slug is already in use", {slug:
// "Already in use"}), the same shape the route's fast-path pre-check uses.
// Exercised directly against updateEvent (not the route), so the check is
// pinned to the repo function itself.
// ---------------------------------------------------------------------------

describe("item 2: updateEvent translates a raced UNIQUE(event.slug) violation into a 400-shaped ApiError (DEC-111)", () => {
  const EVENT_ID = "event-race";
  const ORG_A = "org-a";
  const existingRow = {
    id: EVENT_ID,
    orgId: ORG_A,
    name: "Raced Event",
    slug: "raced-event",
    startDate: "2026-06-01",
    endDate: "2026-06-10",
    location: null,
    timezone: "UTC",
    recordPrefix: "EV",
    brandingJson: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  function makeSelectChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  function raceViolation(): Error {
    const cause = new Error("UNIQUE constraint failed: event.slug");
    const wrapper = new Error("D1_ERROR");
    (wrapper as Error & { cause?: unknown }).cause = cause;
    return wrapper;
  }

  it("update-side UNIQUE violation surfaces as ApiError invalid with fields.slug, never an unhandled throw", async () => {
    const { updateEvent } = await import("../src/server/repo/events");
    const db = {
      select: () => makeSelectChain([existingRow]),
      update: () => ({
        set: () => ({
          where: async () => {
            throw raceViolation();
          },
        }),
      }),
    } as unknown as Db;

    await expect(updateEvent(db, EVENT_ID, ORG_A, { slug: "taken-by-the-racer" })).rejects.toMatchObject({
      code: "invalid",
      fields: { slug: "Already in use" },
    });
  });

  it("a non-uniqueness error rethrows unchanged (not swallowed into the slug refusal)", async () => {
    const db = {
      select: () => makeSelectChain([existingRow]),
      update: () => ({
        set: () => ({
          where: async () => {
            throw new Error("some other D1 failure");
          },
        }),
      }),
    } as unknown as Db;
    const { updateEvent } = await import("../src/server/repo/events");
    await expect(updateEvent(db, EVENT_ID, ORG_A, { slug: "whatever" })).rejects.toThrow("some other D1 failure");
  });

  it("sanity: ApiError import used above actually carries a .code field (guards against a silently-renamed contract)", () => {
    const err = new ApiError("invalid", "x");
    expect(err.code).toBe("invalid");
  });
});

// ---------------------------------------------------------------------------
// Item 3: Sessionboard import participant cap -- src/server/repo/import/
// sessionboard.ts:620-627 (DEC-604). CONFIRMED TRUE on read: the cap is
// counted from a map SEEDED with existing DB participants (not just the
// batch), so an import can't push a submission past
// MAX_PARTICIPANTS_PER_SUBMISSION even when most of the cap is already
// consumed by pre-existing rows -- surplus rows land in `skipped`, the
// headroom rows still get created.
// ---------------------------------------------------------------------------

describe("item 3: Sessionboard participants import respects MAX_PARTICIPANTS_PER_SUBMISSION (DEC-604)", () => {
  function fakeDb(seed: { event: unknown[]; submission?: unknown[]; participant?: unknown[]; contact?: unknown[] }) {
    const state = {
      event: [...seed.event] as any[],
      submission: [...(seed.submission ?? [])] as any[],
      participant: [...(seed.participant ?? [])] as any[],
      contact: [...(seed.contact ?? [])] as any[],
    };

    function stateArrayFor(table: unknown): any[] | undefined {
      if (table === schema.event) return state.event;
      if (table === schema.submission) return state.submission;
      if (table === schema.participant) return state.participant;
      if (table === schema.contact) return state.contact;
      return undefined;
    }
    function snakeToCamel(s: string): string {
      return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    }
    function conditionColumnValues(cond: unknown): Map<string, Set<string>> {
      const map = new Map<string, Set<string>>();
      let currentCol: string | null = null;
      function walk(node: unknown, seen = new Set<unknown>(), depth = 0): void {
        if (depth > 14 || node === null || typeof node !== "object" || seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
          for (const c of node) walk(c, seen, depth + 1);
          return;
        }
        const n = node as Record<string, unknown>;
        if (typeof n.name === "string" && n.name.length > 0 && /^[a-z][a-z0-9_]*$/.test(n.name)) {
          currentCol = n.name;
        }
        if (n.value !== undefined && typeof n.value !== "object") {
          if (currentCol) {
            const key = snakeToCamel(currentCol);
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(JSON.stringify(n.value));
          }
        }
        if (Array.isArray(n.queryChunks)) for (const c of n.queryChunks) walk(c, seen, depth + 1);
        if (Array.isArray(n.value)) for (const c of n.value) walk(c, seen, depth + 1);
      }
      walk(cond);
      return map;
    }
    function rowMatches(row: Record<string, unknown>, cond: unknown): boolean {
      const wants = conditionColumnValues(cond);
      for (const [key, allowed] of wants) {
        if (!(key in row)) continue;
        if (!allowed.has(JSON.stringify(row[key]))) return false;
      }
      return true;
    }
    function makeChain(rows: unknown[]) {
      const chain: any = {
        innerJoin: () => chain,
        where: (cond: unknown) => makeChain(rows.filter((r) => rowMatches(r as Record<string, unknown>, cond))),
        groupBy: () => chain,
        limit: (n: number) => makeChain(rows.slice(0, n)),
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
      };
      return chain;
    }
    const db = {
      select: (_cols?: unknown) => ({
        from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
      }),
      insert: (table: unknown) => ({
        values: (vals: unknown) => {
          const write = async () => {
            const rows = Array.isArray(vals) ? vals : [vals];
            const arr = stateArrayFor(table);
            if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
          };
          return {
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
            onConflictDoNothing: () => write(),
          };
        },
      }),
      update: (table: unknown) => ({
        set: (setVals: unknown) => ({
          where: (cond: unknown) => {
            const write = async () => {
              const arr = stateArrayFor(table);
              if (!arr) return;
              for (const r of arr) {
                if (rowMatches(r as Record<string, unknown>, cond)) Object.assign(r, setVals as object);
              }
            };
            return {
              then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
            };
          },
        }),
      }),
    };
    return { db: db as unknown as Db, state };
  }

  const ORG_ID = "org-1";
  const EVENT_ID = "event-1";
  const SESSION_EXTERNAL_ID = "sb-sess-1";
  const SUBMISSION_ID = "submission-1";

  it("a batch that would push a near-capacity submission over the cap creates only the headroom and skips the rest, naming the submission and the cap", async () => {
    const { applySessionboardPlans } = await import("../src/server/repo/import/sessionboard");
    const { externalRef, SESSIONBOARD_SOURCE } = await import("../src/domain/sessionboard");
    const { MAX_PARTICIPANTS_PER_SUBMISSION } = await import("../src/domain/participant-roles");

    const SESSION_REF = externalRef(SESSIONBOARD_SOURCE, SESSION_EXTERNAL_ID);
    const HEADROOM = 2;
    const existingCount = MAX_PARTICIPANTS_PER_SUBMISSION - HEADROOM;
    const contacts: unknown[] = [];
    const participants: unknown[] = [];
    for (let i = 0; i < existingCount; i++) {
      const contactId = `existing-contact-${i}`;
      contacts.push({ id: contactId, orgId: ORG_ID, externalRef: externalRef(SESSIONBOARD_SOURCE, `existing-spk-${i}`) });
      participants.push({
        id: `existing-participant-${i}`,
        submissionId: SUBMISSION_ID,
        contactId,
        role: "speaker",
        order: i,
        updatedAt: null,
      });
    }
    const OFFERED = 5;
    const plans: unknown[] = [];
    for (let i = 0; i < OFFERED; i++) {
      const externalId = `new-spk-${i}`;
      contacts.push({ id: `new-contact-${i}`, orgId: ORG_ID, externalRef: externalRef(SESSIONBOARD_SOURCE, externalId) });
      plans.push({
        row: i + 2,
        externalRef: null,
        values: { sessionExternalId: SESSION_EXTERNAL_ID, speakerExternalId: externalId },
      });
    }

    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, externalRef: SESSION_REF }],
      participant: participants,
      contact: contacts,
    });

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: false,
      plans: plans as any,
    });

    expect(result.created).toBe(HEADROOM);
    expect(result.skipped).toHaveLength(OFFERED - HEADROOM);
    for (const s of result.skipped) {
      expect(s.reason).toContain(SUBMISSION_ID);
      expect(s.reason).toContain(String(MAX_PARTICIPANTS_PER_SUBMISSION));
    }
    const finalParticipants = state.participant.filter((p: any) => p.submissionId === SUBMISSION_ID);
    expect(finalParticipants).toHaveLength(MAX_PARTICIPANTS_PER_SUBMISSION);
  });
});

// ---------------------------------------------------------------------------
// Item 4: send.ts intra-batch dedupe collapse -- src/routes/comms/send.ts:
// 125-143 (DEC-238). CONFIRMED TRUE on read: stage 1 (intra-batch) keys on
// dedupeKey(email, subject) and runs BEFORE loadRecentlySent, so two
// rendered messages in the same POST that share the same recipient email
// AND the same rendered subject collapse to one send, the second landing in
// `skipped` with reason "duplicate_in_batch". TEST-ONLY per the wave-51
// overlap notice -- no restructuring of send.ts in this commit.
// ---------------------------------------------------------------------------

const ITEM4_ORG_A = "org-a";

const ITEM4_EVENT = {
  id: "evt-dedupe",
  orgId: ITEM4_ORG_A,
  name: "DedupeCon",
  slug: "dedupecon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  recordPrefix: "DED",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

// Two distinct submissions, same speaker (same email), and a STATIC
// subject/body (no merge fields) -- both submissions render to the exact
// same (email, subject) pair, so intra-batch dedupe must collapse the
// second into `skipped`.
const ITEM4_SUBMISSIONS = [
  { id: "sub-a", title: "Talk A", seq: 1, participants: [{ contactId: "ct-1", firstName: "Speaker", lastName: "One", email: "speaker@example.com" }] },
  { id: "sub-b", title: "Talk B", seq: 2, participants: [{ contactId: "ct-1", firstName: "Speaker", lastName: "One", email: "speaker@example.com" }] },
];

let item4RecentlySentCalledWith: { email: string; subject: string }[] | undefined;
const item4SentMails: { to: { email: string }; subject: string }[] = [];

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return { ...actual, getEventForOrg: vi.fn(async () => ITEM4_EVENT) };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async (_db: unknown, _eventId: string, ids: string[]) => {
      const byId = new Map(ITEM4_SUBMISSIONS.map((s) => [s.id, s]));
      return ids.map((id) => byId.get(id)!);
    }),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    loadIcsScheduleData: vi.fn(async () => new Map()),
    loadRecentlySent: vi.fn(async (_db: unknown, _eventId: string, pairs: { email: string; subject: string }[]) => {
      item4RecentlySentCalledWith = pairs;
      return new Map();
    }),
  };
});

vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>("../src/server/repo/tasks/reminders");
  return { ...actual, listOutstandingForEvent: vi.fn(async () => []) };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; subject: string }) => {
        item4SentMails.push(mail);
      }),
    })),
  };
});

describe("item 4: POST /compose/send collapses same-address/same-subject duplicates within one batch (DEC-238)", () => {
  const ORG_A = ITEM4_ORG_A;
  const ORIGIN = "https://events.example.com";
  const event = ITEM4_EVENT;
  const sentMails = item4SentMails;

  class InMemoryKV implements KVStore {
    private readonly store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async put(key: string, value: string): Promise<void> {
      this.store.set(key, value);
    }
    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  afterEach(() => {
    vi.clearAllMocks();
    item4SentMails.length = 0;
    item4RecentlySentCalledWith = undefined;
  });

  const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

  function withEnv(kv: KVStore) {
    return { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: ORIGIN };
  }

  async function buildApp() {
    const { commsRoutes } = await import("../src/routes/comms");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      // DEC-238 (wave-8 amendment, sha efb77e4a): send.ts now writes one
      // email_log row per skipped recipient through d1EmailLogWriter
      // (src/server/context.ts), which calls db.insert(...).values(...) --
      // this fake db must support that call even though this test only
      // asserts on the response body's `skipped` array, not on what got
      // durably written.
      c.set("db", { insert: () => ({ values: async () => {} }) } as never);
      await next();
    });
    app.route("/", commsRoutes);
    return app;
  }

  it("same email + same rendered (static) subject across two submissions: one mail sent, one skipped as duplicate_in_batch", async () => {
    const app = await buildApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/${event.id}/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-a", "sub-b"],
          subject: "Reminder: submission update",
          bodyText: "Hi {speaker_name}, please review.",
        }),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      sent: number;
      skipped: { email: string; reason: string; submissionId: string }[];
      failed: unknown[];
    };
    expect(payload.sent).toBe(1);
    expect(payload.failed).toEqual([]);
    expect(payload.skipped).toHaveLength(1);
    expect(payload.skipped[0]?.reason).toBe("duplicate_in_batch");
    expect(sentMails).toHaveLength(1);

    // The collapsed duplicate never reaches the loadRecentlySent window
    // query -- stage 1 (intra-batch) runs BEFORE stage 2, so only the
    // survivor's (email, subject) pair is asked about.
    expect(item4RecentlySentCalledWith).toHaveLength(1);
    expect(item4RecentlySentCalledWith?.[0]?.email).toBe("speaker@example.com");
  });

  it("same email but DIFFERENT rendered subjects (per-submission merge field) are never collapsed", async () => {
    const app = await buildApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/${event.id}/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-a", "sub-b"],
          // {talk_title} is a per-submission merge field -- sub-a and sub-b
          // render two different subjects, so neither collapses.
          subject: "Update on {talk_title}",
          bodyText: "Hi {speaker_name}, see you soon.",
        }),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { sent: number; skipped: unknown[]; failed: unknown[] };
    expect(payload.sent).toBe(2);
    expect(payload.skipped).toEqual([]);
    expect(sentMails).toHaveLength(2);
  });
});
