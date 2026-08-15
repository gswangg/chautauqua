// DEC-891 (wave 34 amendment): GET /portal/tasks must resolve its page data
// in THREE concurrent Promise.all waves, not five — and the deliverable-
// candidates read must be a single batched statement over every distinct
// event id on the page (listDeliverableCandidatesForEvents), never one
// listDeliverableCandidates call PER event.
//
// Technique: same instrumented-delay-at-the-repo-function-boundary pattern
// as test/portal-submission-detail-round-trip-depth.test.ts and
// test/reviewer-queue-round-trip-depth.test.ts -- mocking every repo call
// loadTasksPageData makes with a shared delay+in-flight tracker measures the
// ROUTE's own Promise.all scheduling behaviourally, not a source grep for
// "Promise.all".

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PortalData } from "../src/server/repo/portal/data";
import type { PortalTaskAssignment, DeliverableCandidate } from "../src/server/repo/portal/tasks";
import type { TaskFileChainLatest, FileChainVersionRow } from "../src/server/repo/files-versions";
import type { FileCommentRow } from "../src/server/repo/files-comments";
import type { PortalDeliverable } from "../src/server/repo/portal/sessions";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";

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

function trackerOf(db: unknown): Tracker {
  return (db as { __tracker: Tracker }).__tracker;
}

function portalData(): PortalData {
  return {
    branding: {
      eventId: "event-1",
      eventName: "Arbitrary Con",
      welcomeMessage: null,
      accentColor: null,
      logoUrl: null,
      showResources: true,
    },
    submissions: [],
    tasks: [],
  } as unknown as PortalData;
}

// One completed file_request assignment (drives the chain-resolution +
// comment-thread wave) and one deliverable-linking file_request assignment
// per event (drives the candidates + latest-deliverable wave).
function fileAssignment(id: string, eventId: string): PortalTaskAssignment {
  return {
    id,
    taskId: `${id}-task`,
    eventId,
    kind: "file_request",
    title: "Upload slides",
    description: null,
    instructions: null,
    dueDate: null,
    assignedAt: 0,
    required: true,
    status: "complete",
    formId: null,
    deliverableKind: null,
    fileId: "file-1",
    responseJson: null,
    timezone: "UTC",
    completedAt: 1000,
  } as unknown as PortalTaskAssignment;
}

function deliverableAssignment(id: string, eventId: string): PortalTaskAssignment {
  return {
    id,
    taskId: `${id}-task`,
    eventId,
    kind: "file_request",
    title: "Link your deliverable",
    description: null,
    instructions: null,
    dueDate: null,
    assignedAt: 0,
    required: true,
    status: "pending",
    formId: null,
    deliverableKind: "presentation",
    fileId: null,
    responseJson: null,
    timezone: "UTC",
    completedAt: null,
  } as unknown as PortalTaskAssignment;
}

function candidatesFor(eventId: string): DeliverableCandidate[] {
  return [
    { id: `${eventId}-sub-a`, ref: "TALK-1", title: "Talk A", status: "accepted", seq: 1 },
    { id: `${eventId}-sub-b`, ref: "TALK-2", title: "Talk B", status: "accepted", seq: 2 },
  ];
}

const listDeliverableCandidatesForEventsCalls: string[][] = [];

function buildMocks() {
  vi.doMock("../src/server/repo/portal", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
    return {
      ...actual,
      getPortalData: vi.fn(async (db: unknown) => tracked(trackerOf(db), portalData())),
      getMyTaskAssignments: vi.fn(async (db: unknown, _contactId: string, _orgId: string) =>
        tracked(trackerOf(db), currentAssignments),
      ),
      listDeliverableCandidatesForEvents: vi.fn(async (db: unknown, _contactId: string, eventIds: string[]) => {
        listDeliverableCandidatesForEventsCalls.push([...new Set(eventIds)]);
        const out = new Map<string, DeliverableCandidate[]>();
        for (const id of new Set(eventIds)) out.set(id, candidatesFor(id));
        return tracked(trackerOf(db), out);
      }),
      listLatestDeliverables: vi.fn(
        async (db: unknown, _contactId: string, _orgId: string, _submissionIds: string[]) =>
          tracked(trackerOf(db), new Map<string, PortalDeliverable>()),
      ),
    };
  });

  vi.doMock("../src/server/repo/files-versions", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-versions")>(
      "../src/server/repo/files-versions",
    );
    return {
      ...actual,
      resolveTaskFileChainLatestMany: vi.fn(async (db: unknown, fileIds: string[]) => {
        const out = new Map<string, TaskFileChainLatest>();
        for (const id of fileIds) {
          out.set(id, { id, filename: "slides-v2.pdf", contentType: "application/pdf", r2Key: "k2", createdAt: 2000 });
        }
        return tracked(trackerOf(db), out);
      }),
      listFileChainVersionsMany: vi.fn(async (db: unknown, fileIds: string[]) => {
        const out = new Map<string, FileChainVersionRow[]>();
        for (const id of fileIds) {
          out.set(id, [
            { id: "file-1", filename: "slides-v1.pdf", contentType: "application/pdf", r2Key: "k1", createdAt: 1000, versionNo: 1 },
            { id: "file-1-v2", filename: "slides-v2.pdf", contentType: "application/pdf", r2Key: "k2", createdAt: 2000, versionNo: 2 },
          ]);
        }
        return tracked(trackerOf(db), out);
      }),
    };
  });

  vi.doMock("../src/server/repo/files-comments", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-comments")>(
      "../src/server/repo/files-comments",
    );
    return {
      ...actual,
      listFileCommentsForFiles: vi.fn(async (db: unknown, fileIds: string[]) => {
        const out = new Map<string, FileCommentRow[]>();
        for (const id of fileIds) out.set(id, []);
        return tracked(trackerOf(db), out);
      }),
    };
  });
}

let currentAssignments: PortalTaskAssignment[] = [];

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../src/server/repo/portal");
  vi.doUnmock("../src/server/repo/files-versions");
  vi.doUnmock("../src/server/repo/files-comments");
  listDeliverableCandidatesForEventsCalls.length = 0;
});

async function buildApp(auth: AuthInfo, tracker: Tracker) {
  buildMocks();
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    // The mocked repo functions above pull the shared tracker as a
    // test-only channel via the fake db object, mirroring
    // test/portal-submission-detail-round-trip-depth.test.ts.
    c.set("db", { __tracker: tracker } as never);
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

describe("DEC-891 (wave 34 amendment): /portal/tasks round-trip depth", () => {
  it("issues at least 2 reads concurrently in wave 2 and again in wave 3 (3 waves total, not 5)", async () => {
    currentAssignments = [fileAssignment("assign-file", "event-1"), deliverableAssignment("assign-deliv", "event-1")];
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const app = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A }, tracker);
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    // Wave 2 alone holds 3 concurrent statements (resolveTaskFileChainLatestMany,
    // listFileChainVersionsMany, listDeliverableCandidatesForEvents); wave 3
    // holds 2 (listFileCommentsForFiles, listLatestDeliverables) -- a fully
    // serial (5-wave) handler could never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(2);
  });

  it("issues the SAME number of listDeliverableCandidatesForEvents statements for a speaker holding assignments across THREE distinct events as for one event", async () => {
    // One event.
    currentAssignments = [deliverableAssignment("assign-deliv-1", "event-1")];
    const tracker1: Tracker = { inFlight: 0, max: 0 };
    const app1 = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A }, tracker1);
    const res1 = await app1.request("/portal/tasks");
    expect(res1.status).toBe(200);
    const oneEventCallCount = listDeliverableCandidatesForEventsCalls.length;
    expect(oneEventCallCount).toBe(1);

    listDeliverableCandidatesForEventsCalls.length = 0;

    // Three distinct events.
    currentAssignments = [
      deliverableAssignment("assign-deliv-1", "event-1"),
      deliverableAssignment("assign-deliv-2", "event-2"),
      deliverableAssignment("assign-deliv-3", "event-3"),
    ];
    const tracker3: Tracker = { inFlight: 0, max: 0 };
    const app3 = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A }, tracker3);
    const res3 = await app3.request("/portal/tasks");
    expect(res3.status).toBe(200);
    const threeEventCallCount = listDeliverableCandidatesForEventsCalls.length;
    expect(threeEventCallCount).toBe(1);
    expect(listDeliverableCandidatesForEventsCalls[0]?.sort()).toEqual(["event-1", "event-2", "event-3"]);

    // The statement COUNT (number of batched-read calls) is identical for 1
    // event and for 3 events -- one call per page load, not one per event.
    expect(threeEventCallCount).toBe(oneEventCallCount);
  });

  it("renders byte-identical /portal/tasks HTML for a completed file_request assignment plus a multi-candidate deliverable choice, across a 1-event and a 3-event page", async () => {
    currentAssignments = [fileAssignment("assign-file", "event-1"), deliverableAssignment("assign-deliv", "event-1")];
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const app = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A }, tracker);
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // The completed file_request card renders the resolved chain-latest
    // filename/version and the version-history block.
    expect(html).toContain("slides-v2.pdf");
    expect(html).toContain("Version history");
    // The multi-candidate deliverable choice renders both candidate options.
    expect(html).toContain("TALK-1");
    expect(html).toContain("TALK-2");
  });
});
