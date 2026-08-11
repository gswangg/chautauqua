// DEC-228: CSRF + draft cookies get HttpOnly + conditional Secure via
// shared builders in src/auth/cookies.ts.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  buildCsrfCookie,
  buildDraftCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../src/auth/cookies";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

class InMemoryKV {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

describe("isSecureRequest", () => {
  it("is true for https URLs", () => {
    expect(isSecureRequest("https://example.com/login")).toBe(true);
  });

  it("is false for http URLs", () => {
    expect(isSecureRequest("http://localhost:8787/login")).toBe(false);
  });
});

describe("buildCsrfCookie", () => {
  it("emits HttpOnly + Path=/ + SameSite=Lax without Secure when insecure", () => {
    const cookie = buildCsrfCookie("tok123", { secure: false });
    expect(cookie).toBe(`${CSRF_COOKIE_NAME}=tok123; HttpOnly; Path=/; SameSite=Lax`);
    expect(cookie).not.toMatch(/Secure/);
  });

  it("appends Secure when secure:true", () => {
    const cookie = buildCsrfCookie("tok123", { secure: true });
    expect(cookie).toBe(`${CSRF_COOKIE_NAME}=tok123; HttpOnly; Path=/; SameSite=Lax; Secure`);
  });
});

describe("buildDraftCookie", () => {
  it("scopes to Path=/submit and stays HttpOnly", () => {
    const cookie = buildDraftCookie("chq_draft_abc", "tok456", { secure: false });
    expect(cookie).toBe("chq_draft_abc=tok456; HttpOnly; Path=/submit; SameSite=Lax");
  });

  it("appends Secure when secure:true", () => {
    const cookie = buildDraftCookie("chq_draft_abc", "tok456", { secure: true });
    expect(cookie).toBe(
      "chq_draft_abc=tok456; HttpOnly; Path=/submit; SameSite=Lax; Secure",
    );
  });
});

describe("route-level: GET /login sets an HttpOnly chq_csrf cookie", () => {
  it("Set-Cookie for chq_csrf includes HttpOnly", async () => {
    const db = {
      select() {
        throw new Error("not used by GET /login");
      },
    } as unknown as AppEnv["Variables"]["db"];

    const kv = new InMemoryKV();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };

    const res = await app.request("/login", {}, env);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`${CSRF_COOKIE_NAME}=[^;]+`));
    expect(setCookie).toMatch(/HttpOnly/);
    // Test runner issues a plain http:// request, so no Secure flag.
    expect(setCookie).not.toMatch(/Secure/);
  });
});
