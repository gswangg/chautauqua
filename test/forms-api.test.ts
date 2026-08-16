import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldDef } from "../src/forms/types";
import { isPermutation, validateFieldDefInput, validateRuleReference } from "../src/forms/builder";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const titleField: FormFieldDef = {
  id: "title",
  section: "session",
  kind: "text",
  label: "Title",
  required: true,
  position: 0,
};

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 1,
  options: ["Talk", "Workshop"],
};

const materialsField: FormFieldDef = {
  id: "materials",
  section: "session",
  kind: "text",
  label: "Materials",
  required: false,
  position: 2,
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

describe("validateFieldDefInput", () => {
  it("accepts a well-formed text field", () => {
    const result = validateFieldDefInput(
      { section: "session", kind: "text", label: "Abstract", required: true },
      [titleField],
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a kind outside the six literals", () => {
    const result = validateFieldDefInput({ kind: "date" }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.kind).toBeDefined();
  });

  it("requires options for dropdown fields", () => {
    const result = validateFieldDefInput({ kind: "dropdown", label: "Format" }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeDefined();
  });

  it("rejects dropdown with an empty options array", () => {
    const result = validateFieldDefInput({ kind: "dropdown", label: "Format", options: [] }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeDefined();
  });

  it("accepts dropdown with a non-empty string options array", () => {
    const result = validateFieldDefInput(
      { kind: "dropdown", label: "Format", options: ["Talk", "Workshop"] },
      [titleField],
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a blank label", () => {
    const result = validateFieldDefInput({ label: "   " }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.label).toBeDefined();
  });

  it("rejects a rule referencing a field id that doesn't exist on the form", () => {
    const result = validateFieldDefInput(
      { rule: { fieldId: "nonexistent", op: "eq", value: "x" } },
      [titleField, formatField],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.rule).toBeDefined();
  });

  it("accepts a rule referencing an existing sibling field", () => {
    const result = validateFieldDefInput(
      { rule: { fieldId: "format", op: "eq", value: "Workshop" } },
      [titleField, formatField],
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateRuleReference", () => {
  it("rejects an unknown rule op", () => {
    const err = validateRuleReference(
      { fieldId: "format", op: "gte" as never, value: 1 },
      [formatField],
    );
    expect(err).toBeDefined();
  });

  it("rejects a field referencing its own id (immediate self-cycle)", () => {
    const err = validateRuleReference({ fieldId: "materials", op: "eq", value: "x" }, [materialsField], "materials");
    expect(err).toBeDefined();
  });

  it("rejects op 'in' whose value is not an array", () => {
    const err = validateRuleReference({ fieldId: "format", op: "in", value: "Workshop" }, [formatField]);
    expect(err).toBeDefined();
  });

  it("detects a two-hop visibility cycle (A depends on B, B would depend on A)", () => {
    // materials.rule already points at format. If we now try to set
    // format's rule to point at materials, that's a cycle: format -> materials -> format.
    const err = validateRuleReference(
      { fieldId: "materials", op: "eq", value: "x" },
      [materialsField, formatField],
      "format",
    );
    expect(err).toBe("rule would create a visibility cycle");
  });

  it("allows a rule referencing a field with no rule chain back to self", () => {
    const err = validateRuleReference({ fieldId: "format", op: "eq", value: "Workshop" }, [formatField], "materials");
    expect(err).toBeUndefined();
  });
});

describe("isPermutation (reorder)", () => {
  const ids = ["a", "b", "c"];

  it("accepts a full permutation in any order", () => {
    expect(isPermutation(ids, ["c", "a", "b"])).toBe(true);
  });

  it("rejects a shorter list (missing an id)", () => {
    expect(isPermutation(ids, ["a", "b"])).toBe(false);
  });

  it("rejects a longer list (extra id)", () => {
    expect(isPermutation(ids, ["a", "b", "c", "d"])).toBe(false);
  });

  it("rejects duplicate ids", () => {
    expect(isPermutation(ids, ["a", "a", "c"])).toBe(false);
  });

  it("rejects an id not belonging to the form", () => {
    expect(isPermutation(ids, ["a", "b", "z"])).toBe(false);
  });

  it("rejects a non-array payload", () => {
    expect(isPermutation(ids, "not-an-array")).toBe(false);
  });
});

// PATCH /api/v1/forms/:formId tracks validation (DEC-169): a typo'd or
// other-event track id must be rejected server-side, not just filtered
// client-side by the public submit page.
vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FORM: import("../src/server/repo/forms").FormRow = {
    id: "form-1",
    eventId: "event-1",
    title: "CFP",
    intro: null,
    isDefault: true,
    openDate: null,
    closeDate: null,
    tracks: null,
  };
  const ACCEPTANCE_FORM: import("../src/server/repo/forms").FormRow = {
    id: "form-2",
    eventId: "event-1",
    title: "Speaker onboarding form",
    intro: null,
    isDefault: false,
    openDate: null,
    closeDate: null,
    tracks: null,
  };
  return {
    ...actual,
    findEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === "event-1" && orgId === "org-1" ? { id: eventId, orgId } : null,
    ),
    findFormForOrg: vi.fn(async (_db: unknown, formId: string, orgId: string) =>
      formId === "form-1" && orgId === "org-1" ? FORM : null,
    ),
    getOrCreateForm: vi.fn(async () => ({ form: FORM, fields: [] })),
    patchForm: vi.fn(async (_db: unknown, _formId: string, patch: { title?: string; tracks?: string[] | null }) => ({
      ...FORM,
      title: patch.title !== undefined ? patch.title : FORM.title,
      // Mirrors repo.patchForm's real storage coercion: [] and null both
      // collapse to null (offer-all) once round-tripped through tracksJson.
      tracks: patch.tracks !== undefined ? (patch.tracks && patch.tracks.length > 0 ? patch.tracks : null) : FORM.tracks,
    })),
    listFields: vi.fn(async () => []),
    // DEC-398: the event's default form (FORM, isDefault:true) plus a
    // non-default acceptance form-task form -- default sorts first.
    listFormsForEvent: vi.fn(async () => [
      { id: FORM.id, title: FORM.title, isDefault: true },
      { id: ACCEPTANCE_FORM.id, title: ACCEPTANCE_FORM.title, isDefault: false },
    ]),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  const TRACKS_BY_EVENT: Record<string, { id: string; eventId: string; name: string; color: string | null; position: number; createdAt: number; updatedAt: number }[]> = {
    "event-1": [
      { id: "track-a", eventId: "event-1", name: "Track A", color: null, position: 0, createdAt: 0, updatedAt: 0 },
      { id: "track-b", eventId: "event-1", name: "Track B", color: null, position: 1, createdAt: 0, updatedAt: 0 },
    ],
    "event-2": [{ id: "track-x", eventId: "event-2", name: "Track X", color: null, position: 0, createdAt: 0, updatedAt: 0 }],
  };
  return {
    ...actual,
    listTracksForEvent: vi.fn(async (_db: unknown, eventId: string) => TRACKS_BY_EVENT[eventId] ?? []),
  };
});

async function buildFormsApp(auth: AuthInfo) {
  const { formsRoutes } = await import("../src/routes/api/forms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", formsRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

async function patchTracks(app: Hono<AppEnv>, tracks: unknown) {
  return app.request("/api/v1/forms/form-1", {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ tracks }),
  });
}

describe("PATCH /api/v1/forms/:formId tracks (DEC-169)", () => {
  it("rejects an unknown track id", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await patchTracks(app, ["track-a", "typo-track"]);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.tracks).toContain("typo-track");
  });

  it("rejects a track id belonging to a different event", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await patchTracks(app, ["track-x"]);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.tracks).toContain("track-x");
  });

  it("accepts a valid subset of the event's tracks, deduped", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await patchTracks(app, ["track-a", "track-a", "track-b"]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracks: string[] | null };
    expect(body.tracks).toEqual(["track-a", "track-b"]);
  });

  it("[] still means offer-all", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await patchTracks(app, []);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracks: string[] | null };
    expect(body.tracks).toBeNull();
  });

  it("null still means offer-all", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await patchTracks(app, null);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracks: string[] | null };
    expect(body.tracks).toBeNull();
  });
});

// PATCH /api/v1/forms/:formId open/close order (DEC-517/DEC-731): the
// server's validator is the ONE place close-before-open is refused, with
// an ApiError carrying `fields` so the SPA can surface it inline at the
// Opens/Closes field rather than a quiet banner.
describe("PATCH /api/v1/forms/:formId openDate/closeDate order (DEC-517/DEC-731)", () => {
  it("400s with a field error when closeDate is before openDate", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await app.request("/api/v1/forms/form-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ openDate: Date.UTC(2026, 5, 1), closeDate: Date.UTC(2026, 4, 1) }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeDefined();
    expect(body.error.fields?.closeDate).toBeDefined();
  });
});

// PATCH /api/v1/forms/:formId title (DEC-731, wave 8 amendment): "Form
// name" (form.title) joins the accepted PATCH fields -- a title-only PATCH
// round-trips, and an empty title is refused with the same fields.title
// grammar as intro.
describe("PATCH /api/v1/forms/:formId title (DEC-731)", () => {
  it("accepts a title-only PATCH and round-trips it", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await app.request("/api/v1/forms/form-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ title: "DevFlow CFP" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("DevFlow CFP");
  });

  it("rejects an empty title with fields.title", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await app.request("/api/v1/forms/form-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.title).toBeDefined();
  });
});

// GET /api/v1/events/:eventId/forms (DEC-398): the top-level serialized
// form is always the DEFAULT form, and the response additively carries
// every form on the event (including non-default acceptance forms) for
// the organizer's form-task "pick a form by name" select.
describe("GET /api/v1/events/:eventId/forms (DEC-398)", () => {
  it("returns the default form at top level plus the full forms list", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/forms");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      isDefault: boolean;
      forms: { id: string; title: string; isDefault: boolean }[];
    };
    expect(body.id).toBe("form-1");
    expect(body.isDefault).toBe(true);
    expect(body.forms).toEqual([
      { id: "form-1", title: "CFP", isDefault: true },
      { id: "form-2", title: "Speaker onboarding form", isDefault: false },
    ]);
  });
});
