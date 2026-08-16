// DEC-373/DEC-374: PUBLIC_CSS is inlined via dangerouslySetInnerHTML
// alongside THEME_CSS, and the per-event accent is validated + applied as a
// `style` attribute on <body> instead of being interpolated into CSS text.
// Mirrors the fake-db-chain harness established in test/public.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { validAccent } from "../src/routes/public/shell";
import { PUBLIC_CSS } from "../src/routes/public/public.css";
import { AGENDA_CSS } from "../src/routes/public/css/agenda.css";
import { THEME_CSS } from "../src/views/theme";
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
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
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

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function buildApp(brandingJson: string | null) {
  const eventRow = {
    id: "ev1",
    orgId: "org1",
    name: "Test Event",
    slug: "conf",
    startDate: "2026-08-10",
    endDate: "2026-08-11",
    location: "Moscone West, San Francisco",
    timezone: "UTC",
    recordPrefix: "SES",
    brandingJson,
  };
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([eventRow]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      return makeChain([]); // hydrateSessions subRows (no sessions)
    },
    selectDistinct: () => makeChain([]), // getVisibleSubmissionIdsOrdered: no sessions
  };
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as any);
    await next();
  });
  app.route("/", publicRoutes);
  return app;
}

describe("validAccent (DEC-374 accent guard)", () => {
  it("passes through a valid 6-hex value unchanged", () => {
    expect(validAccent("#abc123")).toBe("#abc123");
  });

  it("rejects a non-hex value and falls back to the default accent", () => {
    expect(validAccent("red;background:url(x)")).toBe("#4E5C31");
    expect(validAccent("not-a-color")).toBe("#4E5C31");
    expect(validAccent(undefined)).toBe("#4E5C31");
  });
});

describe("PUBLIC_CSS phone breakpoint (DEC-584)", () => {
  it("switches the agenda desktop grid and phone list at the single 700px breakpoint, exactly one visible at a time", () => {
    const media700 = PUBLIC_CSS.match(/@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/);
    expect(media700).toBeTruthy();
    const block = media700![1]!;
    expect(block).toMatch(/\.chq-pub-agenda-desktop\s*\{\s*display:\s*none;\s*\}/);
    expect(block).toMatch(/\.chq-pub-agenda-list\s*\{\s*display:\s*block;\s*\}/);
    // outside the 700px block, the list starts hidden (desktop-first source
    // order). Checked against AGENDA_CSS directly (task-w5-a: chrome.css.ts
    // now also has its own earlier @media (max-width: 700px) block for
    // .chq-pub-filter-row, so cutting PUBLIC_CSS at the FIRST such literal
    // would land inside CHROME_CSS instead of AGENDA_CSS's own block).
    const beforeMedia = AGENDA_CSS.slice(0, AGENDA_CSS.indexOf("@media (max-width: 700px)"));
    expect(beforeMedia).toMatch(/\.chq-pub-agenda-list\s*\{\s*display:\s*none;/);
  });
});

describe("PUBLIC_CSS search box (DEC-919 amendment, wave 40): one compact input in ONE pill row", () => {
  it("declares .chq-visually-hidden (off-screen but still in the a11y tree) for PublicSearchBox's label/submit button", () => {
    expect(PUBLIC_CSS).toMatch(/\.chq-visually-hidden\s*\{[^}]*position:\s*absolute;[^}]*\}/);
    // The classic clip-to-1px technique: an element sized 1x1 and clipped
    // stays reachable/focusable/announced but never paints on screen.
    expect(PUBLIC_CSS).toMatch(/\.chq-visually-hidden\s*\{[^}]*width:\s*1px;[^}]*\}/);
    expect(PUBLIC_CSS).toMatch(/\.chq-visually-hidden\s*\{[^}]*height:\s*1px;[^}]*\}/);
  });

  it("declares .chq-pub-filter-row as the ONE row a surface's search box and pill bars stack into", () => {
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-filter-row\s*\{[^}]*display:\s*flex;[^}]*\}/);
    // task-w5-a: the row now fits ONE row at 820 without wrapping (its
    // controls' declared widths now fit) -- flex-wrap: wrap is a <=700px
    // fallback only, not the unconditional default. See
    // public-filter-row-width.test.ts for that budget contract.
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-filter-row\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*\}/);
  });

  it("declares .chq-pub-search sized as a compact ~150x40 input, plus a 40px visible submit button butted to it (task-w5-a: shrunk from 259 so the filter row's 5 controls fit within 820; DEC-919 wave-69 amendment: the pair still sums to the same 190 the budget allotted)", () => {
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-search\s*\{[^}]*width:\s*150px;[^}]*\}/);
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-search\s*\{[^}]*height:\s*40px;[^}]*\}/);
    expect(PUBLIC_CSS).toMatch(/button\.chq-pub-search-submit\[type=submit\]\s*\{[^}]*width:\s*40px;[^}]*\}/);
    expect(PUBLIC_CSS).toMatch(/button\.chq-pub-search-submit\[type=submit\]\s*\{[^}]*height:\s*40px;[^}]*\}/);
  });
});

// w1-b: appearance:none with no replacement affordance renders a <select>
// indistinguishable from a text input -- every rule that strips the native
// caret must pair it with a replacement (a background-image caret and the
// padding-right that clears it) in the SAME rule body, not just somewhere
// else in the sheet. Scans every `appearance: none` declaration's own rule
// block across both THEME_CSS (the shared select rule every public/portal/
// CFP surface renders through) and PUBLIC_CSS (public-surface-only rules,
// if any ever add one) so this doesn't silently regress on a future rule.
function ruleBlocksWithAppearanceNone(css: string): string[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: string[] = [];
  const ruleRe = /[^{}]*\{[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(stripped))) {
    if (/appearance:\s*none/.test(m[0])) blocks.push(m[0]);
  }
  return blocks;
}

describe("w1-b: appearance:none never ships without a replacement caret affordance", () => {
  it("every appearance:none rule in THEME_CSS and PUBLIC_CSS also declares a background-image caret and clearing padding-right", () => {
    const blocks = [...ruleBlocksWithAppearanceNone(THEME_CSS), ...ruleBlocksWithAppearanceNone(PUBLIC_CSS)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).toMatch(/background-image:\s*url\(/);
      expect(block).toMatch(/padding(-right)?:\s*[^;]*(\d)/);
    }
  });
});

describe("PUBLIC_CSS rendering (DEC-373/374)", () => {
  it("a non-hex brandingJson accentColor falls back to the default accent on the body style attribute", async () => {
    installFakeCaches();
    const app = buildApp(JSON.stringify({ accentColor: "javascript:alert(1)" }));
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("--chq-brandable-accent: #4E5C31;");
    expect(html).not.toContain("javascript:alert(1)");
  });

  it("no rendered <style> element contains HTML-escaped entities (&#39;/&quot;/&gt;)", async () => {
    installFakeCaches();
    const app = buildApp(JSON.stringify({ accentColor: "#123456" }));
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    expect(styleBlocks.length).toBeGreaterThan(0);
    for (const block of styleBlocks) {
      expect(block).not.toContain("&#39;");
      expect(block).not.toContain("&quot;");
      expect(block).not.toContain("&gt;");
    }
  });
});

// Mini-gate probe finding: `.chq-pub-select`'s `background:` SHORTHAND reset
// background-image and silently erased theme.ts's shared select chevron --
// four public filter dropdowns rendered as bare rectangles. These assertions
// ban the shorthand from every public select rule and pin the active-state
// cream chevron (the ink-stroke base chevron vanishes on the ink fill).
describe("public select rules never clobber the shared caret", () => {
  it("no .chq-pub-select* rule uses the bare `background:` shorthand", () => {
    for (const m of PUBLIC_CSS.matchAll(/\.chq-pub-select[\w-]* \{[^}]*\}/g)) {
      expect(m[0]).not.toMatch(/background:\s/);
    }
  });
  it("the active (ink-filled) select carries its own cream chevron", () => {
    const rule = PUBLIC_CSS.match(/\.chq-pub-select-active \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("background-image");
    expect(rule).toContain("%23F4F1E8");
  });
  it("the base public select clears the chevron box with right padding", () => {
    const rule = PUBLIC_CSS.match(/\.chq-pub-select \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/padding: 0 34px 0 10px/);
  });
});
