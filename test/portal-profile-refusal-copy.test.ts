// w57-e: the portal profile refusal used to print the raw request-body key
// ("twitter is too long.") with no overage figure and no form-label
// vocabulary. It now names the <label> text the speaker actually sees and
// says how far over the cap they are, via countOf (src/domain/count-copy.ts)
// -- never a hand-spelled "character(s)". Mirrors the vi.mock/buildApp
// pattern in test/portal-profile-limits.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";
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
  return app.request("/portal/profile", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: "chq_csrf=test-csrf-token",
    },
    body: form.toString(),
  });
}

describe("POST /portal/profile refusal copy (w57-e)", () => {
  it("a bio one character over the cap re-renders 400 with the typed name/bio prefix and 'Bio is 1 character over the limit.'", async () => {
    currentProfile = BASE_PROFILE;
    updateContactProfileMock.mockClear();
    const app = buildApp();
    const bio = "x".repeat(MAX_LONG_TEXT_LENGTH + 1);
    const res = await postProfile(app, { firstName: "Ada", lastName: "Lovelace", bio });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Bio is 1 character over the limit. Nothing else was saved.");
    expect(html).toContain("Ada");
    expect(html).toContain("Lovelace");
    expect(html).toContain(bio.slice(0, 50));
    expect(updateContactProfileMock).not.toHaveBeenCalled();
  });

  it("a bio exactly at the cap saves and redirects 302 to /portal/profile?saved=1", async () => {
    currentProfile = BASE_PROFILE;
    updateContactProfileMock.mockClear();
    const app = buildApp();
    const bio = "x".repeat(MAX_LONG_TEXT_LENGTH);
    const res = await postProfile(app, { bio });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/profile?saved=1");
    expect(updateContactProfileMock).toHaveBeenCalledTimes(1);
  });

  it("a 3-character overage says '3 characters over'", async () => {
    currentProfile = BASE_PROFILE;
    updateContactProfileMock.mockClear();
    const app = buildApp();
    const bio = "x".repeat(MAX_LONG_TEXT_LENGTH + 3);
    const res = await postProfile(app, { bio });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("3 characters over");
    expect(updateContactProfileMock).not.toHaveBeenCalled();
  });
});
