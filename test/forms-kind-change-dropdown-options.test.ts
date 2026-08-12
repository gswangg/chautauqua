// DEC-508: closes the optionless-dropdown hole DEC-505's kind-patch reopened.
// `PATCH /api/v1/fields/:fieldId` with `{"kind":"dropdown"}` and no `options`
// must be rejected — options are required whenever the field is not ALREADY
// a dropdown (create, or a patch changing kind TO dropdown); a patch on a
// field that is already a dropdown may omit options unchanged.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { validateFieldDefInput } from "../src/forms/builder";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

describe("validateFieldDefInput dropdown-options-on-kind-change (DEC-508)", () => {
  it("1. kind -> dropdown with no options on a text field fails with errors.options", () => {
    const result = validateFieldDefInput({ kind: "dropdown" }, [], { id: "f1", kind: "text" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.options).toBeDefined();
    }
  });

  it("2. kind -> dropdown with options on a text field succeeds", () => {
    const result = validateFieldDefInput({ kind: "dropdown", options: ["a", "b"] }, [], { id: "f1", kind: "text" });
    expect(result.ok).toBe(true);
  });

  it("3. partial patch on an already-dropdown field need not re-send options", () => {
    const result = validateFieldDefInput({ label: "x" }, [], { id: "f1", kind: "dropdown" });
    expect(result.ok).toBe(true);
  });

  it("4. kind -> text on a dropdown field is fine without options; sending options with it fails", () => {
    const okResult = validateFieldDefInput({ kind: "text" }, [], { id: "f1", kind: "dropdown" });
    expect(okResult.ok).toBe(true);

    const badResult = validateFieldDefInput({ kind: "text", options: ["a"] }, [], { id: "f1", kind: "dropdown" });
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(badResult.errors.options).toBe("options apply only to dropdown fields");
    }
  });

  it("5. empty/null options on a kind->dropdown change on a text field both fail", () => {
    const emptyResult = validateFieldDefInput({ kind: "dropdown", options: [] }, [], { id: "f1", kind: "text" });
    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) expect(emptyResult.errors.options).toBeDefined();

    const nullResult = validateFieldDefInput({ kind: "dropdown", options: null }, [], { id: "f1", kind: "text" });
    expect(nullResult.ok).toBe(false);
    if (!nullResult.ok) expect(nullResult.errors.options).toBeDefined();
  });
});

const { TEXT_FIELD } = vi.hoisted(() => ({
  TEXT_FIELD: {
    id: "field-text-1",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Bio",
    required: false,
    position: 3,
    locked: false,
  },
}));

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const state: { field: FormFieldRow } = { field: { ...TEXT_FIELD } };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && fieldId === state.field.id ? state.field : null,
    ),
    listFields: vi.fn(async (_db: unknown, _formId: string) => [state.field]),
    describeFieldDependents: vi.fn(async () => ({ dependentLabels: [], answerCount: 0 })),
    patchField: vi.fn(async (_db: unknown, _fieldId: string, patch: Record<string, unknown>) => {
      Object.assign(state.field, patch);
      return state.field;
    }),
    __state: state,
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
    headers: { "x-chq-csrf": "1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/fields/:fieldId kind->dropdown without options (DEC-508)", () => {
  it("400s with the house error envelope and leaves the field un-mutated", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TEXT_FIELD.id}`, { kind: "dropdown" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.options).toBeDefined();

    const repo = await import("../src/server/repo/forms");
    const state = (repo as unknown as { __state: { field: FormFieldRow } }).__state;
    expect(state.field.kind).toBe("text");
    expect(state.field.options).toBeUndefined();
  });
});
