// DEC-170 amendment (wave 72): authzSubmissionWrite composed
// authzSubmissionRead — which admits an in-scope reviewer via
// reviewerCanAccessSubmissionFile — and added ONLY the speaker edit-lock,
// silently inheriting the read predicate for POST /api/v1/submissions/:id/files.
// A reviewer assigned to a non-anonymized plan covering the submission could
// therefore upload a deliverable version, which reopenContentReview flips
// approved/changes_requested -> pending, dropping the session (and its
// speakers) off every public surface. authzFileWrite already refused
// reviewers outright for its own write paths; authzSubmissionWrite now does
// the same. Route wiring under test — repo calls are mocked, same pattern as
// test/files-reviewer-scope.test.ts and test/reviewer-file-access.test.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_ID = "event-1";
const IN_SCOPE_SUB = "sub-1";
const ASSIGNED_REVIEWER = "rev-assigned";

let currentContentStatus = "approved";

const submissionScope = {
  submissionId: IN_SCOPE_SUB,
  eventId: EVENT_ID,
  orgId: ORG_A,
  readParticipantContactIds: ["contact-speaker"],
  activeParticipantContactIds: ["contact-speaker"],
  status: "accepted",
  formCloseDate: null as number | null,
  timezone: "UTC",
};

const reopenContentReviewMock = vi.fn(async (_db: unknown, _eventId: string, submissionId: string) => {
  if (submissionId === IN_SCOPE_SUB) {
    currentContentStatus = "pending";
    return { reopened: true };
  }
  return { reopened: false };
});
const insertFileMock = vi.fn(async () => "file-new");

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === IN_SCOPE_SUB ? submissionScope : null,
    ),
    reviewerCanAccessSubmissionFile: vi.fn(
      async (_db: unknown, userId: string, eventId: string, submissionId: string) =>
        userId === ASSIGNED_REVIEWER && eventId === EVENT_ID && submissionId === IN_SCOPE_SUB,
    ),
    listSubmissionFiles: vi.fn(async () => ({})),
    batchContactNames: vi.fn(async () => new Map<string, string>()),
    insertFile: insertFileMock,
    reopenContentReview: reopenContentReviewMock,
  };
});

function fakeFilesBucket() {
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
}

afterEach(() => {
  vi.clearAllMocks();
  currentContentStatus = "approved";
});

async function buildApiApp(auth: AuthInfo) {
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

function uploadForm() {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([1, 2, 3])], "slides.pdf", { type: "application/pdf" }));
  form.set("kind", "presentation");
  return form;
}

describe("DEC-170 (wave 72): a reviewer may read but not write submission files", () => {
  it("GET /api/v1/submissions/:id/files still 200s an in-scope reviewer", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${IN_SCOPE_SUB}/files`);
    expect(res.status).toBe(200);
  });

  it("POST /api/v1/submissions/:id/files 403s the same in-scope reviewer", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(
      new Request(`http://test.local/api/v1/submissions/${IN_SCOPE_SUB}/files`, {
        method: "POST",
        headers: { "x-chq-csrf": "1" },
        body: uploadForm(),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toBe("Reviewers may not modify files");
  });

  it("the refused reviewer POST never reaches reopenContentReview — content_status is untouched", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    expect(currentContentStatus).toBe("approved");
    const res = await app.request(
      new Request(`http://test.local/api/v1/submissions/${IN_SCOPE_SUB}/files`, {
        method: "POST",
        headers: { "x-chq-csrf": "1" },
        body: uploadForm(),
      }),
    );
    expect(res.status).toBe(403);
    expect(insertFileMock).not.toHaveBeenCalled();
    expect(reopenContentReviewMock).not.toHaveBeenCalled();
    expect(currentContentStatus).toBe("approved");
  });

  it("an organizer POST still 201s and reopens content review", async () => {
    const app = await buildApiApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
    const res = await app.request(
      new Request(`http://test.local/api/v1/submissions/${IN_SCOPE_SUB}/files`, {
        method: "POST",
        headers: { "x-chq-csrf": "1" },
        body: uploadForm(),
      }),
    );
    expect(res.status).toBe(201);
    expect(reopenContentReviewMock).toHaveBeenCalledWith(expect.anything(), EVENT_ID, IN_SCOPE_SUB);
    expect(currentContentStatus).toBe("pending");
  });
});

// Source scan: every authz*Write helper in src/routes/files.ts must contain
// an explicit reviewer refusal — a future write helper composed from a read
// predicate (like authzSubmissionRead) must not silently inherit reviewer
// access the way authzSubmissionWrite did before this fix.
describe("source scan: every authz*Write helper explicitly refuses reviewers", () => {
  it("finds each authz*Write(...) function body and asserts a reviewer refusal", () => {
    const source = readFileSync(join(__dirname, "..", "src", "routes", "files.ts"), "utf8");
    const helperNameRe = /async function (authz\w*Write)\(/g;
    const names: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = helperNameRe.exec(source))) {
      names.push(m[1]!);
    }
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      const start = source.indexOf(`async function ${name}(`);
      expect(start).toBeGreaterThanOrEqual(0);
      const braceStart = source.indexOf("{", start);
      let depth = 0;
      let end = braceStart;
      for (let i = braceStart; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = source.slice(braceStart, end + 1);
      expect(body).toContain('auth.role === "reviewer"');
    }
  });
});
