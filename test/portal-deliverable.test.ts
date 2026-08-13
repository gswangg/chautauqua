// DEC-242/DEC-244 coverage (tasks w1-f, w2-a): speaker-side deliverable
// self-service — a completed file_request assignment renders the current
// CHAIN-LATEST file's download link (dedicated portal route), a
// replace-file form, and its comment thread (read + reply) on
// /portal/tasks, gated strictly by assignment ownership so a speaker can
// only ever reach their own assignment's file/thread. Repo calls are mocked
// (no D1 test harness in this repo) — same pattern as
// test/task-upload-content.test.ts. See also
// test/portal-deliverable-panel.test.ts for the new GET .../file route,
// chain-latest resolution, and comment-cap coverage.

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
  id: FILE_ID,
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
    getMyTaskAssignments: vi.fn(),
    getPortalData: vi.fn(async () => ({
      branding: { eventName: "Demo Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    })),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    resolveTaskFileChainLatest: vi.fn(),
    getFileVersionNumber: vi.fn(async () => 2),
    listFileComments: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 1 })),
    listFileChainVersions: vi.fn(async () => [CHAIN_LATEST]),
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
    c.env = { ...(c.env ?? {}) } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };
const SPEAKER_B: AuthInfo = { userId: "u2", role: "speaker", orgId: ORG_A, contactId: CONTACT_B };

describe("GET /portal/tasks — completed file_request assignment (DEC-242)", () => {
  it("renders the download link, replace-file form, version, and comment thread instead of collapsing to plain text", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { resolveTaskFileChainLatest, listFileComments } = await import("../src/server/repo/files");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      {
        id: ASSIGNMENT_ID,
        taskId: "task-1",
        eventId: TASK_EVENT_ID,
        kind: "file_request",
        title: "Upload slides",
        description: null,
        dueDate: null,
        assignedAt: 0,
        required: true,
        status: "complete",
        formId: null,
        deliverableKind: null,
        fileId: FILE_ID,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
    ]);
    vi.mocked(resolveTaskFileChainLatest).mockResolvedValue(CHAIN_LATEST);
    vi.mocked(listFileComments).mockResolvedValue({
      items: [
        {
          id: "c1",
          fileId: FILE_ID,
          versionNumber: 2,
          body: "Looks great",
          authorName: "Pat Organizer",
          authorRole: "organizer",
          authorUserId: "user-organizer",
          createdAt: Date.now(),
        },
      ],
      total: 1,
      page: 1,
      perPage: 1,
    });

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request("http://test.local/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // download link through the dedicated portal deliverable route (DEC-244)
    expect(html).toContain(`href="/portal/tasks/${ASSIGNMENT_ID}/file"`);
    expect(html).toContain("slides-v2.pdf");
    // version history derived from the chain length
    expect(html).toContain("version 2");
    // replace form re-posts to the existing upload endpoint
    expect(html).toContain(`action="/portal/tasks/${ASSIGNMENT_ID}/upload"`);
    expect(html).toContain("Replace file");
    // comment thread: existing comment rendered + reply form
    expect(html).toContain("Looks great");
    expect(html).toContain("Pat Organizer");
    expect(html).toContain(`action="/portal/tasks/${ASSIGNMENT_ID}/comments"`);
  });
});

describe("POST /portal/tasks/:assignmentId/comments (DEC-242)", () => {
  it("persists a reply and redirects", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { resolveTaskFileChainLatest, insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(resolveTaskFileChainLatest).mockResolvedValue(CHAIN_LATEST);

    const app = await buildPortalApp(SPEAKER_A);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set("body", "Here's an updated version, thanks!");
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/comments`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/tasks");
    expect(insertFileComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        fileId: FILE_ID,
        body: "Here's an updated version, thanks!",
        authorUserId: SPEAKER_A.userId,
        authorContactId: CONTACT_A,
      }),
    );
  });

  it("404/403s speaker B probing speaker A's assignment comments — no IDOR (DEC-175 existence-hiding)", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFileComment } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);

    const app = await buildPortalApp(SPEAKER_B);
    const form = new FormData();
    form.set("chq_csrf", "tok-2");
    form.set("body", "I shouldn't be able to see this thread");
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/comments`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-2" },
        body: form,
      }),
    );

    expect([403, 404]).toContain(res.status);
    expect(insertFileComment).not.toHaveBeenCalled();
  });

  it("404s an unknown assignment id", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(null);

    const app = await buildPortalApp(SPEAKER_A);
    const form = new FormData();
    form.set("chq_csrf", "tok-3");
    form.set("body", "hello");
    const res = await app.request(
      new Request("http://test.local/portal/tasks/does-not-exist/comments", {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-3" },
        body: form,
      }),
    );

    expect(res.status).toBe(404);
  });
});
