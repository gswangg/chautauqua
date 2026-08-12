// SPK-08/CNT-10 round-trip (task-w1-e, DEC-142): a speaker's portal-edited
// bio/social links must be visible (and organizer-editable) on the contact
// detail surface, and an organizer's bio edit must be visible back on the
// speaker's own portal profile. This test shares one in-memory contact
// "row" across mocked src/server/repo/profile.ts and
// src/server/repo/contacts.ts calls so a write through one route is
// observable through the other — a true round trip, without standing up a
// real D1/drizzle instance (see test/profile.test.ts's note: full D1 round
// trips are verified against wrangler dev, not vitest, in stage 1).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";

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

const row: FakeRow = {
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

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>(
    "../src/server/repo/profile",
  );
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
    updateContactProfile: vi.fn(async (_db: unknown, contactId: string, input: {
      firstName: string;
      lastName: string;
      title: string | null;
      company: string | null;
      bio: string | null;
      socialLinks: import("../src/server/repo/profile").SocialLinks;
    }) => {
      if (contactId !== row.id) throw new Error("unknown contact");
      row.firstName = input.firstName;
      row.lastName = input.lastName;
      row.title = input.title;
      row.company = input.company;
      row.bio = input.bio;
      row.socialLinksJson = actual.serializeSocialLinks(input.socialLinks);
      row.updatedAt = new Date();
    }),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>(
    "../src/server/repo/portal",
  );
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
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
    "../src/server/repo/contacts",
  );
  return {
    ...actual,
    findContactForOrg: vi.fn(async (_db: unknown, id: string, orgId: string) => {
      if (id !== row.id || orgId !== row.orgId) return null;
      return { ...row };
    }),
    getContactHistory: vi.fn(async () => []),
    patchContact: vi.fn(async (_db: unknown, id: string, patch: Record<string, unknown>) => {
      if (id !== row.id) throw new Error("unknown contact");
      if (patch.bio !== undefined) row.bio = patch.bio as string | null;
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

function csrfCookieHeader(token: string): string {
  return `${CSRF_COOKIE_NAME}=${token}`;
}

describe("SPK-08/CNT-10 organizer<->speaker profile round trip (DEC-142)", () => {
  it("speaker portal bio+social edit is visible to the organizer detail GET", async () => {
    const app = portalApp(speakerAuth);

    // Prime a CSRF cookie via the GET, matching ContactDrawer/portal usage.
    const getRes = await app.request("/portal/profile");
    expect(getRes.status).toBe(200);
    const setCookie = getRes.headers.get("set-cookie") ?? "";
    const token = /chq_csrf=([^;]+)/.exec(setCookie)?.[1];
    expect(token).toBeTruthy();

    const postRes = await app.request("/portal/profile", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: csrfCookieHeader(token!),
      },
      body: new URLSearchParams({
        [CSRF_COOKIE_NAME]: token!,
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "I build difference engines.",
        twitter: "https://twitter.com/ada",
      }).toString(),
    });
    // DEC-574: the save is a PRG redirect; the 'Profile saved.' notice now
    // renders on the followed GET under ?saved=1 rather than in the POST body.
    expect(postRes.status).toBe(302);
    expect(postRes.headers.get("location")).toBe("/portal/profile?saved=1");
    const savedRes = await app.request("/portal/profile?saved=1");
    expect(savedRes.status).toBe(200);
    expect(await savedRes.text()).toContain("Profile saved.");

    const admin = adminApp(organizerAuth);
    const detailRes = await admin.request("/api/v1/contacts/c-1");
    expect(detailRes.status).toBe(200);
    const body = (await detailRes.json()) as { bio: string; socialLinks: { twitter: string } };
    expect(body.bio).toBe("I build difference engines.");
    expect(body.socialLinks.twitter).toBe("https://twitter.com/ada");
  });

  it("organizer PATCH of bio is visible on the speaker's own portal profile GET", async () => {
    const admin = adminApp(organizerAuth);
    const patchRes = await admin.request("/api/v1/contacts/c-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ bio: "Organizer-edited bio." }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { bio: string };
    expect(patched.bio).toBe("Organizer-edited bio.");

    const portal = portalApp(speakerAuth);
    const profileRes = await portal.request("/portal/profile");
    expect(profileRes.status).toBe(200);
    const html = await profileRes.text();
    expect(html).toContain("Organizer-edited bio.");
  });
});
