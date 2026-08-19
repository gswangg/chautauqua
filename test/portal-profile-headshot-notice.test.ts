// w1-i / DEC-245 (docs/eval-findings.md Section D): the headshot upload
// flow renders the CURRENT headshot next to the upload control (existing
// gated /headshots/:fileId route), and a successful upload redirects with
// ?headshot=1 so a fresh GET renders a distinct 'Headshot uploaded.'
// success notice near the Headshot section (separate from the details
// form's 'Profile saved.' under ?saved=1) — mirrors the vi.mock pattern in
// test/portal-edit-speaker-locked-route.test.ts.

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

// DEC-894: the dimension gate now runs for webp too, so a webp fixture used
// to exercise a successful upload must be real bytes a RIFF/VP8X reader can
// parse — a minimal extended-format (VP8X) container well under the
// MAX_HEADSHOT_EDGE_PX gate.
// Return type is the narrow ArrayBuffer-backed view (not Uint8Array<ArrayBufferLike>)
// so the bytes are assignable to BlobPart in `new File([...])`.
function minimalWebpBytes(width = 100, height = 100): Uint8Array<ArrayBuffer> {
  const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const u24le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
  const payload = [0, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)];
  const chunk = [0x56, 0x50, 0x38, 0x58 /* "VP8X" */, ...u32le(payload.length), ...payload];
  const riffSize = 4 + chunk.length;
  const header = [0x52, 0x49, 0x46, 0x46 /* "RIFF" */, ...u32le(riffSize), 0x57, 0x45, 0x42, 0x50 /* "WEBP" */];
  return new Uint8Array([...header, ...chunk]);
}

const setContactHeadshotMock = vi.fn(async (..._args: unknown[]) => "file-new");
const updateContactProfileMock = vi.fn(async (..._args: unknown[]) => undefined);
// DEC-009 amendment (wave 59): the profile save path now conditionally
// calls completeProfileTaskForContact when the save leaves both a bio and a
// headshot in place — this test's fake `db` (an empty object, see buildApp
// below) doesn't support real drizzle queries, so the real implementation
// must be replaced here too, same as setContactHeadshot/updateContactProfile.
const completeProfileTaskForContactMock = vi.fn(async (..._args: unknown[]) => 0);

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  return {
    ...actual,
    getContactProfile: vi.fn(async () => currentProfile),
    setContactHeadshot: (...args: unknown[]) => setContactHeadshotMock(...args),
    updateContactProfile: (...args: unknown[]) => updateContactProfileMock(...args),
    completeProfileTaskForContact: (...args: unknown[]) => completeProfileTaskForContactMock(...args),
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

  // Eval D24: the headshot rendered with alt="", i.e. presentational, so the
  // only image on the screen was invisible to the a11y tree and a screen
  // reader could not tell the loaded-photo branch from the empty-box one.
  // The alt names the person, the same `${firstName} ${lastName}` idiom the
  // public speaker renderers use (src/routes/public/detail.tsx,
  // src/routes/public/speakers.tsx).
  it("gives the headshot an alt naming the speaker, never the presentational alt=\"\"", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect(html).toContain('alt="Jane Doe"');
    expect(html).not.toContain('alt=""');
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

describe("GET /portal/profile?headshot=1 — distinct headshot success notice", () => {
  it("renders 'Headshot uploaded.' (not 'Profile saved.') when the headshot=1 flag is present", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile?headshot=1");
    const html = await res.text();
    expect(html).toContain("Headshot uploaded.");
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

describe("POST /portal/profile (with a headshot part)", () => {
  function postProfile(app: Hono<AppEnv>, file?: File) {
    const form = new FormData();
    form.set("chq_csrf", "test-csrf-token");
    form.set("firstName", "Jane");
    form.set("lastName", "Doe");
    if (file) form.set("headshot", file);
    return app.request(
      "/portal/profile",
      {
        method: "POST",
        headers: { cookie: "chq_csrf=test-csrf-token" },
        body: form,
      },
      { FILES: fakeFilesBucket() } as unknown as AppEnv["Bindings"],
    );
  }

  it("redirects to /portal/profile?saved=1&headshot=1 on a successful upload (PRG)", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const file = new File([minimalWebpBytes()], "photo.webp", { type: "image/webp" });
    const res = await postProfile(app, file);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/profile?saved=1&headshot=1");
  });

  it("redirects to /portal/profile?saved=1 (no headshot flag) when no file part is submitted", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await postProfile(app);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/profile?saved=1");
  });

  it("rejects an empty-file submit with a clear validation error, not a silent success", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const emptyFile = new File([], "photo.webp", { type: "image/webp" });
    const res = await postProfile(app, emptyFile);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("File is empty");
  });
});

// DEC-574: one multipart POST must carry both a changed bio and a headshot
// file, and persist both — the prior split-form design lost the bio when a
// photo was uploaded.
describe("POST /portal/profile — merged form persists bio and headshot together", () => {
  function fakeFileStoreBucket() {
    const puts: Array<{ key: string; contentType: string | undefined }> = [];
    return {
      bucket: {
        async put(key: string, _value: unknown, contentType?: string) {
          puts.push({ key, contentType });
        },
        async get() {
          return null;
        },
        async delete() {},
      } as unknown as AppEnv["Bindings"]["FILES"],
      puts,
    };
  }

  it("persists a changed bio and a headshot upload from a single multipart POST", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const { bucket, puts } = fakeFileStoreBucket();

    const form = new FormData();
    form.set("chq_csrf", "test-csrf-token");
    form.set("firstName", "Jane");
    form.set("lastName", "Doe");
    form.set("bio", "A brand new bio written just before the upload.");
    form.set("headshot", new File([minimalWebpBytes()], "photo.webp", { type: "image/webp" }));

    const res = await app.request(
      "/portal/profile",
      {
        method: "POST",
        headers: { cookie: "chq_csrf=test-csrf-token" },
        body: form,
      },
      { FILES: bucket } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/profile?saved=1&headshot=1");
    // The headshot was actually stored (file store received the upload)...
    expect(puts.length).toBe(1);
    expect(setContactHeadshotMock).toHaveBeenCalled();
    // ...and updateContactProfile was called with the submitted bio, not
    // silently dropped because a file was also present in the same body.
    expect(updateContactProfileMock).toHaveBeenCalledWith(
      expect.anything(),
      "c1",
      expect.objectContaining({ bio: "A brand new bio written just before the upload." }),
    );
  });
});

describe("GET /portal/profile — merged form", () => {
  it("renders exactly one <form> in the details/headshot region (the page's other <form> is the layout's sign-out button)", async () => {
    currentProfile = PROFILE_WITH_HEADSHOT;
    const app = buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    // Isolate the details/headshot region from the layout chrome (which has
    // its own single-purpose sign-out <form>, demoted to a page footer by
    // w2-g/DEC-590 — still outside <main>, just after it instead of before)
    // before counting <form> tags — this is what "one form for the whole
    // details+headshot region" means. The <form> element opens before the
    // "Headshot" section it wraps, so anchor on its own action attribute
    // rather than the section label, and stop at </main> so the footer's
    // sign-out form is excluded.
    const region = html.slice(html.indexOf('<form method="post" action="/portal/profile"'), html.indexOf("</main>"));
    const formOpenCount = (region.match(/<form\b/g) ?? []).length;
    expect(formOpenCount).toBe(1);
    // Both the file input and a details field live in that one form.
    expect(region).toContain('name="headshot"');
    expect(region).toContain('name="firstName"');
  });
});
