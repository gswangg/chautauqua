import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerFramingHeaders } from "../src/server/framing";

// Regression: workerd serves ASSETS responses with immutable headers; the
// framing middleware must clone rather than throw (authed /admin 500'd).
describe("framing headers on immutable responses", () => {
  it("stamps frame-denial headers by cloning when headers are immutable", async () => {
    const app = new Hono<any>();
    registerFramingHeaders(app as any);
    app.get("/admin/asset.js", () => {
      const res = new Response("ok");
      // Simulate workerd's immutable headers: freeze via a throwing proxy.
      const frozen = new Proxy(res.headers, {
        get(target, prop, recv) {
          if (prop === "set") {
            return () => { throw new TypeError("Can't modify immutable headers."); };
          }
          const v = Reflect.get(target, prop, recv);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
      Object.defineProperty(res, "headers", { value: frozen });
      return res;
    });
    const res = await app.request("/admin/asset.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });

  it("leaves /embed/* responses unstamped", async () => {
    const app = new Hono<any>();
    registerFramingHeaders(app as any);
    app.get("/embed/x", () => new Response("ok"));
    const res = await app.request("/embed/x");
    expect(res.headers.get("X-Frame-Options")).toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });
});
