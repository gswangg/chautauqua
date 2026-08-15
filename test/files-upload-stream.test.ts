// w42-a: POST /api/v1/submissions/:id/files must stream the upload straight
// into R2 (FileStore.put accepts ReadableStream — src/server/context.ts:91)
// rather than buffering the whole file into memory with file.arrayBuffer()
// first. Route-level regression: spy the FILES bucket's put() and assert
// the second argument is a ReadableStream, never an ArrayBuffer. Mocking
// pattern mirrors test/deliverable-edit-lock.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const SPEAKER_CONTACT = "contact-speaker";

const scope = {
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: ORG_A,
  readParticipantContactIds: [SPEAKER_CONTACT],
  activeParticipantContactIds: [SPEAKER_CONTACT],
  status: "pending",
  formCloseDate: null,
  timezone: "America/New_York",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async () => scope),
    insertFile: vi.fn(async () => "new-file-id"),
    reopenContentReview: vi.fn(async () => ({ reopened: false })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket(putSpy: (key: string, data: unknown) => void) {
  return {
    async get() {
      return null;
    },
    async put(key: string, data: unknown) {
      putSpy(key, data);
    },
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(putSpy: (key: string, data: unknown) => void) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const auth: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_A, contactId: SPEAKER_CONTACT };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(putSpy) } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

describe("POST /api/v1/submissions/:id/files streams the upload to R2", () => {
  it("passes a ReadableStream (not an ArrayBuffer) as FileStore.put's data arg", async () => {
    let seenData: unknown;
    const app = await buildApp((_key, data) => {
      seenData = data;
    });
    const form = new FormData();
    form.set("file", new File(["hello world"], "deck.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request("/api/v1/submissions/sub-1/files", {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
      body: form,
    });
    expect(res.status).toBe(201);
    expect(seenData).toBeInstanceOf(ReadableStream);
    expect(seenData).not.toBeInstanceOf(ArrayBuffer);
  });
});
