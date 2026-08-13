// DEC-300: route-level tests for DELETE /api/v1/fields/:fieldId's
// cascade-confirm behavior. Mounts the sub-app per test/forms-api.test.ts's
// established mocking pattern (repo module mocked out from under the route).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { LOCKED_FIELD, OPEN_FIELD, DEPENDENT_FIELD } = vi.hoisted(() => ({
  LOCKED_FIELD: {
    id: "locked-1",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Title",
    required: true,
    position: 0,
    locked: true,
  },
  OPEN_FIELD: {
    id: "field-open",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Materials",
    required: false,
    position: 2,
    locked: false,
  },
  DEPENDENT_FIELD: {
    id: "field-with-deps",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Format",
    required: false,
    position: 1,
    locked: false,
  },
}));

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [LOCKED_FIELD.id]: LOCKED_FIELD,
    [OPEN_FIELD.id]: OPEN_FIELD,
    [DEPENDENT_FIELD.id]: DEPENDENT_FIELD,
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? FIELDS[fieldId] : null,
    ),
    describeFieldDependents: vi.fn(async (_db: unknown, _formId: string, fieldId: string) =>
      fieldId === DEPENDENT_FIELD.id
        ? { dependentLabels: ["Slides link"], answerCount: 3 }
        : { dependentLabels: [], answerCount: 0 },
    ),
    deleteFieldCascade: vi.fn(async () => ({ clearedRules: 1, deletedAnswers: 3 })),
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

function del(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: "DELETE", headers: { "x-chq-csrf": "1" } });
}

describe("DELETE /api/v1/fields/:fieldId cascade-confirm (DEC-300)", () => {
  it("409s naming dependents/answers when cascade is not passed", async () => {
    const app = await buildApp();
    const res = await del(app, `/api/v1/fields/${DEPENDENT_FIELD.id}`);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toContain("Format");
    expect(body.error.message).toContain("1 dependent question");
    expect(body.error.message).toContain("3 collected answers");
    expect(body.error.fields?.dependents).toBe("Slides link");
    expect(body.error.fields?.answers).toBe("3");
  });

  it("cascades and deletes when cascade=1 is passed", async () => {
    const app = await buildApp();
    const res = await del(app, `/api/v1/fields/${DEPENDENT_FIELD.id}?cascade=1`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; clearedRules: number; deletedAnswers: number };
    expect(body).toEqual({ ok: true, clearedRules: 1, deletedAnswers: 3 });
  });

  it("still rejects locked fields before checking dependents", async () => {
    const app = await buildApp();
    const res = await del(app, `/api/v1/fields/${LOCKED_FIELD.id}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });

  it("a field with no dependents/answers deletes without cascade in one call", async () => {
    const app = await buildApp();
    const res = await del(app, `/api/v1/fields/${OPEN_FIELD.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
