// DEC-367 amendment (wave 57), gate-9 mandate item 3: the /admin/* 404
// notice card (an authenticated organizer hitting an unmatched /admin/*
// path gets ORGANIZER_NOT_FOUND_LINKS via the shared NotFoundDocument,
// src/server/not-found.tsx) renders its footer links with the bare
// `.chq-auth-footer-links` class -- never wrapped in `.chq-auth-footer`
// (that wrapper only exists on /login's own footer row). Before wave 57
// AUTH_CSS's `.chq-auth-footer-links a` base rule carried an unconditional
// `min-height: 44px`, so the 404 card's links inherited a 44px desktop tap
// box they had no phone-only reason to carry -- the two carried rhythm
// numbers this discharges (404 block 166 vs the frame's 126; body->links
// 46.5 vs the frame's 26.5) trace back to that inherited box. This pins
// both halves: the rendered card really does use the bare class, and the
// bare class's rule no longer carries a base-scope 44px box.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { AUTH_CSS } from "../src/routes/auth.css";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { registerNotFoundHandler } from "../src/server/not-found";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

function buildApp(auth?: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  registerNotFoundHandler(app);
  return app;
}

describe("/admin/* 404 notice card no longer inherits a base-scope 44px tap box (DEC-367 wave 57)", () => {
  it("an authenticated organizer's unmatched /admin/* path renders footer links with the bare .chq-auth-footer-links class, not .chq-auth-footer-scoped", async () => {
    const app = buildApp({ userId: "u1", role: "organizer", orgId: "org1" });
    const res = await app.request("/admin/this-does-not-exist");
    expect(res.status).toBe(404);
    const body = await res.text();

    expect(body).toContain('<div class="chq-auth-footer-links">');
    expect(body).not.toContain('<div class="chq-auth-footer chq-auth-footer-links">');
    // Organizer links, not the anonymous homepage/log-in pair.
    expect(body).toContain('href="/admin/overview"');
    expect(body).toContain('href="/admin/submissions"');
  });

  it("AUTH_CSS's bare .chq-auth-footer-links a rule -- the one the 404 card actually uses -- carries no base-scope min-height", () => {
    const match = AUTH_CSS.match(/\.chq-auth-footer-links a \{([^}]*)\}/);
    expect(match, "expected to find the base .chq-auth-footer-links a rule").not.toBeNull();
    expect(match![1]).not.toMatch(/min-height/);
  });
});
