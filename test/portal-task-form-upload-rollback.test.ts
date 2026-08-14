// DEC-040 amendment (wave 74, task w6-c) coverage: a portal task-form POST
// (/portal/tasks/:assignmentId/form) that uploads N files but then fails
// validateAnswers (or has a fileErrors entry) must not leave any of THIS
// request's already-uploaded files behind — mirrors the public CFP submit
// pipeline's rollback (src/routes/public/submit.tsx). Repo calls are mocked
// (no D1 test harness in this repo) — same pattern as
// test/portal-task-form-files.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FormFieldRow } from "../src/server/repo/forms";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const FORM_ID = "form-1";
const FILE_FIELD_1 = "field-receipt";
const FILE_FIELD_2 = "field-photo";
const TEXT_FIELD_ID = "field-notes";
const NEW_FILE_ID = "file-new-1";

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

const TWO_FILE_FIELDS: FormFieldRow[] = [
  {
    id: FILE_FIELD_1,
    formId: FORM_ID,
    section: "speaker",
    kind: "file",
    label: "Receipt",
    required: false,
    position: 0,
    locked: false,
  },
  {
    id: FILE_FIELD_2,
    formId: FORM_ID,
    section: "speaker",
    kind: "file",
    label: "Photo ID",
    required: true,
    position: 1,
    locked: false,
  },
];

const ONE_FILE_WITH_TEXT_FIELDS: FormFieldRow[] = [
  {
    id: FILE_FIELD_1,
    formId: FORM_ID,
    section: "speaker",
    kind: "file",
    label: "Receipt",
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
    required: true,
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
    listFields: vi.fn(),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    insertFile: vi.fn(async () => NEW_FILE_ID),
  };
});

vi.mock("../src/server/repo/portal-config", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-config")>(
    "../src/server/repo/portal-config",
  );
  return {
    ...actual,
    deleteFileRow: vi.fn(async () => {}),
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
  const del = vi.fn(async () => {});
  return {
    put,
    async get() {
      return null;
    },
    delete: del,
  } as unknown as R2Bucket & { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
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

describe("POST /portal/tasks/:assignmentId/form — DEC-040 failed-submit rollback", () => {
  it("a two-file form where the second (required) file field fails validation rolls back the first field's upload", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { listFields } = await import("../src/server/repo/forms");
    const { insertFile } = await import("../src/server/repo/files");
    const { deleteFileRow } = await import("../src/server/repo/portal-config");
    const { saveTaskFormResponse } = await import("../src/server/repo/portal");
    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    vi.mocked(listFields).mockResolvedValue(TWO_FILE_FIELDS);
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignmentWithResponse(null)]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set(
      `field__${FILE_FIELD_1}`,
      new File([new Uint8Array([1, 2, 3, 4])], "receipt.pdf", { type: "application/pdf" }),
    );
    // FILE_FIELD_2 is required but no file part is sent for it — validateAnswers
    // must reject this request naming that field.

    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("field-error");

    // the first field's upload happened (it validated fine) before the
    // second field's required-ness failure was discovered downstream...
    expect(insertFile).toHaveBeenCalledTimes(1);
    expect(bucket.put).toHaveBeenCalledTimes(1);

    // ...but the failure must roll it back: the R2 object and the file row
    // this request just wrote are both deleted before the 400 renders.
    expect(bucket.delete).toHaveBeenCalledTimes(1);
    expect(deleteFileRow).toHaveBeenCalledTimes(1);
    expect(deleteFileRow).toHaveBeenCalledWith(expect.anything(), NEW_FILE_ID);

    expect(saveTaskFormResponse).not.toHaveBeenCalled();
    expect(updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it("a carried-forward prior file id is never deleted when an unrelated required field fails validation", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { listFields } = await import("../src/server/repo/forms");
    const { insertFile } = await import("../src/server/repo/files");
    const { deleteFileRow } = await import("../src/server/repo/portal-config");
    const { saveTaskFormResponse } = await import("../src/server/repo/portal");
    vi.mocked(listFields).mockResolvedValue(ONE_FILE_WITH_TEXT_FIELDS);
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    const priorFileId = "file-prior-1";
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignmentWithResponse(JSON.stringify({ [FILE_FIELD_1]: priorFileId })),
    ]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    // no new file part for the file field at all — carries the prior id
    // forward. The required text field is left blank, which fails
    // validateAnswers and must 400.

    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(400);

    // no new upload happened this request, so nothing to roll back...
    expect(insertFile).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();

    // ...and in particular the PRIOR file (carried forward, not written by
    // this request) must never be touched by the rollback.
    expect(bucket.delete).not.toHaveBeenCalled();
    expect(deleteFileRow).not.toHaveBeenCalled();
    expect(saveTaskFormResponse).not.toHaveBeenCalled();
  });
});
