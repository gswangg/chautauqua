// DEC-244 coverage (task w2-a): portal speaker deliverable self-service —
// GET /portal/tasks/:assignmentId/file (chain-latest download, dedicated
// portal route, never the organizer /files route) and the comment thread
// anchored to the chain-latest file id, with the comment-body cap.
// Repo calls are mocked (no D1 test harness in this repo) — same pattern
// as test/portal-deliverable.test.ts / test/task-upload-content.test.ts.
// See test/portal-deliverable-panel-repo.test.ts for the real
// resolveTaskFileChainLatest forward-walk and insertFileComment/
// listFileComments round trip against a fake DB.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const CONTACT_B = "contact-b";
const ASSIGNMENT_ID = "assignment-1";
const TASK_EVENT_ID = "event-1";
const FILE_ID = "file-current-1";

const COMPLETE_SCOPE = {
  id: ASSIGNMENT_ID,
  taskId: "task-1",
  eventId: TASK_EVENT_ID,
  kind: "file_request" as const,
  formId: null,
  deliverableKind: "presentation",
  contactId: CONTACT_A,
  orgId: ORG_A,
  status: "complete",
  fileId: FILE_ID,
};

const CHAIN_LATEST = {
  id: "file-latest-1",
  filename: "slides-v2.pdf",
  contentType: "application/pdf",
  r2Key: "task/assignment-1/slides-v2.pdf",
  createdAt: Date.now(),
};

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    resolveTaskFileChainLatest: vi.fn(),
    insertFileComment: vi.fn(async () => "comment-new-1"),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket(body: string | null) {
  return {
    async get(key: string) {
      if (body === null) return null;
      return {
        body: new Response(body).body,
        httpMetadata: { contentType: "application/pdf" },
        size: body.length,
        key,
      } as unknown as R2ObjectBody;
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildPortalApp(auth: AuthInfo, filesBody: string | null = "pdf-bytes") {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(filesBody) } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };
const SPEAKER_B: AuthInfo = { userId: "u2", role: "speaker", orgId: ORG_A, contactId: CONTACT_B };

describe("GET /portal/tasks/:assignmentId/file (DEC-244)", () => {
  it("serves the chain-latest bytes with an attachment disposition", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { resolveTaskFileChainLatest: mockedResolve } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(mockedResolve).mockResolvedValue(CHAIN_LATEST);

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("slides-v2.pdf");
    const text = await res.text();
    expect(text).toBe("pdf-bytes");
  });

  it("404s a foreign speaker's assignment id — no IDOR", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { resolveTaskFileChainLatest: mockedResolve } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);

    const app = await buildPortalApp(SPEAKER_B);
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file`);

    expect([403, 404]).toContain(res.status);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it("404s an unknown assignment id", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(null);

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request("http://test.local/portal/tasks/does-not-exist/file");
    expect(res.status).toBe(404);
  });
});

describe("POST /portal/tasks/:assignmentId/comments (DEC-244)", () => {
  it("anchors the reply to the chain-latest file id and sets both author ids", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { resolveTaskFileChainLatest: mockedResolve, insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(mockedResolve).mockResolvedValue(CHAIN_LATEST);

    const app = await buildPortalApp(SPEAKER_A);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set("body", "Uploaded the latest version.");
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/comments`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(302);
    expect(insertFileComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        fileId: CHAIN_LATEST.id,
        body: "Uploaded the latest version.",
        authorUserId: SPEAKER_A.userId,
        authorContactId: CONTACT_A,
      }),
    );
  });

  it("rejects an empty comment body", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);

    const app = await buildPortalApp(SPEAKER_A);
    const form = new FormData();
    form.set("chq_csrf", "tok-2");
    form.set("body", "   ");
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/comments`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-2" },
        body: form,
      }),
    );

    expect(res.status).toBe(400);
    expect(insertFileComment).not.toHaveBeenCalled();
  });

  it("rejects an oversize comment body (>4000 chars)", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);

    const app = await buildPortalApp(SPEAKER_A);
    const form = new FormData();
    form.set("chq_csrf", "tok-3");
    form.set("body", "x".repeat(4001));
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/comments`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-3" },
        body: form,
      }),
    );

    expect(res.status).toBe(400);
    expect(insertFileComment).not.toHaveBeenCalled();
  });
});
