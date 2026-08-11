import { describe, expect, it } from "vitest";
import { resolveBaseUrl } from "../src/server/origin";

function ctx(opts: {
  url: string;
  headers?: Record<string, string>;
  publicBaseUrl?: string;
  devMode?: string;
}) {
  const headers = opts.headers ?? {};
  return {
    req: {
      url: opts.url,
      header: (name: string) => headers[name],
    },
    env: {
      PUBLIC_BASE_URL: opts.publicBaseUrl,
      DEV_MODE: opts.devMode,
    },
  };
}

describe("resolveBaseUrl (DEC-252)", () => {
  it("prefers PUBLIC_BASE_URL when set, stripping a trailing slash", () => {
    const c = ctx({ url: "http://chautauqua.cc/submit/foo", publicBaseUrl: "https://example.org/" });
    expect(resolveBaseUrl(c)).toBe("https://example.org");
  });

  it("throws on a malformed PUBLIC_BASE_URL", () => {
    const c = ctx({ url: "http://chautauqua.cc/x", publicBaseUrl: "not-a-url" });
    expect(() => resolveBaseUrl(c)).toThrow();
  });

  it("throws on a non-http(s) PUBLIC_BASE_URL scheme", () => {
    const c = ctx({ url: "http://chautauqua.cc/x", publicBaseUrl: "ftp://example.org" });
    expect(() => resolveBaseUrl(c)).toThrow();
  });

  it("in dev mode, uses the request URL origin directly when it's loopback", () => {
    const c = ctx({ url: "http://localhost:8801/submit/foo", devMode: "1" });
    expect(resolveBaseUrl(c)).toBe("http://localhost:8801");
  });

  it("in dev mode, falls back to a loopback Origin header when request origin isn't loopback (wrangler route-shadowing repro)", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      headers: { Origin: "http://localhost:8801" },
    });
    expect(resolveBaseUrl(c)).toBe("http://localhost:8801");
  });

  it("in dev mode, falls back to a loopback Referer origin when neither request URL nor Origin header is loopback", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      headers: { Referer: "http://127.0.0.1:8801/submit/foo" },
    });
    expect(resolveBaseUrl(c)).toBe("http://127.0.0.1:8801");
  });

  it("in dev mode, rejects a non-loopback Origin header (never lets an attacker-supplied header set the base)", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      headers: { Origin: "https://evil.example.com" },
    });
    expect(resolveBaseUrl(c)).toBe("http://chautauqua.cc");
  });

  it("in dev mode, rejects a non-loopback Referer header", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      headers: { Referer: "https://evil.example.com/whatever" },
    });
    expect(resolveBaseUrl(c)).toBe("http://chautauqua.cc");
  });

  it("outside dev mode, ignores loopback headers entirely and uses the request URL origin", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      headers: { Origin: "http://localhost:8801" },
    });
    expect(resolveBaseUrl(c)).toBe("http://chautauqua.cc");
  });

  it("falls back to the request URL origin in production (no PUBLIC_BASE_URL, no DEV_MODE)", () => {
    const c = ctx({ url: "https://chautauqua.cc/submit/foo" });
    expect(resolveBaseUrl(c)).toBe("https://chautauqua.cc");
  });
});
