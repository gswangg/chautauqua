// DEC-505: PATCH /api/v1/fields/:fieldId must refuse an `options` edit that
// drops a value submissions have already answered — src/forms/validate.ts
// rejects any stored answer whose value is not in field.options, so a bare
// removal would silently orphan an answer and 409 the speaker's next
// untouched save. Route-level tests, mocking the repo module out from under
// the route per test/forms-field-kind-patch.test.ts's established pattern.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { DROPDOWN_FIELD, MULTI_FIELD, LOCKED_DROPDOWN_FIELD, ANSWER_COUNTS } = vi.hoisted(() => {
  const DROPDOWN_FIELD = {
    id: "field-dropdown",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Format",
    required: true,
    position: 0,
    locked: false,
    options: ["Talk", "Workshop", "Panel"],
  };
  const MULTI_FIELD = {
    id: "field-multi",
    formId: "form-1",
    section: "session" as const,
    // Stored kind is "dropdown"; the answer-count guard reads value_json
    // shape (array vs. scalar), not field.kind, so this covers any
    // options-bearing field whose stored answer happens to be an array
    // (e.g. a future multi-select kind, or a track-style multi-value field).
    kind: "dropdown" as const,
    label: "Topics",
    required: false,
    position: 1,
    locked: false,
    options: ["AI", "Web", "Data"],
  };
  const LOCKED_DROPDOWN_FIELD = {
    id: "field-locked-dropdown",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Session format",
    required: true,
    position: 2,
    locked: true,
    options: ["Talk", "Workshop"],
  };
  // answer values, keyed by fieldId: "Talk" answered on the dropdown field,
  // "Workshop" never answered; multi-select answer is an array containing "AI".
  const ANSWER_COUNTS: Record<string, Map<string, number>> = {
    [DROPDOWN_FIELD.id]: new Map([["Talk", 3]]),
    [MULTI_FIELD.id]: new Map([["AI", 2]]),
    [LOCKED_DROPDOWN_FIELD.id]: new Map([["Talk", 1]]),
  };
  return { DROPDOWN_FIELD, MULTI_FIELD, LOCKED_DROPDOWN_FIELD, ANSWER_COUNTS };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [DROPDOWN_FIELD.id]: { ...DROPDOWN_FIELD },
    [MULTI_FIELD.id]: { ...MULTI_FIELD },
    [LOCKED_DROPDOWN_FIELD.id]: { ...LOCKED_DROPDOWN_FIELD },
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) => Object.values(FIELDS).filter((f) => f.formId === formId)),
    describeFieldDependents: vi.fn(async () => ({ dependentLabels: [], answerCount: 0 })),
    countAnswersByOptionValue: vi.fn(async (_db: unknown, fieldId: string) => ANSWER_COUNTS[fieldId] ?? new Map()),
    patchField: vi.fn(
      async (_db: unknown, fieldId: string, patch: { label?: string; options?: string[] | null }) => {
        const current = FIELDS[fieldId];
        if (!current) throw new Error("not found");
        if (patch.label !== undefined) current.label = patch.label;
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

describe("PATCH /api/v1/fields/:fieldId — options removal vs. collected answers (DEC-505)", () => {
  it("409s removing an ANSWERED option, and leaves stored options unchanged", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: ["Workshop", "Panel"] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toMatch(/"Talk"/);
    expect(body.error.message).toMatch(/3 answers/);
    expect(body.error.message).toMatch(/Nothing was changed/);
    expect(body.error.fields?.options).toBe("1");

    const reread = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { label: "Format" });
    const rereadBody = (await reread.json()) as { options?: string[] };
    expect(rereadBody.options).toEqual(["Talk", "Workshop", "Panel"]);
  });

  it("200s removing an UNanswered option", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: ["Talk", "Panel"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options?: string[] };
    expect(body.options).toEqual(["Talk", "Panel"]);
  });

  it("200s adding an option", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, {
      options: ["Talk", "Workshop", "Panel", "Fireside"],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options?: string[] };
    expect(body.options).toEqual(["Talk", "Workshop", "Panel", "Fireside"]);
  });

  it("200s reordering the same set of options", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${DROPDOWN_FIELD.id}`, { options: ["Panel", "Talk", "Workshop"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options?: string[] };
    expect(body.options).toEqual(["Panel", "Talk", "Workshop"]);
  });

  it("blocks removing a multi-select element that a stored array answer contains", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${MULTI_FIELD.id}`, { options: ["Web", "Data"] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/"AI"/);
    expect(body.error.message).toMatch(/2 answers/);
  });

  it("behaves identically for a locked built-in field — the guard is about answers, not the lock", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${LOCKED_DROPDOWN_FIELD.id}`, { options: ["Workshop"] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/"Talk"/);
  });
});
