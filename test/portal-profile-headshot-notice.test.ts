// w1-i (docs/eval-findings.md Section D): the headshot upload flow now
// renders the CURRENT headshot next to the upload control (existing gated
// /headshots/:fileId route), and a successful upload redirects with
// ?saved=1 so a fresh GET renders a success notice — mirrors the vi.mock
// pattern in test/portal-edit-speaker-locked-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactProfile } from "../src/server/repo/profile";

const PROFILE_WITH_HEADSHOT: ContactProfile = {
  id: "c1",
  firstName: "Jane",
  lastName: "Doe",
  title: null,
  company: null,
  bio: null,
  headshotUrl: "/headshots/file-abc",
  socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
};

const PROFILE_NO_HEADSHOT: ContactProfile = { ...PROFILE_WITH_HEADSHOT, headshotUrl: null };

const setContactHeadshotMock = vi.fn(async (..._args: unknown[]) => "file-new");

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  return {
    ...actual,
    getContactProfile: vi.fn(async () => currentProfile),
    setContactHeadshot: (...args: unknown[]) => setContactHeadshotMock(...args),
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

// Mutable module-level fixture read by the getContactProfile mock above.
let currentProfile: ContactProfile = PROFILE_WITH_HEADSHOT;

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

describe("GET /portal/profile — current headshot preview", () => {
  it("renders an <img> pointing at the gated /headshots/:fileId route when a headshot is on file", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('src="/headshots/file-abc"');
  });

  it("shows a no-headshot placeholder when none is on file", async () => {
    currentProfile = PROFILE_NO_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect(html).not.toContain("<img");
    expect(html).toContain("No headshot uploaded yet.");
  });
});

describe("GET /portal/profile?saved=1 — success notice", () => {
  it("renders the saved notice when the saved=1 flag is present", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile?saved=1");
    const html = await res.text();
    expect(html).toContain("Profile saved.");
  });

  it("does not render the saved notice without the flag", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect(html).not.toContain("Profile saved.");
  });
});

function fakeFilesBucket() {
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as AppEnv["Bindings"]["FILES"];
}

describe("POST /portal/profile/headshot", () => {
  function postHeadshot(app: Hono<AppEnv>, file?: File) {
    const form = new FormData();
    form.set("chq_csrf", "test-csrf-token");
    if (file) form.set("headshot", file);
    return app.request(
      "/portal/profile/headshot",
      {
        method: "POST",
        headers: { cookie: "chq_csrf=test-csrf-token" },
        body: form,
      },
      { FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"],
    );
  }

  it("redirects to /portal/profile?saved=1 on a successful upload (PRG)", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const file = new File([new Uint8Array([1, 2, 3])], "photo.webp", { type: "image/webp" });
    const res = await postHeadshot(app, file);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/profile?saved=1");
  });

  it("rejects an empty-file submit with a clear validation error, not a silent success", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const emptyFile = new File([], "photo.webp", { type: "image/webp" });
    const res = await postHeadshot(app, emptyFile);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("File is empty");
  });
});
