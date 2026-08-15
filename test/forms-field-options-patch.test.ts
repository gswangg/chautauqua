// DEC-500: PATCH /api/v1/fields/:fieldId must validate `options` against the
// field's *effective* kind (stored kind when the patch omits `kind`, which it
// always does), not just a supplied `kind`. Before this fix, `{"options":
// []}` or `{"options": null}` passed validation on a dropdown field because
// the check lived inside `if (input.kind !== undefined)` — permanently
// bricking a live dropdown for every subsequent answer.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { validateFieldDefInput } from "../src/forms/builder";
import type { FormFieldDef } from "../src/forms/types";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { DROPDOWN_FIELD, DROPDOWN_FIELD_2, TEXT_FIELD } = vi.hoisted(() => ({
  DROPDOWN_FIELD: {
    id: "field-dropdown",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Format",
    required: true,
    position: 0,
    locked: false,
    options: ["Talk", "Workshop"],
  },
  DROPDOWN_FIELD_2: {
    id: "field-dropdown-2",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Track",
    required: true,
    position: 2,
    locked: false,
    options: ["Talk", "Workshop"],
  },
  TEXT_FIELD: {
    id: "field-text",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Materials",
    required: false,
    position: 1,
    locked: false,
  },
}));

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [DROPDOWN_FIELD.id]: { ...DROPDOWN_FIELD },
    [DROPDOWN_FIELD_2.id]: { ...DROPDOWN_FIELD_2 },
    [TEXT_FIELD.id]: { ...TEXT_FIELD },
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) =>
      Object.values(FIELDS).filter((f) => f.formId === formId),
    ),
    // DEC-505: no answers recorded against any option in these fixtures —
    // every removal in this file is answer-free.
    countAnswersByOptionValue: vi.fn(async () => new Map()),
    patchField: vi.fn(async (_db: unknown, fieldId: string, patch: { label?: string; options?: string[] | null }) => {
      const current = FIELDS[fieldId];
      if (!current) throw new Error("not found");
      if (patch.label !== undefined) current.label = patch.label;
      if (patch.options !== undefined) current.options = patch.options ?? undefined;
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

describe("PATCH /api/v1/fields/:fieldId — dropdown options (DEC-500)", () => {
  it("rejects an empty options array on a dropdown field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: [] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.options).toBeDefined();

    const check = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { label: "Format" });
    expect(check.status).toBe(200);
    const checked = (await check.json()) as { options?: string[] };
    expect(checked.options).toEqual(["Talk", "Workshop"]);
  });

  it("rejects null options on a dropdown field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: null });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.options).toBeDefined();
  });

  it("rejects an options array with a non-string entry", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: ["a", 1] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.options).toBeDefined();
  });

  it("rejects a non-array options value", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: "x" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.options).toBeDefined();
  });

  it("accepts a valid non-empty options array and updates it", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: ["A", "B"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options?: string[] };
    expect(body.options).toEqual(["A", "B"]);
  });

  it("rejects options on a non-dropdown field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TEXT_FIELD.id}`, { options: ["A"] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.options).toBeDefined();
  });

  it("patching label alone on a dropdown field leaves options untouched (no false positive)", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD_2.id}`, { label: "New label" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { label?: string; options?: string[] };
    expect(body.label).toBe("New label");
    expect(body.options).toEqual(["Talk", "Workshop"]);
  });
});

describe("validateFieldDefInput — effective kind resolution (DEC-500 unit)", () => {
  const storedDropdown: FormFieldDef = {
    id: "d1",
    section: "session",
    kind: "dropdown",
    label: "Format",
    required: true,
    position: 0,
    options: ["Talk", "Workshop"],
  };

  it("validates options against the stored kind when the patch omits kind", () => {
    const result = validateFieldDefInput({ options: [] }, [], { id: "d1", kind: "dropdown" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeDefined();
  });

  it("a patch that only touches label passes even though kind is dropdown", () => {
    const result = validateFieldDefInput({ label: "Format 2" }, [storedDropdown], { id: "d1", kind: "dropdown" });
    expect(result.ok).toBe(true);
  });

  it("create (no existing) still requires options for dropdown even without input.options key", () => {
    const result = validateFieldDefInput({ section: "session", kind: "dropdown", label: "Format" }, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeDefined();
  });
});
