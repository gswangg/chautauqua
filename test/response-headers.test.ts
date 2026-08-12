// DEC-697: setResponseHeaders must survive a response whose Headers throw
// on set/append/delete (workerd ASSETS responses, cached responses, etc.)
// by rebuilding a fresh Response and applying the headers to the clone.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerFramingHeaders } from "../src/server/framing";
import { noStoreByDefault } from "../src/server/middleware";

/** Wraps a real Response's Headers in a Proxy that throws a TypeError on
 * set/append/delete -- simulating workerd's immutable ASSETS Headers --
 * while every read (.get/.has/.entries/iteration, which `new Response(body,
 * init)` relies on to copy headers) still passes through untouched. */
function freezeHeaders(response: Response): Response {
  const real = response.headers;
  const frozen = new Proxy(real, {
    get(target, prop, _receiver) {
      if (prop === "set" || prop === "append" || prop === "delete") {
        return () => {
          throw new TypeError("Headers are immutable");
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  Object.defineProperty(response, "headers", { get: () => frozen, configurable: true });
  return response;
}

function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  registerFramingHeaders(app);
  app.use("*", noStoreByDefault);
  app.get("/frozen", () => {
    const real = new Response("frozen-body", { status: 200, statusText: "OK" });
    return freezeHeaders(real);
  });
  return app;
}

describe("setResponseHeaders / responseHasHeader (DEC-697)", () => {
  it("decorates a response with immutable Headers by rebuilding it, preserving status and body", async () => {
    const app = buildApp();
    const res = await app.request("/frozen");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("frozen-body");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
