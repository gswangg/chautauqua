// DEC-777/DEC-338 (wave 33): GET /portal/submissions/:id must issue its five
// caller-scoped reads (contactId AND auth.orgId baked into every one of
// them, so none can return another speaker's row at any ordering) as one
// concurrent Promise.all wave, then gate the id-only-scoped
// getPortalParticipants read (plus its two dependents) behind the `detail`
// ownership proof in a second wave -- never seven strictly sequential
// awaits, and never a participants read for a submission this contact does
// not own.
//
// Technique: same instrumented-delay pattern as
// test/reviewer-queue-round-trip-depth.test.ts, applied at the repo
// function boundary (rather than the raw db-query boundary) since this
// route's five wave-1 reads are separate repo functions, each with its own
// multi-statement internals -- mocking every one of them with a shared
// delay+in-flight tracker measures the route's OWN Promise.all scheduling
// behaviourally, not a source grep for the string "Promise.all".

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PortalSubmissionDetail, PortalData } from "../src/server/repo/portal/data";
import type { PortalTaskAssignment } from "../src/server/repo/portal/tasks";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const OWNED_SUBMISSION = "submission-owned";
const FOREIGN_SUBMISSION = "submission-foreign";

interface Tracker {
  inFlight: number;
  max: number;
}

function tracked<T>(tracker: Tracker, value: T, ms = 8): Promise<T> {
  tracker.inFlight += 1;
  tracker.max = Math.max(tracker.max, tracker.inFlight);
  return new Promise<void>((resolve) => setTimeout(resolve, ms)).then(() => {
    tracker.inFlight -= 1;
    return value;
  });
}

function detailFor(id: string): PortalSubmissionDetail {
  return {
    id,
    eventId: "event-1",
    ref: "TALK-1",
    title: "A Talk",
    description: "An abstract.",
    status: "accepted",
    statusLabel: "Accepted",
    submittedAt: 0,
    timezone: "UTC",
    answers: [],
    trackName: null,
    format: null,
    day: null,
    startMin: null,
    endMin: null,
    roomName: null,
  } as unknown as PortalSubmissionDetail;
}

function portalData(): PortalData {
  return {
    branding: {
      eventId: null,
      eventName: "Speaker Portal",
      welcomeMessage: null,
      accentColor: null,
      logoUrl: null,
      showResources: true,
    },
    submissions: [],
    tasks: [],
    contactName: "Speaker Name",
    contactCompany: null,
  } as unknown as PortalData;
}

const participantsCalls: string[] = [];

function trackerOf(db: unknown): Tracker {
  return (db as { __tracker: Tracker }).__tracker;
}

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalSubmissionDetail: vi.fn(async (db: unknown, id: string, contactId: string, orgId: string) =>
      tracked(
        trackerOf(db),
        contactId === CONTACT_A && orgId === ORG_A && id === OWNED_SUBMISSION ? detailFor(id) : null,
      ),
    ),
    getPortalData: vi.fn(async (db: unknown, _contactId: string, _orgId: string) => tracked(trackerOf(db), portalData())),
    getMyTaskAssignments: vi.fn(async (db: unknown, _contactId: string, _orgId: string) =>
      tracked(trackerOf(db), [] as PortalTaskAssignment[]),
    ),
    getLatestDeliverable: vi.fn(async (db: unknown, _contactId: string, _orgId: string, _id: string) =>
      tracked(trackerOf(db), null),
    ),
    listDeliverableCandidatesForEvents: vi.fn(async (db: unknown, _contactId: string, _eventIds: string[]) =>
      tracked(trackerOf(db), new Map()),
    ),
  };
});

// DEC-945 (wave-65 amendment): the 404 this suite exercises now renders via
// portalNotFound (src/routes/portal/shared.tsx), which resolves its eyebrow
// via resolveNotFoundEyebrow(c.var.db) -- the SAME shared read every other
// 404 surface performs. This suite's db fake is a bare tracker object, not a
// real D1 binding, so the real resolver would throw; stub it out since the
// eyebrow lookup is not this suite's concern.
vi.mock("../src/server/not-found", async () => {
  const actual = await vi.importActual<typeof import("../src/server/not-found")>("../src/server/not-found");
  return {
    ...actual,
    resolveNotFoundEyebrow: vi.fn(async () => "Not found"),
  };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (db: unknown, _orgId: string, _contactId: string, _id: string) =>
      tracked(trackerOf(db), null),
    ),
    getPortalParticipants: vi.fn(async (db: unknown, id: string) => {
      participantsCalls.push(id);
      return tracked(trackerOf(db), []);
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  participantsCalls.length = 0;
});

async function buildApp(auth: AuthInfo, tracker: Tracker) {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    // The mocked repo functions above pull the shared tracker as an extra
    // (test-only) trailing argument the route never itself passes -- so
    // instead the fake db carries it, and each mock reads it off db.
    c.set("db", { __tracker: tracker } as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  return app;
}

describe("DEC-777/DEC-338 (wave 33): /portal/submissions/:id round-trip depth", () => {
  it("issues at least 5 reads concurrently on the happy path (wave 1)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const app = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A }, tracker);
    const res = await app.request(`/portal/submissions/${OWNED_SUBMISSION}`);
    expect(res.status).toBe(200);
    expect(tracker.max).toBeGreaterThanOrEqual(5);
  });

  it("returns 404 for a submission this contact does not own, issuing ZERO participants reads", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const app = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A }, tracker);
    const res = await app.request(`/portal/submissions/${FOREIGN_SUBMISSION}`);
    expect(res.status).toBe(404);
    expect(participantsCalls).toEqual([]);
  });
});
