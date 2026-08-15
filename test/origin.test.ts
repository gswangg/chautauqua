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

  it("outside dev mode, ignores loopback headers entirely and throws when PUBLIC_BASE_URL is unset (DEC-252 amendment, wave 18)", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      headers: { Origin: "http://localhost:8801" },
    });
    expect(() => resolveBaseUrl(c)).toThrow(/PUBLIC_BASE_URL/);
  });

  it("outside dev mode, throws rather than guessing from the request URL origin (no PUBLIC_BASE_URL, no DEV_MODE) (DEC-252 amendment, wave 18)", () => {
    const c = ctx({ url: "https://chautauqua.cc/submit/foo" });
    expect(() => resolveBaseUrl(c)).toThrow(/PUBLIC_BASE_URL/);
  });

  it("DEC-296: a non-loopback PUBLIC_BASE_URL always wins, even in dev mode with a loopback Origin header", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      publicBaseUrl: "https://example.org",
      headers: { Origin: "http://localhost:8801" },
    });
    expect(resolveBaseUrl(c)).toBe("https://example.org");
  });

  it("DEC-296: in dev mode, a loopback Origin header outranks a loopback default PUBLIC_BASE_URL (wrangler routes repro)", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      publicBaseUrl: "http://localhost:8787",
      headers: { Origin: "http://localhost:8792" },
    });
    expect(resolveBaseUrl(c)).toBe("http://localhost:8792");
  });

  it("DEC-296: in dev mode, a loopback default PUBLIC_BASE_URL wins when the request has no loopback origin/headers", () => {
    const c = ctx({
      url: "http://chautauqua.cc/submit/foo",
      devMode: "1",
      publicBaseUrl: "http://localhost:8787",
    });
    expect(resolveBaseUrl(c)).toBe("http://localhost:8787");
  });

  it("DEC-296 (wave 38): THE GAP CASE — a loopback Host header wins over a loopback default PUBLIC_BASE_URL when the request URL is route-shadowed to production and no Origin/Referer exist", () => {
    const c = ctx({
      url: "https://chautauqua.cc/claim/x",
      devMode: "1",
      publicBaseUrl: "http://localhost:8787",
      headers: { Host: "127.0.0.1:8788" },
    });
    expect(resolveBaseUrl(c)).toBe("http://127.0.0.1:8788");
  });

  it("DEC-296 (wave 38): NEGATIVE CONTROL — a non-loopback Host header is never a candidate; falls back to the loopback default PUBLIC_BASE_URL", () => {
    const c = ctx({
      url: "https://chautauqua.cc/claim/x",
      devMode: "1",
      publicBaseUrl: "http://localhost:8787",
      headers: { Host: "chautauqua.cc" },
    });
    expect(resolveBaseUrl(c)).toBe("http://localhost:8787");
  });

  it("DEC-296 (wave 38): NEGATIVE CONTROL — outside dev mode, the configured PUBLIC_BASE_URL wins outright and no header is consulted", () => {
    const c = ctx({
      url: "https://chautauqua.cc/claim/x",
      publicBaseUrl: "http://localhost:8787",
      headers: { Host: "127.0.0.1:8788" },
    });
    expect(resolveBaseUrl(c)).toBe("http://localhost:8787");
  });

  it("DEC-296 (wave 38): NEGATIVE CONTROL — a non-loopback PUBLIC_BASE_URL wins outright in dev mode even with a loopback Host header; production can never be poisoned by a header", () => {
    const c = ctx({
      url: "https://chautauqua.cc/claim/x",
      devMode: "1",
      publicBaseUrl: "https://events.example.com",
      headers: { Host: "127.0.0.1:8788" },
    });
    expect(resolveBaseUrl(c)).toBe("https://events.example.com");
  });

  it("DEC-296 (wave 38): the no-PUBLIC_BASE_URL dev branch also honours a loopback Host header", () => {
    const c = ctx({
      url: "https://chautauqua.cc/claim/x",
      devMode: "1",
      headers: { Host: "127.0.0.1:8788" },
    });
    expect(resolveBaseUrl(c)).toBe("http://127.0.0.1:8788");
  });
});
