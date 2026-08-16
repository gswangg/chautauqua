// DEC-490 (wave-12 amendment): POST and PATCH /embeds refuse any option key
// not listed for the target surface in DEC-489's table, and a PATCH that
// changes `surface` alone re-validates the EFFECTIVE options (stored ∪
// patched) against the EFFECTIVE surface, so switching surface can never
// silently leave a stale, now-unsupported filter in the stored recipe.
// Mounts the real embedsRoutes sub-app against a minimal fake db, mirroring
// the fakeDb pattern in test/embeds-api-patch.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { embedsRoutes } from "../src/routes/api/embeds";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MIN_EMBED_LIMIT, MAX_EMBED_LIMIT } from "../src/server/repo/public/bounds";

const ORG_A = "org-a";
const EVENT_ID = "event-1";

function agendaEmbedRow(optionsJson: string) {
  return {
    id: "emb-1",
    orgId: ORG_A,
    eventId: EVENT_ID,
    name: "Agenda widget",
    surface: "agenda",
    format: "iframe",
    optionsJson,
    enabled: true,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// getEventOrgId (POST's assertEventOwnership) selects a single-column
// projection ({orgId}); everything else in this route file selects the full
// row shape, same distinction test/embeds-api-patch.test.ts's fakeDb draws.
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: any[] = [];
  const inserts: any[] = [];
  const db = {
    select: (cols?: unknown) => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      const isSingleOrgIdProjection =
        cols &&
        typeof cols === "object" &&
        "orgId" in (cols as Record<string, unknown>) &&
        Object.keys(cols as object).length === 1;
      const projected = isSingleOrgIdProjection ? rows.map((r) => ({ orgId: (r as { orgId: string }).orgId })) : rows;
      return makeChain(projected);
    },
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push(vals);
        },
      }),
    }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], updates, inserts };
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

function postRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/events/:eventId/embeds refuses a knob the surface does not honor (DEC-490)", () => {
  it("refuses ?format on an agenda embed, naming the key and the surface", async () => {
    const { db } = fakeDb([
      [{ orgId: ORG_A }], // assertEventOwnership -> getEventOrgId
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/embeds`, {
        name: "Agenda widget",
        surface: "agenda",
        format: "iframe",
        options: { sessionFormat: "talk" },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain("sessionFormat");
    expect(body.error.message).toContain("agenda");
    expect(body.error.fields).toMatchObject({ sessionFormat: expect.any(String) });
  });

  it("refuses ?limit on a schedule embed", async () => {
    const { db } = fakeDb([[{ orgId: ORG_A }]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/embeds`, {
        name: "Schedule widget",
        surface: "schedule",
        format: "iframe",
        options: { limit: 5 },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.fields).toMatchObject({ limit: expect.any(String) });
  });

  it("accepts day/q/trackId/accent on an agenda embed (the ruled knob set)", async () => {
    const { db, inserts } = fakeDb([
      [{ orgId: ORG_A }], // assertEventOwnership
      [{ id: "t1", eventId: EVENT_ID }], // trackBelongsToEvent
      [{ count: 0 }], // countEmbeds (cap check)
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/embeds`, {
        name: "Agenda widget",
        surface: "agenda",
        format: "iframe",
        options: { trackId: "t1", day: "2026-08-10", q: "ai", accent: "#123456" },
      }),
    );

    expect(res.status).toBe(201);
    expect(JSON.parse(inserts[0].optionsJson)).toMatchObject({
      trackId: "t1",
      day: "2026-08-10",
      q: "ai",
      accent: "#123456",
    });
  });

  // DEC-487 (wave 10 amendment): the refusal sentence for an out-of-range
  // `limit` is composed from the same two constants parseLimit enforces
  // (src/server/repo/public/bounds.ts), so the enforced range and the
  // described range can never drift apart.
  it("refuses an out-of-range limit with a message naming both MIN_EMBED_LIMIT and MAX_EMBED_LIMIT", async () => {
    const { db } = fakeDb([[{ orgId: ORG_A }]]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/embeds`, {
        name: "Sessions widget",
        surface: "sessions",
        format: "iframe",
        options: { limit: MAX_EMBED_LIMIT + 1 },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain(String(MIN_EMBED_LIMIT));
    expect(body.error.message).toContain(String(MAX_EMBED_LIMIT));
    expect(body.error.fields).toMatchObject({ limit: expect.any(String) });
  });
});

describe("PATCH /api/v1/embeds/:id re-validates the EFFECTIVE options against the EFFECTIVE surface (DEC-490)", () => {
  it("refuses when only `surface` changes and the stored options carry a knob the new surface does not honor", async () => {
    // stored: an agenda embed's own day+q -- day/q are legal on speakers too,
    // so switch to a knob speakers genuinely refuses: none of agenda's own
    // set collide... use a stored day+q PLUS a track highlight (legal on
    // agenda, and also legal on speakers as a filter) is not enough to prove
    // the refusal, so this stored recipe instead carries `day`, which
    // speakers does not honor at all.
    const row = agendaEmbedRow(JSON.stringify({ day: "2026-08-10", q: "ai" }));
    const { db } = fakeDb([[row]]); // getEmbedOwnership
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { surface: "speakers" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toMatchObject({ day: expect.any(String) });
  });

  it("succeeds when only `surface` changes and every stored key is legal on the new surface", async () => {
    const row = agendaEmbedRow(JSON.stringify({ q: "ai", accent: "#123456" }));
    const { db, updates } = fakeDb([
      [row], // getEmbedOwnership
      [{ ...row, surface: "speakers" }], // updateEmbed's post-write select
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { surface: "speakers" }));

    expect(res.status).toBe(200);
    expect(JSON.parse(updates[0].optionsJson)).toEqual({ q: "ai", accent: "#123456" });
  });

  it("merges a patched option onto the stored recipe rather than discarding the rest", async () => {
    const row = agendaEmbedRow(JSON.stringify({ q: "ai" }));
    const { db, updates } = fakeDb([
      [row], // getEmbedOwnership
      [row], // updateEmbed's post-write select
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { options: { day: "2026-08-10" } }));

    expect(res.status).toBe(200);
    expect(JSON.parse(updates[0].optionsJson)).toEqual({ q: "ai", day: "2026-08-10" });
  });

  it("refuses a patched option the CURRENT (unchanged) surface does not honor", async () => {
    const row = agendaEmbedRow(JSON.stringify({}));
    const { db } = fakeDb([[row]]); // getEmbedOwnership
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { options: { limit: 3 } }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.fields).toMatchObject({ limit: expect.any(String) });
  });
});
