// DEC-454/DEC-455: one canonical email rule + "required means non-blank",
// exercised at the pure-core level (src/domain/email.ts, validateAnswers)
// and at the two route surfaces that write contact.email.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { normalizeEmail, isValidEmail, MAX_EMAIL_LENGTH, MAX_EMAIL_LOCAL_LENGTH } from "../src/domain/email";
import { validateAnswers } from "../src/forms/validate";
import type { FormFieldDef } from "../src/forms/types";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { R2Bucket } from "@cloudflare/workers-types";

// ---------------------------------------------------------------------------
// src/domain/email.ts — normalizeEmail/isValidEmail table
// ---------------------------------------------------------------------------

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM  ")).toBe("alice@example.com");
  });
});

describe("isValidEmail", () => {
  it.each([
    ["", false],
    ["   ", false],
    ["a@b", false],
    ["a@@b.com", false],
    ["a b@c.com", false],
    [`${"x".repeat(60)}@${"y".repeat(240)}.com`, false], // over 254 total
  ])("rejects %j", (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });

  it("rejects an over-length local part (>64 chars)", () => {
    const local = "a".repeat(MAX_EMAIL_LOCAL_LENGTH + 1);
    expect(isValidEmail(`${local}@example.com`)).toBe(false);
  });

  it("accepts a local part exactly at the cap", () => {
    const local = "a".repeat(MAX_EMAIL_LOCAL_LENGTH);
    expect(isValidEmail(`${local}@example.com`)).toBe(true);
  });

  it("rejects an address over MAX_EMAIL_LENGTH total", () => {
    const address = `a@${"b".repeat(MAX_EMAIL_LENGTH)}.com`;
    expect(address.length).toBeGreaterThan(MAX_EMAIL_LENGTH);
    expect(isValidEmail(address)).toBe(false);
  });

  it.each([
    "person+tag@example.com", // plus-addressing
    "a@sub.example.com", // subdomain
    "a@my-domain.co", // hyphenated domain
    "  Person@Example.COM  ", // valid after normalization
  ])("accepts %j", (input) => {
    expect(isValidEmail(input)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAnswers — DEC-455 blank-string absence + DEC-454 email field
// ---------------------------------------------------------------------------

describe("validateAnswers — DEC-455 whitespace-only required text", () => {
  const fields: FormFieldDef[] = [
    { id: "title", section: "session", kind: "text", label: "Title", required: true, position: 0 },
  ];

  it("a whitespace-only value for a required text field is rejected as required", () => {
    const result = validateAnswers(fields, { title: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBe("required");
  });
});

describe("validateAnswers — DEC-454 locked email field", () => {
  const fields: FormFieldDef[] = [
    { id: "email", section: "speaker", kind: "text", label: "Email", required: true, position: 0 },
  ];

  it("a whitespace-only email is rejected as required, never reaching cleaned as an empty string", () => {
    const result = validateAnswers(fields, { email: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBe("required");
    }
  });

  it("an invalid (non-blank) email is rejected with the canonical message", () => {
    const result = validateAnswers(fields, { email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBe("must be a valid email address");
  });

  it("a valid email is normalized into cleaned", () => {
    const result = validateAnswers(fields, { email: "  Alice@Example.COM  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cleaned.email).toBe("alice@example.com");
  });
});

// ---------------------------------------------------------------------------
// POST /submit/:eventSlug — whitespace email re-renders 400, no persistence
// ---------------------------------------------------------------------------

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const updates: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push(vals);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts, updates };
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function fakeFilesBucket(): R2Bucket {
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
}

const CSRF_TOKEN = "test-csrf-token";
const BINDINGS = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

function submitForm(overrides: Record<string, string>) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("field__first_name", "Ada");
  form.set("field__last_name", "Lovelace");
  form.set("field__email", "ada@example.com");
  for (const [k, v] of Object.entries(overrides)) {
    form.set(`field__${k}`, v);
  }
  form.set("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

describe("POST /submit/:eventSlug — DEC-455 whitespace email", () => {
  it("a whitespace-only email re-renders 400 and persists nothing", async () => {
    const { publicSubmitRoutes } = await import("../src/routes/public/submit");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const { db, inserts, updates } = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);

    const req = submitForm({ email: "   " });
    const res = await app.request(req, undefined, {
      ...BINDINGS,
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
    } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Contacts API — POST /contacts email validation + normalization
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function jsonPost(path: string, body: unknown, method = "POST") {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("src/routes/api/contacts.ts — DEC-454 email validation", () => {
  it("POST /contacts with 'not-an-email' is 400", async () => {
    const { registerErrorHandler: dynRegisterErrorHandler } = await import("../src/server/http");
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    dynRegisterErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/contacts", { firstName: "Jane", lastName: "Doe", email: "not-an-email" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { fields?: Record<string, string> } };
    expect(body.error?.fields).toHaveProperty("email");
  });

  it("POST /contacts stores 'Alice@Example.com ' normalized (lowercased, trimmed)", async () => {
    let capturedEmail: string | undefined;
    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
        "../src/server/repo/contacts",
      );
      return {
        ...actual,
        createContact: async (
          _db: unknown,
          _orgId: string,
          values: { email: string; firstName: string; lastName: string },
        ) => {
          capturedEmail = values.email;
          return {
            id: "c1",
            orgId: ORG_A,
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
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
        },
      };
    });

    const { registerErrorHandler: dynRegisterErrorHandler } = await import("../src/server/http");
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    dynRegisterErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/contacts", { firstName: "Alice", lastName: "Doe", email: "Alice@Example.com " }),
    );
    expect(res.status).toBe(201);
    expect(capturedEmail).toBe("alice@example.com");
  });
});
