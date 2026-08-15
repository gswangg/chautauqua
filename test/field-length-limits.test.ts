// DEC-417: every admin JSON mutation gets a request-input bound so an
// oversized free-text field is a clean 400 instead of a D1 SQLITE_TOOBIG
// 500. Unit-tests parseBoundedText/parseBoundedOptionalText directly, then
// walks one over-cap request per route file through that route's own
// in-process Hono app (repo/db calls the route makes before reaching the
// new bound are mocked so no D1/wrangler dependency is needed here, mirroring
// test/users-api.test.ts's pattern).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBoundedText, parseBoundedOptionalText } from "../src/server/http";
import {
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_LONG_TEXT_LENGTH,
  MAX_RICH_TEXT_LENGTH,
} from "../src/forms/validate";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function jsonPost(path: string, body: unknown, method = "POST") {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// parseBoundedText / parseBoundedOptionalText (pure unit tests)
// ---------------------------------------------------------------------------

describe("parseBoundedText", () => {
  it("accepts a value exactly at the cap", () => {
    const value = "a".repeat(10);
    expect(parseBoundedText(value, "field", { max: 10 })).toBe(value);
  });

  it("rejects a value one char over the cap", () => {
    expect(() => parseBoundedText("a".repeat(11), "field", { max: 10 })).toThrowError(/at most 10/);
  });

  it("rejects non-string input", () => {
    expect(() => parseBoundedText(42, "field", { max: 10 })).toThrowError(/must be a string/);
  });

  it("trims by default before measuring/require-checking", () => {
    expect(parseBoundedText("  hi  ", "field", { max: 10 })).toBe("hi");
    expect(() => parseBoundedText("   ", "field", { max: 10, required: true })).toThrowError(/required/);
  });

  it("does not trim when trim:false", () => {
    expect(parseBoundedText("  hi  ", "field", { max: 10, trim: false })).toBe("  hi  ");
  });

  it("rejects empty-after-trim when required", () => {
    expect(() => parseBoundedText("", "field", { max: 10, required: true })).toThrowError(/required/);
  });

  it("allows empty when not required", () => {
    expect(parseBoundedText("", "field", { max: 10 })).toBe("");
  });

  it("error carries a fields entry naming the field", () => {
    try {
      parseBoundedText("a".repeat(11), "myField", { max: 10 });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as { fields?: Record<string, string> }).fields).toHaveProperty("myField");
    }
  });
});

describe("parseBoundedOptionalText", () => {
  it("returns null for undefined/null/empty-after-trim", () => {
    expect(parseBoundedOptionalText(undefined, "f", { max: 10 })).toBeNull();
    expect(parseBoundedOptionalText(null, "f", { max: 10 })).toBeNull();
    expect(parseBoundedOptionalText("   ", "f", { max: 10 })).toBeNull();
  });

  it("returns the trimmed string when present and within cap", () => {
    expect(parseBoundedOptionalText("  hi  ", "f", { max: 10 })).toBe("hi");
  });

  it("rejects over-cap input", () => {
    expect(() => parseBoundedOptionalText("a".repeat(11), "f", { max: 10 })).toThrowError(/at most 10/);
  });

  it("rejects non-string input", () => {
    expect(() => parseBoundedOptionalText(42, "f", { max: 10 })).toThrowError(/must be a string/);
  });
});

// ---------------------------------------------------------------------------
// Route-level over-cap assertions, one per Step 3 file.
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

async function expectInvalid(res: Response, field: string) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error?: { code?: string; fields?: Record<string, string> } };
  expect(body.error?.code).toBe("invalid");
  expect(body.error?.fields).toHaveProperty(field);
}

describe("src/routes/api/submissions.ts", () => {
  it("POST /events/:eventId/submissions rejects an over-cap title (DEC-417 reproduces the SQLITE_TOOBIG bug)", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/submissions", { title: "x".repeat(MAX_NAME_LENGTH + 1) }),
    );
    await expectInvalid(res, "title");
  });
});

describe("src/routes/api/events.ts", () => {
  it("POST /events rejects an over-cap name", async () => {
    const { eventsRoutes } = await import("../src/routes/api/events");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", eventsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events", {
        name: "x".repeat(MAX_NAME_LENGTH + 1),
        slug: "ev",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        timezone: "UTC",
      }),
    );
    await expectInvalid(res, "name");
  });
});

describe("src/routes/tasks.ts", () => {
  it("POST /events/:eventId/tasks rejects an over-cap title", async () => {
    vi.doMock("../src/server/repo/tasks", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    const { taskRoutes } = await import("../src/routes/tasks");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", taskRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/tasks", {
        kind: "general",
        title: "x".repeat(MAX_NAME_LENGTH + 1),
        required: false,
      }),
    );
    await expectInvalid(res, "title");
  });
});

describe("src/routes/comms.ts", () => {
  it("POST /api/v1/events/:eventId/templates rejects an over-cap bodyText", async () => {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A, timezone: "UTC" })) };
    });
    const { commsRoutes } = await import("../src/routes/comms");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", commsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/templates", {
        name: "Reminder",
        subject: "hi",
        bodyText: "x".repeat(MAX_RICH_TEXT_LENGTH + 1),
      }),
    );
    await expectInvalid(res, "bodyText");
  });

  it("POST /api/v1/events/:eventId/compose/preview rejects an over-cap ad-hoc subject", async () => {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A, timezone: "UTC" })) };
    });
    const { commsRoutes } = await import("../src/routes/comms");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", commsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/compose/preview", {
        subject: "x".repeat(MAX_TEXT_LENGTH + 1),
        bodyText: "hi",
        submissionIds: ["sub-1"],
      }),
    );
    await expectInvalid(res, "subject");
  });
});

describe("src/routes/api/views.ts", () => {
  it("POST /events/:eventId/views rejects an over-cap name", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    const { viewsRoutes } = await import("../src/routes/api/views");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", viewsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/views", {
        name: "x".repeat(MAX_NAME_LENGTH + 1),
        config: { q: "", status: [], trackId: null, sort: "newest", columns: [] },
      }),
    );
    await expectInvalid(res, "name");
  });
});

describe("src/routes/api/forms.ts", () => {
  it("POST /api/v1/forms/:formId/fields rejects an over-cap label", async () => {
    const form = { id: "form-1", eventId: "ev-1", title: "CFP", intro: null, isDefault: true, openDate: null, closeDate: null, tracks: null };
    vi.doMock("../src/server/repo/forms", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
      return {
        ...actual,
        findFormForOrg: vi.fn(async () => form),
        listFields: vi.fn(async () => []),
      };
    });
    const { formsRoutes } = await import("../src/routes/api/forms");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", formsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/forms/form-1/fields", {
        section: "session",
        kind: "text",
        label: "x".repeat(MAX_NAME_LENGTH + 1),
      }),
    );
    await expectInvalid(res, "label");
  });
});

describe("src/routes/api/portal-config.ts", () => {
  it("PUT /events/:eventId/portal-settings rejects an over-cap welcomeMessage", async () => {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A })) };
    });
    const { portalConfigRoutes } = await import("../src/routes/api/portal-config");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", portalConfigRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/portal-settings", { welcomeMessage: "x".repeat(MAX_LONG_TEXT_LENGTH + 1) }, "PUT"),
    );
    await expectInvalid(res, "welcomeMessage");
  });

  it("POST /events/:eventId/resources (wiki) rejects an over-cap title", async () => {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A })) };
    });
    const { portalConfigRoutes } = await import("../src/routes/api/portal-config");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", portalConfigRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/resources", { title: "x".repeat(MAX_NAME_LENGTH + 1), content: "hi" }),
    );
    await expectInvalid(res, "title");
  });
});

describe("src/routes/review/plans.ts", () => {
  it("POST /api/v1/events/:eventId/plans rejects an over-cap name", async () => {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A })) };
    });
    const { reviewPlansRoutes } = await import("../src/routes/review/plans");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewPlansRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/plans", {
        name: "x".repeat(MAX_NAME_LENGTH + 1),
        scale: { min: 1, max: 5 },
        criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
      }),
    );
    await expectInvalid(res, "name");
  });

  it("criterion label over the name cap is rejected", async () => {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A })) };
    });
    const { reviewPlansRoutes } = await import("../src/routes/review/plans");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", reviewPlansRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/plans", {
        name: "Round 1",
        scale: { min: 1, max: 5 },
        criteria: [{ id: "c1", label: "x".repeat(MAX_NAME_LENGTH + 1), kind: "rating", weight: 1 }],
      }),
    );
    await expectInvalid(res, "criteria");
  });
});

describe("src/routes/files.ts", () => {
  // DEC-244 wave-58 amendment: the comments route caps a reply at
  // MAX_COMMENT_BODY_LENGTH (4000, src/domain/files.ts) -- not
  // forms/validate's MAX_LONG_TEXT_LENGTH (20000), which is for form
  // answers, not this deliverable reply thread.
  it("POST /files/:fileId/comments rejects an over-cap body, counting the overage and marking fields.body", async () => {
    const scope = {
      fileId: "f1",
      submissionId: "sub-1",
      eventId: "ev-1",
      orgId: ORG_A,
      uploadedByContactId: null,
      readParticipantContactIds: [],
      activeParticipantContactIds: [],
      filename: "a.pdf",
      contentType: "application/pdf",
      r2Key: "k",
    };
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return { ...actual, getFileScope: vi.fn(async () => scope) };
    });
    const { fileApiRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", fileApiRoutes);

    const { MAX_COMMENT_BODY_LENGTH } = await import("../src/domain/files");
    const res = await app.request(jsonPost("/api/v1/files/f1/comments", { body: "x".repeat(MAX_COMMENT_BODY_LENGTH + 1) }));
    expect(res.status).toBe(400);
    const parsed = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(parsed.error.code).toBe("invalid");
    expect(parsed.error.fields).toHaveProperty("body");
    expect(parsed.error.message).toContain("1");
    expect(parsed.error.message).toContain(MAX_COMMENT_BODY_LENGTH.toLocaleString("en-US"));
  });
});

describe("src/routes/api/users.ts", () => {
  it("POST /api/v1/users rejects an over-cap email", async () => {
    const { usersRoutes } = await import("../src/routes/api/users");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", usersRoutes);

    const res = await app.request(
      jsonPost("/api/v1/users", { email: `${"x".repeat(MAX_NAME_LENGTH + 1)}@example.com`, role: "reviewer" }),
    );
    await expectInvalid(res, "email");
  });
});

describe("src/routes/api/contacts.ts", () => {
  it("POST /contacts rejects an over-cap firstName", async () => {
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/contacts", {
        firstName: "x".repeat(MAX_NAME_LENGTH + 1),
        lastName: "Doe",
        email: "jane@example.com",
      }),
    );
    await expectInvalid(res, "firstName");
  });

  it("PATCH /contacts/:id rejects an over-cap bio", async () => {
    const contact = {
      id: "c1",
      orgId: ORG_A,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: null,
      company: null,
      title: null,
      bio: null,
      headshotUrl: null,
      notes: null,
      customFieldsJson: null,
      socialLinksJson: null,
      createdAt: 0,
      updatedAt: 0,
    };
    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
        "../src/server/repo/contacts",
      );
      return { ...actual, findContactForOrg: vi.fn(async () => contact) };
    });
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/contacts/c1", { bio: "x".repeat(MAX_LONG_TEXT_LENGTH + 1) }, "PATCH"),
    );
    await expectInvalid(res, "bio");
  });

  it("POST /contacts/import rejects a csvText payload over MAX_IMPORT_CSV_BYTES", async () => {
    const { contactsRoutes, MAX_IMPORT_CSV_BYTES } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/contacts/import", {
        csvText: "x".repeat(MAX_IMPORT_CSV_BYTES + 1),
        mapping: {},
      }),
    );
    await expectInvalid(res, "csvText");
  });

  it("POST /contacts/import rejects more than MAX_IMPORT_ROWS data rows", async () => {
    const { contactsRoutes, MAX_IMPORT_ROWS } = await import("../src/routes/api/contacts");
    const { MAX_IMPORT_ROWS: repoMaxImportRows } = await import("../src/server/repo/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `p${i}@example.com,First,Last`).join("\n");
    const csvText = `email,firstName,lastName\n${rows}`;

    const res = await app.request(
      jsonPost("/api/v1/contacts/import", {
        csvText,
        mapping: { email: "email", firstName: "firstName", lastName: "lastName" },
      }),
    );
    // DEC-478: the route's MAX_IMPORT_ROWS IS the repo's MAX_IMPORT_ROWS --
    // one constant, so the 400 message names the same number the repo layer
    // would separately enforce if this check were ever bypassed.
    expect(MAX_IMPORT_ROWS).toBe(repoMaxImportRows);
    const body = (await res.clone().json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain(String(repoMaxImportRows));
    await expectInvalid(res, "csvText");
  });
});

// ---------------------------------------------------------------------------
// DEC-417 (wave 46 amendment): the sample above walks one over-cap request
// per route FILE. This block is the enumeration the field guide's own rule
// requires — every hand-rolled `typeof body.<name> !== "string"` occurrence
// under src/routes must sit inside a handler that also applies a length
// bound (a MAX_*_LENGTH / *_MAX_LEN reference, a parseBoundedText/
// parseBoundedOptionalText call naming the same field, or an inline
// `<field>.length > <number literal>` check), or the field must be named on
// UNBOUNDED_STRING_FIELDS below with a stated reason. Silence is a defect;
// this scan turns it into a named file:line:field failure. Pattern is the
// DEC-628 source-scan shape already used by test/security-invariants.test.ts.
// ---------------------------------------------------------------------------

const ROUTES_DIR = resolve(fileURLToPath(import.meta.url), "../../src/routes");

/** Deliberate exceptions to "every typeof body.<field> !== 'string' check
 * sits behind a length bound" (DEC-417). Each entry must state WHY the field
 * is exempt — an id, an enum value validated against a closed set, or a
 * payload capped in its own units (bytes, not chars) — never silence. */
export const UNBOUNDED_STRING_FIELDS: Array<{ file: string; field: string; reason: string }> = [
  { file: "content-notes.ts", field: "fileId", reason: "an id looked up against the DB, not free text" },
  { file: "tasks.ts", field: "formId", reason: "an id looked up against the DB, not free text" },
  { file: "api/pipeline.ts", field: "contactId", reason: "an id looked up against the DB, not free text" },
  {
    file: "api/contacts/bulk-email.ts",
    field: "eventId",
    reason: "an id looked up against the DB, not free text",
  },
  { file: "api/contacts/merge.ts", field: "keepId", reason: "an id looked up against the DB, not free text" },
  {
    file: "api/submissions.ts",
    field: "inviteStatus",
    reason: "enum validated against the closed INVITE_STATUS_VALUES set",
  },
  {
    file: "review/plans-reviewers.ts",
    field: "userId",
    reason: "an id looked up against the DB, not free text",
  },
  { file: "api/contacts/crud.ts", field: "eventId", reason: "an id looked up against the DB, not free text" },
  {
    file: "api/contacts/crud.ts",
    field: "role",
    reason: "enum validated against the closed PARTICIPANT_ROLE_OPTIONS set",
  },
  { file: "api/embeds.ts", field: "surface", reason: "enum validated against isSurface's closed set" },
  { file: "api/embeds.ts", field: "format", reason: "enum validated against the closed EMBED_FORMATS set" },
  {
    file: "api/import.ts",
    field: "csvText",
    reason: "bounded in bytes via MAX_IMPORT_CSV_BYTES (TextEncoder), not chars",
  },
  {
    file: "api/contacts/import.ts",
    field: "csvText",
    reason: "bounded in bytes via MAX_IMPORT_CSV_BYTES (TextEncoder), not chars",
  },
  {
    file: "api/contacts/import.ts",
    field: "eventId",
    reason: "an id looked up against the DB, not free text",
  },
  {
    file: "comms/send.ts",
    field: "templateId",
    reason:
      "an id looked up against the DB (DEC-846 wave-3 amendment provenance validation) — a foreign/unknown value 404/400s via findTemplateById, not free text",
  },
];

function listAllSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listAllSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

interface StringCheckOccurrence {
  file: string;
  relFile: string;
  line: number;
  field: string;
  handlerSlice: string;
}

/** From `startIdx`, finds the nearest preceding `(c) => {` / `async (c) =>
 * {` arrow-handler opener, then returns the source slice from that opener to
 * its matching closing brace (found by brace-balancing) — i.e. the full
 * enclosing handler body, so a bound applied ANYWHERE in the handler counts,
 * not just on the same line. */
function enclosingHandlerSlice(source: string, startIdx: number): string {
  const openerRegex = /\(c\)\s*=>\s*\{/g;
  let lastOpenerEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = openerRegex.exec(source))) {
    if (m.index > startIdx) break;
    lastOpenerEnd = m.index + m[0].length;
  }
  if (lastOpenerEnd === -1) {
    // No enclosing arrow handler found — fall back to a generous forward
    // window so a bound placed just below the check is still seen; a
    // failure to find ANY bound in that window is a real finding.
    return source.slice(startIdx, Math.min(source.length, startIdx + 4000));
  }
  let depth = 1;
  let i = lastOpenerEnd;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    i++;
  }
  return source.slice(lastOpenerEnd, i);
}

function isBounded(handlerSlice: string, field: string): boolean {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A named cap constant (MAX_*_LENGTH or *_MAX_LEN) referenced anywhere in
  // the handler, alongside the field's own name somewhere in the handler --
  // conservative (doesn't prove they're wired together on the SAME line),
  // but a false negative here is caught by the field's own route-level test
  // above; this scan exists to catch outright silence, not verify wiring.
  const hasNamedCap = /\bMAX_[A-Z0-9_]*_LENGTH\b|\b[A-Z0-9_]*_MAX_LEN\b/.test(handlerSlice);
  const fieldMentionedWithBound = new RegExp(`\\b${escaped}\\b[\\s\\S]{0,120}?(MAX_[A-Z0-9_]*_LENGTH|[A-Z0-9_]*_MAX_LEN)`).test(
    handlerSlice,
  );
  const parseBoundedCall = new RegExp(
    `parseBounded(?:Optional)?Text\\(\\s*body\\.${escaped}\\b`,
  ).test(handlerSlice);
  const inlineNumericBound = new RegExp(`\\bbody\\.${escaped}\\.length\\s*[><]\\s*\\d+`).test(handlerSlice);
  return (hasNamedCap && fieldMentionedWithBound) || parseBoundedCall || inlineNumericBound;
}

describe("DEC-417 (wave 46 amendment): every typeof body.<field> !== 'string' check is length-bounded or allowlisted", () => {
  const files = listAllSourceFiles(ROUTES_DIR);
  expect(files.length).toBeGreaterThan(0);

  const occurrences: StringCheckOccurrence[] = [];
  const checkRegex = /typeof\s+body\.([A-Za-z0-9_]+)\s*!==\s*"string"/g;
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    let m: RegExpExecArray | null;
    checkRegex.lastIndex = 0;
    while ((m = checkRegex.exec(source))) {
      const field = m[1]!;
      const line = source.slice(0, m.index).split("\n").length;
      const relFile = file.slice(ROUTES_DIR.length + 1).split("\\").join("/");
      occurrences.push({
        file,
        relFile,
        line,
        field,
        handlerSlice: enclosingHandlerSlice(source, m.index),
      });
    }
  }

  it("found at least 30 occurrences (a broken regex must fail loudly, not pass vacuously)", () => {
    expect(occurrences.length).toBeGreaterThanOrEqual(30);
  });

  it("every occurrence is length-bounded in its handler, or named on UNBOUNDED_STRING_FIELDS with a reason", () => {
    const failures: string[] = [];
    for (const occ of occurrences) {
      if (isBounded(occ.handlerSlice, occ.field)) continue;
      const exempt = UNBOUNDED_STRING_FIELDS.find((e) => e.file === occ.relFile && e.field === occ.field);
      if (exempt) {
        expect(exempt.reason.length).toBeGreaterThan(0);
        continue;
      }
      failures.push(`${occ.relFile}:${occ.line}: field '${occ.field}' has no length bound and no allowlist entry`);
    }
    expect(failures).toEqual([]);
  });

  it("every UNBOUNDED_STRING_FIELDS entry names a real occurrence and states a reason", () => {
    for (const exempt of UNBOUNDED_STRING_FIELDS) {
      expect(exempt.reason.length).toBeGreaterThan(0);
      const match = occurrences.find((occ) => occ.relFile === exempt.file && occ.field === exempt.field);
      expect(
        match,
        `UNBOUNDED_STRING_FIELDS names ${exempt.file}:${exempt.field}, which is not a 'typeof body.<field> !== "string"' occurrence`,
      ).toBeDefined();
    }
  });
});
