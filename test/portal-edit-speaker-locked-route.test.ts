// Route-level companion to test/portal-edit-speaker-locked.test.ts (DEC-121):
// mirrors test/portal-edit-track-validation.test.ts's mocking pattern to
// check the rendered HTML and the saveSubmissionEdits call-site, without
// needing a full fake db for getPortalData's independent query set.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { fieldInputName } from "../src/views/form-render";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";

const BASE_FIELDS: FormFieldDef[] = [
  { id: "first_name", section: "speaker", kind: "text", label: "First name", required: true, position: 0 },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", required: true, position: 1 },
  { id: "email", section: "speaker", kind: "text", label: "Email", required: true, position: 2 },
];

const BASE_DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
  fields: BASE_FIELDS,
  answers: { first_name: "Jane", last_name: "Doe", email: "jane@example.test" },
  offeredTrackIds: ["t1"],
  allTracks: [{ id: "t1", name: "Track One" }],
  selectedTrackIds: ["t1"],
};

const saveSubmissionEditsMock = vi.fn(async (..._args: unknown[]) => {});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async () => BASE_DATA),
    saveSubmissionEdits: (...args: unknown[]) => saveSubmissionEditsMock(...args),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { orgName: "Org", primaryColor: "#000", logoUrl: null },
      submissions: [],
      tasks: [],
    })),
  };
});

const { portalEditRoutes } = await import("../src/routes/portal/edit");

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalEditRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

describe("GET /portal/submissions/:id/edit (DEC-121 rendering)", () => {
  it("renders the contact's name/email prefilled — email as static read-only text, not an editable input", async () => {
    const app = buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Jane");
    expect(html).toContain("Doe");
    expect(html).toContain("Email: jane@example.test");
    expect(html).toContain("(read-only)");
    // No editable input should exist for the locked email field.
    expect(html).not.toContain(`name="${fieldInputName("email")}"`);
  });
});

describe("POST /portal/submissions/:id/edit (DEC-121 save behavior)", () => {
  function postEdit(app: Hono<AppEnv>, fields: Record<string, string>) {
    const params = new URLSearchParams({ chq_csrf: CSRF_TOKEN, trackIds: "t1", ...fields });
    return app.request("/portal/submissions/s1/edit", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `chq_csrf=${CSRF_TOKEN}`,
      },
      body: params.toString(),
    });
  }

  it("saves successfully with no field__email in the body at all — carry-over satisfies required", async () => {
    const app = buildApp();
    saveSubmissionEditsMock.mockClear();
    const res = await postEdit(app, {
      [fieldInputName("first_name")]: "Jane",
      [fieldInputName("last_name")]: "Doe",
    });
    expect(res.status).toBe(302);
    expect(saveSubmissionEditsMock).toHaveBeenCalledTimes(1);
  });

  it("passes contactId through to saveSubmissionEdits and never forwards a body-supplied email", async () => {
    const app = buildApp();
    saveSubmissionEditsMock.mockClear();
    const res = await postEdit(app, {
      [fieldInputName("first_name")]: "NewFirst",
      [fieldInputName("last_name")]: "Doe",
      [fieldInputName("email")]: "attacker@example.test",
    });
    expect(res.status).toBe(302);
    expect(saveSubmissionEditsMock).toHaveBeenCalledTimes(1);
    const call = saveSubmissionEditsMock.mock.calls[0]!;
    // (db, submissionId, contactId, cleanedAnswers, trackIds)
    expect(call[1]).toBe("s1");
    expect(call[2]).toBe("c1");
    const cleaned = call[3] as Record<string, unknown>;
    expect(cleaned.first_name).toBe("NewFirst");
    expect(cleaned.email).toBe("jane@example.test");
    expect(cleaned.email).not.toBe("attacker@example.test");
  });
});
