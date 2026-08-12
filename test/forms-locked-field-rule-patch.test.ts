// DEC-625: a locked built-in field can never be hidden and can never be
// given a visibility rule. PATCH /api/v1/fields/:fieldId rejects
// body.rule !== undefined on a locked field with 400 before repo.patchField
// is reached. Mocking pattern follows test/forms-field-kind-patch.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { LOCKED_FIELD, UNLOCKED_FIELD } = vi.hoisted(() => ({
  LOCKED_FIELD: {
    id: "field-locked",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Title",
    required: true,
    position: 0,
    locked: true,
  },
  UNLOCKED_FIELD: {
    id: "field-custom",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Custom",
    required: false,
    position: 1,
    locked: false,
  },
}));

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [LOCKED_FIELD.id]: { ...LOCKED_FIELD },
    [UNLOCKED_FIELD.id]: { ...UNLOCKED_FIELD },
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) =>
      Object.values(FIELDS).filter((f) => f.formId === formId),
    ),
    describeFieldDependents: vi.fn(async () => ({ dependentLabels: [], answerCount: 0 })),
    patchField: vi.fn(async (_db: unknown, fieldId: string, patch: Record<string, unknown>) => {
      const current = FIELDS[fieldId];
      if (!current) throw new Error("not found");
      Object.assign(current, patch);
      FIELDS[fieldId] = current;
      return { ...current };
    }),
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

describe("PATCH /api/v1/fields/:fieldId — locked fields reject rule changes (DEC-625)", () => {
  it("400s when a rule is attached to a locked built-in field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, {
      rule: { fieldId: "email", op: "eq", value: "x" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toBe("Locked built-in fields cannot be given a visibility rule");
    expect(body.error.fields).toEqual({ rule: "Not allowed on a locked field" });
  });

  it("400s when a locked field's rule is explicitly cleared (rule: null) too, since rule !== undefined", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, { rule: null });
    expect(res.status).toBe(400);
  });

  it("still allows a rule on a non-locked custom field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${UNLOCKED_FIELD.id}`, {
      rule: { fieldId: "field-locked", op: "eq", value: "x" },
    });
    expect(res.status).toBe(200);
  });

  it("leaves a locked field unchanged (not reaching patchField) when rejected", async () => {
    const app = await buildApp();
    await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, {
      rule: { fieldId: "email", op: "eq", value: "x" },
    });
    const reread = await patch(app, `/api/v1/fields/${LOCKED_FIELD.id}`, { label: "Title" });
    const rereadBody = (await reread.json()) as { rule?: unknown };
    expect(rereadBody.rule).toBeUndefined();
  });
});
