// DEC-636: framing is a closed two-list -- /embed/* is framable, every
// other surface denies. This test is itself a closed two-list: a denied
// list (must carry BOTH X-Frame-Options: DENY and a frame-ancestors 'none'
// CSP) and a framable list (must carry NEITHER header), each floor-counted
// so an empty enumeration cannot pass silently.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerFramingHeaders, FRAMABLE_PREFIXES } from "../src/server/framing";

function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  registerFramingHeaders(app);
  // Catch-all: this test exercises header behavior only, not real routing
  // or request-scoped context (db/session), which is out of this task's
  // scope -- registerFramingHeaders itself is route-agnostic.
  app.all("*", (c) => c.text("ok"));
  return app;
}

const DENIED_PATHS = [
  "/login",
  "/admin",
  "/portal",
  "/account/password",
  "/api/v1/me",
  "/e/some-event/sessions",
  "/docs/api",
  "/",
];

const FRAMABLE_PATHS = ["/embed/some-event/sessions", "/embed/some-event/sessions.json"];

describe("framing headers (DEC-636)", () => {
  it("FRAMABLE_PREFIXES is exactly the framable set this test enumerates", () => {
    expect(FRAMABLE_PREFIXES).toEqual(["/embed"]);
  });

  it("asserts a floor count on both lists", () => {
    expect(DENIED_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(FRAMABLE_PATHS.length).toBeGreaterThanOrEqual(2);
  });

  for (const path of DENIED_PATHS) {
    it(`denies framing on ${path}`, async () => {
      const app = buildApp();
      const res = await app.request(path);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    });
  }

  for (const path of FRAMABLE_PATHS) {
    it(`sets neither header on framable path ${path}`, async () => {
      const app = buildApp();
      const res = await app.request(path);
      expect(res.headers.get("X-Frame-Options")).toBeNull();
      expect(res.headers.get("Content-Security-Policy")).toBeNull();
    });
  }
});
