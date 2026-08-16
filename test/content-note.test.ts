// DEC-720/DEC-741 route coverage for POST /api/v1/submissions/:id/content-note:
// (a) the comment row is written to the DEC-573 chain thread, (b) content_status
// only flips when requestChanges is true (never 'approved'), (c) one mailer
// send per active-invite recipient with the note body present, (d) a failing
// recipient does not abort the batch and appears in `failed`. Mocking pattern
// mirrors test/files-delete-route.test.ts (repo mocked) and
// test/comms-send-mailer-failure.test.ts (mailer mocked via server/context).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import type { SubmissionScope, FileScope } from "../src/server/repo/files-authz";

// status/formCloseDate/timezone feed the DEC-041 speaker edit-lock in
// authzSubmissionWrite; content-note is organizer-only, so they are inert
// here — set to an open (editable) submission so they never mask a 403.
const SUBMISSION_SCOPE: SubmissionScope = {
  submissionId: "sub-1",
  eventId: "evt-1",
  orgId: "org-1",
  readParticipantContactIds: ["ct-good", "ct-bad"],
  activeParticipantContactIds: ["ct-good", "ct-bad"],
  status: "accepted",
  formCloseDate: null,
  timezone: "America/New_York",
};

// Belongs to org-1 — used to prove an org-2 organizer is forbidden, not
// merely a 404 for an unrecognized id.
const OTHER_ORG_SCOPE: SubmissionScope = {
  submissionId: "sub-2",
  eventId: "evt-2",
  orgId: "org-1",
  readParticipantContactIds: [],
  activeParticipantContactIds: [],
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
  readParticipantContactIds: ["ct-good", "ct-bad"],
  activeParticipantContactIds: ["ct-good", "ct-bad"],
  filename: "deck.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/file-1-deck.pdf",
};

const composeSubmission = {
  id: "sub-1",
  title: "On Engines",
  participants: [
    { contactId: "ct-good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" },
    { contactId: "ct-bad", firstName: "Grace", lastName: "Hopper", email: "bad@example.com" },
  ],
};

const insertFileCommentCalls: { fileId: string; body: string; authorUserId: string; authorContactId: string | null }[] = [];
const updateContentStatusCalls: { submissionId: string; contentStatus: string }[] = [];

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === "sub-1" ? SUBMISSION_SCOPE : submissionId === "sub-2" ? OTHER_ORG_SCOPE : null,
    ),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => (fileId === "file-1" ? FILE_SCOPE : null)),
    insertFileComment: vi.fn(async (_db: unknown, input: { fileId: string; body: string; authorUserId: string; authorContactId: string | null }) => {
      insertFileCommentCalls.push(input);
      return "comment-1";
    }),
    updateContentStatus: vi.fn(async (_db: unknown, _eventId: string, submissionId: string, contentStatus: string) => {
      updateContentStatusCalls.push({ submissionId, contentStatus });
    }),
  };
});

// B9 (DEC-037 amendment, wave 27): the note-reply route now looks up the
// owning event's name for the shell's wordmark/footer via getEventForOrg --
// mocked here since this test's db is a bare `{}` fake (no drizzle behind
// it).
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      orgId === "org-1" && (eventId === "evt-1" || eventId === "evt-2") ? { id: eventId, name: "The Event" } : null,
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

const sentMails: { to: { email: string }; subject: string; text: string; eventId: string; contactId: string | null }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; subject: string; text: string; eventId: string; contactId: string | null }) => {
        if (mail.to.email === "bad@example.com") {
          throw new Error("simulated provider rejection");
        }
        sentMails.push(mail);
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
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
const OTHER_ORG_ORGANIZER: AuthInfo = { userId: "org-user-2", role: "organizer", orgId: "org-2" };
const SPEAKER: AuthInfo = { userId: "speaker-user-1", role: "speaker", orgId: "org-1", contactId: "ct-good" };

async function buildApp(auth: AuthInfo) {
  const { contentNoteRoutes } = await import("../src/routes/content-notes");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), KV: new InMemoryKV() as never, PUBLIC_BASE_URL: "https://events.example.com" } as never;
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

describe("POST /api/v1/submissions/:id/content-note (DEC-720/DEC-741)", () => {
  it("writes the comment row, flips status when requestChanges, and sends to the good recipient (bad recipient fails and is reported)", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "Please fix the font size.", requestChanges: true });

    expect(res.status).toBe(200);
    const responseBody = (await res.json()) as { sent: number; failed: { email: string; message: string }[] };

    // (a) comment row written to the chain thread.
    expect(insertFileCommentCalls).toHaveLength(1);
    expect(insertFileCommentCalls[0]?.fileId).toBe("file-1");
    expect(insertFileCommentCalls[0]?.body).toBe("Please fix the font size.");

    // (b) status flips because requestChanges was true.
    expect(updateContentStatusCalls).toHaveLength(1);
    expect(updateContentStatusCalls[0]).toEqual({ submissionId: "sub-1", contentStatus: "changes_requested" });

    // (c) one mailer send per recipient with the note body present.
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]?.to.email).toBe("good@example.com");
    expect(sentMails[0]?.text).toContain("Please fix the font size.");
    expect(sentMails[0]?.eventId).toBe("evt-1");
    expect(sentMails[0]?.contactId).toBe("ct-good");

    // (d) the failing recipient doesn't abort the batch — it's reported.
    expect(responseBody.sent).toBe(1);
    expect(responseBody.failed).toHaveLength(1);
    expect(responseBody.failed[0]?.email).toBe("bad@example.com");
    expect(responseBody.failed[0]?.message).toContain("simulated provider rejection");
  });

  it("never flips content_status when requestChanges is false, and never sets 'approved'", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "Just a heads up.", requestChanges: false });

    expect(res.status).toBe(200);
    expect(insertFileCommentCalls).toHaveLength(1);
    expect(updateContentStatusCalls).toHaveLength(0);
    for (const call of updateContentStatusCalls) {
      expect(call.contentStatus).not.toBe("approved");
    }
  });

  it("400s with a field-shaped error when fileId is missing", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-1", { body: "hi", requestChanges: false });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.fileId).toBeDefined();
  });

  it("400s when fileId does not belong to the submission", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-1", { fileId: "file-unknown", body: "hi", requestChanges: false });
    expect(res.status).toBe(400);
  });

  it("404s an organizer from a different org (existence-hiding, never 403)", async () => {
    const app = await buildApp(OTHER_ORG_ORGANIZER);
    const res = await postNote(app, "sub-2", { fileId: "file-1", body: "hi", requestChanges: false });
    expect(res.status).toBe(404);
  });

  it("403s a speaker (organizer-only endpoint)", async () => {
    const app = await buildApp(SPEAKER);
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "hi", requestChanges: false });
    expect(res.status).toBe(403);
  });

  it("404s an unknown submission", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-missing", { fileId: "file-1", body: "hi", requestChanges: false });
    expect(res.status).toBe(404);
  });

  // DEC-244 wave-58 amendment: the content-note body writes to the SAME
  // file_comment row /files/:fileId/comments POST writes, so it shares that
  // route's MAX_COMMENT_BODY_LENGTH (4000) cap, not forms/validate's
  // MAX_LONG_TEXT_LENGTH (20000).
  it("400s a body over MAX_COMMENT_BODY_LENGTH, counting the overage and marking fields.body", async () => {
    const { MAX_COMMENT_BODY_LENGTH } = await import("../src/domain/files");
    const app = await buildApp(ORGANIZER);
    const overBody = "x".repeat(MAX_COMMENT_BODY_LENGTH + 1);
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: overBody, requestChanges: false });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toContain("1");
    expect(body.error.message).toContain(MAX_COMMENT_BODY_LENGTH.toLocaleString("en-US"));
    expect(body.error.fields?.body).toBeDefined();
    expect(insertFileCommentCalls).toHaveLength(0);
  });
});
