// DEC-505 (amendment, wave 49): PATCH /api/v1/fields/:fieldId must refuse an
// edit that invalidates a SIBLING'S stored visibility rule (an option
// removal or kind change the sibling's rule.value/kind typing depends on),
// 409 naming the dependent, unless ?cascade=1 -- which clears exactly those
// rules in the same write and reports clearedRules. Mirrors
// test/forms-option-removal-guard.test.ts's route-level mocking pattern.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { TRIGGER_FIELD, DEPENDENT_FIELD, UNRELATED_FIELD } = vi.hoisted(() => {
  const TRIGGER_FIELD = {
    id: "field-trigger",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Format",
    required: true,
    position: 0,
    locked: false,
    options: ["Talk", "Workshop", "Panel"],
  };
  const DEPENDENT_FIELD = {
    id: "field-dependent",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Workshop details",
    required: true,
    position: 1,
    locked: false,
    rule: { fieldId: "field-trigger", op: "eq" as const, value: "Workshop" },
  };
  const UNRELATED_FIELD = {
    id: "field-unrelated",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Notes",
    required: false,
    position: 2,
    locked: false,
  };
  return { TRIGGER_FIELD, DEPENDENT_FIELD, UNRELATED_FIELD };
});

function freshFields(): Record<string, FormFieldRow> {
  return {
    [TRIGGER_FIELD.id]: { ...TRIGGER_FIELD },
    [DEPENDENT_FIELD.id]: { ...DEPENDENT_FIELD, rule: { ...DEPENDENT_FIELD.rule } },
    [UNRELATED_FIELD.id]: { ...UNRELATED_FIELD },
  };
}

let FIELDS: Record<string, FormFieldRow> = freshFields();

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) => Object.values(FIELDS).filter((f) => f.formId === formId)),
    describeFieldDependents: vi.fn(async () => ({ dependentLabels: [], answerCount: 0 })),
    countAnswersByOptionValue: vi.fn(async () => new Map()),
    patchField: vi.fn(
      async (
        _db: unknown,
        fieldId: string,
        patch: { label?: string; options?: string[] | null; kind?: string; section?: string },
      ) => {
        const current = FIELDS[fieldId];
        if (!current) throw new Error("not found");
        if (patch.label !== undefined) current.label = patch.label;
        if (patch.options !== undefined) current.options = patch.options ?? undefined;
        if (patch.kind !== undefined) {
          (current as { kind: string }).kind = patch.kind;
          if (patch.kind !== "dropdown" && patch.options === undefined) current.options = undefined;
        }
        if (patch.section !== undefined) (current as { section: string }).section = patch.section;
        FIELDS[fieldId] = current;
        return { ...current };
      },
    ),
    clearFieldRules: vi.fn(async (_db: unknown, fieldIds: string[]) => {
      for (const id of fieldIds) {
        const f = FIELDS[id];
        if (f) f.rule = undefined;
      }
      return fieldIds.length;
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

describe("PATCH /api/v1/fields/:fieldId — a patch invalidating a sibling's rule (DEC-505 wave 49)", () => {
  it("(a) removing an option a sibling rule targets 409s naming the sibling, and leaves the field UNCHANGED", async () => {
    FIELDS = freshFields();
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TRIGGER_FIELD.id}`, { options: ["Talk", "Panel"] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.fields?.dependents).toBe("Workshop details");
    expect(body.error.message).toMatch(/Workshop details/);

    const reread = await patch(app, `/api/v1/fields/${TRIGGER_FIELD.id}`, { label: "Format" });
    const rereadBody = (await reread.json()) as { options?: string[] };
    expect(rereadBody.options).toEqual(["Talk", "Workshop", "Panel"]);
    expect(FIELDS[DEPENDENT_FIELD.id]?.rule).toEqual({ fieldId: "field-trigger", op: "eq", value: "Workshop" });
  });

  it("(b) the same request with ?cascade=1 succeeds, returns clearedRules: 1, and clears the sibling's stored rule", async () => {
    FIELDS = freshFields();
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TRIGGER_FIELD.id}?cascade=1`, { options: ["Talk", "Panel"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options?: string[]; clearedRules?: number };
    expect(body.options).toEqual(["Talk", "Panel"]);
    expect(body.clearedRules).toBe(1);
    expect(FIELDS[DEPENDENT_FIELD.id]?.rule).toBeUndefined();
  });

  it("(c) a kind change dropdown->number that invalidates a sibling's string rule.value 409s the same way", async () => {
    FIELDS = freshFields();
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TRIGGER_FIELD.id}`, { kind: "number" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.fields?.dependents).toBe("Workshop details");
    expect(FIELDS[TRIGGER_FIELD.id]?.kind).toBe("dropdown");
  });

  it("(d) removing an option no sibling references still succeeds", async () => {
    FIELDS = freshFields();
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TRIGGER_FIELD.id}`, { options: ["Workshop", "Panel"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options?: string[]; clearedRules?: number };
    expect(body.options).toEqual(["Workshop", "Panel"]);
    expect(body.clearedRules).toBeUndefined();
    expect(FIELDS[DEPENDENT_FIELD.id]?.rule).toEqual({ fieldId: "field-trigger", op: "eq", value: "Workshop" });
  });
});
