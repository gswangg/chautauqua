// DEC-582 (wave 11 amendment): docs/design/Chautauqua Home.dc.html draws the
// fresh-deploy hub state's action cluster as TWO controls -- a primary
// "Sign in" and a tertiary "API docs ›" (:284-287 desktop, :313-314 phone).
// root.tsx rendered only the primary. This test pins ALL THREE HubStates as
// one render contract, each asserted as an EXACT action set (not merely
// "contains") so a future change to any one state's action cluster is
// caught here rather than by a separate, driftable test per state. Same
// fake-db/app harness as test/home-hub.test.ts.

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

const ORG = { id: "org1", name: "Hub Test Org" };

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

const ACTION_CLASSES = [
  "chq-home-action-primary",
  "chq-home-action-secondary",
  "chq-home-action-quiet",
  "chq-home-action-tertiary",
];

/** Every anchor inside <main> whose class is one of the four named action
 * families -- excludes row TITLE links (chq-home-name / chq-home-archive-name),
 * which link the same target but are not "actions". */
function mainActionAnchors(html: string): { text: string; href: string; cls: string }[] {
  const main = html.split("<main")[1]?.split("</main>")[0] ?? "";
  return [...main.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)]
    .map((m) => {
      const hrefMatch = m[1]!.match(/href="([^"]*)"/);
      const classMatch = m[1]!.match(/class="([^"]*)"/);
      return { text: m[2]!.trim(), href: hrefMatch?.[1] ?? "", cls: classMatch?.[1] ?? "" };
    })
    .filter((a) => ACTION_CLASSES.includes(a.cls));
}

describe("DEC-582 (wave 11 amendment): hub action cluster is one exact render contract per state", () => {
  it("full — per-row 'Submit a talk' / 'Browse sessions' / 'Sessions ›', no body-level Sign in", async () => {
    const now = Date.now();
    // DEC-522: open/close are UTC-midnight DAY LABELS (see the footer test's
    // fixture note) — raw instants make classification time-of-day dependent.
    const dayLabel = (offsetDays: number) => Math.floor(now / 86_400_000 + offsetDays) * 86_400_000;
    const events = [
      eventRow({
        id: "e1",
        slug: "open-cfp-event",
        name: "Open CFP Event",
        openMs: dayLabel(-2),
        closeMs: dayLabel(30),
      }),
      eventRow({
        id: "e2",
        slug: "published-event",
        name: "Published Event",
        closeMs: dayLabel(-30),
      }),
      eventRow({
        id: "e3",
        slug: "past-event",
        name: "Past Event",
        startDate: "2020-01-01",
        endDate: "2020-01-02",
        closeMs: dayLabel(-2),
      }),
    ];
    const app = buildApp(
      buildQueue({
        events,
        countRows: [
          { eventId: "e2", count: 5 },
          { eventId: "e3", count: 2 },
        ],
      }),
    );
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    const actions = mainActionAnchors(body);
    expect(actions.map((a) => a.text)).toEqual(["Submit a talk", "Browse sessions", "Sessions ›"]);
    expect(actions.map((a) => a.href)).toEqual([
      "/submit/open-cfp-event",
      "/e/published-event/sessions",
      "/e/past-event/sessions",
    ]);
    expect(body).not.toMatch(/class="chq-home-signin-row"/);
  });

  it("between_cycles — 'Already happened' section renders BEFORE the sign-in row; secondary Sign in + 'Organisers and reviewers'", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2020-01-01",
        endDate: "2020-01-02",
        closeMs: Math.floor(Date.now() / 86_400_000 - 2) * 86_400_000,
      }),
    ];
    const app = buildApp(buildQueue({ events, countRows: [{ eventId: "e1", count: 1 }] }));
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();

    const archiveIdx = body.indexOf('class="chq-home-archive-row"');
    const signinRowIdx = body.indexOf('class="chq-home-signin-row"');
    expect(archiveIdx).toBeGreaterThan(-1);
    expect(signinRowIdx).toBeGreaterThan(-1);
    expect(archiveIdx).toBeLessThan(signinRowIdx);

    const signinRow = body.split('class="chq-home-signin-row"')[1]?.split("</div>")[0] ?? "";
    expect(signinRow).toContain('class="chq-home-action-secondary"');
    expect(signinRow).toContain("Sign in");
    expect(signinRow).toContain('href="/login"');
    expect(signinRow).toContain("Organisers and reviewers");
    // exactly one anchor in the sign-in row (the secondary Sign in) plus a
    // plain <span> caption -- no tertiary link in this state.
    const anchorsInRow = [...signinRow.matchAll(/<a\b/g)].length;
    expect(anchorsInRow).toBe(1);
  });

  it("fresh — primary Sign in plus the new tertiary 'API docs ›', no event sections", async () => {
    const app = buildApp(buildQueue({ events: [] }));
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();

    const signinRow = body.split('class="chq-home-signin-row"')[1]?.split("</main>")[0] ?? "";
    const anchors = [...signinRow.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].map((m) => {
      const hrefMatch = m[1]!.match(/href="([^"]*)"/);
      const classMatch = m[1]!.match(/class="([^"]*)"/);
      return { text: m[2]!.trim(), href: hrefMatch?.[1] ?? "", cls: classMatch?.[1] ?? "" };
    });
    expect(anchors).toEqual([
      { text: "Sign in", href: "/login", cls: "chq-home-action-primary" },
      { text: "API docs ›", href: "/docs/api", cls: "chq-home-action-tertiary" },
    ]);

    expect(body).not.toMatch(/class="chq-home-archive-row"/);
    expect(body).not.toMatch(/class="chq-home-row"/);
    expect(body).not.toMatch(/class="chq-home-row-published"/);
  });

  // Wave-16 amendment (DEC-383): the prior "G13 lane-D fix" rule pinned
  // here (API docs on the FULL hub only) left a v12/390 gap on
  // between_cycles. root.tsx now renders the anchor unconditionally in
  // the DOM for `between_cycles` too (an extra class,
  // .chq-home-footer-link-end-phone, base-hidden by home.css.ts and
  // revealed only under max-width:700px -- DEC-385), so the DOM-level
  // count moves from 0 to 1 for that state. `full`'s render is unchanged;
  // `fresh` still renders none. See the citation beside the assertion
  // below for the frame line this reproduces.
  it("the footer's 'API docs' link renders on the full hub and (DOM-only, base-hidden) on between_cycles; still absent on fresh", async () => {
    const scenarios: { name: string; queue: unknown[][] }[] = [
      {
        name: "full",
        queue: buildQueue({
          events: [
            // DEC-522: open/close are UTC-midnight DAY LABELS, expanded to
            // local start/end-of-day in the event's timezone. Raw instants
            // made this fixture time-of-day dependent (between 00:00 UTC and
            // local midnight, "today's" label has not started yet in LA).
            // Use aligned labels safely in the past / future instead.
            eventRow({
              id: "e1",
              openMs: Math.floor(Date.now() / 86_400_000 - 2) * 86_400_000,
              closeMs: Math.floor(Date.now() / 86_400_000 + 30) * 86_400_000,
            }),
          ],
        }),
      },
      {
        name: "between_cycles",
        queue: buildQueue({
          events: [
            eventRow({
              id: "e1",
              startDate: "2020-01-01",
              endDate: "2020-01-02",
              closeMs: Math.floor(Date.now() / 86_400_000 - 2) * 86_400_000,
            }),
          ],
          countRows: [{ eventId: "e1", count: 1 }],
        }),
      },
      { name: "fresh", queue: buildQueue({ events: [] }) },
    ];

    for (const scenario of scenarios) {
      const app = buildApp(scenario.queue);
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      const body = await res.text();
      const footer = body.split("<footer")[1]?.split("</footer>")[0] ?? "";
      const footerApiLinks = [...footer.matchAll(/href="\/docs\/api"[^>]*>\s*API docs\s*<\/a>/g)];
      expect(footerApiLinks.length, `${scenario.name} footer API docs link`).toBe(scenario.name === "fresh" ? 0 : 1);
      // docs/design/Chautauqua Home.dc.html:261 `<a href="#" style="margin-left:auto; font-size:12px; font-weight:700; min-height:44px; display:flex; align-items:center">API docs</a>` -- between_cycles carries the extra base-hidden class; full does not.
      if (scenario.name === "between_cycles") {
        expect(footer).toMatch(/class="chq-home-footer-link chq-home-footer-link-end chq-home-footer-link-end-phone"/);
      } else if (scenario.name === "full") {
        expect(footer).toMatch(/class="chq-home-footer-link chq-home-footer-link-end"/);
        expect(footer).not.toContain("chq-home-footer-link-end-phone");
      }
    }
  });
});
