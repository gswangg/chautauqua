// EMB-01/EMB-08 (DEC-592, DEC-579): Format must render on every public
// session surface — the sessions-list card, the session detail drill-in,
// the agenda item, and the JSON twin of the sessions feed — hydrated from
// submission_answer for the SESSION_FORMAT_FIELD_ID field. A null format
// (no such field on this event's form, or no answer given) must render
// NOTHING: never a labelled blank chip/row. Fake-db-chain harness mirrors
// the established pattern in test/public.test.ts (no local sqlite/D1 test
// driver is wired up).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    offset: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

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

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

const SUB_ROW = { id: "sub1", seq: 1, title: "Fireside Chat", description: null, icsSequence: 0 };

function formatAnswerRows(hasAnswer: boolean) {
  return hasAnswer ? [{ submissionId: "sub1", valueJson: JSON.stringify("Workshop") }] : [];
}

function buildApp() {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  return app;
}

function withDb(app: Hono<AppEnv>, db: unknown) {
  app.use("*", async (c, next) => {
    c.set("db", db as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", publicRoutes);
  return app;
}

describe("Format on the sessions-list card (/e/:eventSlug/sessions)", () => {
  function db(hasAnswer: boolean) {
    let call = 0;
    return {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
        if (call === 2) return makeChain([]); // getPublicTracks
        if (call === 3) return makeChain([]); // getPublicRooms (DEC-774)
        if (call === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
        if (call === 5) return makeChain([SUB_ROW]); // hydrateSessions subRows
        if (call === 6) return makeChain([]); // trackRows
        if (call === 7) return makeChain([]); // speakerRows
        if (call === 8) return makeChain([]); // slotRows
        if (call === 9) return makeChain(formatAnswerRows(hasAnswer)); // formatRows
        if (call === 10) return makeChain([{ count: 1 }]); // countVisibleSubmissions
        // DEC-683: !embed sessions rail queries — real (empty) row shapes.
        if (call === 11) return makeChain([]); // getPublicScheduleDayCounts
        return makeChain([]); // getPublicCfpWindow
      },
      selectDistinct: () => makeChain([{ id: "sub1", title: "Fireside Chat" }]),
    };
  }

  // DEC-968: the list row's format renders through the shared
  // .chq-pub-session-tag meta line, not the colour-swatch .chq-pub-format-chip
  // (which stays for the agenda blocks and the detail page below).
  it("a session with the answer shows it on the card", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(true));
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-session-tag"');
    expect(html).toContain("Workshop");
  });

  it("no field-session-format answer renders no Format label", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(false));
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("Workshop");
  });
});

describe("Format on the session detail drill-in (/e/:eventSlug/sessions/:id)", () => {
  function db(hasAnswer: boolean) {
    let call = 0;
    return {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
        if (call === 2) return makeChain([SUB_ROW]); // hydrateSessions subRows
        if (call === 3) return makeChain([]); // trackRows
        if (call === 4) return makeChain([]); // speakerRows
        if (call === 5) return makeChain([]); // slotRows
        if (call === 6) return makeChain(formatAnswerRows(hasAnswer)); // formatRows
        return makeChain([]); // getScheduleInfoForSubmissions slotRows
      },
      selectDistinct: () => makeChain([{ id: "sub1" }]), // getPublicSessionDetail visibleRows
    };
  }

  it("shows the format on the detail page", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(true));
    const res = await app.request("/e/conf/sessions/sub1", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-format-chip"');
    expect(html).toContain("Workshop");
  });

  it("no answer renders no Format label on the detail page", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(false));
    const res = await app.request("/e/conf/sessions/sub1", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('class="chq-pub-format-chip"');
  });
});

// Only cards.tsx (SessionCard) and detail.tsx (session-detail branch) are
// this task's UI-rendering scope (agenda.tsx's own markup is untouched —
// owned by an in-flight wave-2 agenda task). This confirms the repo layer
// still carries `format` all the way onto PublicAgendaItem, verified
// through the agenda surface's own JSON twin.
describe("Format on the agenda item's data (getPublicAgenda -> PublicAgendaItem.format, via /embed/:eventSlug/agenda.json)", () => {
  function db(hasAnswer: boolean) {
    let call = 0;
    return {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
        if (call === 2) return makeChain([{ count: 1 }]); // getPublicAgenda count(*)
        if (call === 3) return makeChain([SUB_ROW]); // hydrateSessions subRows
        if (call === 4) return makeChain([]); // trackRows
        if (call === 5) return makeChain([]); // speakerRows
        if (call === 6) return makeChain([]); // slotRows (hydrateSessions' own — unused by agenda item)
        return makeChain(formatAnswerRows(hasAnswer)); // formatRows
      },
      selectDistinct: () =>
        makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: null }]),
    };
  }

  it("a session with the answer carries format on the agenda item", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(true));
    const res = await app.request("/embed/conf/agenda.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ format: string | null }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.format).toBe("Workshop");
  });

  it("no answer serializes the agenda item's format as null", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(false));
    const res = await app.request("/embed/conf/agenda.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ format: string | null }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.format).toBeNull();
  });
});

describe("Format in the .json payload twin (/embed/:eventSlug/sessions.json)", () => {
  function db(hasAnswer: boolean) {
    let call = 0;
    return {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
        if (call === 2) return makeChain([SUB_ROW]); // hydrateSessions subRows
        if (call === 3) return makeChain([]); // trackRows
        if (call === 4) return makeChain([]); // speakerRows
        if (call === 5) return makeChain([]); // slotRows
        if (call === 6) return makeChain(formatAnswerRows(hasAnswer)); // formatRows
        return makeChain([{ count: 1 }]); // countVisibleSubmissions
      },
      selectDistinct: () => makeChain([{ id: "sub1", title: "Fireside Chat" }]),
    };
  }

  it("a session with the answer carries format in the JSON item", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(true));
    const res = await app.request("/embed/conf/sessions.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ format: string | null }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.format).toBe("Workshop");
  });

  it("no answer serializes format as null, never a placeholder string", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), db(false));
    const res = await app.request("/embed/conf/sessions.json", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ format: string | null }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.format).toBeNull();
  });
});
