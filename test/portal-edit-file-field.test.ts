// Regression for the portal-edit 400 on forms with required file fields
// (DEC-109): extractAnswers never reads file inputs from the request body
// (files are read-only in the edit portal per DEC-041), but it must carry
// the already-stored file answer forward so validateAnswers doesn't see a
// missing required answer. A missing stored answer must still not be fatal
// here — the POST handler forces file-kind required to false before
// validating, since public submit (src/forms/validate.ts, unmodified) is
// the only place required files are truly enforced.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { extractAnswers } from "../src/routes/portal/edit";
import { validateAnswers } from "../src/forms/validate";
import type { FormFieldDef, AnswerMap } from "../src/forms/types";
import { fieldInputName } from "../src/views/form-render";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";

const FILE_FIELD: FormFieldDef = {
  id: "headshot",
  section: "speaker",
  kind: "file",
  label: "Headshot",
  required: true,
  position: 0,
};

const TEXT_FIELD: FormFieldDef = {
  id: "bio",
  section: "speaker",
  kind: "text",
  label: "Bio",
  required: false,
  position: 1,
};

const CHECKBOX_FIELD: FormFieldDef = {
  id: "agree",
  section: "speaker",
  kind: "checkbox",
  label: "Agree",
  required: false,
  position: 2,
};

describe("extractAnswers (portal edit, DEC-109)", () => {
  it("carries the stored file answer over when present, ignoring any body value", () => {
    const body: Record<string, unknown> = {
      [fieldInputName(FILE_FIELD.id)]: "malicious-client-supplied-value",
    };
    const stored: AnswerMap = { [FILE_FIELD.id]: "uploads/headshot-abc123.jpg" };
    const answers = extractAnswers([FILE_FIELD], body, stored).answers;
    expect(answers[FILE_FIELD.id]).toBe("uploads/headshot-abc123.jpg");
  });

  it("yields no key for a file field when no stored answer exists", () => {
    const answers = extractAnswers([FILE_FIELD], {}, {}).answers;
    expect(Object.prototype.hasOwnProperty.call(answers, FILE_FIELD.id)).toBe(false);
  });

  it("ignores a non-string or empty-string stored file answer", () => {
    const answers1 = extractAnswers([FILE_FIELD], {}, { [FILE_FIELD.id]: "" }).answers;
    expect(Object.prototype.hasOwnProperty.call(answers1, FILE_FIELD.id)).toBe(false);

    const answers2 = extractAnswers([FILE_FIELD], {}, { [FILE_FIELD.id]: 42 }).answers;
    expect(Object.prototype.hasOwnProperty.call(answers2, FILE_FIELD.id)).toBe(false);
  });

  it("checkbox behavior is unchanged: present body key -> true, absent -> false", () => {
    const present = extractAnswers([CHECKBOX_FIELD], { [fieldInputName(CHECKBOX_FIELD.id)]: "on" }, {}).answers;
    expect(present[CHECKBOX_FIELD.id]).toBe(true);

    const absent = extractAnswers([CHECKBOX_FIELD], {}, {}).answers;
    expect(absent[CHECKBOX_FIELD.id]).toBe(false);
  });

  it("text behavior is unchanged: reads from body, skips when absent", () => {
    const withValue = extractAnswers([TEXT_FIELD], { [fieldInputName(TEXT_FIELD.id)]: "hello" }, {}).answers;
    expect(withValue[TEXT_FIELD.id]).toBe("hello");

    const withoutValue = extractAnswers([TEXT_FIELD], {}, {}).answers;
    expect(Object.prototype.hasOwnProperty.call(withoutValue, TEXT_FIELD.id)).toBe(false);
  });
});

describe("extractAnswers + validateAnswers composition (DEC-109)", () => {
  function validateForEdit(fields: FormFieldDef[], answers: AnswerMap) {
    // Mirrors the POST handler in src/routes/portal/edit.tsx: file-kind
    // required is forced false since files are read-only here.
    return validateAnswers(
      fields.map((f) => (f.kind === "file" ? { ...f, required: false } : f)),
      answers,
    );
  }

  it("ok:true when a required file field has a stored answer", () => {
    const stored: AnswerMap = { [FILE_FIELD.id]: "uploads/headshot-abc123.jpg" };
    const answers = extractAnswers([FILE_FIELD], {}, stored).answers;
    const result = validateForEdit([FILE_FIELD], answers);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned[FILE_FIELD.id]).toBe("uploads/headshot-abc123.jpg");
    }
  });

  it("ok:true when a required file field has no stored answer (required forced false)", () => {
    const answers = extractAnswers([FILE_FIELD], {}, {}).answers;
    const result = validateForEdit([FILE_FIELD], answers);
    expect(result.ok).toBe(true);
  });

  it("public submit path (validateAnswers unmodified) still rejects a missing required file", () => {
    const result = validateAnswers([FILE_FIELD], {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[FILE_FIELD.id]).toBe("required");
    }
  });
});

const ROUTE_FIELDS_DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
  fields: [FILE_FIELD, TEXT_FIELD],
  answers: { [FILE_FIELD.id]: "uploads/headshot-abc123.jpg", [TEXT_FIELD.id]: "Existing bio" },
  offeredTrackIds: [],
  allTracks: [],
  selectedTrackIds: [],
  formatLabel: null,
};

const routeLoadEditableSubmissionMock = vi.fn(async () => ROUTE_FIELDS_DATA);
const routeSaveSubmissionEditsMock = vi.fn(async (..._args: unknown[]) => {});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: (...args: unknown[]) => routeLoadEditableSubmissionMock(...(args as [])),
    getPortalParticipants: vi.fn(async () => []),
    getAllSubmissionParticipants: vi.fn(async () => []),
    saveSubmissionEdits: (...args: unknown[]) => routeSaveSubmissionEditsMock(...args),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalHome: vi.fn(async () => ({ views: [], placements: new Map() })),
    getPortalData: vi.fn(async () => ({
      branding: { orgName: "Org", primaryColor: "#000", logoUrl: null },
      submissions: [],
      tasks: [],
    })),
  };
});

async function buildRouteApp() {
  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalEditRoutes);
  return app;
}

const ROUTE_CSRF_TOKEN = "test-csrf-token";

// DEC-041 (wave-117 amendment): route-layer coverage that the picker itself
// is gone -- the GET render offers no <input type=file> and exactly one
// rendition of the stored filename, and a POST carrying a file part for a
// file field neither changes the stored answer nor reports success for the
// discarded upload.
describe("portal edit route: file fields are never offered as a live picker (DEC-041)", () => {
  it("GET renders exactly one rendition of the file answer and zero input[type=file] in #chq-portal-edit-form", async () => {
    const app = await buildRouteApp();
    const res = await app.request("/portal/submissions/s1/edit", {
      headers: { cookie: `chq_csrf=${ROUTE_CSRF_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    const formMatch = html.match(/<form id="chq-portal-edit-form"[\s\S]*?<\/form>/);
    if (!formMatch) throw new Error("#chq-portal-edit-form not found");
    const formHtml = formMatch[0];
    expect(formHtml).not.toContain('type="file"');
    const filenameOccurrences = formHtml.split("uploads/headshot-abc123.jpg").length - 1;
    expect(filenameOccurrences).toBe(1);
  });

  it("POST with a file part for a file field leaves the stored answer unchanged and reports success normally (the upload is silently discarded, not fatally rejected)", async () => {
    const app = await buildRouteApp();
    routeSaveSubmissionEditsMock.mockClear();
    const formData = new FormData();
    formData.append("chq_csrf", ROUTE_CSRF_TOKEN);
    formData.append(fieldInputName(TEXT_FIELD.id), "Updated bio");
    // A file part posted for the read-only file field -- the handler must
    // never read it back into the saved answer.
    formData.append(
      fieldInputName(FILE_FIELD.id),
      new File(["binary-bytes"], "replacement-headshot.jpg", { type: "image/jpeg" }),
    );
    const res = await app.request("/portal/submissions/s1/edit", {
      method: "POST",
      headers: { cookie: `chq_csrf=${ROUTE_CSRF_TOKEN}` },
      body: formData,
    });
    expect(res.status).toBe(302);
    expect(routeSaveSubmissionEditsMock).toHaveBeenCalledTimes(1);
    const call = routeSaveSubmissionEditsMock.mock.calls[0] as unknown[];
    const cleaned = call[3] as AnswerMap;
    // The stored filename survives untouched -- never the posted File's name.
    expect(cleaned[FILE_FIELD.id]).toBe("uploads/headshot-abc123.jpg");
  });
});
