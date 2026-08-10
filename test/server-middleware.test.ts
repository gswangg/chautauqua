import { describe, expect, it } from "vitest";
import { resolveAuth, checkDoubleSubmitCsrf } from "../src/server/middleware";
import type { SessionLookup, UserLookup, SessionRow, UserRow } from "../src/server/middleware";
import { hashToken, newSessionToken } from "../src/auth/tokens";

class FakeSessions implements SessionLookup {
  constructor(private readonly rows: Map<string, SessionRow>) {}
  async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    return this.rows.get(tokenHash) ?? null;
  }
}

class FakeUsers implements UserLookup {
  constructor(private readonly rows: Map<string, UserRow>) {}
  async findById(userId: string): Promise<UserRow | null> {
    return this.rows.get(userId) ?? null;
  }
}

describe("resolveAuth", () => {
  it("returns undefined when there's no token", async () => {
    const sessions = new FakeSessions(new Map());
    const users = new FakeUsers(new Map());
    await expect(resolveAuth(undefined, sessions, users, Date.now())).resolves.toBeUndefined();
  });

  it("resolves a live session to AuthInfo", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u1", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(
      new Map([["u1", { id: "u1", orgId: "o1", role: "organizer", contactId: null }]]),
    );
    const auth = await resolveAuth(token, sessions, users, now);
    expect(auth).toEqual({ userId: "u1", role: "organizer", orgId: "o1", contactId: undefined });
  });

  it("returns undefined for an expired session", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u1", expiresAt: now - 1000 }]]));
    const users = new FakeUsers(
      new Map([["u1", { id: "u1", orgId: "o1", role: "organizer", contactId: null }]]),
    );
    await expect(resolveAuth(token, sessions, users, now)).resolves.toBeUndefined();
  });

  it("returns undefined for an unknown token", async () => {
    const sessions = new FakeSessions(new Map());
    const users = new FakeUsers(new Map());
    await expect(resolveAuth("no-such-token", sessions, users, Date.now())).resolves.toBeUndefined();
  });

  it("returns undefined when the session's user no longer exists", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "ghost", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(new Map());
    await expect(resolveAuth(token, sessions, users, now)).resolves.toBeUndefined();
  });

  it("carries contactId through for speaker users", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u2", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(
      new Map([["u2", { id: "u2", orgId: "o1", role: "speaker", contactId: "c1" }]]),
    );
    const auth = await resolveAuth(token, sessions, users, now);
    expect(auth?.contactId).toBe("c1");
  });

  it("throws loudly on an unknown role literal (data corruption)", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u3", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(
      new Map([["u3", { id: "u3", orgId: "o1", role: "admin", contactId: null }]]),
    );
    await expect(resolveAuth(token, sessions, users, now)).rejects.toThrow(/unknown user role/i);
  });
});

describe("checkDoubleSubmitCsrf", () => {
  it("passes when cookie and form token match", () => {
    expect(checkDoubleSubmitCsrf("abc123", "abc123")).toBe(true);
  });

  it("fails when the cookie is missing", () => {
    expect(checkDoubleSubmitCsrf(undefined, "abc123")).toBe(false);
  });

  it("fails when tokens differ", () => {
    expect(checkDoubleSubmitCsrf("abc123", "xyz789")).toBe(false);
  });

  it("fails when the form field is missing or not a string", () => {
    expect(checkDoubleSubmitCsrf("abc123", undefined)).toBe(false);
    expect(checkDoubleSubmitCsrf("abc123", ["abc123"])).toBe(false);
  });
});
