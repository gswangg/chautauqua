import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { ApiError, errorEnvelope, parseBoundedIdArray, registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

describe("ApiError / errorEnvelope", () => {
  it("maps codes to the DEC-013 status codes", () => {
    expect(new ApiError("unauthorized", "x").status).toBe(401);
    expect(new ApiError("forbidden", "x").status).toBe(403);
    expect(new ApiError("not_found", "x").status).toBe(404);
    expect(new ApiError("invalid", "x").status).toBe(400);
    expect(new ApiError("conflict", "x").status).toBe(409);
    expect(new ApiError("internal", "x").status).toBe(500);
  });

  it("builds the { error: { code, message } } envelope", () => {
    const err = new ApiError("not_found", "Submission not found");
    expect(errorEnvelope(err)).toEqual({
      error: { code: "not_found", message: "Submission not found" },
    });
  });

  it("includes fields when supplied (validation errors)", () => {
    const err = new ApiError("invalid", "Bad input", { email: "Required" });
    expect(errorEnvelope(err)).toEqual({
      error: { code: "invalid", message: "Bad input", fields: { email: "Required" } },
    });
  });
});

// DEC-182
describe("parseBoundedIdArray", () => {
  it("returns the array unchanged when it's a valid list of ids", () => {
    expect(parseBoundedIdArray(["a", "b", "c"], "ids")).toEqual(["a", "b", "c"]);
  });

  it("throws invalid when value is not an array", () => {
    let err: unknown;
    try {
      parseBoundedIdArray("not-an-array", "ids");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("invalid");
    expect((err as ApiError).fields).toEqual({ ids: "Required" });
  });

  it("throws invalid when the array is empty", () => {
    expect(() => parseBoundedIdArray([], "ids")).toThrow(ApiError);
  });

  it("throws invalid, no silent filtering, when any element is not a string", () => {
    let err: unknown;
    try {
      parseBoundedIdArray(["a", 123, "c"], "ids");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("invalid");
  });

  it("throws invalid when an element has length 0", () => {
    expect(() => parseBoundedIdArray([""], "ids")).toThrow(ApiError);
  });

  it("throws invalid when an element exceeds 64 chars", () => {
    expect(() => parseBoundedIdArray(["x".repeat(65)], "ids")).toThrow(ApiError);
  });

  it("allows an element at exactly 64 chars", () => {
    expect(parseBoundedIdArray(["x".repeat(64)], "ids")).toEqual(["x".repeat(64)]);
  });

  it("throws invalid when the array exceeds the default max of 1000", () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    expect(() => parseBoundedIdArray(ids, "ids")).toThrow(ApiError);
  });

  it("allows exactly the default max of 1000", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
    expect(parseBoundedIdArray(ids, "ids")).toHaveLength(1000);
  });

  it("respects a custom maxCount", () => {
    expect(() => parseBoundedIdArray(["a", "b", "c"], "ids", { maxCount: 2 })).toThrow(ApiError);
    expect(parseBoundedIdArray(["a", "b"], "ids", { maxCount: 2 })).toEqual(["a", "b"]);
  });
});

// DEC-841 wave 54 amendment: the HTML error page's 'Go back' link must never
// carry a cross-origin or protocol-relative href, even from an attacker-
// controlled Referer header. Exercised through the real onError handler
// (not the private safeReferrerPath helper directly) on a non-API GET.
describe("registerErrorHandler HTML error page back-link (DEC-841)", () => {
  function buildApp() {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.get("/portal/boom", () => {
      throw new ApiError("not_found", "Nope");
    });
    return app;
  }

  async function requestWithReferer(referer: string | undefined) {
    const app = buildApp();
    const headers: Record<string, string> = {};
    if (referer !== undefined) headers.referer = referer;
    const res = await app.request("https://app.example.com/portal/boom", { headers });
    const body = await res.text();
    return { res, body };
  }

  it("keeps a same-origin referer's path and search", async () => {
    const { body } = await requestWithReferer("https://app.example.com/portal/submissions?page=2");
    expect(body).toContain('href="/portal/submissions?page=2"');
  });

  it("falls back to '/' for a cross-origin referer", async () => {
    const { body } = await requestWithReferer("https://evil.tld/x");
    expect(body).toContain('href="/"');
    expect(body).not.toContain("evil.tld");
  });

  it("falls back to '/' for a protocol-relative referer path (same-origin host, //-prefixed path)", async () => {
    const { body } = await requestWithReferer("https://app.example.com//evil.tld/x");
    expect(body).toContain('href="/"');
    expect(body).not.toContain("evil.tld");
  });

  it("falls back to '/' for a garbage (unparseable) referer", async () => {
    const { body } = await requestWithReferer("not a url");
    expect(body).toContain('href="/"');
  });

  it("falls back to '/' when there is no referer at all", async () => {
    const { body } = await requestWithReferer(undefined);
    expect(body).toContain('href="/"');
  });
});
