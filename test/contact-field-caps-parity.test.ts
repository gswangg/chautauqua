// DEC-422 (amendment, wave 61): one cap per contact field across both roles
// (the portal speaker self-edit at POST /portal/profile and the CRM
// organizer edit at PATCH /api/v1/contacts/:id). This enumerates every
// shared free-text field and drives BOTH routes at the same length, so a
// cap that drifts between the two surfaces (or a field added to one side
// and not the other) fails loudly here rather than as a silent lockout —
// see FINDINGS w61-c: a speaker's own profile edit could otherwise lock the
// producer out of their contact drawer.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";

interface FakeRow {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  headshotUrl: string | null;
  notes: string | null;
  customFieldsJson: string | null;
  socialLinksJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const baseRow: FakeRow = {
  id: "c-1",
  orgId: "org-1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: null,
  company: null,
  title: null,
  bio: null,
  headshotUrl: null,
  notes: null,
  customFieldsJson: null,
  socialLinksJson: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

let row: FakeRow = { ...baseRow };

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  return {
    ...actual,
    getContactProfile: vi.fn(async (_db: unknown, contactId: string) => {
      if (contactId !== row.id) return null;
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        title: row.title,
        company: row.company,
        bio: row.bio,
        headshotUrl: row.headshotUrl,
        socialLinks: actual.parseSocialLinks(row.socialLinksJson),
      };
    }),
    updateContactProfile: vi.fn(
      async (
        _db: unknown,
        contactId: string,
        input: {
          firstName: string;
          lastName: string;
          title: string | null;
          company: string | null;
          bio: string | null;
          socialLinks: import("../src/server/repo/profile").SocialLinks;
        },
      ) => {
        if (contactId !== row.id) throw new Error("unknown contact");
        row.firstName = input.firstName;
        row.lastName = input.lastName;
        row.title = input.title;
        row.company = input.company;
        row.bio = input.bio;
        row.socialLinksJson = actual.serializeSocialLinks(input.socialLinks);
        row.updatedAt = new Date();
      },
    ),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { eventId: null, eventName: "Speaker Portal", welcomeMessage: null, accentColor: null, logoUrl: null, showResources: true },
      submissions: [],
      tasks: [],
    })),
  };
});

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactForOrg: vi.fn(async (_db: unknown, id: string, orgId: string) => {
      if (id !== row.id || orgId !== row.orgId) return null;
      return { ...row };
    }),
    getContactHistory: vi.fn(async () => []),
    patchContact: vi.fn(async (_db: unknown, id: string, patch: Record<string, unknown>) => {
      if (id !== row.id) throw new Error("unknown contact");
      Object.assign(row, patch);
      row.updatedAt = new Date();
      return { ...row };
    }),
  };
});

const { portalProfileRoutes } = await import("../src/routes/portal/profile");
const { contactsRoutes } = await import("../src/routes/api/contacts");

function portalApp(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  app.route("/portal", portalProfileRoutes);
  return app;
}

function adminApp(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const speakerAuth: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: "org-1", contactId: "c-1" };
const organizerAuth: AuthInfo = { userId: "u-org", role: "organizer", orgId: "org-1" };

async function postPortalProfile(value: string, fieldName: string): Promise<Response> {
  const app = portalApp(speakerAuth);
  const getRes = await app.request("/portal/profile");
  const setCookie = getRes.headers.get("set-cookie") ?? "";
  const token = /chq_csrf=([^;]+)/.exec(setCookie)?.[1]!;
  const fields: Record<string, string> = { firstName: "Ada", lastName: "Lovelace" };
  fields[fieldName] = value;
  return app.request("/portal/profile", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${CSRF_COOKIE_NAME}=${token}`,
    },
    body: new URLSearchParams({ [CSRF_COOKIE_NAME]: token, ...fields }).toString(),
  });
}

// Identity fields patch directly; social links patch through the nested
// socialLinks object (crud.ts:319-344).
const SOCIAL_FIELDS = new Set(["twitter", "linkedin", "github", "website"]);

async function patchContact(value: string, fieldName: string): Promise<Response> {
  const app = adminApp(organizerAuth);
  const body = SOCIAL_FIELDS.has(fieldName)
    ? { socialLinks: { twitter: "", linkedin: "", github: "", website: "", [fieldName]: value } }
    : { [fieldName]: value };
  return app.request("/api/v1/contacts/c-1", {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

interface FieldCase {
  field: string;
  max: number;
}

const FIELDS: FieldCase[] = [
  { field: "firstName", max: MAX_NAME_LENGTH },
  { field: "lastName", max: MAX_NAME_LENGTH },
  { field: "title", max: MAX_NAME_LENGTH },
  { field: "company", max: MAX_NAME_LENGTH },
  { field: "bio", max: MAX_LONG_TEXT_LENGTH },
  { field: "twitter", max: MAX_TEXT_LENGTH },
  { field: "linkedin", max: MAX_TEXT_LENGTH },
  { field: "github", max: MAX_TEXT_LENGTH },
  { field: "website", max: MAX_TEXT_LENGTH },
];

describe("contact field caps agree between the portal and the CRM (DEC-422)", () => {
  for (const { field, max } of FIELDS) {
    it(`${field}: both routes accept exactly ${max} chars and refuse ${max + 1}`, async () => {
      row = { ...baseRow };
      const atMax = "x".repeat(max);
      const overMax = "x".repeat(max + 1);

      const portalOk = await postPortalProfile(atMax, field);
      expect(portalOk.status, `portal accept at max for ${field}`).toBe(302);

      row = { ...baseRow };
      const portalRefused = await postPortalProfile(overMax, field);
      expect(portalRefused.status, `portal refuse over max for ${field}`).toBe(400);

      row = { ...baseRow };
      const crmOk = await patchContact(atMax, field);
      expect(crmOk.status, `crm accept at max for ${field}`).toBe(200);

      const crmRefused = await patchContact(overMax, field);
      expect(crmRefused.status, `crm refuse over max for ${field}`).toBe(400);
    });
  }

  // A fifth field added to only one side (a field present in FIELDS whose
  // cap disagrees between the two routes) would fail the parametrized case
  // above by asserting a 302/200 where a 400 lands, or vice versa -- this
  // enumeration IS the parity check.

  it("both refusals name the overage (not a bare 'Max N')", async () => {
    row = { ...baseRow };
    const overMax = "x".repeat(MAX_NAME_LENGTH + 1);

    const portalRes = await postPortalProfile(overMax, "firstName");
    expect(portalRes.status).toBe(400);
    const portalHtml = await portalRes.text();
    expect(portalHtml).toContain("First name is 1 character over the limit.");

    row = { ...baseRow };
    const crmRes = await patchContact(overMax, "firstName");
    expect(crmRes.status).toBe(400);
    const crmBody = (await crmRes.json()) as { error: { fields?: Record<string, string> } };
    expect(crmBody.error.fields?.firstName).toBe("1 character over");
  });
});
