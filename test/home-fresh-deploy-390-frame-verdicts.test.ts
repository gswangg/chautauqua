// w30-i: the last zero-markup-citer 390 phone frame in docs/design/
// Chautauqua Home.dc.html -- "Fresh deploy · phone" (label :299, frame
// :302-321, extent runs to the next label line). Before this file, the
// frame's only citer anywhere in the tree was test/home-phone-frames.test.ts,
// a pure CSS-TEXT scan of HOME_CSS (jsdom applies no stylesheet, so it
// never dispatches a request). DEC-976's wave-28 amendment is explicit that
// an SSR phone-frame verdict is a REQUEST and a CSS-text scan is its
// COMPANION, never its substitute -- this file supplies the missing request
// half. It does not replace or edit test/home-phone-frames.test.ts, whose
// CSS-rule-shape coverage of this same frame (header/body/footer band
// geometry, the signin-row's phone stack, the tertiary anchor's floor) is
// reused here by citation, not duplicated rule-by-rule; the handful of
// CSS-text pins in this file's last describe block are the ones this
// frame's tail-control geometry specifically needs re-asserted alongside
// the request that renders them (DEC-385).
//
// Harness: `app.request('/')` against `rootRoutes` with a queue-based fake
// db that resolves an ORG but zero listable events -- src/lib/home-hub.ts's
// hubState() returns "fresh" whenever openCfp/published/past are all empty,
// regardless of whether an org row exists at all, so a seeded org with no
// events reaches the exact same branch as root.tsx's "no org row" early
// return (root.tsx:461-475) with a real org name in the DOM instead of the
// "Chautauqua" wordmark fallback. Copied verbatim from
// test/public-home-phone.test.ts's fakeDb/fakeAssets/eventRow/buildQueue
// shape (DEC-613 -- no new mock stack authored).
//
// SHAPE-GRADED, not literal: the org name ":304 `Chautauqua Demo Org`" is
// the frame's own seeded sample data (DEC-967 -- product copy comes from
// the DB, never a hardcoded literal), graded by presence/non-emptiness only.
// The frame's tail "Sign in" (:313) is drawn as a bare `<span>`, not an
// `<a>` -- consistent with this design pack's general convention of drawing
// primary-action chips as spans in the static mockup (the header's OWN
// "Sign in" at :305 IS drawn as `<a href="#">`, and test/
// home-account-docs-390-frame-verdicts.test.ts already grades the identical
// span-vs-anchor gap on the Event hub frame's "Submit a talk"/"Browse
// sessions" chips as a non-divergence for the same reason) -- the real
// route renders a functioning `<a href="/login">` there, which is required
// for the control to do anything at all. Not filed as a DIVERGES row.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import { HOME_CSS } from "../src/routes/public/home.css";
import { stripCssComments } from "./helpers/strip-css-comments";

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

function buildQueue(): unknown[][] {
  // ORG row, then zero events -- the count/track/format-count selects never
  // fire when the event list is empty (root.tsx -> listHubEvents), so an
  // empty queue tail is enough; matches buildQueue's own `hasEvents` guard
  // in test/public-home-phone.test.ts and test/home-account-docs-390-
  // frame-verdicts.test.ts.
  return [[ORG], [], [], [], []];
}

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb(buildQueue()));
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

async function renderFresh(): Promise<string> {
  const app = buildApp();
  const res = await app.request("/", {}, { ASSETS: fakeAssets() });
  expect(res.status).toBe(200);
  return res.text();
}

function sectionOf(body: string, tag: "header" | "footer" | "main"): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(body);
  if (!m) throw new Error(`no <${tag}> in body`);
  return m[1]!;
}

describe("'Fresh deploy · phone' (:302-321) — REQUEST half (SSR, DEC-976)", () => {
  it("header carries the org name (shape only, seeded data) and a real Sign in link to /login", async () => {
    const body = await renderFresh();
    const header = sectionOf(body, "header");
    // docs/design/Chautauqua Home.dc.html:304 `Chautauqua Demo Org` --
    // seeded sample data, graded by shape (non-empty org-name span), never
    // as a literal (DEC-967).
    const orgMatch = /class="chq-home-org">([^<]+)</.exec(header);
    expect(orgMatch).not.toBeNull();
    expect(orgMatch![1]!.trim().length).toBeGreaterThan(0);
    // docs/design/Chautauqua Home.dc.html:305 `<a href="#" style="margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">Sign in</a>`
    expect(header).toContain('class="chq-home-signin" href="/login"');
    expect(header).toContain("Sign in");
  });

  it("the empty-state hero renders both literals verbatim", async () => {
    const body = await renderFresh();
    // docs/design/Chautauqua Home.dc.html:310 `<h1 ...>Nothing here yet</h1>`
    expect(body).toContain("<h1>Nothing here yet</h1>");
    // docs/design/Chautauqua Home.dc.html:311 `<p ...>No call for papers is open and no programme has been published.</p>`
    expect(body).toContain("<p>No call for papers is open and no programme has been published.</p>");
  });

  it("the tail 'Sign in' primary action renders as a real /login anchor (frame draws it as a chip, see file header note: not a divergence)", async () => {
    const body = await renderFresh();
    const main = sectionOf(body, "main");
    const signinRow = main.split('class="chq-home-signin-row"')[1] ?? "";
    // docs/design/Chautauqua Home.dc.html:313 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700">Sign in</span>`
    expect(signinRow).toContain('class="chq-home-action-primary" href="/login"');
    expect(signinRow).toContain("Sign in");
  });

  it("the right-flushed 'API docs ›' anchor renders -- turns root.tsx:271-277's already-quoted DEC-383 claim into a real assertion", async () => {
    const body = await renderFresh();
    const main = sectionOf(body, "main");
    const signinRow = main.split('class="chq-home-signin-row"')[1] ?? "";
    // docs/design/Chautauqua Home.dc.html:314 `<a href="#" style="font-size:14px; font-weight:700; min-height:44px; display:flex; align-items:center">API docs ›</a>`
    expect(signinRow).toContain('class="chq-home-action-tertiary" href="/docs/api"');
    expect(signinRow).toContain("API docs ›");
  });

  it("footer carries the 'Running on Chautauqua' GitHub attribution and no API-docs link (the fresh frame's own footer draws none)", async () => {
    const body = await renderFresh();
    const footer = sectionOf(body, "footer");
    // docs/design/Chautauqua Home.dc.html:317 `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; align-items:center; gap:14px">`
    expect(footer).toContain("Running on");
    expect(footer).toContain('href="https://github.com/gswangg/chautauqua"');
    expect(footer).toContain("Chautauqua");
    expect(footer).not.toMatch(/href="\/docs\/api"/);
  });

  it("the shell's three bands render in document order (header, then main, then footer) -- the sticky-footer contract's structural precondition", async () => {
    const body = await renderFresh();
    const shellStart = body.indexOf('class="chq-home-shell"');
    const headerIdx = body.indexOf("<header");
    const mainIdx = body.indexOf("<main");
    const footerIdx = body.indexOf("<footer");
    expect(shellStart).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(shellStart);
    expect(mainIdx).toBeGreaterThan(headerIdx);
    expect(footerIdx).toBeGreaterThan(mainIdx);
  });
});

describe("'Fresh deploy · phone' — SOURCE-TEXT half (companion to the request half above, never its substitute -- jsdom/SSR applies no stylesheet)", () => {
  const CLEAN = stripCssComments(HOME_CSS);

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

  const PHONE = phoneLayer(CLEAN);

  it("HOME_CSS declares exactly one @media (max-width: …) block and no min-width query (DEC-385 single direction)", () => {
    const opens = [...CLEAN.matchAll(/@media\s*\(max-width:\s*700px\)\s*\{/g)];
    expect(opens.length).toBe(1);
    expect(CLEAN).not.toMatch(/@media\s*\([^)]*min-width/);
  });

  it("docs/design/Chautauqua Home.dc.html:305 `min-height:44px; display:flex; align-items:center` -- the header Sign in link keeps the 44px floor at phone width", () => {
    const signin = ruleFor(PHONE, ".chq-home-signin");
    expect(signin).toMatch(/min-height:\s*44px/);
    expect(signin).toMatch(/display:\s*flex/);
    expect(signin).toMatch(/align-items:\s*center/);
    expect(signin).toMatch(/padding:\s*0 \d+px/);
  });

  it("the tertiary anchor is display:flex/align-items:center at base scope and re-asserts min-height:44px at phone width -- turns root.tsx:271-277's (DEC-383) already-quoted claim into a real assertion, not just a comment", () => {
    const baseRule = /\.chq-home-action-tertiary\s*\{([^}]*)\}/.exec(
      CLEAN.slice(0, CLEAN.indexOf("@media (max-width: 700px)")),
    );
    expect(baseRule).not.toBeNull();
    // docs/design/Chautauqua Home.dc.html:314 `font-size:14px; font-weight:700; min-height:44px; display:flex; align-items:center`
    expect(baseRule![1]).toMatch(/display:\s*flex/);
    expect(baseRule![1]).toMatch(/align-items:\s*center/);
    const tertiary = ruleFor(PHONE, ".chq-home-action-tertiary");
    expect(tertiary).toMatch(/min-height:\s*44px/);
  });

  it("docs/design/Chautauqua Home.dc.html:313 `min-height:48px; display:flex; align-items:center; justify-content:center` -- the primary Sign in chip reaches its 48px floor and stretches full-width on the fresh state's stacked signin-row", () => {
    const rowSelector = ".chq-home-body:has(.chq-home-action-tertiary) .chq-home-signin-row";
    const row = ruleFor(PHONE, rowSelector);
    expect(row).toMatch(/flex-direction:\s*column/);
    expect(row).toMatch(/align-items:\s*stretch/);
    const primaryRule = /\.chq-home-action-primary,\s*\n?\s*\.chq-home-action-secondary\s*\{([^}]*)\}/.exec(PHONE);
    expect(primaryRule).not.toBeNull();
    expect(primaryRule![1]).toMatch(/width:\s*100%/);
    expect(primaryRule![1]).toMatch(/justify-content:\s*center/);
  });

  it("docs/design/Chautauqua Home.dc.html:317 `<a ...>Chautauqua</a>` inside the 'Running on' credit -- .chq-home-footer-link keeps its 44px floor at phone width (w14-ee amendment)", () => {
    const footerLinkRule = /\.chq-home-name,\s*\n?\s*\.chq-home-archive-name,\s*\n?\s*\.chq-home-footer-link\s*\{([^}]*)\}/.exec(
      PHONE,
    );
    expect(footerLinkRule).not.toBeNull();
    expect(footerLinkRule![1]).toMatch(/min-height:\s*44px/);
    expect(footerLinkRule![1]).toMatch(/display:\s*flex/);
    expect(footerLinkRule![1]).toMatch(/align-items:\s*center/);
  });

  it("the shell is a column flex parent with a full-viewport minimum height, and the body is the flexible child that absorbs slack -- the empty page's footer never floats mid-page at 844 height (User-filed sticky-footer note, base scope, applies at every width)", () => {
    const shellRule = /\.chq-home-shell\s*\{([^}]*)\}/.exec(CLEAN);
    expect(shellRule).not.toBeNull();
    expect(shellRule![1]).toMatch(/display:\s*flex/);
    expect(shellRule![1]).toMatch(/flex-direction:\s*column/);
    expect(shellRule![1]).toMatch(/min-height:\s*100vh/);
    const bodyRule = /\.chq-home-body\s*\{([^}]*)\}/.exec(CLEAN);
    expect(bodyRule).not.toBeNull();
    expect(bodyRule![1]).toMatch(/flex:\s*1 0 auto/);
  });
});
