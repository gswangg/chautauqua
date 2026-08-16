// DEC-547 wave-62 amendment: POST /api/v1/submissions/:id/content-note must
// resolve pure env/config reads on its send path BEFORE the first durable
// write (insertFileComment / updateContentStatus), so an unconfigured
// deployment refuses loudly with nothing committed instead of writing the
// note/status move first and only then 500ing. resolvePortalLinks (a KV
// call) stays AFTER the write, but a failure there must land inside the
// {sent, failed, recipients} 200 envelope rather than surfacing as a 500 --
// the write already happened and cannot be undone (DEC-547). Mocking
// pattern mirrors test/content-note.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import type { SubmissionScope, FileScope } from "../src/server/repo/files-authz";

const SUBMISSION_SCOPE: SubmissionScope = {
  submissionId: "sub-1",
  eventId: "evt-1",
  orgId: "org-1",
  readParticipantContactIds: ["ct-good"],
  activeParticipantContactIds: ["ct-good"],
  status: "accepted",
  formCloseDate: null,
  timezone: "America/New_York",
};

const FILE_SCOPE: FileScope = {
  fileId: "file-1",
  submissionId: "sub-1",
  eventId: "evt-1",
  orgId: "org-1",
  uploadedByContactId: "ct-good",
  readParticipantContactIds: ["ct-good"],
  activeParticipantContactIds: ["ct-good"],
  filename: "deck.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/file-1-deck.pdf",
};

const composeSubmission = {
  id: "sub-1",
  title: "On Engines",
  participants: [{ contactId: "ct-good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" }],
};

const insertFileCommentCalls: { fileId: string; body: string }[] = [];
const updateContentStatusCalls: { submissionId: string; contentStatus: string }[] = [];

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) => (submissionId === "sub-1" ? SUBMISSION_SCOPE : null)),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => (fileId === "file-1" ? FILE_SCOPE : null)),
    insertFileComment: vi.fn(async (_db: unknown, input: { fileId: string; body: string }) => {
      insertFileCommentCalls.push(input);
      return "comment-1";
    }),
    updateContentStatus: vi.fn(async (_db: unknown, _eventId: string, submissionId: string, contentStatus: string) => {
      updateContentStatusCalls.push({ submissionId, contentStatus });
    }),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      orgId === "org-1" && eventId === "evt-1" ? { id: eventId, name: "The Event" } : null,
    ),
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async (_db: unknown, _eventId: string, submissionIds: string[]) =>
      submissionIds.includes("sub-1") ? [composeSubmission] : [],
    ),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
  };
});

const resolvePortalLinksMock = vi.fn();
vi.mock("../src/server/repo/portal-link", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-link")>("../src/server/repo/portal-link");
  return {
    ...actual,
    resolvePortalLinks: resolvePortalLinksMock,
  };
});

const mailerSend = vi.fn(async () => {});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: mailerSend })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  insertFileCommentCalls.length = 0;
  updateContentStatusCalls.length = 0;
});

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

const ORGANIZER: AuthInfo = { userId: "org-user-1", role: "organizer", orgId: "org-1" };

async function buildApp(auth: AuthInfo, env: Record<string, unknown>) {
  const { contentNoteRoutes } = await import("../src/routes/content-notes");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), KV: new InMemoryKV() as never, ...env } as never;
    await next();
  });
  app.route("/api/v1", contentNoteRoutes);
  return app;
}

function postNote(app: Hono<AppEnv>, submissionId: string, body: Record<string, unknown>) {
  return app.request(`https://events.example.com/api/v1/submissions/${submissionId}/content-note`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/submissions/:id/content-note write ordering (DEC-547 wave-62 amendment)", () => {
  it("refuses BEFORE any write when PUBLIC_BASE_URL is unset outside dev — no comment row, content_status unchanged", async () => {
    // DEV_MODE unset/not "1" and no PUBLIC_BASE_URL forces resolveBaseUrl
    // down its non-dev throwing branch (src/server/origin.ts:123-127).
    const app = await buildApp(ORGANIZER, { PUBLIC_BASE_URL: undefined, DEV_MODE: undefined });
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "Please fix the font size.", requestChanges: true });

    expect(res.status).toBe(500);
    expect(insertFileCommentCalls).toHaveLength(0);
    expect(updateContentStatusCalls).toHaveLength(0);
    expect(resolvePortalLinksMock).not.toHaveBeenCalled();
    expect(mailerSend).not.toHaveBeenCalled();
  });

  it("commits the write and reports 200 with every participant in `failed` when resolvePortalLinks throws (KV failure)", async () => {
    resolvePortalLinksMock.mockRejectedValueOnce(new Error("KV unavailable"));
    const app = await buildApp(ORGANIZER, { PUBLIC_BASE_URL: "https://events.example.com" });
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "Please fix the font size.", requestChanges: true });

    expect(res.status).toBe(200);
    const responseBody = (await res.json()) as { sent: number; failed: { email: string; message: string }[]; recipients: number };

    // The note + status move are durable regardless of the later KV failure.
    expect(insertFileCommentCalls).toHaveLength(1);
    expect(updateContentStatusCalls).toHaveLength(1);
    expect(updateContentStatusCalls[0]).toEqual({ submissionId: "sub-1", contentStatus: "changes_requested" });

    expect(responseBody.sent).toBe(0);
    expect(responseBody.recipients).toBe(1);
    expect(responseBody.failed).toHaveLength(1);
    expect(responseBody.failed[0]?.email).toBe("good@example.com");
    expect(responseBody.failed[0]?.message).toContain("KV unavailable");
    expect(mailerSend).not.toHaveBeenCalled();
  });
});
