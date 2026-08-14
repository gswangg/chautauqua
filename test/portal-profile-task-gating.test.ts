// DEC-009 amendment (wave 59): the portal profile save path
// (src/routes/portal/profile.tsx) must call completeProfileTaskForContact
// ONLY once the saved contact ends the request with BOTH a non-empty bio
// AND a headshot -- a bio-only or headshot-only save must leave any pending
// "Finalize bio + headshot" assignment untouched. Mirrors
// test/contact-profile-roundtrip.test.ts's mock-repo pattern; the real SQL
// closure semantics are covered separately by
// test/profile-task-completion.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";

interface FakeRow {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  headshotUrl: string | null;
  socialLinksJson: string | null;
}

const row: FakeRow = {
  id: "c-1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: null,
  company: null,
  bio: null,
  headshotUrl: null,
  socialLinksJson: null,
};

const completeProfileTaskForContact = vi.fn(async () => 0);

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
    updateContactProfile: vi.fn(async (_db: unknown, contactId: string, input: { bio: string | null }) => {
      if (contactId !== row.id) throw new Error("unknown contact");
      row.bio = input.bio;
    }),
    completeProfileTaskForContact,
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

const { portalProfileRoutes } = await import("../src/routes/portal/profile");

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

const speakerAuth: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: "org-1", contactId: "c-1" };

async function csrfToken(app: Hono<AppEnv>): Promise<{ token: string; cookie: string }> {
  const getRes = await app.request("/portal/profile");
  const setCookie = getRes.headers.get("set-cookie") ?? "";
  const token = /chq_csrf=([^;]+)/.exec(setCookie)?.[1]!;
  return { token, cookie: `${CSRF_COOKIE_NAME}=${token}` };
}

async function saveProfile(app: Hono<AppEnv>, bio: string) {
  const { token, cookie } = await csrfToken(app);
  return app.request("/portal/profile", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams({
      [CSRF_COOKIE_NAME]: token,
      firstName: "Ada",
      lastName: "Lovelace",
      bio,
    }).toString(),
  });
}

describe("DEC-009 amendment: portal profile save gates the profile-task completion call", () => {
  it("bio only (no headshot on file) never calls completeProfileTaskForContact", async () => {
    row.bio = null;
    row.headshotUrl = null;
    completeProfileTaskForContact.mockClear();
    const app = portalApp(speakerAuth);
    const res = await saveProfile(app, "I build difference engines.");
    expect(res.status).toBe(302);
    expect(completeProfileTaskForContact).not.toHaveBeenCalled();
  });

  it("headshot on file but a blank bio submit never calls completeProfileTaskForContact", async () => {
    row.bio = null;
    row.headshotUrl = "/headshots/f-1";
    completeProfileTaskForContact.mockClear();
    const app = portalApp(speakerAuth);
    const res = await saveProfile(app, "");
    expect(res.status).toBe(302);
    expect(completeProfileTaskForContact).not.toHaveBeenCalled();
  });

  it("bio + a headshot already on file calls completeProfileTaskForContact exactly once", async () => {
    row.bio = null;
    row.headshotUrl = "/headshots/f-1";
    completeProfileTaskForContact.mockClear();
    const app = portalApp(speakerAuth);
    const res = await saveProfile(app, "I build difference engines.");
    expect(res.status).toBe(302);
    expect(completeProfileTaskForContact).toHaveBeenCalledTimes(1);
    expect(completeProfileTaskForContact.mock.calls[0]!.slice(1)).toEqual(["c-1", "org-1", "u-speaker"]);
  });
});
