// DEC-505: a form field's `kind` and `section` were accepted by
// FieldModal but silently dropped by FieldPatch/patchField — PATCH
// returned 200 with the field unchanged. This exercises the route +
// repo fix: kind/section are now genuinely patchable, a kind change
// away from "dropdown" clears stored options in the same UPDATE
// (DEC-500's options-exist-only-on-dropdowns invariant), a kind change
// is refused with 409 while collected answers exist, and locked
// built-in fields reject kind/section changes outright (400).
//
// Route-level tests, mocking the repo module out from under the route
// per test/forms-field-options-patch.test.ts's established pattern —
// the mocked `patchField` mutates an in-memory FIELDS record the same
// way the real UPDATE-then-re-read would, so a "re-read" here is a
// second request against the same mutated state.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { TEXT_FIELD, DROPDOWN_FIELD, ANSWERED_FIELD, LOCKED_FIELD } = vi.hoisted(() => ({
  TEXT_FIELD: {
    id: "field-text",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Materials",
    required: false,
    position: 0,
    locked: false,
  },
  DROPDOWN_FIELD: {
    id: "field-dropdown",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Format",
    required: true,
    position: 1,
    locked: false,
    options: ["Talk", "Workshop"],
  },
  ANSWERED_FIELD: {
    id: "field-answered",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Bio",
    required: false,
    position: 2,
    locked: false,
  },
  LOCKED_FIELD: {
    id: "field-locked",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Title",
    required: true,
    position: 3,
    locked: true,
  },
}));

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [TEXT_FIELD.id]: { ...TEXT_FIELD },
    [DROPDOWN_FIELD.id]: { ...DROPDOWN_FIELD },
    [ANSWERED_FIELD.id]: { ...ANSWERED_FIELD },
    [LOCKED_FIELD.id]: { ...LOCKED_FIELD },
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) =>
      Object.values(FIELDS).filter((f) => f.formId === formId),
    ),
    describeFieldDependents: vi.fn(async (_db: unknown, _formId: string, fieldId: string) =>
      fieldId === ANSWERED_FIELD.id
        ? { dependentLabels: [], answerCount: 4 }
        : { dependentLabels: [], answerCount: 0 },
    ),
    patchField: vi.fn(
      async (
        _db: unknown,
        fieldId: string,
        patch: {
          label?: string;
          options?: string[] | null;
          section?: FormFieldRow["section"];
          kind?: FormFieldRow["kind"];
        },
      ) => {
        const current = FIELDS[fieldId];
        if (!current) throw new Error("not found");
        if (patch.label !== undefined) current.label = patch.label;
        if (patch.section !== undefined) current.section = patch.section;
        if (patch.kind !== undefined) {
          current.kind = patch.kind;
          // Mirrors the real UPDATE: a kind change away from dropdown
          // clears options in the same statement unless options were
          // explicitly supplied in this same patch.
          if (patch.kind !== "dropdown" && patch.options === undefined) {
            current.options = undefined;
          }
        }
        if (patch.options !== undefined) current.options = patch.options ?? undefined;
        FIELDS[fieldId] = current;
        return { ...current };
      },
    ),
  };
});

async function buildApp() {
  const { formsRoutes } = await import("../src/routes/api/forms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", ORGANIZER);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", formsRoutes);
  return app;
}

function patch(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(path, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/fields/:fieldId — kind + section (DEC-505)", () => {
  it("(a) changes an answer-free text field to dropdown with options", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TEXT_FIELD.id}`, { kind: "dropdown", options: ["A", "B"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind?: string; options?: string[] };
    expect(body.kind).toBe("dropdown");
    expect(body.options).toEqual(["A", "B"]);

    // re-read
    const reread = await patch(app, `/api/v1/fields/${TEXT_FIELD.id}`, { label: "Materials" });
    const rereadBody = (await reread.json()) as { kind?: string; options?: string[] };
    expect(rereadBody.kind).toBe("dropdown");
    expect(rereadBody.options).toEqual(["A", "B"]);
  });

  it("(b) changes a dropdown field with options to text and clears options", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { kind: "text" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind?: string; options?: string[] };
    expect(body.kind).toBe("text");
    expect(body.options).toBeUndefined();
  });

  it("(c) refuses a kind change with 409 when the field has collected answers, leaving it unchanged", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ANSWERED_FIELD.id}`, { kind: "dropdown", options: ["A", "B"] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/4 collected answer/);

    // re-read: field row unchanged
    const reread = await patch(app, `/api/v1/fields/${ANSWERED_FIELD.id}`, { label: "Bio" });
    const rereadBody = (await reread.json()) as { kind?: string };
    expect(rereadBody.kind).toBe("text");
  });

  it("(d) changes section alone", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TEXT_FIELD.id}`, { section: "speaker" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { section?: string };
    expect(body.section).toBe("speaker");
  });

  it("(e) refuses a kind change on a locked built-in field with 400", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, { kind: "dropdown", options: ["A", "B"] });
    expect(res.status).toBe(400);

    // unchanged
    const reread = await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, { required: true });
    const rereadBody = (await reread.json()) as { kind?: string };
    expect(rereadBody.kind).toBe("text");
  });

  it("also refuses a locked field's section change with 400", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, { section: "speaker" });
    expect(res.status).toBe(400);
  });
});
