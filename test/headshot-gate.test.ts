// DEC-067: GET /headshots/:fileId is gated per getHeadshotServeScope
// (src/server/repo/profile.ts). Public visibility uses the exact predicate
// mirrored from repo/public.ts's visibleSubmissionConditions(); otherwise
// only a matching-org organizer or the owning speaker gets a private-cache
// preview, and every other case is a bare 404 (never 401/403 — existence
// must not leak). A minimal fake db stands in for D1 (three sequential
// select() calls: file row, reverse contact lookup, visibility check) — full
// wrangler-dev round trips are covered by the walkthrough scripts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { headshotServeRoutes } from "../src/routes/portal/profile";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { CLIENT_CACHE_CONTROL } from "../src/server/pubcache";

type FileRow = { kind: string; r2Key: string; contentType: string } | null;
type ContactRow = { id: string; orgId: string } | null;

function fakeDb(fileRow: FileRow, contactRow: ContactRow, visible: boolean) {
  let call = 0;
  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
    };
    return chain;
  }
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain(fileRow ? [fileRow] : []);
      if (call === 2) return makeChain(contactRow ? [contactRow] : []);
      return makeChain(visible ? [{ id: "p1" }] : []);
    },
  } as unknown as AppEnv["Variables"]["db"];
}

function fakeFilesBucket(body: ReadableStream | null) {
  return {
    async get() {
      if (!body) return null;
      return { body, httpMetadata: { contentType: "image/jpeg" }, size: 3 };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", headshotServeRoutes);
  return app;
}

async function request(app: Hono<AppEnv>, fileId: string) {
  return app.request(`/headshots/${fileId}`, undefined, {
    FILES: fakeFilesBucket(new ReadableStream()),
  } as unknown as AppEnv["Bindings"]);
}

const HEADSHOT_ROW: FileRow = { kind: "headshot", r2Key: "headshot/c1/abc.jpg", contentType: "image/jpeg" };
const CONTACT_ROW: ContactRow = { id: "c1", orgId: "org1" };

describe("GET /headshots/:fileId (DEC-067 gate)", () => {
  it("serves 200 with the shared public cache contract, unauthenticated, when accepted+approved+visible", async () => {
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, true), undefined);
    const res = await request(app, "f1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
  });

  it("404s unauthenticated when the speaker isn't publicly visible (pending/hidden)", async () => {
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, false), undefined);
    const res = await request(app, "f1");
    expect(res.status).toBe(404);
  });

  it("serves 200 with a private cache header for a same-org organizer when not publicly visible", async () => {
    const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, false), auth);
    const res = await request(app, "f1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=0");
  });

  it("serves 200 with a private cache header for the owning speaker when not publicly visible", async () => {
    const auth: AuthInfo = { userId: "u2", role: "speaker", orgId: "org1", contactId: "c1" };
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, false), auth);
    const res = await request(app, "f1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=0");
  });

  it("404s (never 403) for a cross-org organizer when not publicly visible", async () => {
    const auth: AuthInfo = { userId: "u3", role: "organizer", orgId: "org-other" };
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, false), auth);
    const res = await request(app, "f1");
    expect(res.status).toBe(404);
  });

  it("404s for everyone (even an authenticated same-org organizer) when the fileId is superseded — no contact currently references it", async () => {
    const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
    const anon = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, null, false), undefined);
    const resAnon = await request(anon, "f1");
    expect(resAnon.status).toBe(404);

    const authed = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, null, false), auth);
    const resAuthed = await request(authed, "f1");
    expect(resAuthed.status).toBe(404);
  });

  it("404s through this route for a file whose kind is not 'headshot'", async () => {
    const app = appWithDbAndAuth(fakeDb({ kind: "attachment", r2Key: "x", contentType: "application/pdf" }, null, false), undefined);
    const res = await request(app, "f1");
    expect(res.status).toBe(404);
  });
});
