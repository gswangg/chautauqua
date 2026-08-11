// DEC-245: SSR action-confirmation conventions covering the three findings
// closed in that decision — (a) CFP save-draft redirects with ?draft=saved
// and the GET renders a distinct "Draft saved" banner, (b) headshot upload
// success renders "Headshot uploaded." (distinct from the details form's
// "Profile saved.") next to the preview, and (c) the /login pending-state
// handler (disable + "Signing in…") is pinned as a regression test.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { ContactProfile } from "../src/server/repo/profile";

// ---------------------------------------------------------------------------
// (a) CFP save-draft
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
  closeDate: new Date(Date.UTC(2026, 11, 1)),
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
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
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
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

function submitApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

describe("(a) CFP save-draft SSR confirmation (DEC-245)", () => {
  it("POST save-draft returns 302 with Location ending in ?draft=saved", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = submitApp(db);

    const form = new URLSearchParams();
    form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
    form.set("field__title", "My great talk");
    form.set("field__first_name", "Ada");

    const res = await app.request(
      "/submit/test-conf/save-draft",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
        },
        body: form.toString(),
      },
      { KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location.endsWith("?draft=saved")).toBe(true);
  });

  it("the following GET (with draft cookie) contains 'Draft saved'", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = submitApp(db);

    // Simulate a browser following the redirect: a draft cookie is already
    // set (the save-draft POST set one) and the URL carries ?draft=saved.
    const kv = fakeKv();
    const res = await app.request(
      "/submit/test-conf?draft=saved",
      { headers: { cookie: "chq_draft_form-1=some-token" } },
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Draft saved");
  });
});

// ---------------------------------------------------------------------------
// (b) Headshot upload success message
// ---------------------------------------------------------------------------

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

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  return {
    ...actual,
    getContactProfile: vi.fn(async () => PROFILE_WITH_HEADSHOT),
    setContactHeadshot: vi.fn(async () => "file-new"),
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

function profileApp() {
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

describe("(b) Headshot upload SSR confirmation (DEC-245)", () => {
  it("headshot upload success HTML contains 'Headshot uploaded.' and the <img> preview", async () => {
    const app = profileApp();
    const res = await app.request("/portal/profile?headshot=1");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Headshot uploaded.");
    expect(html).toContain('src="/headshots/file-abc"');
  });
});

// ---------------------------------------------------------------------------
// (c) Login pending-state handler (regression pin)
// ---------------------------------------------------------------------------

describe("(c) /login pending-state handler (DEC-245 ratification)", () => {
  it("GET /login HTML contains id=\"chq-login-submit\" and the onsubmit disable/'Signing in…' handler", async () => {
    const { authRoutes } = await import("../src/routes/auth");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.route("/", authRoutes);

    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="chq-login-submit"');
    expect(html).toContain("b.disabled=true");
    expect(html).toContain("Signing in…");
  });
});
