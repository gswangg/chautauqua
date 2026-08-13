// DEC-811: one malformed cookie on the domain (e.g. `foo=100%`, a bare '%'
// that decodeURIComponent rejects as a bad escape sequence) must not 500
// every route. parseCookies (src/auth/cookies.ts) now decodes PER COOKIE:
// when decodeURIComponent throws for one value, that value is stored raw
// and the loop continues -- the header is never abandoned and no other
// cookie is touched. Our own minted tokens (session/csrf/draft) are
// base64url or hex, so falling back to the raw value for a legitimately
// undecodable cookie never corrupts anything we ourselves issue.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { parseCookies, SESSION_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import { sessionLoader } from "../src/server/middleware";
import { registerErrorHandler } from "../src/server/http";

describe("parseCookies (DEC-811)", () => {
  it("a malformed value ('foo=100%') doesn't abandon the header -- a later valid cookie still parses", () => {
    const cookies = parseCookies("foo=100%; chq_session=abc123");
    expect(cookies.foo).toBe("100%");
    expect(cookies[SESSION_COOKIE_NAME]).toBe("abc123");
  });

  it("a malformed value appearing AFTER a valid one still leaves the valid one intact", () => {
    const cookies = parseCookies("chq_session=abc123; bar=100%");
    expect(cookies[SESSION_COOKIE_NAME]).toBe("abc123");
    expect(cookies.bar).toBe("100%");
  });

  it("legitimately percent-encoded values still decode", () => {
    const cookies = parseCookies("greeting=hello%20world");
    expect(cookies.greeting).toBe("hello world");
  });

  it("pairs with no '=' are skipped, blank names are ignored", () => {
    const cookies = parseCookies("noequalssign; =blankname; ok=1");
    expect(cookies).toEqual({ ok: "1" });
  });

  it("an empty/null header returns an empty object", () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Request-level regression: an anonymous request carrying a malformed
// cookie must not 500 (mirrors test/server-http.test.ts's ApiError/envelope
// coverage, but exercised end-to-end through sessionLoader).
// ---------------------------------------------------------------------------

describe("sessionLoader survives a malformed cookie header (DEC-811 regression)", () => {
  it("GET /health with 'Cookie: foo=100%' answers 200, not 500", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: async () => [],
      };
      c.set("db", { select: () => chain } as unknown as AppEnv["Variables"]["db"]);
      await next();
    });
    app.use("*", sessionLoader);
    registerErrorHandler(app);
    app.get("/health", (c) => c.json({ ok: true }));

    const res = await app.request("/health", {
      headers: { Cookie: "foo=100%" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("a malformed cookie alongside a real (but non-matching) chq_session still reaches sessionLoader's db lookup instead of throwing during parse", async () => {
    const app = new Hono<AppEnv>();
    let sessionLookupCalled = false;
    app.use("*", async (c, next) => {
      const chain: any = {
        from: () => chain,
        where: () => {
          sessionLookupCalled = true;
          return chain;
        },
        limit: async () => [],
      };
      c.set("db", { select: () => chain } as unknown as AppEnv["Variables"]["db"]);
      await next();
    });
    app.use("*", sessionLoader);
    registerErrorHandler(app);
    app.get("/health", (c) => c.json({ ok: true }));

    const res = await app.request("/health", {
      headers: { Cookie: "foo=100%; chq_session=deadbeef" },
    });

    expect(res.status).toBe(200);
    expect(sessionLookupCalled).toBe(true);
  });
});
