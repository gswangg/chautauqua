import { describe, expect, it } from "vitest";
import { hashToken, newApiToken, apiTokenDisplayPrefix } from "../src/auth/tokens";
import {
  resolveBearerAuth,
  extractBearerToken,
  checkDoubleSubmitCsrf,
  csrfJson,
  type ApiTokenLookup,
  type ApiTokenRow,
} from "../src/server/middleware";
import type { AuthInfo } from "../src/server/env";

// Minimal fake Hono context covering only what csrfJson touches
// (c.req.header, c.var.auth) — avoids standing up a real D1-backed app just
// to exercise this pure-ish branch.
function fakeContext(headers: Record<string, string>, auth: AuthInfo | undefined) {
  return {
    req: { header: (name: string) => headers[name.toLowerCase()] },
    var: { auth },
  } as unknown as Parameters<typeof csrfJson>[0];
}

class FakeApiTokens implements ApiTokenLookup {
  constructor(private readonly rows: Map<string, ApiTokenRow>) {}
  async findByTokenHash(tokenHash: string): Promise<ApiTokenRow | null> {
    return this.rows.get(tokenHash) ?? null;
  }
}

describe("newApiToken / apiTokenDisplayPrefix / hashToken", () => {
  it("mints a chq_ prefixed token with 40 random chars", () => {
    const token = newApiToken();
    expect(token.startsWith("chq_")).toBe(true);
    expect(token.length).toBe(4 + 40);
  });

  it("mints distinct tokens on each call", () => {
    expect(newApiToken()).not.toBe(newApiToken());
  });

  it("display prefix is the first 12 plaintext chars", () => {
    const token = "chq_abcdefghijklmnopqrstuvwxyz234567zzzz";
    expect(apiTokenDisplayPrefix(token)).toBe(token.slice(0, 12));
    expect(apiTokenDisplayPrefix(token)).toHaveLength(12);
  });

  it("hashToken is deterministic sha256 hex, distinct per input", async () => {
    const a = await hashToken("chq_aaaa");
    const b = await hashToken("chq_aaaa");
    const c = await hashToken("chq_bbbb");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractBearerToken", () => {
  it("extracts a chq_ token from a well-formed Authorization header", () => {
    expect(extractBearerToken("Bearer chq_abc123")).toBe("chq_abc123");
  });

  it("returns undefined for missing/malformed headers", () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken(null)).toBeUndefined();
    expect(extractBearerToken("")).toBeUndefined();
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeUndefined();
    expect(extractBearerToken("Bearer sometoken")).toBeUndefined();
  });
});

describe("resolveBearerAuth", () => {
  it("resolves a known token hash to an organizer AuthInfo with viaBearer=true", async () => {
    const token = newApiToken();
    const tokenHash = await hashToken(token);
    const tokens = new FakeApiTokens(
      new Map([[tokenHash, { id: "tok1", orgId: "org1", createdByUserId: "u1" }]]),
    );
    const auth = await resolveBearerAuth(token, tokens, hashToken);
    expect(auth).toEqual({ userId: "u1", role: "organizer", orgId: "org1", viaBearer: true });
  });

  it("returns undefined for an unknown token (no lookup match)", async () => {
    const tokens = new FakeApiTokens(new Map());
    const auth = await resolveBearerAuth("chq_unknowntoken", tokens, hashToken);
    expect(auth).toBeUndefined();
  });

  it("returns undefined when there's no token", async () => {
    const tokens = new FakeApiTokens(new Map());
    await expect(resolveBearerAuth(undefined, tokens, hashToken)).resolves.toBeUndefined();
  });
});

describe("cookie-session precedence (sessionLoader contract)", () => {
  // sessionLoader itself needs a live Hono context + D1, so this documents
  // the precedence rule at the unit level: resolveAuth's result, when
  // present, always wins — resolveBearerAuth is only ever consulted as a
  // fallback (see src/server/middleware.ts's sessionLoader body, which
  // early-returns once a cookie session resolves).
  it("bearer auth never claims the organizer role for a different org than the token row", async () => {
    const token = newApiToken();
    const tokenHash = await hashToken(token);
    const tokens = new FakeApiTokens(
      new Map([[tokenHash, { id: "tok1", orgId: "org-from-token", createdByUserId: "u9" }]]),
    );
    const auth = await resolveBearerAuth(token, tokens, hashToken);
    expect(auth?.orgId).toBe("org-from-token");
  });
});

describe("csrfJson", () => {
  const cookieAuth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  const bearerAuth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1", viaBearer: true };

  it("rejects a cookie-session request missing the x-chq-csrf header", async () => {
    const c = fakeContext({}, cookieAuth);
    await expect(csrfJson(c, async () => {})).rejects.toThrow(/csrf/i);
  });

  it("passes a cookie-session request with the x-chq-csrf header", async () => {
    const c = fakeContext({ "x-chq-csrf": "1" }, cookieAuth);
    let called = false;
    await csrfJson(c, async () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("is exempt (passes with no header) when auth.viaBearer is true", async () => {
    const c = fakeContext({}, bearerAuth);
    let called = false;
    await csrfJson(c, async () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("still requires the header when there's no auth at all (unauthenticated mutation attempt)", async () => {
    const c = fakeContext({}, undefined);
    await expect(csrfJson(c, async () => {})).rejects.toThrow(/csrf/i);
  });
});

describe("checkDoubleSubmitCsrf (cookie-session form CSRF, unaffected by bearer auth)", () => {
  it("passes when cookie and form token match", () => {
    expect(checkDoubleSubmitCsrf("tok", "tok")).toBe(true);
  });
});
