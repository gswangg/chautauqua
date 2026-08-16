// DEC-422/DEC-598 (wave-10 amendment): a repeated `field_<id>` part under
// parseBody({all:true}) (an array, e.g. a hand-crafted request or a doubled
// <input name>) must be REFUSED, never merged into "a,b" (the old
// `typeof raw === "string" ? raw : String(raw)` behaviour) and never
// silently dropped (the old `raw instanceof File` check on a File[], always
// false). Covers the shared pure-core primitives plus all three answer-
// extraction doors: public CFP save-draft, portal submission edit, and
// portal task form.

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import {
  readSingleFormValue,
  readSingleFilePart,
  extractFileAnswers,
  REPEATED_ANSWER_MESSAGE,
} from "../src/lib/submit-core";
import { extractAnswers as publicExtractAnswers, extractTrackIds } from "../src/routes/public/submit-body";
import { extractAnswers as portalEditExtractAnswers } from "../src/routes/portal/edit";
import type { FormFieldDef } from "../src/forms/types";
import { fieldInputName } from "../src/views/form-render";
import { publicSubmitRoutes } from "../src/routes/public/submit";

// ---------------------------------------------------------------------------
// Pure-core primitives
// ---------------------------------------------------------------------------

describe("readSingleFormValue (DEC-422/DEC-598)", () => {
  it("refuses an array-shaped (repeated) part instead of stringifying it", () => {
    const result = readSingleFormValue(["a", "b"]);
    expect(result.ok).toBe(false);
  });

  it("accepts a single string value unchanged", () => {
    const result = readSingleFormValue("hello");
    expect(result).toEqual({ ok: true, value: "hello" });
  });

  it("treats an absent value as present-but-undefined, not a refusal", () => {
    const result = readSingleFormValue(undefined);
    expect(result).toEqual({ ok: true, value: undefined });
  });
});

describe("readSingleFilePart (DEC-422/DEC-598)", () => {
  it("refuses a File[] (repeated file part) instead of silently dropping it", () => {
    const f1 = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    const f2 = new File([new Uint8Array([2])], "b.pdf", { type: "application/pdf" });
    const result = readSingleFilePart([f1, f2]);
    expect(result.ok).toBe(false);
  });

  it("accepts a single valid File", () => {
    const f = new File([new Uint8Array([1, 2, 3])], "receipt.pdf", { type: "application/pdf" });
    const result = readSingleFilePart(f);
    expect(result).toEqual({ ok: true, file: f });
  });

  it("treats nothing-selected as file: null, not a refusal", () => {
    const result = readSingleFilePart(undefined);
    expect(result).toEqual({ ok: true, file: null });
  });
});

describe("extractFileAnswers repeatedFieldIds (DEC-422/DEC-598)", () => {
  it("collects a repeated file field id in repeatedFieldIds instead of dropping it silently", () => {
    const f1 = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    const f2 = new File([new Uint8Array([2])], "b.pdf", { type: "application/pdf" });
    const { files, repeatedFieldIds } = extractFileAnswers(
      ["receipt"],
      (id) => `field__${id}`,
      { field__receipt: [f1, f2] },
    );
    expect(files.receipt).toBeUndefined();
    expect(repeatedFieldIds).toEqual(["receipt"]);
  });

  it("a single valid file still lands in files with no repeatedFieldIds entry", () => {
    const f = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    const { files, repeatedFieldIds } = extractFileAnswers(
      ["receipt"],
      (id) => `field__${id}`,
      { field__receipt: f },
    );
    expect(files.receipt).toBe(f);
    expect(repeatedFieldIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Door 1: public CFP (src/routes/public/submit-body.ts extractAnswers)
// ---------------------------------------------------------------------------

const TEXT_FIELD: FormFieldDef = {
  id: "title",
  section: "session",
  kind: "text",
  label: "Title",
  required: true,
  position: 0,
};

describe("public submit-body extractAnswers (DEC-422/DEC-598)", () => {
  it("a duplicated text field is refused, not merged into 'a,b'", () => {
    const body: Record<string, unknown> = { [fieldInputName(TEXT_FIELD.id)]: ["first value", "second value"] };
    const { answers, repeatedFieldIds } = publicExtractAnswers([TEXT_FIELD], body);
    expect(answers[TEXT_FIELD.id]).toBeUndefined();
    expect(answers[TEXT_FIELD.id]).not.toBe("first value,second value");
    expect(repeatedFieldIds).toEqual([TEXT_FIELD.id]);
  });

  it("a single-valued text field still extracts normally", () => {
    const body: Record<string, unknown> = { [fieldInputName(TEXT_FIELD.id)]: "hello" };
    const { answers, repeatedFieldIds } = publicExtractAnswers([TEXT_FIELD], body);
    expect(answers[TEXT_FIELD.id]).toBe("hello");
    expect(repeatedFieldIds).toEqual([]);
  });
});

describe("extractTrackIds dedupe (DEC-598)", () => {
  it("a duplicated trackId is accepted and deduped, not refused", () => {
    const ids = extractTrackIds({ trackIds: ["track-1", "track-1", "track-2"] });
    expect(ids).toEqual(["track-1", "track-2"]);
  });
});

// ---------------------------------------------------------------------------
// Door 2: portal submission edit (src/routes/portal/edit.ts extractAnswers)
// ---------------------------------------------------------------------------

describe("portal edit extractAnswers (DEC-422/DEC-598)", () => {
  it("a duplicated text field is refused, not merged into 'a,b'", () => {
    const body: Record<string, unknown> = { [fieldInputName(TEXT_FIELD.id)]: ["x", "y"] };
    const { answers, repeatedFieldIds } = portalEditExtractAnswers([TEXT_FIELD], body, {});
    expect(answers[TEXT_FIELD.id]).toBeUndefined();
    expect(repeatedFieldIds).toEqual([TEXT_FIELD.id]);
  });

  it("a single-valued field still extracts normally", () => {
    const body: Record<string, unknown> = { [fieldInputName(TEXT_FIELD.id)]: "hello" };
    const { answers, repeatedFieldIds } = portalEditExtractAnswers([TEXT_FIELD], body, {});
    expect(answers[TEXT_FIELD.id]).toBe("hello");
    expect(repeatedFieldIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Door 1 (HTTP): POST /submit/:eventSlug/save-draft refuses BEFORE any KV
// write.
// ---------------------------------------------------------------------------

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: new Date(Date.UTC(2026, 11, 1)),
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  {
    id: "title",
    section: "session",
    kind: "text",
    label: "Title",
    helpText: null,
    required: true,
    position: 0,
    optionsJson: null,
    ruleJson: null,
  },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: { key: string; count: number; expiresAt: number }) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            const existing = rateLimitRows.get(vals.key);
            if (existing) {
              existing.count += 1;
              return [{ count: existing.count }];
            }
            rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
            return [{ count: vals.count }];
          },
          then: (resolve: (v: undefined) => void) => {
            const existing = rateLimitRows.get(vals.key);
            if (existing) existing.count += 1;
            else rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
            resolve(undefined);
          },
        }),
      }),
    }),
    delete: () => ({ where: async () => {} }),
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  const puts: Array<{ key: string; value: string }> = [];
  const kv = {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
      puts.push({ key, value });
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return { kv, puts };
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

describe("POST /submit/:eventSlug/save-draft — DEC-422/DEC-598 repeated field refusal", () => {
  it("a duplicated text field 400s naming the field and never writes the draft to KV", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const { kv, puts } = fakeKv();

    const form = new URLSearchParams();
    form.append(CSRF_COOKIE_NAME, CSRF_TOKEN);
    form.append("field__title", "first value");
    form.append("field__title", "second value");

    const res = await app.request(
      "/submit/test-conf/save-draft",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
          "cf-connecting-ip": "10.0.0.9",
        },
        body: form.toString(),
      },
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(REPEATED_ANSWER_MESSAGE);
    expect(html).not.toContain("first value,second value");
    expect(puts.some((p) => p.key.startsWith("draft:"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Door 3: portal task form (POST /portal/tasks/:assignmentId/form)
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const FORM_ID_TASK = "form-1";
const TEXT_FIELD_ID = "field-notes";
const FILE_FIELD_ID = "field-receipt";

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

const TASK_TEXT_FIELDS = [
  {
    id: TEXT_FIELD_ID,
    formId: FORM_ID_TASK,
    section: "speaker",
    kind: "text",
    label: "Notes",
    required: false,
    position: 0,
    locked: false,
  },
];

const TASK_FILE_FIELDS = [
  {
    id: FILE_FIELD_ID,
    formId: FORM_ID_TASK,
    section: "speaker",
    kind: "file",
    label: "Receipt",
    required: false,
    position: 0,
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
    insertFile: vi.fn(async () => "file-new-1"),
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

function scopeFor(kind: "form") {
  return {
    id: ASSIGNMENT_ID,
    taskId: "task-1",
    eventId: "event-1",
    kind,
    formId: FORM_ID_TASK,
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
    formId: FORM_ID_TASK,
    deliverableKind: null,
    fileId: null,
    responseJson,
    timezone: "UTC",
    completedAt: null,
  };
}

describe("POST /portal/tasks/:assignmentId/form — DEC-422/DEC-598 repeated field refusal", () => {
  it("a duplicated text field 400s naming the field, never persists 'a,b'", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { listFields } = await import("../src/server/repo/forms");
    const { saveTaskFormResponse } = await import("../src/server/repo/portal");
    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    vi.mocked(listFields).mockResolvedValue(TASK_TEXT_FIELDS as any);
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor("form"));
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignmentWithResponse(null)]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.append(`field__${TEXT_FIELD_ID}`, "first value");
    form.append(`field__${TEXT_FIELD_ID}`, "second value");

    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(REPEATED_ANSWER_MESSAGE);
    expect(html).not.toContain("first value,second value");
    expect(saveTaskFormResponse).not.toHaveBeenCalled();
    expect(updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it("a duplicated file input 400s naming the real cause, never a silent success", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { listFields } = await import("../src/server/repo/forms");
    const { saveTaskFormResponse } = await import("../src/server/repo/portal");
    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(listFields).mockResolvedValue(TASK_FILE_FIELDS as any);
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor("form"));
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignmentWithResponse(null)]);

    const bucket = fakeFilesBucket();
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.append(
      `field__${FILE_FIELD_ID}`,
      new File([new Uint8Array([1, 2, 3])], "a.pdf", { type: "application/pdf" }),
    );
    form.append(
      `field__${FILE_FIELD_ID}`,
      new File([new Uint8Array([4, 5, 6])], "b.pdf", { type: "application/pdf" }),
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
    expect(html).toContain(REPEATED_ANSWER_MESSAGE);
    // never a silent "nothing selected" success: no file row is written, and
    // the assignment is never marked complete.
    expect(insertFile).not.toHaveBeenCalled();
    expect(saveTaskFormResponse).not.toHaveBeenCalled();
    expect(updateAssignmentStatus).not.toHaveBeenCalled();
  });
});
