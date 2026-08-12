// DEC-626: an HTML form post never ends as a JSON blob, and the public CFP
// keeps the submitter's answers. Covers:
//  - POST /submit/:eventSlug with no chq_csrf cookie re-renders <SubmitPage>
//    (text/html, 400) with the submitted answers intact.
//  - the rate-limited branch re-renders <SubmitPage> (text/html, 429) with
//    the answers and the limit message, rather than throwing.
//  - POST /login with no cookie returns text/html, not the JSON envelope.
//  - an /api/v1-style route (csrfJson) still returns the JSON envelope.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler, ApiError } from "../src/server/http";
import { csrfJson } from "../src/server/middleware";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { scopedRateLimitKey } from "../src/lib/rate-limit";
import type { AppEnv } from "../src/server/env";

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

function fakeKv(initial?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
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

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

describe("POST /submit/:eventSlug - DEC-626 htmlSurface", () => {
  it("with no chq_csrf cookie re-renders the SubmitPage (text/html, 400) with the submitted title intact", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);

    const form = new URLSearchParams();
    form.set("field__title", "My Expired-Session Talk");
    form.set("field__first_name", "Ada");

    const res = await app.request(
      "/submit/test-conf",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      },
      { KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("My Expired-Session Talk");
    expect(body).toContain("your answers are still here");
  });

  it("rate-limited path re-renders the SubmitPage (text/html, 429) with answers and the limit message", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);

    const now = Date.now();
    const key = scopedRateLimitKey("submit", "unknown", Math.floor(now / (3600 * 1000)) * 3600 * 1000);
    const kv = fakeKv({ [key]: "60" });

    const form = new URLSearchParams();
    form.set(CSRF_COOKIE_NAME, "tok-1");
    form.set("field__title", "My Rate-Limited Talk");
    form.set("field__first_name", "Ada");

    const res = await app.request(
      "/submit/test-conf",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `${CSRF_COOKIE_NAME}=tok-1` },
        body: form.toString(),
      },
      { KV: kv } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("My Rate-Limited Talk");
    expect(body).toContain("Too many submissions from this address");
  });
});

describe("POST /login - DEC-626 htmlSurface", () => {
  it("with no cookie returns text/html, not the JSON envelope", async () => {
    const db = fakeDb([]);
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);

    const form = new URLSearchParams();
    form.set("email", "a@example.com");
    form.set("password", "irrelevant");

    const res = await app.request("/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).not.toContain('"error"');
  });
});

describe("csrfJson (/api/v1-style) - DEC-626 htmlSurface", () => {
  it("an unmarked JSON route still returns the JSON error envelope", async () => {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.post("/api/v1/thing", csrfJson, async (c) => {
      throw new ApiError("invalid", "should never reach here");
    });

    const res = await app.request("/api/v1/thing", { method: "POST" });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.message).toBe("Missing or invalid CSRF header");
  });
});
