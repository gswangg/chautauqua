// Request-level companion to test/public-agenda-phone-frames.test.ts's
// CSS-text pins (task w28-g, DEC-976 wave-28 amendment: "an SSR phone-frame
// verdict is a REQUEST; a CSS-text scan is its companion, never its
// substitute"). That sibling file (413 lines) is a pure source-scan on
// AGENDA_CSS/RAIL_CSS/CARDS_CSS/CHROME_CSS's text — `grep -c 'buildApp\|
// app.request\|fetch('` on it returns 0, so it can see geometry but never
// markup. This file dispatches REAL requests through the actual route
// modules (Hono<AppEnv> + registerErrorHandler + app.request, mirroring
// test/public-home-phone.test.ts's mock-db + buildApp + app.request shape)
// and asserts the returned HTML string.
//
// SCOPE: this file's name matches test/public-agenda-phone-frames.test.ts
// (its CSS-text sibling), which owns exactly agenda.css.ts + rail.css.ts +
// cards.css.ts + chrome.css.ts -- the two phone frames those four
// stylesheets style, "Public agenda · phone" and "My schedule · phone"
// (per-line citations for each are inline with their own assertions
// below). The public-site cluster carries FOUR MORE in-scope phone
// frames -- "Submit a talk" and its three DEC-098 confirmation states,
// "Submitted", "Submitted · email already known", "Submitted · has an
// account" -- but those are styled by cfp.css.ts, a DIFFERENT stylesheet
// with its own CSS-text sibling test/cfp-phone-submit-relining.test.ts,
// and ALREADY carry real request-level verdicts landed at
// test/public-390-frame-verdicts.test.ts (task w14-sf, DEC-976 wave-158
// SSR amendment) -- MATCHES/DIVERGES per frame, real app.request dispatch,
// verbatimLine citation receipts. Adding a second copy of those four
// frames' assertions here would be exactly the "second copy of a
// vocabulary is a trap with a delay fuse" the field guide (DEC-613) warns
// against; this file does not re-test them. The full six-frame accounting
// (both files) is in this task's ledger, its own path spelled with a
// space so this comment is never itself mistaken for a design-file
// citation: docs/design/audit / public-390-request-verdicts-v12.md.
//
// The eight remaining width:390px/height:844 frames in the SAME .dc.html
// file (Speaker portal, Portal · Your tasks, Portal · Hotel stay form,
// Portal · Your profile, Portal · Your session, Portal · Edit your
// session, Portal · co-presenter rejected, Portal · Resources) belong to
// the speaker-portal cluster's own sibling lane and are out of scope here
// (see the ledger header for the population derivation and the note that
// the brief's "three portal frames" figure undercounts the true eight).
//
// Harness: mirrors test/public-390-frame-verdicts.test.ts's
// buildAgendaApp()/buildScheduleApp() exactly (which themselves mirror
// test/public-agenda-rail.test.ts's buildApp()) — the mock-db-queue +
// Hono<AppEnv> + app.route + app.request shape test/public-home-phone.test.ts
// also uses for root.tsx, adapted to agenda/schedule's own repo call
// sequence. Reused verbatim rather than a third reimplementation (DEC-613).
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { DEC_976 } from "../src/decisions";

// implements DEC_976 (an SSR phone-frame verdict is a REQUEST; a CSS-text
// scan is its companion, never its substitute).
void DEC_976;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims, so a citation cannot silently rot
 * to a wrong line the way a bare `:line` reference can. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
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

const AGENDA_EVENT_ROW = {
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

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

const SLOT_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 570, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-11", startMin: 600, endMin: 630, roomId: "room1" },
];

function buildAgendaApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([AGENDA_EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      // getPublicScheduleDayCounts -- two days, so DaySwitcher renders more
      // than one pill (days.length <= 1 -> null, agenda-controls.tsx:85).
      if (selectCall === 3)
        return makeChain([
          { day: "2026-08-10", count: 1 },
          { day: "2026-08-11", count: 1 },
        ]);
      if (selectCall === 4) return makeChain([{ count: 1 }]); // getPublicAgenda count(*)
      if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 6) return makeChain([{ id: "room1", name: "Main Hall", position: 1 }]); // room lookup
      if (selectCall === 7) {
        return makeChain([{ id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 }]); // hydrateSessions subRows
      }
      return makeChain([]); // trackRows/speakerRows/slotRows/formatRows
    },
    selectDistinct: () => makeChain(SLOT_ROWS),
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

function buildScheduleApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([AGENDA_EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ count: 1 }]); // getPublicAgenda count(*)
      if (selectCall === 4) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 5) return makeChain([{ id: "room1", name: "Main Hall" }]); // room lookup
      if (selectCall === 6) {
        return makeChain([{ id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 }]);
      }
      return makeChain([]);
    },
    selectDistinct: () =>
      makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }]),
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

describe("PUBLIC SSR 390 frame render verdicts, request companion (task w28-g)", () => {
  describe("frame :371-409 Public agenda", () => {
    it("MATCHES: the day-switcher <nav> is the frame's drawn filter idiom -- Jump-to-day pills + the terminal My schedule pill", async () => {
      installFakeCaches();
      const res = await buildAgendaApp().request("/e/conf/agenda", {}, TEST_ENV);
      expect(res.status).toBe(200);
      const html = await res.text();

      // docs/design/Chautauqua Public and Portal.dc.html:378 `<span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:600">Tue 12</span>`
      // -- declares the day strip's active-day pill; :381 (below) declares
      // its terminal "My schedule" member -- together the frame's whole
      // filter/scanning idiom (no separate search box is drawn here).
      verbatimLine(378, '          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:600">Tue 12</span>');
      expect(html).toContain('aria-label="Jump to day"');
      expect(html).toContain('class="chq-pub-day-switcher"');
      const pills = [...html.matchAll(/<a class="chq-pub-day-pill[^"]*"/g)];
      expect(pills.length).toBeGreaterThanOrEqual(2); // >=1 day pill + the My-schedule pill

      // docs/design/Chautauqua Public and Portal.dc.html:381 `<span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:500">My schedule · 4</span>`
      // -- the strip's terminal member; a real, honest divergence from the
      // frame's sample count "4" is noted below (the real route starts at 0).
      verbatimLine(381, '          <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:500">My schedule · 4</span>');
      expect(html).toContain('class="chq-pub-day-pill chq-pub-my-schedule-pill" href="/e/conf/schedule"');
      // Real route count starts at 0 -- client hydration (agenda-itinerary-
      // script.tsx) fills it after paint; the frame's static sample is "4".
      expect(html).toMatch(/My schedule ·\s*<span id="chq-my-schedule-pill-count">0<\/span>/);
    });

    it("MATCHES: the dock band -- filled Download .ics + bordered Speakers, exactly the two controls the frame draws", async () => {
      installFakeCaches();
      const res = await buildAgendaApp().request("/e/conf/agenda", {}, TEST_ENV);
      const html = await res.text();

      // docs/design/Chautauqua Public and Portal.dc.html:400 `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
      verbatimLine(400, '      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">');
      expect(html).toContain('class="chq-pub-agenda-dock"');
      const dock = html.split('class="chq-pub-agenda-dock"')[1]?.split("</div>\n")[0] ?? "";
      expect(dock).toContain('id="chq-ics-link-dock"');
      expect(dock).toContain("Download .ics");
      expect(dock).toContain('class="chq-pub-agenda-dock-cross" href="/e/conf/speakers">');
      expect(dock).toContain("Speakers</a>");
    });

    it("real divergence, not a defect: the frame's own mockup leads with the event title as a bare span, never an <h1> -- the real route's <h1> is the (dynamic, session-count-bearing) chq-pub-surface-title, which the frame's static sample never shows", async () => {
      installFakeCaches();
      const res = await buildAgendaApp().request("/e/conf/agenda", {}, TEST_ENV);
      const html = await res.text();
      const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
      expect(h1s).toHaveLength(1);
      expect(h1s[0]![0]).toContain('class="chq-pub-surface-title"');
    });
  });

  describe("frame :861-893 My schedule · /schedule", () => {
    it("MATCHES: exactly one <h1>My schedule</h1>, and (structural divergence from :371's agenda) NO day switcher -- this surface has no day facet of its own", async () => {
      installFakeCaches();
      const res = await buildScheduleApp().request("/e/conf/schedule", {}, TEST_ENV);
      expect(res.status).toBe(200);
      const html = await res.text();

      // docs/design/Chautauqua Public and Portal.dc.html:867 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">My schedule</h1>`
      verbatimLine(867, `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">My schedule</h1>`);
      const h1s = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)];
      expect(h1s).toHaveLength(1);
      expect(h1s[0]![1]).toBe("My schedule");
      expect(html).not.toContain('class="chq-pub-day-switcher"');
      expect(html).not.toContain('aria-label="Jump to day"');
    });

    it("MATCHES: the dock band -- filled Download .ics + bordered All sessions", async () => {
      installFakeCaches();
      const res = await buildScheduleApp().request("/e/conf/schedule", {}, TEST_ENV);
      const html = await res.text();

      // docs/design/Chautauqua Public and Portal.dc.html:884 `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
      verbatimLine(884, '      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">');
      expect(html).toContain('class="chq-pub-schedule-dock"');
      const dock = html.split('class="chq-pub-schedule-dock"')[1]?.split("</div>\n")[0] ?? "";
      const icsMatch = dock.match(/<a id="chq-ics-link-dock"[^>]*>([^<]*)<\/a>/);
      expect(icsMatch).toBeTruthy();
      expect(icsMatch![1]!.trim()).toBe("Download .ics");
      expect(dock).toContain('class="chq-pub-schedule-dock-cross" href="/e/conf/sessions">');
      expect(dock).toContain("All sessions</a>");
    });

    it("MATCHES: per-row action reads Remove (never Save/Saved -- that's the agenda list's own vocabulary)", async () => {
      installFakeCaches();
      const res = await buildScheduleApp().request("/e/conf/schedule", {}, TEST_ENV);
      const html = await res.text();

      // docs/design/Chautauqua Public and Portal.dc.html:880 `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Remove</span>`
      verbatimLine(880, '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Remove</span>');
      expect(html).toContain('class="chq-pub-schedule-remove"');
      expect(html).toContain("<span>Remove</span>");
    });
  });
});
