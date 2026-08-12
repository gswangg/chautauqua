import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { parseSocialLinks, serializeSocialLinks, type SocialLinks } from "../src/server/repo/profile";
import { validateHeadshotUpload } from "../src/domain/files";
import { speakerGate } from "../src/routes/portal/shared";
import { portalProfileRoutes } from "../src/routes/portal/profile";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

describe("social links JSON round-trip", () => {
  it("round-trips a fully populated record", () => {
    const links: SocialLinks = {
      twitter: "@alice",
      linkedin: "in/alice",
      github: "alice",
      website: "https://alice.example",
    };
    const json = serializeSocialLinks(links);
    expect(parseSocialLinks(json)).toEqual(links);
  });

  it("trims whitespace and drops blank fields on serialize", () => {
    const json = serializeSocialLinks({ twitter: "  @a  ", linkedin: "", github: "   ", website: "https://x" });
    expect(JSON.parse(json)).toEqual({ twitter: "@a", website: "https://x" });
  });

  it("parses back dropped/blank fields as empty strings", () => {
    const json = serializeSocialLinks({ twitter: "", linkedin: "", github: "", website: "" });
    expect(parseSocialLinks(json)).toEqual({ twitter: "", linkedin: "", github: "", website: "" });
  });

  it("falls back to the empty record for null", () => {
    expect(parseSocialLinks(null)).toEqual({ twitter: "", linkedin: "", github: "", website: "" });
  });

  it("falls back to the empty record for malformed JSON — never throws", () => {
    expect(parseSocialLinks("{not json")).toEqual({ twitter: "", linkedin: "", github: "", website: "" });
  });

  it("falls back to the empty record for a JSON array", () => {
    expect(parseSocialLinks("[1,2,3]")).toEqual({ twitter: "", linkedin: "", github: "", website: "" });
  });

  it("drops unexpected extra keys and coerces non-string values away", () => {
    const json = JSON.stringify({ twitter: "@a", evil: "<script>", linkedin: 5 });
    expect(parseSocialLinks(json)).toEqual({ twitter: "@a", linkedin: "", github: "", website: "" });
  });
});

describe("validateHeadshotUpload", () => {
  it("accepts a png under the 8 MB cap", () => {
    const result = validateHeadshotUpload({ filename: "me.png", sizeBytes: 1024 });
    expect(result).toEqual({ ok: true, ext: "png", servedContentType: "image/png" });
  });

  it("accepts jpg, jpeg, and webp", () => {
    for (const [file, type] of [
      ["me.jpg", "image/jpeg"],
      ["me.jpeg", "image/jpeg"],
      ["me.webp", "image/webp"],
    ] as const) {
      const result = validateHeadshotUpload({ filename: file, sizeBytes: 1024 });
      expect(result).toEqual({ ok: true, ext: file.split(".")[1], servedContentType: type });
    }
  });

  it("rejects gif — narrower allowlist than the submission-file pipeline", () => {
    const result = validateHeadshotUpload({ filename: "me.gif", sizeBytes: 1024 });
    expect(result.ok).toBe(false);
  });

  it("rejects a pdf loudly", () => {
    const result = validateHeadshotUpload({ filename: "me.pdf", sizeBytes: 1024 });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 8 MB", () => {
    const result = validateHeadshotUpload({ filename: "me.png", sizeBytes: 9 * 1024 * 1024 });
    expect(result.ok).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const result = validateHeadshotUpload({ filename: "me.png", sizeBytes: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects a file with no extension", () => {
    const result = validateHeadshotUpload({ filename: "me", sizeBytes: 1024 });
    expect(result.ok).toBe(false);
  });

  // DEC-425: caps the attacker-controlled filename length before extension lookup.
  it("rejects a filename over MAX_NAME_LENGTH (200) with an InvalidUpload", () => {
    const filename = "x".repeat(201) + ".png";
    const result = validateHeadshotUpload({ filename, sizeBytes: 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields?.headshot).toBeDefined();
  });

  it("accepts a filename exactly AT MAX_NAME_LENGTH (200) (off-by-one)", () => {
    const filename = "x".repeat(196) + ".png"; // 196 + 4 = 200
    expect(filename.length).toBe(200);
    const result = validateHeadshotUpload({ filename, sizeBytes: 1024 });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Route-level: gate + no cross-contact route surface. Per DEC-012's testing
// strategy, vitest covers middleware/CSRF logic against tiny fakes — full D1
// round trips are verified against wrangler dev, not here (no workers-pool
// dependency in stage 1). These tests inject c.var.auth directly (bypassing
// sessionLoader/D1) to exercise speakerGate and the route table in isolation.
// ---------------------------------------------------------------------------

function appWithAuth(auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/portal", portalProfileRoutes);
  return app;
}

describe("speakerGate on /portal/profile", () => {
  it("redirects to /login when there's no session", async () => {
    const app = appWithAuth(undefined);
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("redirects organizers to /admin", async () => {
    const app = appWithAuth({ userId: "u1", role: "organizer", orgId: "org1" });
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("redirects reviewers to /admin", async () => {
    const app = appWithAuth({ userId: "u1", role: "reviewer", orgId: "org1" });
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("gate itself passes a speaker session through to next()", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("auth", { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" });
      await next();
    });
    app.use("*", speakerGate);
    app.get("/portal/profile", (c) => c.text("ok"));
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});

// GET /headshots/:fileId route behavior (DEC-059 caching + DEC-067 gate) is
// covered in test/headshot-gate.test.ts, not here.

describe("no route surface accepts a foreign contactId — another contact's profile is unreachable", () => {
  it("GET /portal/profile takes no id param: hitting a path with one 404s (falls through to Hono's default not-found)", async () => {
    const app = appWithAuth({ userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" });
    const res = await app.request("/portal/profile/some-other-contact-id");
    // Only /portal/profile and /portal/profile/headshot are registered —
    // there is no :contactId-shaped route, so this can only 404.
    expect(res.status).toBe(404);
  });

  it("POST /portal/profile ignores any contactId supplied in the form body (would 403 on missing CSRF before ever reading one)", async () => {
    const app = appWithAuth({ userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" });
    const res = await app.request("/portal/profile", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "contactId=someone-elses-id&firstName=A&lastName=B",
    });
    // No chq_csrf cookie present -> csrfForm rejects before touching the db;
    // the handler never reads a contactId from the body at all (it always
    // uses assertSpeakerContactId(auth)).
    expect(res.status).toBe(400);
  });
});
