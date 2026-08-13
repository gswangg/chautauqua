// DEC-822: PATCH /api/v1/embeds/:id extends beyond name/enabled to accept
// surface, format and options, with the SAME validation POST already runs
// (isSurface, EMBED_FORMATS, object-shaped options) — a saved embed's
// recipe (not just its name) can be edited later. Mounts the real
// embedsRoutes sub-app against a minimal fake db that records select/update
// calls in order, mirroring the fakeDb pattern in test/api-participants.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { embedsRoutes } from "../src/routes/api/embeds";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const EMBED_ROW = {
  id: "emb-1",
  orgId: ORG_A,
  eventId: "event-1",
  name: "Homepage widget",
  surface: "sessions",
  format: "iframe",
  optionsJson: "{}",
  enabled: true,
  createdAt: new Date(1000),
  updatedAt: new Date(1000),
};

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: any[] = [];
  const db = {
    select: (cols?: unknown) => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      // getEmbedOwnership selects {orgId}; every other select() in this
      // route file selects the full row shape. Project down to orgId
      // when the caller only asked for it, so both call sites work off
      // the same fake row set.
      const projected =
        cols && typeof cols === "object" && "orgId" in (cols as Record<string, unknown>) && Object.keys(cols as object).length === 1
          ? rows.map((r) => ({ orgId: (r as { orgId: string }).orgId }))
          : rows;
      return makeChain(projected);
    },
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push(vals);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], updates };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", embedsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/embeds/:id (DEC-822 full recipe)", () => {
  it("accepts surface + format + options alongside name, same as POST validates", async () => {
    const { db, updates } = fakeDb([
      [EMBED_ROW], // getEmbedOwnership
      [EMBED_ROW], // updateEmbed's post-write select
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      patchRequest("/api/v1/embeds/emb-1", {
        name: "Renamed",
        surface: "speakers",
        format: "json",
        options: { q: "ai", limit: 10 },
      }),
    );

    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({
      name: "Renamed",
      surface: "speakers",
      format: "json",
      optionsJson: JSON.stringify({ q: "ai", limit: 10 }),
    });
  });

  it("rejects an unknown surface with the same shape POST uses", async () => {
    const { db } = fakeDb([[EMBED_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { surface: "not-a-surface" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toMatchObject({ surface: expect.any(String) });
  });

  it("rejects an unknown format", async () => {
    const { db } = fakeDb([[EMBED_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { format: "not-a-format" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toMatchObject({ format: expect.any(String) });
  });

  it("rejects a non-object options value", async () => {
    const { db } = fakeDb([[EMBED_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { options: "nope" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toMatchObject({ options: expect.any(String) });
  });

  it("still accepts name/enabled alone, unchanged behavior", async () => {
    const { db, updates } = fakeDb([[EMBED_ROW], [{ ...EMBED_ROW, enabled: false }]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { enabled: false }));

    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ enabled: false });
    expect(updates[0]).not.toHaveProperty("surface");
    expect(updates[0]).not.toHaveProperty("format");
    expect(updates[0]).not.toHaveProperty("optionsJson");
  });
});
