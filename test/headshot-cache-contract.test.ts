// DEC-059 (amended wave 70): the publicly-visible branch of GET
// /headshots/:fileId no longer serves an immutable header keyed off an
// authorization outcome (scope.publiclyVisible flips when a speaker is
// un-published, and the route sits outside publicCacheMiddleware's
// version-salted key space, so no purge could ever reach an already-issued
// response). It now shares CLIENT_CACHE_CONTROL with the public pages that
// embed the image, and both branches carry Vary: Cookie so a shared cache
// never mixes the private/public answers for the same URL. Reuses the fake
// db/bucket harness pattern from test/headshot-gate.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { headshotServeRoutes } from "../src/routes/portal/profile";
import { registerErrorHandler } from "../src/server/http";
import { CLIENT_CACHE_CONTROL } from "../src/server/pubcache";
import type { AppEnv, AuthInfo } from "../src/server/env";

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

function fakeFilesBucket() {
  return {
    async get() {
      return { body: new ReadableStream(), httpMetadata: { contentType: "image/jpeg" }, size: 3 };
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
    FILES: fakeFilesBucket(),
  } as unknown as AppEnv["Bindings"]);
}

const HEADSHOT_ROW: FileRow = { kind: "headshot", r2Key: "headshot/c1/abc.jpg", contentType: "image/jpeg" };
const CONTACT_ROW: ContactRow = { id: "c1", orgId: "org1" };

describe("GET /headshots/:fileId cache contract (DEC-059 amendment, wave 70)", () => {
  it("a publicly-visible headshot responds with exactly CLIENT_CACHE_CONTROL and Vary: Cookie", async () => {
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, true), undefined);
    const res = await request(app, "f1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("a not-yet-visible headshot fetched by its owning speaker responds private, max-age=0 + Vary: Cookie", async () => {
    const auth: AuthInfo = { userId: "u2", role: "speaker", orgId: "org1", contactId: "c1" };
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, false), auth);
    const res = await request(app, "f1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=0");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("the same fileId fetched anonymously while not-yet-visible 404s and carries no public Cache-Control", async () => {
    const app = appWithDbAndAuth(fakeDb(HEADSHOT_ROW, CONTACT_ROW, false), undefined);
    const res = await request(app, "f1");
    expect(res.status).toBe(404);
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl === null || !cacheControl.startsWith("public")).toBe(true);
    expect(cacheControl).not.toBe(CLIENT_CACHE_CONTROL);
  });
});
