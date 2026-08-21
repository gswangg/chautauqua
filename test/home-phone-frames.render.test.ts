// Task w28-f (DEC-976 wave-28): REQUEST verdicts for the three Home 390
// phone frames, alongside the CSS-text pins in test/home-phone-frames.test.ts
// and test/public-home-phone.test.ts. Both of those files are source-scans
// (public-home-phone.test.ts does issue requests, but only asserts against
// the head/footer bands, not the H1 or the full body's control-label
// membership) -- neither proves the drawn MARKUP of the three states'
// bodies renders. This file issues a real `GET /` per state (mirroring
// public-home-phone.test.ts's own buildApp/fakeDb harness -- DEC-613: reuse
// the existing request vocabulary, never author a second one) and asserts
// against the response body:
//
//   * exactly one <h1> whose text equals the frame's drawn H1 literal
//   * the drawn dock band (data-chq-phone-dock) -- absent for all three:
//     the Home hub is an anonymous SSR page with no shell/tab-bar to stand
//     down, so no frame here ever draws one (grep confirms src/routes/
//     root.tsx sets no such attribute; DEC-576's dock contract exists to
//     suppress a shell tab bar this page never has)
//   * no back link -- none of the three frames draws one (Home is the top
//     of the anonymous surface, not a drill-in)
//   * every control label the frame draws inside that extent
//
// Frame population derived per the task's own grammar: a label line is
// font-size:19px + `>TITLE</`, its extent runs to the next label line, and
// it is a phone frame iff the extent contains both width:390px and
// height:844. In docs/design/Chautauqua Home.dc.html that is exactly three
// frames -- "Event hub · phone" (:113, frame extent [116,181)), "Between
// cycles · phone" (:228, extent [231,269)), "Fresh deploy · phone" (:299,
// extent [302,326)) -- matching test/home-phone-frames.test.ts's own header
// comment population.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";

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
  expect(res.status).toBe(200);
  return res.text();
}

function h1sOf(body: string): string[] {
  return [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1]!.trim());
}

describe("v12 phone frame 'Event hub' (docs/design/Chautauqua Home.dc.html:116-180) -- REQUEST verdict", () => {
  it("docs/design/Chautauqua Home.dc.html:124 `<h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.042em; line-height:1.05\">Events</h1>` -- exactly one <h1>, text 'Events'", async () => {
    const body = await renderState("full");
    const h1s = h1sOf(body);
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toBe("Events");
  });

  it("docs/design/Chautauqua Home.dc.html:119 `<a href=\"#\" style=\"margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">Sign in</a>` -- header 'Sign in' present, no drawn back link and no dock band (the hub has no shell to stand down)", async () => {
    const body = await renderState("full");
    expect(body).toContain(">Sign in<");
    expect(body).not.toContain("data-chq-phone-dock");
    expect(body).not.toContain("&lsaquo; Back");
  });

  it("docs/design/Chautauqua Home.dc.html:137 `<span style=\"background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; margin-top:2px\">Submit a talk</span>` -- 'Submit a talk' present for the open-CFP row", async () => {
    const body = await renderState("full");
    expect(body).toContain("Submit a talk");
  });

  it("docs/design/Chautauqua Home.dc.html:173 `<a href=\"#\" style=\"margin-left:auto; font-size:12px; font-weight:700; min-height:44px; display:flex; align-items:center\">API docs</a>` -- footer 'API docs' present, pointed at /docs/api", async () => {
    const body = await renderState("full");
    expect(body).toContain('href="/docs/api"');
    expect(body).toContain(">API docs<");
  });
});

describe("v12 phone frame 'Between cycles' (docs/design/Chautauqua Home.dc.html:231-268) -- REQUEST verdict", () => {
  it("docs/design/Chautauqua Home.dc.html:239 `<h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:29px; font-weight:700; letter-spacing:-0.042em; line-height:1.07\">No open calls right now</h1>` -- exactly one <h1>, text 'No open calls right now'", async () => {
    const body = await renderState("between_cycles");
    const h1s = h1sOf(body);
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toBe("No open calls right now");
  });

  it("docs/design/Chautauqua Home.dc.html:119 `<a href=\"#\" style=\"margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">Sign in</a>` -- header 'Sign in' present, no drawn back link and no dock band", async () => {
    const body = await renderState("between_cycles");
    expect(body).toContain(">Sign in<");
    expect(body).not.toContain("data-chq-phone-dock");
    expect(body).not.toContain("&lsaquo; Back");
  });

  it("docs/design/Chautauqua Home.dc.html:165 `<a href=\"#\" style=\"font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center; white-space:nowrap\">Sessions ›</a>` -- archive row's 'Sessions ›' present", async () => {
    const body = await renderState("between_cycles");
    expect(body).toContain("Sessions ›");
  });

  it("docs/design/Chautauqua Home.dc.html:261 `<a href=\"#\" style=\"margin-left:auto; font-size:12px; font-weight:700; min-height:44px; display:flex; align-items:center\">API docs</a>` -- footer 'API docs' present, pointed at /docs/api (between_cycles' own phone-only anchor)", async () => {
    const body = await renderState("between_cycles");
    expect(body).toContain('href="/docs/api"');
    expect(body).toContain(">API docs<");
  });
});

describe("v12 phone frame 'Fresh deploy' (docs/design/Chautauqua Home.dc.html:302-325) -- REQUEST verdict", () => {
  it("docs/design/Chautauqua Home.dc.html:310 `<h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:29px; font-weight:700; letter-spacing:-0.042em; line-height:1.07\">Nothing here yet</h1>` -- exactly one <h1>, text 'Nothing here yet'", async () => {
    const body = await renderState("fresh");
    const h1s = h1sOf(body);
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toBe("Nothing here yet");
  });

  it("docs/design/Chautauqua Home.dc.html:119 `<a href=\"#\" style=\"margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">Sign in</a>` -- header 'Sign in' present, no drawn back link and no dock band", async () => {
    const body = await renderState("fresh");
    expect(body).toContain(">Sign in<");
    expect(body).not.toContain("data-chq-phone-dock");
    expect(body).not.toContain("&lsaquo; Back");
  });

  it("docs/design/Chautauqua Home.dc.html:313 `<span style=\"background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700\">Sign in</span>` -- the body's own 'Sign in' CTA present (a second occurrence beside the header's)", async () => {
    const body = await renderState("fresh");
    const signInCount = [...body.matchAll(/>Sign in</g)].length;
    expect(signInCount).toBeGreaterThanOrEqual(2);
  });

  it("docs/design/Chautauqua Home.dc.html:314 `<a href=\"#\" style=\"font-size:14px; font-weight:700; min-height:44px; display:flex; align-items:center\">API docs ›</a>` -- 'API docs ›' present, pointed at /docs/api. Fresh deploy's own footer draws NO API-docs anchor (:317-318 ends with no trailing link, unlike the other two states), so /docs/api appears exactly once", async () => {
    const body = await renderState("fresh");
    expect(body).toContain("API docs ›");
    const hrefCount = [...body.matchAll(/href="\/docs\/api"/g)].length;
    expect(hrefCount).toBe(1);
  });
});
