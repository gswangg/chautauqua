// w30-a (DEC-317/DEC-720 wave-30 amendment): zero active-invite recipients
// is no longer a hard 400 for POST /api/v1/submissions/:id/content-note --
// the note write and the optional status move are durable regardless of who
// can be mailed. Mocking pattern mirrors test/content-note.test.ts.

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
  uploadedByContactId: null as unknown as string,
  readParticipantContactIds: [],
  activeParticipantContactIds: [],
  filename: "deck.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/file-1-deck.pdf",
};

// Second submission fixture proving the WITH-participants path is unchanged.
const WITH_PARTICIPANTS_SCOPE: SubmissionScope = {
  submissionId: "sub-2",
  eventId: "evt-1",
  orgId: "org-1",
  readParticipantContactIds: ["ct-good"],
  activeParticipantContactIds: ["ct-good"],
  status: "accepted",
  formCloseDate: null,
  timezone: "America/New_York",
};

const FILE_SCOPE_2: FileScope = {
  fileId: "file-2",
  submissionId: "sub-2",
  eventId: "evt-1",
  orgId: "org-1",
  uploadedByContactId: "ct-good",
  readParticipantContactIds: ["ct-good"],
  activeParticipantContactIds: ["ct-good"],
  filename: "deck2.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-2/file-2-deck.pdf",
};

const composeSubmissionWithParticipants = {
  id: "sub-2",
  title: "On Compilers",
  participants: [{ contactId: "ct-good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" }],
};

const insertFileCommentCalls: { fileId: string; body: string; authorUserId: string; authorContactId: string | null }[] = [];
const updateContentStatusCalls: { submissionId: string; contentStatus: string }[] = [];

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === "sub-1" ? SUBMISSION_SCOPE : submissionId === "sub-2" ? WITH_PARTICIPANTS_SCOPE : null,
    ),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) =>
      fileId === "file-1" ? FILE_SCOPE : fileId === "file-2" ? FILE_SCOPE_2 : null,
    ),
    insertFileComment: vi.fn(async (_db: unknown, input: { fileId: string; body: string; authorUserId: string; authorContactId: string | null }) => {
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
    // sub-1 resolves to no compose row at all (the "missing row" branch);
    // sub-2 resolves to a row with one active-invite participant.
    loadComposeSubmissions: vi.fn(async (_db: unknown, _eventId: string, submissionIds: string[]) =>
      submissionIds.includes("sub-2") ? [composeSubmissionWithParticipants] : [],
    ),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
  };
});

const sentMails: { to: { email: string }; subject: string; text: string; eventId: string; contactId: string | null }[] = [];
const mailerSend = vi.fn(async (mail: { to: { email: string }; subject: string; text: string; eventId: string; contactId: string | null }) => {
  sentMails.push(mail);
});
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: mailerSend })),
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

describe("POST /api/v1/submissions/:id/content-note with zero recipients (DEC-317/DEC-720 wave-30 amendment)", () => {
  it("still inserts the comment and flips content_status, returning 200 with recipients:0 and sent:0, no mailer call", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "Nobody to notify yet.", requestChanges: true });

    expect(res.status).toBe(200);
    const responseBody = (await res.json()) as { sent: number; failed: unknown[]; recipients: number };

    expect(insertFileCommentCalls).toHaveLength(1);
    expect(insertFileCommentCalls[0]?.fileId).toBe("file-1");
    expect(insertFileCommentCalls[0]?.body).toBe("Nobody to notify yet.");

    expect(updateContentStatusCalls).toHaveLength(1);
    expect(updateContentStatusCalls[0]).toEqual({ submissionId: "sub-1", contentStatus: "changes_requested" });

    expect(responseBody).toEqual({ sent: 0, failed: [], recipients: 0 });
    expect(mailerSend).not.toHaveBeenCalled();
    expect(sentMails).toHaveLength(0);
  });

  it("still works with requestChanges false (no status flip) and zero recipients", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-1", { fileId: "file-1", body: "Just a note.", requestChanges: false });

    expect(res.status).toBe(200);
    const responseBody = (await res.json()) as { sent: number; failed: unknown[]; recipients: number };
    expect(insertFileCommentCalls).toHaveLength(1);
    expect(updateContentStatusCalls).toHaveLength(0);
    expect(responseBody).toEqual({ sent: 0, failed: [], recipients: 0 });
    expect(mailerSend).not.toHaveBeenCalled();
  });

  it("leaves the existing WITH-participants behaviour unchanged: note + status + one send per participant, recipients counted", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await postNote(app, "sub-2", { fileId: "file-2", body: "Please fix the font.", requestChanges: true });

    expect(res.status).toBe(200);
    const responseBody = (await res.json()) as { sent: number; failed: unknown[]; recipients: number };

    expect(insertFileCommentCalls).toHaveLength(1);
    expect(updateContentStatusCalls).toHaveLength(1);
    expect(updateContentStatusCalls[0]).toEqual({ submissionId: "sub-2", contentStatus: "changes_requested" });

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]?.to.email).toBe("good@example.com");
    expect(responseBody).toEqual({ sent: 1, failed: [], recipients: 1 });
  });
});
