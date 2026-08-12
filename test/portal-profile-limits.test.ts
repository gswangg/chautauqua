// DEC-422: POST /portal/profile had no length bound on any of its
// free-text fields — an unbounded bio/title/company/social-link write could
// hit SQLITE_TOOBIG as a 500. Every field is now capped at MAX_TEXT_LENGTH
// (bio at MAX_LONG_TEXT_LENGTH) and checked BEFORE updateContactProfile, so
// an over-cap value re-renders <ProfilePage ... error=... /> at 400 naming
// the offending field and never reaches the repo call. Mirrors the
// vi.mock/buildApp pattern in test/portal-profile-headshot-notice.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";
import type { ContactProfile } from "../src/server/repo/profile";

const BASE_PROFILE: ContactProfile = {
  id: "c1",
  firstName: "Jane",
  lastName: "Doe",
  title: null,
  company: null,
  bio: null,
  headshotUrl: null,
  socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
};

let currentProfile: ContactProfile = BASE_PROFILE;
const updateContactProfileMock = vi.fn(async (..._args: unknown[]) => {});

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  return {
    ...actual,
    getContactProfile: vi.fn(async () => currentProfile),
    updateContactProfile: (...args: unknown[]) => updateContactProfileMock(...args),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { eventName: "Test Conf", welcomeMessage: null, accentColor: null, logoUrl: null },
      submissions: [],
      tasks: [],
    })),
  };
});

const { portalProfileRoutes } = await import("../src/routes/portal/profile");

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalProfileRoutes);
  return app;
}

function postProfile(app: Hono<AppEnv>, fields: Record<string, string>) {
  const form = new URLSearchParams();
  form.set("chq_csrf", "test-csrf-token");
  form.set("firstName", "Jane");
  form.set("lastName", "Doe");
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return app.request(
    "/portal/profile",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "chq_csrf=test-csrf-token",
      },
      body: form.toString(),
    },
  );
}

describe("POST /portal/profile — DEC-422 field caps", () => {
  it("rejects an over-cap bio with 400, names the field, and never calls updateContactProfile", async () => {
    currentProfile = BASE_PROFILE;
    updateContactProfileMock.mockClear();
    const app = buildApp();
    const res = await postProfile(app, { bio: "x".repeat(MAX_LONG_TEXT_LENGTH + 1) });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("bio");
    expect(updateContactProfileMock).not.toHaveBeenCalled();
  });

  it("rejects an over-cap social link (twitter) with 400 and never calls updateContactProfile", async () => {
    currentProfile = BASE_PROFILE;
    updateContactProfileMock.mockClear();
    const app = buildApp();
    const res = await postProfile(app, { twitter: "x".repeat(MAX_TEXT_LENGTH + 1) });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("twitter");
    expect(updateContactProfileMock).not.toHaveBeenCalled();
  });

  it("saves successfully when bio and social links are exactly at their caps", async () => {
    currentProfile = BASE_PROFILE;
    updateContactProfileMock.mockClear();
    const app = buildApp();
    const bio = "x".repeat(MAX_LONG_TEXT_LENGTH);
    const twitter = "y".repeat(MAX_TEXT_LENGTH);
    const res = await postProfile(app, { bio, twitter });

    // DEC-574: a successful save is a PRG redirect carrying ?saved=1, not an
    // inline 200 — no headshot part here, so no &headshot=1.
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/profile?saved=1");
    expect(updateContactProfileMock).toHaveBeenCalledTimes(1);
    const callArgs = updateContactProfileMock.mock.calls[0]!;
    const payload = callArgs[2] as { bio: string | null; socialLinks: { twitter: string } };
    expect(payload.bio).toBe(bio);
    expect(payload.socialLinks.twitter).toBe(twitter);
  });
});
