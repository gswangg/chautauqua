// DEC-657 (wave 28 amendment): the speaker portal's upload refusal is a
// designed refusal, not a bare re-typed sentence. Covers:
//   (1) the 400 re-render carries the hoisted vocabulary's class names
//       (chq-field-error on the message, chq-field-invalid + aria-invalid
//       on the offending file input);
//   (2) the message wraps the raw validateUpload failure with the accepted-
//       format clause, sourced from src/domain/files.ts's own uploadHintText
//       -- never a re-typed allowlist;
//   (3) when the assignment already carries a completed file (a replace),
//       the survival line 'Your current file is unchanged. Nothing was
//       replaced.' is present too;
//   (4) no unprefixed class="field-error" survives anywhere under src/ --
//       the one vocabulary is class-name-first (DEC-124 wave-28 amendment).
//
// Repo calls mocked, same pattern as test/task-upload-content.test.ts and
// test/portal-task-upload-chain.test.ts (no D1 test harness in this repo).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { uploadHintText } from "../src/domain/files";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const TASK_EVENT_ID = "event-1";
const PRIOR_FILE_ID = "file-prior-1";

const SPEAKER: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    listDeliverableCandidates: vi.fn(async () => [
      { id: "sub-1", ref: "T-1", title: "Talk One", status: "accepted", seq: 1 },
    ]),
    getPortalData: vi.fn(async () => ({
      branding: { eventName: "Test Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    })),
    getMyTaskAssignments: vi.fn(async () => [
      {
        id: ASSIGNMENT_ID,
        title: "Finalize slides",
        description: null,
        required: true,
        dueDate: null,
        status: "pending",
        kind: "file_request",
        formId: null,
        fileId: null,
        responseJson: null,
      },
    ]),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getReplacesTarget: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildPortalApp() {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", SPEAKER);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

function scopeFor(fileId: string | null) {
  return {
    id: ASSIGNMENT_ID,
    taskId: "task-1",
    eventId: TASK_EVENT_ID,
    kind: "file_request" as const,
    formId: null,
    deliverableKind: "presentation",
    contactId: CONTACT_A,
    orgId: ORG_A,
    status: fileId ? ("complete" as const) : ("pending" as const),
    fileId,
  };
}

async function postDisallowedUpload(): Promise<Response> {
  const app = await buildPortalApp();
  const form = new FormData();
  form.set("chq_csrf", "tok-1");
  form.set("file", new File(["not a deliverable"], "malware.exe", { type: "application/octet-stream" }));
  return app.request(
    new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
      method: "POST",
      headers: { cookie: "chq_csrf=tok-1" },
      body: form,
    }),
  );
}

describe("POST /portal/tasks/:assignmentId/upload -- designed refusal (DEC-657 wave-28 amendment)", () => {
  it("first upload (no prior file): 400 re-render carries chq-field-error + chq-field-invalid + the accepted-format clause, no survival line", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor(null));

    const res = await postDisallowedUpload();
    expect(res.status).toBe(400);
    const html = await res.text();

    expect(html).toContain("chq-field-error");
    expect(html).toContain("chq-field-invalid");
    expect(html).toContain('aria-invalid="true"');
    // The accepted-format clause is sourced from domain/files.ts's own
    // uploadHintText -- never a re-typed copy of the allowlist.
    expect(html).toContain(uploadHintText("presentation"));
    expect(html).not.toContain("Your current file is unchanged. Nothing was replaced.");
  });

  it("replace (assignment already has a completed file): the refusal also says what survived", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { getReplacesTarget } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor(PRIOR_FILE_ID));
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: null, kind: "presentation" });

    const res = await postDisallowedUpload();
    expect(res.status).toBe(400);
    const html = await res.text();

    expect(html).toContain("chq-field-error");
    expect(html).toContain("chq-field-invalid");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(uploadHintText("presentation"));
    expect(html).toContain("Your current file is unchanged. Nothing was replaced.");
  });

  it("no file selected: the refusal is a plain sentence, not the bare fragment 'file is required'", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor(null));

    const app = await buildPortalApp();
    const form = new FormData();
    form.set("chq_csrf", "tok-2");
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-2" },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Choose a file first");
    expect(html).not.toMatch(/>\s*file is required\s*</);
  });
});

describe("no unprefixed class=\"field-error\" survives anywhere under src/ (DEC-657/DEC-124 hoist)", () => {
  function allTsxFiles(root: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      out.push(join(entry.parentPath, entry.name));
    }
    return out;
  }

  it("every field-error class attribute is prefixed chq-field-error", () => {
    const offenders: string[] = [];
    for (const filePath of allTsxFiles(SRC)) {
      const text = readFileSync(filePath, "utf-8");
      if (/class="field-error"/.test(text)) offenders.push(filePath);
    }
    expect(offenders, `unprefixed class="field-error" found in:\n${offenders.join("\n")}`).toEqual([]);
  });
});
