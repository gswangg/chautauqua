// DEC-489 (wave-49 amendment): every public feed envelope — paged
// (sessions/speakers/gallery) or unpaged (agenda/schedule) — must report a
// `perPage` a consumer can actually divide by. This enumerates all five
// public surfaces x both feed formats (.json/.xml) and asserts the four
// envelope invariants hold on every combination, including the empty case
// (an event with zero scheduled sessions) that previously made the
// agenda/schedule `.json`/`.xml` twin report `perPage: 0`. Same
// fake-db-chain harness as test/public-feeds.test.ts (no local sqlite/D1
// test driver wired up — see package.json) — this drives the real route
// through `publicRoutes`, not a hand-rolled envelope.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { MAX_PUBLIC_ROWS } from "../src/server/repo/public/bounds";

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

// Same real-LIMIT/OFFSET-aware fake chain as test/public-feeds.test.ts.
function makeChain(rows: unknown[]) {
  let lim: number | undefined;
  let off = 0;
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: (n: number) => {
      lim = n;
      return chain;
    },
    offset: (n: number) => {
      off = n;
      return chain;
    },
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => {
      const end = lim === undefined ? undefined : off + lim;
      resolve(rows.slice(off, end));
    },
  };
  return chain;
}

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {
      /* no-op */
    },
    async delete() {
      /* no-op */
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

function mountApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

// sessions surface: getPublicSessions -> getVisibleSubmissionIdsOrdered
// (selectDistinct) -> hydrateSessions (5 selects, skipped entirely when the
// id list is empty) -> countVisibleSubmissions (1 select).
function buildSessionsApp(hasItems: boolean) {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (hasItems) {
        if (selectCall === 2) {
          return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
        }
        if (selectCall === 3) return makeChain([]); // trackRows
        if (selectCall === 4) return makeChain([]); // speakerRows
        if (selectCall === 5) return makeChain([]); // slotRows
        if (selectCall === 6) return makeChain([]); // formatRows
        return makeChain([{ count: 1 }]); // 7: countVisibleSubmissions
      }
      // No matching ids: hydrateSessions short-circuits, only the count
      // query's select() remains (call 2).
      return makeChain([{ count: 0 }]);
    },
    selectDistinct: () => makeChain(hasItems ? [{ id: "sub1", title: "Visible Talk" }] : []),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

// speakers/gallery surface: getPublicSpeakers -> idQuery (selectDistinct) ->
// countRows (1 select) -> hydration batch (1 select, skipped when the id
// list is empty).
function buildSpeakersApp(hasItems: boolean) {
  const idRows = hasItems ? [{ contactId: "c1" }] : [];
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (selectCall === 2) return makeChain([{ total: hasItems ? 1 : 0 }]);
      return makeChain(
        idRows.map((r) => ({
          contactId: r.contactId,
          firstName: "First",
          lastName: r.contactId,
          title: null,
          company: null,
          headshotUrl: null,
          bio: null,
          submissionId: `sub-${r.contactId}`,
          submissionTitle: "Talk",
        })),
      );
    },
    selectDistinct: () => makeChain(idRows),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

// agenda/schedule surface: getPublicAgenda -> countQuery (1 select, subquery
// built via selectDistinct but only the outer select()'s explicit rows
// matter to this fake) -> [total===0 short-circuits here] -> rowsQuery
// (selectDistinct, awaited directly for the slot rows) -> hydrateSessions
// (5 selects).
function buildAgendaApp(hasItems: boolean) {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (selectCall === 2) return makeChain([{ count: hasItems ? 1 : 0 }]);
      if (!hasItems) return makeChain([]); // unreachable: total===0 returns before another select()
      if (selectCall === 3) {
        return makeChain([{ id: "sub1", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }]);
      }
      if (selectCall === 4) return makeChain([]); // trackRows
      if (selectCall === 5) return makeChain([]); // speakerRows
      if (selectCall === 6) return makeChain([]); // slotRows
      return makeChain([]); // formatRows
    },
    selectDistinct: () =>
      makeChain(
        hasItems ? [{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: null }] : [],
      ),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

type Envelope = { page: number; perPage: number; total: number; itemsLength: number };

async function jsonEnvelope(res: Response): Promise<Envelope> {
  const body = (await res.json()) as { page: number; perPage: number; total: number; items: unknown[] };
  return { page: body.page, perPage: body.perPage, total: body.total, itemsLength: body.items.length };
}

async function xmlEnvelope(res: Response): Promise<Envelope> {
  const xml = await res.text();
  const m = xml.match(/page="(\d+)" perPage="(\d+)" total="(\d+)"/);
  if (!m) throw new Error(`envelope attributes not found in xml feed: ${xml.slice(0, 200)}`);
  const itemsLength = (xml.match(/<item>/g) ?? []).length;
  return { page: Number(m[1]), perPage: Number(m[2]), total: Number(m[3]), itemsLength };
}

function assertEnvelopeInvariants(env: Envelope): void {
  expect(env.page).toBeGreaterThanOrEqual(1);
  expect(env.perPage).toBeGreaterThanOrEqual(1);
  expect(env.itemsLength).toBeLessThanOrEqual(env.perPage);
  expect(env.total).toBeGreaterThanOrEqual(env.itemsLength);
}

const PAGED_SURFACES = [
  ["sessions", buildSessionsApp],
  ["speakers", buildSpeakersApp],
  ["gallery", buildSpeakersApp],
] as const;

const UNPAGED_SURFACES = [
  ["agenda", buildAgendaApp],
  ["schedule", buildAgendaApp],
] as const;

const FORMATS = [
  ["json", jsonEnvelope],
  ["xml", xmlEnvelope],
] as const;

describe("public feed envelope invariants (DEC-489 wave-49 amendment)", () => {
  for (const [surface, builder] of [...PAGED_SURFACES, ...UNPAGED_SURFACES]) {
    for (const [format, parse] of FORMATS) {
      it(`${surface}.${format}: page>=1, perPage>=1, items<=perPage, total>=items (with items)`, async () => {
        installFakeCaches();
        const app = builder(true);
        const res = await app.request(`/embed/conf/${surface}.${format}`, {}, TEST_ENV);
        expect(res.status).toBe(200);
        const env = await parse(res);
        assertEnvelopeInvariants(env);
      });
    }
  }

  // DEC-489 wave-49: this is the case that previously produced perPage=0
  // for agenda/schedule — an event with zero scheduled sessions.
  for (const [surface] of UNPAGED_SURFACES) {
    for (const [format, parse] of FORMATS) {
      it(`${surface}.${format}: empty agenda (zero scheduled sessions) reports the ceiling, not 0`, async () => {
        installFakeCaches();
        const app = buildAgendaApp(false);
        const res = await app.request(`/embed/conf/${surface}.${format}`, {}, TEST_ENV);
        expect(res.status).toBe(200);
        const env = await parse(res);
        assertEnvelopeInvariants(env);
        expect(env.itemsLength).toBe(0);
        expect(env.total).toBe(0);
        expect(env.page).toBe(1);
        expect(env.perPage).toBe(MAX_PUBLIC_ROWS);
      });
    }
  }
});
