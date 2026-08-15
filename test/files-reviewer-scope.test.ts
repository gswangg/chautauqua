// DEC-170 wave-54 amendment: the reviewer file grant, previously unreachable
// through GET /api/v1/submissions/:id/files (authzSubmissionRead only named
// organizer/speaker) and GET/POST /api/v1/files/:fileId/comments
// (authzFileRead called canAccessFile with NO options, so `opts?.
// reviewerInScope === true` in files-authz.ts was always undefined for a
// reviewer), is now reachable through both doors via the SAME
// resolveReviewerFileScope predicate authzServeFile already used for GET
// /files/:fileId. Route wiring under test — repo calls are mocked, same
// pattern as test/reviewer-file-access.test.ts and
// test/files-archive-route.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_ID = "event-1";

// sub-1: reviewer "rev-assigned" has a non-anonymized plan assignment whose
// scope covers this submission.
const IN_SCOPE_SUB = "sub-1";
// sub-2: same reviewer's assignment doesn't cover this submission (cross-track).
const CROSS_TRACK_SUB = "sub-2";
// sub-3: only reachable via an anonymized plan assignment — DEC-170 says
// anonymized plans never grant file access.
const ANON_ONLY_SUB = "sub-3";

const ASSIGNED_REVIEWER = "rev-assigned";

const submissionScopes: Record<string, { submissionId: string; eventId: string; orgId: string; readParticipantContactIds: string[]; activeParticipantContactIds: string[]; status: string; formCloseDate: number | null; timezone: string }> = {
  [IN_SCOPE_SUB]: {
    submissionId: IN_SCOPE_SUB,
    eventId: EVENT_ID,
    orgId: ORG_A,
    readParticipantContactIds: ["contact-speaker"],
    activeParticipantContactIds: ["contact-speaker"],
    status: "accepted",
    formCloseDate: null,
    timezone: "UTC",
  },
  [CROSS_TRACK_SUB]: {
    submissionId: CROSS_TRACK_SUB,
    eventId: EVENT_ID,
    orgId: ORG_A,
    readParticipantContactIds: ["contact-speaker-2"],
    activeParticipantContactIds: ["contact-speaker-2"],
    status: "accepted",
    formCloseDate: null,
    timezone: "UTC",
  },
  [ANON_ONLY_SUB]: {
    submissionId: ANON_ONLY_SUB,
    eventId: EVENT_ID,
    orgId: ORG_A,
    readParticipantContactIds: ["contact-speaker-3"],
    activeParticipantContactIds: ["contact-speaker-3"],
    status: "accepted",
    formCloseDate: null,
    timezone: "UTC",
  },
};

const fileScopesById: Record<
  string,
  { fileId: string; submissionId: string | null; eventId: string; orgId: string; uploadedByContactId: string | null; readParticipantContactIds: string[]; activeParticipantContactIds: string[]; filename: string; contentType: string; r2Key: string }
> = {
  "file-in-scope": {
    fileId: "file-in-scope",
    submissionId: IN_SCOPE_SUB,
    eventId: EVENT_ID,
    orgId: ORG_A,
    uploadedByContactId: "contact-speaker",
    readParticipantContactIds: ["contact-speaker"],
    activeParticipantContactIds: ["contact-speaker"],
    filename: "slides.pdf",
    contentType: "application/pdf",
    r2Key: "sub/sub-1/slides.pdf",
  },
  "file-cross-track": {
    fileId: "file-cross-track",
    submissionId: CROSS_TRACK_SUB,
    eventId: EVENT_ID,
    orgId: ORG_A,
    uploadedByContactId: "contact-speaker-2",
    readParticipantContactIds: ["contact-speaker-2"],
    activeParticipantContactIds: ["contact-speaker-2"],
    filename: "deck.pdf",
    contentType: "application/pdf",
    r2Key: "sub/sub-2/deck.pdf",
  },
  "file-anon-only": {
    fileId: "file-anon-only",
    submissionId: ANON_ONLY_SUB,
    eventId: EVENT_ID,
    orgId: ORG_A,
    uploadedByContactId: "contact-speaker-3",
    readParticipantContactIds: ["contact-speaker-3"],
    activeParticipantContactIds: ["contact-speaker-3"],
    filename: "notes.pdf",
    contentType: "application/pdf",
    r2Key: "sub/sub-3/notes.pdf",
  },
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) => submissionScopes[submissionId] ?? null),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => fileScopesById[fileId] ?? null),
    // Mirrors reviewerCanAccessSubmissionFile's real contract: true only for
    // the assigned reviewer + the submission covered by their non-anonymized
    // plan. Cross-track and anonymized-only submissions never resolve true.
    reviewerCanAccessSubmissionFile: vi.fn(
      async (_db: unknown, userId: string, eventId: string, submissionId: string) =>
        userId === ASSIGNED_REVIEWER && eventId === EVENT_ID && submissionId === IN_SCOPE_SUB,
    ),
    listSubmissionFiles: vi.fn(async () => ({})),
    batchContactNames: vi.fn(async () => new Map<string, string>()),
    listFileComments: vi.fn(async () => ({ items: [], total: 0 })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApiApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

describe("DEC-170 (wave 54): GET /api/v1/submissions/:id/files admits an in-scope reviewer", () => {
  it("200s for a reviewer whose non-anonymized plan assignment covers the submission", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${IN_SCOPE_SUB}/files`);
    expect(res.status).toBe(200);
  });

  it("403s the same reviewer for a cross-track submission (assignment doesn't cover it)", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${CROSS_TRACK_SUB}/files`);
    expect(res.status).toBe(403);
  });

  it("403s a reviewer whose only covering assignment is on an anonymized plan", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${ANON_ONLY_SUB}/files`);
    expect(res.status).toBe(403);
  });

  it("organizer access is unchanged", async () => {
    const app = await buildApiApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${IN_SCOPE_SUB}/files`);
    expect(res.status).toBe(200);
  });

  it("participant-speaker access is unchanged", async () => {
    const app = await buildApiApp({
      userId: "speaker-user",
      role: "speaker",
      orgId: ORG_A,
      contactId: "contact-speaker",
    });
    const res = await app.request(`/api/v1/submissions/${IN_SCOPE_SUB}/files`);
    expect(res.status).toBe(200);
  });

  it("a non-participant speaker still 403s (no IDOR opened by the reviewer branch)", async () => {
    const app = await buildApiApp({
      userId: "other-speaker-user",
      role: "speaker",
      orgId: ORG_A,
      contactId: "someone-else",
    });
    const res = await app.request(`/api/v1/submissions/${IN_SCOPE_SUB}/files`);
    expect(res.status).toBe(403);
  });
});

describe("DEC-170 (wave 54): GET /api/v1/files/:fileId/comments admits an in-scope reviewer, POST stays refused", () => {
  it("GET 200s for a reviewer whose non-anonymized plan assignment covers the file's submission", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/file-in-scope/comments`);
    expect(res.status).toBe(200);
  });

  it("GET 403s the same reviewer for a cross-track file", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/file-cross-track/comments`);
    expect(res.status).toBe(403);
  });

  it("GET 403s a reviewer whose only covering assignment is anonymized", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/file-anon-only/comments`);
    expect(res.status).toBe(403);
  });

  it("POST 403s an in-scope reviewer — a read grant never authorizes a write", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/file-in-scope/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ body: "hello" }),
    });
    expect(res.status).toBe(403);
  });

  it("organizer and participant-speaker comment access unchanged", async () => {
    const organizerApp = await buildApiApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
    const organizerRes = await organizerApp.request(`/api/v1/files/file-in-scope/comments`);
    expect(organizerRes.status).toBe(200);

    const speakerApp = await buildApiApp({
      userId: "speaker-user",
      role: "speaker",
      orgId: ORG_A,
      contactId: "contact-speaker",
    });
    const speakerRes = await speakerApp.request(`/api/v1/files/file-in-scope/comments`);
    expect(speakerRes.status).toBe(200);
  });
});
