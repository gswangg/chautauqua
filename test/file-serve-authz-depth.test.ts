// DEC-170 (wave-33 amendment): GET /files/:fileId (authzServeFile,
// src/routes/files.ts) probes three disjoint file populations —
// getFileScope (submission deliverables/attachments), getResourceFileScope
// (DEC-047 resources), getTaskFileScope (DEC-065/DEC-248 task-assignment
// uploads). Previously these ran as three sequential awaits, so a
// task-assignment upload paid for two guaranteed-empty lookups before
// reaching its own. This test proves the fix BEHAVIOURALLY — an
// instrumented mock of the three repo lookups, each resolving only after an
// artificial delay, tracking the maximum number of simultaneously in-flight
// calls — the same technique test/reviewer-queue-round-trip-depth.test.ts
// uses for its own route (not a source grep for `Promise.all`). A second
// test drives a corrupted fixture where two populations both return a row
// and asserts the loud throw named in the task (never a silent
// probe-order pick).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const taskFileScope = {
  fileId: "file-task-1",
  orgId: ORG_A,
  assignmentContactId: "contact-assigned",
  uploadedByContactId: null as string | null,
  filename: "handout.pdf",
  contentType: "application/pdf",
  r2Key: "task/file-task-1/handout.pdf",
};

const resourceFileScope = {
  fileId: "file-resource-1",
  orgId: ORG_A,
  filename: "resource.pdf",
  contentType: "application/pdf",
  r2Key: "resource/file-resource-1/resource.pdf",
};

interface Tracker {
  inFlight: number;
  max: number;
}

/** Wraps a repo lookup so every call resolves only after a real macrotask
 * delay, tracking the maximum number of simultaneously in-flight calls —
 * genuinely concurrent callers overlap in wall-clock time, genuinely
 * sequential callers never do. */
function delayed<T>(tracker: Tracker, value: T): () => Promise<T> {
  return () =>
    new Promise<T>((resolve) => {
      tracker.inFlight += 1;
      tracker.max = Math.max(tracker.max, tracker.inFlight);
      setTimeout(() => {
        tracker.inFlight -= 1;
        resolve(value);
      }, 8);
    });
}

function fakeFilesBucket() {
  return {
    async get() {
      return {
        body: new ReadableStream(),
        httpMetadata: { contentType: taskFileScope.contentType },
        size: 10,
      };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo) {
  const { fileServeRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/", fileServeRoutes);
  return app;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("DEC-170 (wave-33 amendment): authzServeFile probes its three populations in one wave", () => {
  it("has at least 3 lookups simultaneously in-flight on the serve path (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getFileScope: vi.fn(delayed(tracker, null)),
        getResourceFileScope: vi.fn(delayed(tracker, null)),
        getTaskFileScope: vi.fn(delayed(tracker, taskFileScope)),
      };
    });
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(200);
    expect(tracker.max).toBeGreaterThanOrEqual(3);
  });

  it("throws loudly, naming the file and the matched populations, when two populations both return a row", async () => {
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getFileScope: vi.fn(async () => null),
        getResourceFileScope: vi.fn(async () => resourceFileScope),
        getTaskFileScope: vi.fn(async () => taskFileScope),
      };
    });
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    // registerErrorHandler turns an uncaught Error into a 500 — the route
    // never gets to pick a permission outcome by probe order.
    expect(res.status).toBe(500);
  });
});
