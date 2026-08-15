// DEC-041 amendment: a speaker's deliverable writes (upload/replace a file,
// post a comment) must obey the same server-side edit lock the portal
// enforces (src/domain/edit-lock.ts canEditSubmission) — not just org/
// participant membership. Separately, POST /files/:fileId/comments must be
// gated by a WRITE predicate (authzFileWrite), never the READ predicate
// (authzFileRead) that GET uses. Repo calls are mocked so these are pure
// route-level access-decision tests (no D1/wrangler dependency in stage 1) —
// same pattern as test/task-file-access.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const SPEAKER_CONTACT = "contact-speaker";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const CLOSED_DATE = Date.parse("2026-01-01T00:00:00Z"); // well in the past -> form closed
const OPEN_DATE = Date.parse("2099-01-01T00:00:00Z"); // far future -> form open
const TZ = "America/New_York";

interface FakeSubmission {
  submissionId: string;
  eventId: string;
  orgId: string;
  readParticipantContactIds: string[];
  activeParticipantContactIds: string[];
  status: string;
  formCloseDate: number | null;
  timezone: string;
}

const submissions: Record<string, FakeSubmission> = {
  "sub-accepted-closed": {
    submissionId: "sub-accepted-closed",
    eventId: "event-1",
    orgId: ORG_A,
    readParticipantContactIds: [SPEAKER_CONTACT],
    activeParticipantContactIds: [SPEAKER_CONTACT],
    status: "accepted",
    formCloseDate: CLOSED_DATE,
    timezone: TZ,
  },
  "sub-declined-closed": {
    submissionId: "sub-declined-closed",
    eventId: "event-1",
    orgId: ORG_A,
    readParticipantContactIds: [SPEAKER_CONTACT],
    activeParticipantContactIds: [SPEAKER_CONTACT],
    status: "declined",
    formCloseDate: CLOSED_DATE,
    timezone: TZ,
  },
  "sub-pending-open": {
    submissionId: "sub-pending-open",
    eventId: "event-1",
    orgId: ORG_A,
    readParticipantContactIds: [SPEAKER_CONTACT],
    activeParticipantContactIds: [SPEAKER_CONTACT],
    status: "pending",
    formCloseDate: OPEN_DATE,
    timezone: TZ,
  },
};

const fileScopeForSubmission: Record<string, unknown> = {
  "sub-accepted-closed": {
    fileId: "file-accepted-closed",
    submissionId: "sub-accepted-closed",
    eventId: "event-1",
    orgId: ORG_A,
    uploadedByContactId: null,
    readParticipantContactIds: [SPEAKER_CONTACT],
    activeParticipantContactIds: [SPEAKER_CONTACT],
    filename: "deck.pdf",
    contentType: "application/pdf",
    r2Key: "sub/deck.pdf",
  },
  "sub-declined-closed": {
    fileId: "file-declined-closed",
    submissionId: "sub-declined-closed",
    eventId: "event-1",
    orgId: ORG_A,
    uploadedByContactId: null,
    readParticipantContactIds: [SPEAKER_CONTACT],
    activeParticipantContactIds: [SPEAKER_CONTACT],
    filename: "deck.pdf",
    contentType: "application/pdf",
    r2Key: "sub/deck.pdf",
  },
  "sub-pending-open": {
    fileId: "file-pending-open",
    submissionId: "sub-pending-open",
    eventId: "event-1",
    orgId: ORG_A,
    uploadedByContactId: null,
    readParticipantContactIds: [SPEAKER_CONTACT],
    activeParticipantContactIds: [SPEAKER_CONTACT],
    filename: "deck.pdf",
    contentType: "application/pdf",
    r2Key: "sub/deck.pdf",
  },
};

const fileIdToSubmissionId: Record<string, string> = {
  "file-accepted-closed": "sub-accepted-closed",
  "file-declined-closed": "sub-declined-closed",
  "file-pending-open": "sub-pending-open",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) => submissions[submissionId] ?? null),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => {
      const subId = fileIdToSubmissionId[fileId];
      return subId ? (fileScopeForSubmission[subId] ?? null) : null;
    }),
    insertFile: vi.fn(async () => "new-file-id"),
    insertFileComment: vi.fn(async () => "new-comment-id"),
    listSubmissionFiles: vi.fn(async () => ({})),
    listFileComments: vi.fn(async () => []),
    reopenContentReview: vi.fn(async () => {}),
  };
});

vi.useFakeTimers();
vi.setSystemTime(NOW);

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket() {
  return {
    async get() {
      return { body: new ReadableStream(), httpMetadata: { contentType: "application/pdf" }, size: 10 };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const speaker: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_A, contactId: SPEAKER_CONTACT };
const organizer: AuthInfo = { userId: "u-organizer", role: "organizer", orgId: ORG_A };

async function postFile(app: Hono<AppEnv>, submissionId: string) {
  const form = new FormData();
  form.set("file", new File(["hello"], "deck.pdf", { type: "application/pdf" }));
  form.set("kind", "presentation");
  return app.request(`/api/v1/submissions/${submissionId}/files`, {
    method: "POST",
    headers: { "x-chq-csrf": "1" },
    body: form,
  });
}

async function postComment(app: Hono<AppEnv>, fileId: string) {
  return app.request(`/api/v1/files/${fileId}/comments`, {
    method: "POST",
    headers: { "x-chq-csrf": "1", "content-type": "application/json" },
    body: JSON.stringify({ body: "looks good" }),
  });
}

describe("POST /api/v1/submissions/:id/files — DEC-041 edit lock", () => {
  it("allows an accepted speaker even though the form is closed", async () => {
    const app = await buildApp(speaker);
    const res = await postFile(app, "sub-accepted-closed");
    expect(res.status).toBe(201);
  });

  it("403s a declined speaker once the form is closed, with the named message", async () => {
    const app = await buildApp(speaker);
    const res = await postFile(app, "sub-declined-closed");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("This submission can no longer be edited");
  });

  it("allows a pending speaker while the form is still open", async () => {
    const app = await buildApp(speaker);
    const res = await postFile(app, "sub-pending-open");
    expect(res.status).toBe(201);
  });

  it("allows an organizer even for a declined submission with a closed form (never locked)", async () => {
    const app = await buildApp(organizer);
    const res = await postFile(app, "sub-declined-closed");
    expect(res.status).toBe(201);
  });
});

describe("POST /api/v1/files/:fileId/comments — DEC-041 edit lock (write predicate, not read)", () => {
  it("allows an accepted speaker even though the form is closed", async () => {
    const app = await buildApp(speaker);
    const res = await postComment(app, "file-accepted-closed");
    expect(res.status).toBe(201);
  });

  it("403s a declined speaker once the form is closed, with the named message", async () => {
    const app = await buildApp(speaker);
    const res = await postComment(app, "file-declined-closed");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("This submission can no longer be edited");
  });

  it("allows a pending speaker while the form is still open", async () => {
    const app = await buildApp(speaker);
    const res = await postComment(app, "file-pending-open");
    expect(res.status).toBe(201);
  });

  it("allows an organizer even for a declined submission with a closed form (never locked)", async () => {
    const app = await buildApp(organizer);
    const res = await postComment(app, "file-declined-closed");
    expect(res.status).toBe(201);
  });
});
