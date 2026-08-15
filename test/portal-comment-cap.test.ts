// DEC-244 amendment (wave 56) coverage: the portal comment reply must fail
// the way the portal upload already fails — inline (200 HTML), with the
// typed text kept, and the cap named in words. Repo calls are mocked (no D1
// test harness in this repo) — same pattern as test/portal-file-versions.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_COMMENT_BODY_LENGTH } from "../src/domain/files";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
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
  filename: "slides-v1.pdf",
  contentType: "application/pdf",
  r2Key: "task/assignment-1/slides-v1.pdf",
  createdAt: Date.now(),
  versionNo: 1,
};

const ASSIGNMENT_ROW = {
  id: ASSIGNMENT_ID,
  taskId: "task-1",
  eventId: TASK_EVENT_ID,
  kind: "file_request" as const,
  title: "Upload slides",
  description: null,
  instructions: null,
  dueDate: null,
  assignedAt: 0,
  required: true,
  status: "complete" as const,
  formId: null,
  deliverableKind: "presentation",
  fileId: FILE_ID,
  responseJson: null,
  timezone: "UTC",
  completedAt: null,
};

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    getMyTaskAssignments: vi.fn(),
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: TASK_EVENT_ID,
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
        showResources: true,
      },
      submissions: [],
      tasks: [],
    })),
    listDeliverableCandidates: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    resolveTaskFileChainLatest: vi.fn(),
    resolveTaskFileChainLatestMany: vi.fn(),
    listFileChainVersions: vi.fn(),
    listFileChainVersionsMany: vi.fn(),
    listFileComments: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 1 })),
    listFileCommentsForFiles: vi.fn(async () => new Map()),
    insertFileComment: vi.fn(async () => "comment-new-1"),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildPortalApp(auth: AuthInfo) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

async function primeTasksListMocks() {
  const { getMyTaskAssignments } = await import("../src/server/repo/portal");
  const { resolveTaskFileChainLatestMany, listFileChainVersionsMany } = await import("../src/server/repo/files");
  vi.mocked(getMyTaskAssignments).mockResolvedValue([ASSIGNMENT_ROW]);
  vi.mocked(resolveTaskFileChainLatestMany).mockResolvedValue(new Map([[FILE_ID, CHAIN_LATEST]]));
  vi.mocked(listFileChainVersionsMany).mockResolvedValue(new Map([[FILE_ID, [CHAIN_LATEST]]]));
}

async function postComment(app: Hono<AppEnv>, body: string) {
  const form = new FormData();
  form.set("chq_csrf", "tok-1");
  form.set("body", body);
  return app.request(
    new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/comments`, {
      method: "POST",
      headers: { cookie: "chq_csrf=tok-1" },
      body: form,
    }),
  );
}

describe("POST /portal/tasks/:assignmentId/comments — DEC-244 amendment (wave 56) inline refusal", () => {
  it("over-cap body (4001 chars): returns 200 HTML with the typed text and the named limit, never posts", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    await primeTasksListMocks();

    const app = await buildPortalApp(SPEAKER_A);
    const oversized = "x".repeat(4001);
    const res = await postComment(app, oversized);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(oversized);
    expect(html).toContain(MAX_COMMENT_BODY_LENGTH.toLocaleString("en-US"));
    expect(html).toContain("chq-field-error");
    expect(insertFileComment).not.toHaveBeenCalled();
  });

  it("empty body: returns 200 HTML with a visible refusal, never posts", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    await primeTasksListMocks();

    const app = await buildPortalApp(SPEAKER_A);
    const res = await postComment(app, "   ");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("chq-field-error");
    expect(insertFileComment).not.toHaveBeenCalled();
  });

  it("exactly at the cap (4000 chars): redirects 302 and writes exactly one comment", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFileComment, resolveTaskFileChainLatest } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(resolveTaskFileChainLatest).mockResolvedValue(CHAIN_LATEST);

    const app = await buildPortalApp(SPEAKER_A);
    const atCap = "x".repeat(MAX_COMMENT_BODY_LENGTH);
    const res = await postComment(app, atCap);

    expect(res.status).toBe(302);
    expect(insertFileComment).toHaveBeenCalledTimes(1);
    expect(insertFileComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: atCap, fileId: CHAIN_LATEST.id }),
    );
  });
});
