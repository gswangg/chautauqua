import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { newSessionToken, hashToken } from "../src/auth/tokens";
import {
  buildSessionCookie,
  clearSessionCookie,
  parseCookies,
  newCsrfToken,
  CSRF_HEADER,
} from "../src/auth/cookies";

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const GOLDEN_FORMAT_RE = /^pbkdf2\$v1\$600000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/;

describe("password", () => {
  it("round-trips hash/verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("throws on malformed stored hash", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash")).rejects.toThrow();
    await expect(verifyPassword("anything", "pbkdf2$v1$600000$onlysalt")).rejects.toThrow();
    await expect(verifyPassword("anything", "bcrypt$v1$600000$salt$hash")).rejects.toThrow();
  });

  it("matches the golden format exactly, for seed-script interop", async () => {
    const hash = await hashPassword("some-password");
    expect(hash).toMatch(GOLDEN_FORMAT_RE);
    const [, , , salt, digest] = hash.split("$");
    expect(salt).toMatch(B64URL_RE);
    expect(digest).toMatch(B64URL_RE);
  });

  it("produces distinct salts across calls", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("tokens", () => {
  it("newSessionToken is b64url alphabet", () => {
    const token = newSessionToken();
    expect(token).toMatch(B64URL_RE);
    expect(token.length).toBeGreaterThan(0);
  });

  it("hashToken produces sha-256 hex", async () => {
    const token = newSessionToken();
    const hashed = await hashToken(token);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashToken is deterministic for the same token", async () => {
    const token = "fixed-token-value";
    const a = await hashToken(token);
    const b = await hashToken(token);
    expect(a).toBe(b);
  });
});

describe("cookies", () => {
  it("buildSessionCookie sets DEC-004 attributes (insecure)", () => {
    const cookie = buildSessionCookie("tok123", { secure: false });
    expect(cookie).toContain("chq_session=tok123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(cookie).not.toContain("Secure");
  });

  it("buildSessionCookie adds Secure when requested", () => {
    const cookie = buildSessionCookie("tok123", { secure: true });
    expect(cookie).toContain("Secure");
  });

  it("clearSessionCookie expires the cookie", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("chq_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("parseCookies parses a cookie header", () => {
    const parsed = parseCookies("chq_session=abc123; chq_csrf=def456");
    expect(parsed).toEqual({ chq_session: "abc123", chq_csrf: "def456" });
  });

  it("parseCookies returns empty object for null header", () => {
    expect(parseCookies(null)).toEqual({});
  });

  it("newCsrfToken is b64url alphabet", () => {
    const token = newCsrfToken();
    expect(token).toMatch(B64URL_RE);
  });

  it("CSRF_HEADER constant matches DEC-004", () => {
    expect(CSRF_HEADER).toBe("x-chq-csrf");
  });
});
