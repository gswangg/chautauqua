// w30-a: DEC-020 amendment -- a request-body ceiling enforced BEFORE
// anything reads the body. checkRequestBody is the pure predicate table;
// the route-level test proves a real upload route (POST
// /api/v1/submissions/:id/files) is refused by Content-Length alone, before
// its handler (and therefore parseBody/validateUpload) ever runs.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  MAX_REQUEST_BODY_BYTES,
  checkRequestBody,
  requestBodyLimit,
} from "../src/server/body-limit";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

describe("checkRequestBody", () => {
  it("always allows GET/HEAD/OPTIONS regardless of headers", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get", "head", "options"]) {
      expect(checkRequestBody(method, null, null)).toEqual({ ok: true });
      expect(checkRequestBody(method, "multipart/form-data", String(MAX_REQUEST_BODY_BYTES + 1))).toEqual({
        ok: true,
      });
    }
  });

  it("refuses a parseable Content-Length over the ceiling, naming the ceiling and the declared size", () => {
    const result = checkRequestBody("POST", "application/json", String(MAX_REQUEST_BODY_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(String(MAX_REQUEST_BODY_BYTES));
      expect(result.message).toContain(String(MAX_REQUEST_BODY_BYTES + 1));
    }
  });

  it("allows a Content-Length exactly at the ceiling", () => {
    expect(checkRequestBody("POST", "application/json", String(MAX_REQUEST_BODY_BYTES))).toEqual({ ok: true });
  });

  it("allows a small Content-Length", () => {
    expect(checkRequestBody("POST", "application/json", "100")).toEqual({ ok: true });
  });

  it("refuses a non-numeric Content-Length", () => {
    const result = checkRequestBody("POST", "application/json", "not-a-number");
    expect(result.ok).toBe(false);
  });

  it("refuses an absent Content-Length when content-type is multipart/form-data", () => {
    const result = checkRequestBody("POST", "multipart/form-data; boundary=xyz", null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.toLowerCase()).toContain("content-length");
    }
  });

  it("allows an absent Content-Length for a non-multipart request", () => {
    expect(checkRequestBody("POST", "application/json", null)).toEqual({ ok: true });
    expect(checkRequestBody("POST", null, null)).toEqual({ ok: true });
  });
});

describe("requestBodyLimit middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildMiddlewareApp() {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", requestBodyLimit);
    // Mounted under /api/v1 so the shared error responder (DEC-841) picks
    // the JSON envelope rather than the HTML error surface.
    app.post("/api/v1/probe", async (c) => {
      // Reading the body here would only happen if the middleware let it
      // through -- the assertion is that this handler never runs at all
      // for an oversized request (see route-level test below for the
      // stronger, real-route version of that assertion).
      await c.req.text();
      return c.json({ ok: true });
    });
    return app;
  }

  it("returns 413 with the DEC-013 envelope for an oversized Content-Length", async () => {
    const app = buildMiddlewareApp();
    const res = await app.request("/api/v1/probe", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "200000000" },
      body: "x",
    });
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json).toEqual({
      error: {
        code: "payload_too_large",
        message: expect.stringContaining(String(MAX_REQUEST_BODY_BYTES)),
      },
    });
  });

  it("passes through a small request", async () => {
    const app = buildMiddlewareApp();
    const res = await app.request("/api/v1/probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});

// Route-level: a real upload route (POST /api/v1/submissions/:id/files)
// refuses a declared-oversized request before parseBody/the handler ever
// runs. Mirrors test/files-upload-stream.test.ts's app-building pattern.
const ORG_A = "org-a";
const SPEAKER_CONTACT = "contact-speaker";

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async () => {
      throw new Error("handler ran: getSubmissionScope should never be called for an oversized request");
    }),
    insertFile: vi.fn(async () => "new-file-id"),
    reopenContentReview: vi.fn(async () => {}),
  };
});

describe("POST /api/v1/submissions/:id/files is refused by Content-Length before the handler runs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  async function buildApp() {
    const { fileApiRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", requestBodyLimit);
    const auth: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_A, contactId: SPEAKER_CONTACT };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}) } as never;
      await next();
    });
    app.route("/api/v1", fileApiRoutes);
    return app;
  }

  it("responds 413 with the DEC-013 envelope and never calls the handler", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/submissions/sub-1/files", {
      method: "POST",
      headers: {
        "x-chq-csrf": "1",
        "content-type": "multipart/form-data; boundary=xyz",
        "content-length": "200000000",
      },
      body: "tiny-body-not-real-multipart",
    });
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json).toEqual({
      error: {
        code: "payload_too_large",
        message: expect.any(String),
      },
    });
    const { getSubmissionScope } = await import("../src/server/repo/files");
    expect(getSubmissionScope).not.toHaveBeenCalled();
  });
});
