// DEC-040 amendment (wave 70, task w70-a) coverage: the portal task-form
// POST (/portal/tasks/:assignmentId/form) previously had NO enctype and
// silently dropped any file-kind field's upload — the browser sent
// application/x-www-form-urlencoded, form-render.tsx's <input type="file">
// value never made it into the parsed body, and validate.ts's generic
// non-empty-string check let the (missing) answer sail through as
// "complete" regardless. This mirrors the public CFP submit pipeline
// (src/routes/public/submit.tsx / src/lib/submit-core.ts's
// extractFileAnswers) for file-kind fields on the portal task form: one
// putThenRecord per file, a real file row (kind 'handout', submissionId
// null), and the resulting file id written into responseJson. Repo calls
// are mocked (no D1 test harness in this repo) — same pattern as
// test/portal-task-upload-chain.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FormFieldRow } from "../src/server/repo/forms";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const FORM_ID = "form-1";
const FILE_FIELD_ID = "field-receipt";
const TEXT_FIELD_ID = "field-notes";
const NEW_FILE_ID = "file-new-1";

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

const FIELDS: FormFieldRow[] = [
  {
    id: FILE_FIELD_ID,
    formId: FORM_ID,
    section: "speaker",
    kind: "file",
    label: "Receipt or booking confirmation",
    required: false,
    position: 0,
    locked: false,
  },
  {
    id: TEXT_FIELD_ID,
    formId: FORM_ID,
    section: "speaker",
    kind: "text",
    label: "Notes",
    required: false,
    position: 1,
    locked: false,
  },
];

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    getMyTaskAssignments: vi.fn(),
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
        showResources: true,
      },
      submissions: [],
      tasks: [],
      contactName: "Speaker One",
    })),
    saveTaskFormResponse: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    listFields: vi.fn(async () => FIELDS),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    insertFile: vi.fn(async () => NEW_FILE_ID),
  };
});

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    updateAssignmentStatus: vi.fn(async () => {}),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket() {
  const put = vi.fn(async () => {});
  return {
    put,
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket & { put: ReturnType<typeof vi.fn> };
}

async function buildPortalApp(bucket: ReturnType<typeof fakeFilesBucket>) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", SPEAKER_A);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: bucket } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

function scopeFor() {
  return {
    id: ASSIGNMENT_ID,
    taskId: "task-1",
    eventId: "event-1",
    kind: "form" as const,
    formId: FORM_ID,
    deliverableKind: null,
    contactId: CONTACT_A,
    orgId: ORG_A,
    status: "pending" as const,
    fileId: null,
  };
}

function assignmentWithResponse(responseJson: string | null) {
  return {
    id: ASSIGNMENT_ID,
    taskId: "task-1",
    eventId: "event-1",
    kind: "form" as const,
    title: "Flight reimbursement form",
    description: null,
    instructions: null,
    dueDate: null,
    assignedAt: 0,
    required: true,
    status: "pending",
    formId: FORM_ID,
    deliverableKind: null,
    fileId: null,
    responseJson,
    timezone: "UTC",
    completedAt: null,
  };
}

describe("POST /portal/tasks/:assignmentId/form — DEC-040 file-kind fields", () => {
  it("(a) a multipart POST with a valid file mints one file row and completes the task", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    const { saveTaskFormResponse } = await import("../src/server/repo/portal");
    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignmentWithResponse(null)]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set(
      `field__${FILE_FIELD_ID}`,
      new File([new Uint8Array([1, 2, 3, 4])], "receipt.pdf", { type: "application/pdf" }),
    );
    form.set(`field__${TEXT_FIELD_ID}`, "some notes");

    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(302);
    expect(insertFile).toHaveBeenCalledTimes(1);
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        submissionId: null,
        kind: "handout",
        filename: "receipt.pdf",
        previousFileId: null,
        uploadedByContactId: CONTACT_A,
        // DEC-248 amendment (wave 10): links the file back to its assignment
        // so getTaskFileScope can resolve the population and serve it.
        taskAssignmentId: ASSIGNMENT_ID,
      }),
    );
    // exactly one r2 write for the one file field
    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveTaskFormResponse)).toHaveBeenCalledWith(
      expect.anything(),
      ASSIGNMENT_ID,
      CONTACT_A,
      expect.stringContaining(NEW_FILE_ID),
    );
    const savedJson = vi.mocked(saveTaskFormResponse).mock.calls[0]![3] as string;
    const saved = JSON.parse(savedJson);
    expect(saved[FILE_FIELD_ID]).toBe(NEW_FILE_ID);
    expect(vi.mocked(updateAssignmentStatus)).toHaveBeenCalledWith(
      expect.anything(),
      ASSIGNMENT_ID,
      "complete",
      SPEAKER_A.userId,
      expect.any(Date),
      CONTACT_A,
    );
  });

  it("(b) a re-submit with an empty file part carries the stored file id forward — no second file row", async () => {
    const { getAssignmentScope, getMyTaskAssignments, saveTaskFormResponse } = await import(
      "../src/server/repo/portal"
    );
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    const priorFileId = "file-prior-1";
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignmentWithResponse(JSON.stringify({ [FILE_FIELD_ID]: priorFileId })),
    ]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    // no file part selected for the file field at all — same as an
    // untouched <input type="file"> on a re-submit.
    form.set(`field__${TEXT_FIELD_ID}`, "updated notes");

    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(302);
    expect(insertFile).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
    const savedJson = vi.mocked(saveTaskFormResponse).mock.calls[0]![3] as string;
    const saved = JSON.parse(savedJson);
    expect(saved[FILE_FIELD_ID]).toBe(priorFileId);
  });

  it("(c) a disallowed-extension upload re-renders 400 on-screen, leaves the assignment not complete, and mints no file row", async () => {
    const { getAssignmentScope, getMyTaskAssignments, saveTaskFormResponse } = await import(
      "../src/server/repo/portal"
    );
    const { insertFile } = await import("../src/server/repo/files");
    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignmentWithResponse(null)]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set(
      `field__${FILE_FIELD_ID}`,
      new File([new Uint8Array([1, 2, 3, 4])], "receipt.exe", { type: "application/octet-stream" }),
    );

    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).not.toMatch(/^\s*\{/); // never the raw JSON error blob
    expect(html).toContain("field-error");
    expect(insertFile).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
    expect(saveTaskFormResponse).not.toHaveBeenCalled();
    expect(updateAssignmentStatus).not.toHaveBeenCalled();
  });
});
