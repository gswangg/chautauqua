// DEC-582 (wave 84 amendment, v12 mobile campaign w2): docs/design/
// Chautauqua Home.dc.html draws the hub's three states at 390 --
// "Event hub · phone" (docs/design/Chautauqua Home.dc.html:113
// `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px;
// font-weight:600">Event hub · phone</span>`), "Between cycles · phone"
// (docs/design/Chautauqua Home.dc.html:228 `<span style="font-family:
// 'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Between
// cycles · phone</span>`), and "Fresh deploy · phone" (docs/design/
// Chautauqua Home.dc.html:299 `<span style="font-family:'Familjen Grotesk',
// sans-serif; font-size:19px; font-weight:600">Fresh deploy · phone</span>`).
// Across all three the head and footer BAND are declared once for the
// surface, never restated per state (a footer that changes with content is
// a second footer); only the body differs. This file pins that render
// contract at the DOM level (this is SSR HTML -- jsdom applies no
// stylesheet). The tagline (the 900 desktop frames' trailing "· open-source
// speaker and event-content management") is dropped as a pure WIDTH
// decision here: the `.chq-home-footer-tagline` span is in the DOM for
// every state and a single phone-scoped CSS rule hides it, never a
// per-state render branch -- the same enable-inside-the-media-query
// contract DEC-385's Amendment (wave 12) requires of every phone-named
// selector, applied to a hide-at-phone (not a phone-only-show) case.
// CSS-rule-shape coverage for the rest of the phone anatomy (header/body/row
// geometry) already lives in test/home-phone-frames.test.ts; this file only
// covers what changed here: the footer's tagline drop. The between_cycles
// frame's footer "API docs" link (present at 390, absent at 900 for that
// one state) is a known v12 gap this lane leaves open -- see the
// "full carries the API docs anchor..." test below and the FINDING comment
// in home.css.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import { HOME_CSS } from "../src/routes/public/home.css";

function fakeDb(resultQueue: unknown[][]): Db {
  let i = 0;
  return {
    select: () => {
      const results = resultQueue[i++] ?? [];
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function fakeAssets(): Fetcher {
  return {
    async fetch() {
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

const ORG = { id: "org1", name: "Chautauqua Demo Org" };

function eventRow(overrides: {
  id?: string;
  name?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  timezone?: string;
  openMs?: number | null;
  closeMs?: number | null;
}) {
  const { openMs = null, closeMs = null, ...rest } = overrides;
  return {
    id: "e1",
    name: "DevFlow Workshops, autumn 2027",
    slug: "devflow-workshops-2027",
    startDate: "2027-10-09",
    endDate: "2027-10-10",
    location: "Fort Mason, San Francisco",
    timezone: "America/Los_Angeles",
    ...rest,
    openDate: openMs === null ? null : new Date(openMs),
    closeDate: closeMs === null ? null : new Date(closeMs),
  };
}

function buildQueue(opts: {
  events: ReturnType<typeof eventRow>[];
  countRows?: { eventId: string; count: number }[];
  trackCountRows?: { eventId: string; count: number }[];
  formatCountRows?: { eventId: string; count: number }[];
}): unknown[][] {
  const hasEvents = opts.events.length > 0;
  const countRows = hasEvents ? (opts.countRows ?? []) : [];
  const trackCountRows = hasEvents ? (opts.trackCountRows ?? []) : [];
  const formatCountRows = hasEvents ? (opts.formatCountRows ?? []) : [];
  return [[ORG], opts.events, countRows, trackCountRows, formatCountRows];
}

function buildApp(queue: unknown[][]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb(queue));
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

async function renderState(state: "full" | "between_cycles" | "fresh"): Promise<string> {
  const now = Date.now();
  const dayLabel = (offsetDays: number) => Math.floor(now / 86_400_000 + offsetDays) * 86_400_000;
  let events: ReturnType<typeof eventRow>[] = [];
  if (state === "full") {
    events = [eventRow({ id: "e1", slug: "open-cfp-event", openMs: dayLabel(-2), closeMs: dayLabel(30) })];
  } else if (state === "between_cycles") {
    events = [eventRow({ id: "e1", startDate: "2020-01-01", endDate: "2020-01-02", closeMs: dayLabel(-2) })];
  }
  const app = buildApp(
    buildQueue({ events, countRows: state === "between_cycles" ? [{ eventId: "e1", count: 5 }] : undefined }),
  );
  const res = await app.request("/", {}, { ASSETS: fakeAssets() });
  return res.text();
}

function footerOf(body: string): string {
  const m = /<footer[^>]*>([\s\S]*?)<\/footer>/.exec(body);
  if (!m) throw new Error("no <footer> in body");
  return m[1]!;
}

function headOf(body: string): string {
  const m = /<header[^>]*>([\s\S]*?)<\/header>/.exec(body);
  if (!m) throw new Error("no <header> in body");
  return m[1]!;
}

describe("DEC-582 (wave 84): the hub head is declared once, identical across all three states", () => {
  it("org name + Sign in, same markup for full / between_cycles / fresh", async () => {
    const heads = await Promise.all((["full", "between_cycles", "fresh"] as const).map((s) => renderState(s).then(headOf)));
    expect(new Set(heads).size).toBe(1);
    expect(heads[0]).toContain("Chautauqua Demo Org");
    expect(heads[0]).toContain('href="/login"');
    expect(heads[0]).toContain("Sign in");
  });
});

describe("DEC-582 (wave 84): the hub footer is declared once -- never a fourth footer per state", () => {
  // NOTE (v12 mobile campaign w2, flagged not fixed here): the between_cycles
  // frame draws the footer's "API docs" anchor on its 390 sibling
  // (docs/design/Chautauqua Home.dc.html:261) but not on its own 900 twin
  // (:220) -- a genuine width-only divergence this lane's frozen-desktop
  // constraint cannot close without touching root.tsx's Footer() render
  // branch AND test/public-home-state-actions.test.ts's DOM-count pin
  // ("the footer's 'API docs' link renders on the full hub only"), neither
  // of which is an owned file here. This test pins the PRE-EXISTING
  // (unchanged) contract instead; see home.css.ts's phone-block comment for
  // the gap itself.
  it("full carries the API docs anchor; between_cycles and fresh do not (unchanged root.tsx contract)", async () => {
    const full = footerOf(await renderState("full"));
    const between = footerOf(await renderState("between_cycles"));
    const fresh = footerOf(await renderState("fresh"));

    expect(full).toContain('href="/docs/api"');
    expect(between).not.toContain('href="/docs/api"');
    expect(fresh).not.toContain('href="/docs/api"');
    expect(fresh).not.toContain(">API docs<");
  });

  it("the 'Running on Chautauqua' GitHub attribution is present and identical in all three footers", async () => {
    const footers = await Promise.all(
      (["full", "between_cycles", "fresh"] as const).map((s) => renderState(s).then((b) => footerOf(b))),
    );
    for (const footer of footers) {
      expect(footer).toContain("Running on");
      expect(footer).toContain("github.com/gswangg/chautauqua");
      expect(footer).toContain("Chautauqua");
    }
  });

  it("the desktop tagline text is present in the DOM for every state (a phone CSS rule hides it, not a render branch)", async () => {
    const footers = await Promise.all(
      (["full", "between_cycles", "fresh"] as const).map((s) => renderState(s).then((b) => footerOf(b))),
    );
    for (const footer of footers) {
      expect(footer).toMatch(/class="chq-home-footer-tagline"/);
      expect(footer).toContain("open-source speaker and event-content management");
    }
  });
});

describe("DEC-582/DEC-385: the phone width rules for the footer live in HOME_CSS's single max-width:700px block", () => {
  const CLEAN = HOME_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  function phoneLayer(css: string): string {
    const out: string[] = [];
    const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = opener.exec(css)) !== null) {
      let depth = 1;
      let i = m.index + m[0].length;
      const start = i;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") depth -= 1;
        i += 1;
      }
      if (depth !== 0) throw new Error("unbalanced @media block");
      out.push(css.slice(start, i - 1));
    }
    if (out.length === 0) throw new Error("no max-width media block found");
    return out.join("\n");
  }

  function ruleFor(layer: string, selector: string): string {
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = rule.exec(layer)) !== null) {
      const selectors = m[1]!
        .split(",")
        .map((s) => s.trim().replace(/\s+/g, " "))
        .filter(Boolean);
      if (selectors.includes(selector)) return m[2]!;
    }
    throw new Error(`no phone rule for ${selector}`);
  }

  // DEC-385: single direction -- max-width only, never min-width, and
  // exactly one such block in the whole module.
  it("HOME_CSS declares exactly one @media (max-width: 700px) block and no min-width query", () => {
    const opens = [...CLEAN.matchAll(/@media\s*\(max-width:\s*700px\)\s*\{/g)];
    expect(opens.length).toBe(1);
    expect(CLEAN).not.toMatch(/@media\s*\([^)]*min-width/);
  });

  it("the tagline is hidden only inside the phone block, never at top level", () => {
    // top-level: no bare `.chq-home-footer-tagline {` rule outside the media block
    const layer = phoneLayer(CLEAN);
    const withoutPhoneLayer = CLEAN.replace(layer, "");
    expect(withoutPhoneLayer).not.toMatch(/\.chq-home-footer-tagline\s*\{[^}]*display\s*:\s*none/);
    expect(ruleFor(layer, ".chq-home-footer-tagline")).toMatch(/display:\s*none/);
  });

  it("the API-docs anchor keeps the 44px floor with centred flex AND horizontal padding at phone width", () => {
    const layer = phoneLayer(CLEAN);
    const rule = ruleFor(layer, ".chq-home-footer-link-end");
    expect(rule).toMatch(/min-height:\s*44px/);
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/align-items:\s*center/);
    expect(rule).toMatch(/padding:\s*0 \d+px/);
  });
});
