// DEC-144/DEC-139 browser render-sweep gate: boots a migrated + seeded
// `wrangler dev` on a free local port (same boot/seed sequence CI's
// walkthrough/perf-smoke jobs use — see .github/workflows/ci.yml and
// package.json's "seed"/"db:migrate" scripts), launches Playwright
// chromium (`npx playwright install chromium` must have been run once —
// see README "Dev: render-sweep gate"), logs in once per persona via the
// real /login form using the seeded credentials (docs/fixtures/sample-data.json,
// same fixture scripts/seed.ts and scripts/perf-smoke.ts read), then visits
// every app/src/routeManifest.ts entry and asserts:
//   - the navigation response status is 200
//   - the rendered #root (admin SPA routes) or body (SSR portal/public
//     routes) text is non-empty
//   - zero collected console 'error' + pageerror events (no allowlist)
//
// DEC-253: a second pass then re-visits MOBILE_ROUTE_MANIFEST (the no-login
// public/embed/submit surfaces + /login + /portal) at a 390x844 viewport and
// asserts zero page-level horizontal overflow
// (document.scrollingElement.scrollWidth <= window.innerWidth + 1px slack)
// and that every primary nav/filter/submit control on the page measures
// >= 40px tall (tap-target size) — see scripts/render-sweep-lib.ts's
// evaluateMobileRoute for the pass criteria and test/render-sweep-lib.test.ts
// for its unit tests.
//
// Prints a per-route PASS/FAIL table and exits non-zero on any failure.
// Not run as part of `npm test` (needs a booted server) — run explicitly
// via `npm run gate:render-sweep`.
//
// Scripts/ tooling (not src/ pure-core, DEC-002), so node: imports and the
// playwright/child_process dependency are fine here. Pure evaluation/
// formatting helpers live in scripts/render-sweep-lib.ts for unit testing;
// see test/render-sweep-lib.test.ts.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser, type BrowserContext, type ConsoleMessage, type Page } from "playwright";

import { ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";
import {
  ADMIN_MOBILE_PASS_BLOCKING,
  allFontFloorPassed,
  allMobilePassed,
  allPassed,
  evaluateFontFloor,
  evaluateMobileRoute,
  evaluateRoute,
  FONT_FLOOR_BLOCKING,
  fontFloorErrorResult,
  formatFontFloorSummary,
  formatFontFloorTable,
  formatMobileResultsTable,
  formatMobileSummary,
  formatResultsTable,
  formatSummary,
  mobileErrorResult,
  PAGE_EVALUATE_KEEPNAMES_SHIM,
  routeErrorResult,
  type FontFloorResult,
  type MobileRouteEntry,
  type MobileRouteResult,
  type RouteResult,
} from "./render-sweep-lib";
import {
  allContrastPassed,
  CONTRAST_BLOCKING,
  CONTRAST_MIN_RATIO,
  CONTRAST_MIN_RATIO_LARGE,
  contrastErrorResult,
  evaluateContrast,
  formatContrastSummary,
  formatContrastTable,
  type ContrastResult,
} from "./render-sweep-contrast";
import { ensureDevVars } from "./ensure-dev-vars";

// DEC-253: the no-login/portal mobile-bar surfaces (390x844). Seed literals
// mirror app/src/routeManifest.ts (same "devflow-conf-2027" event,
// seed_submission_0001/seed_contact_0001 — the seed's index-0 accepted +
// content-approved + visible submission/contact, DEC-108 — so the session
// and speaker detail drill-ins resolve against `npm run seed` data).
export const MOBILE_EVENT_SLUG = "devflow-conf-2027";
const MOBILE_SESSION_ID = "seed_submission_0001";
const MOBILE_SPEAKER_ID = "seed_contact_0001";
const MOBILE_TASK_ASSIGNMENT_ID = "seed_task_assignment_0001";

export const MOBILE_ROUTE_MANIFEST: readonly MobileRouteEntry[] = [
  { path: `/submit/${MOBILE_EVENT_SLUG}`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/sessions`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/speakers`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/agenda`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/schedule`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/gallery`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/sessions/${MOBILE_SESSION_ID}`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/speakers/${MOBILE_SPEAKER_ID}`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/sessions`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/agenda`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/speakers`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/schedule`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/gallery`, role: "public" },
  { path: "/login", role: "public" },
  { path: "/portal", role: "speaker" },
  // DEC-411: widen the mobile pass from the single /portal route to the
  // whole phone product — the same speaker portal surfaces already in
  // app/src/routeManifest.ts (110-127), same deterministic seed ids.
  { path: `/portal/submissions/${MOBILE_SESSION_ID}`, role: "speaker" },
  { path: `/portal/submissions/${MOBILE_SESSION_ID}/edit`, role: "speaker" },
  { path: "/portal/profile", role: "speaker" },
  { path: "/portal/tasks", role: "speaker" },
  { path: `/portal/tasks/${MOBILE_TASK_ASSIGNMENT_ID}/form`, role: "speaker" },
  { path: "/account/password", role: "speaker" },
  { path: "/docs/api", role: "public" },
  { path: "/dev/mailbox", role: "public" },
] as const;

/** Selector list for "primary nav/filter/submit controls" (DEC-253): surface
 * nav, search/track-filter forms, submit/save-draft buttons, and the portal
 * sign-out/nav controls. Deliberately excludes secondary inline links (e.g.
 * per-card "View"/"Show more") — those aren't the primary navigation the
 * mobile bar is graded on. */
const MOBILE_CONTROL_SELECTOR = [
  "nav a",
  "form[role='search'] input",
  "form[role='search'] button",
  "form button[type='submit']",
  "form input[type='submit']",
  "header form button",
].join(", ");

// DEC-387: admin mobile pass (390x844, advisory) — the organizer + reviewer
// entries of ROUTE_MANIFEST, with the "/admin/*" catch-all excluded (it's
// not a real page, just App.tsx's fallback route). This is the instrument
// that makes DEC-385's phone-frame redesign checkable; it lands advisory
// (see ADMIN_MOBILE_PASS_BLOCKING in render-sweep-lib.ts) because these
// routes have never been measured at 390px before.
export const ADMIN_MOBILE_ROUTE_MANIFEST: readonly MobileRouteEntry[] = ROUTE_MANIFEST.filter(
  (entry) => (entry.role === "organizer" || entry.role === "reviewer") && entry.path !== "/admin/*",
).map((entry) => ({ path: entry.path, role: entry.role }));

/** DEC-387 control selector: the redesign's phone-bar/primary-control
 * vocabulary (tabbar links/buttons, .chq-btn, .chq-input, .chq-select,
 * header nav links), visible only — same `offsetParent !== null` filter as
 * the public mobile pass. */
const ADMIN_MOBILE_CONTROL_SELECTOR = [
  ".chq-tabbar a",
  ".chq-tabbar button",
  ".chq-btn",
  ".chq-input",
  ".chq-select",
  "header nav a",
].join(", ");

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

interface Persona {
  email: string;
  password: string;
}

interface FixtureData {
  identities: {
    organizer: Persona;
    speaker: Persona;
    reviewer: Persona;
  };
}

/** Finds an unused TCP port by asking the OS to bind an ephemeral one. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const address = srv.address();
      if (address === null || typeof address === "string") {
        reject(new Error("findFreePort: could not determine bound port"));
        return;
      }
      const { port } = address;
      srv.close(() => resolve(port));
    });
  });
}

function runOrThrow(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`render-sweep: command failed (exit ${result.status}): ${cmd} ${args.join(" ")}`);
  }
}

async function waitForHealth(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // server not accepting connections yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`render-sweep: ${baseUrl}/health did not become ready within ${timeoutMs}ms`);
}

function personaForRole(role: RouteManifestEntry["role"], identities: FixtureData["identities"]): Persona | null {
  switch (role) {
    case "organizer":
      return identities.organizer;
    case "reviewer":
      return identities.reviewer;
    case "speaker":
      return identities.speaker;
    case "public":
      return null;
  }
}

/** Logs in via the real HTML /login form (not the JSON API) so the render-sweep exercises the same path a real browser session takes. */
async function loginContext(
  browser: Browser,
  baseUrl: string,
  persona: Persona,
  options?: { viewport?: { width: number; height: number } },
): Promise<BrowserContext> {
  const context = await browser.newContext(options?.viewport ? { viewport: options.viewport } : {});
  const page = await context.newPage();
  const getRes = await page.goto(`${baseUrl}/login`);
  if (!getRes || getRes.status() !== 200) {
    throw new Error(`render-sweep login: GET /login expected 200, got ${getRes?.status()}`);
  }
  await page.fill('input[name="email"]', persona.email);
  await page.fill('input[name="password"]', persona.password);
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(`render-sweep login: still on /login after submit for ${persona.email} (bad credentials or CSRF failure)`);
  }
  await page.close();
  return context;
}

// DEC-421: walks every rendered element, keeping only those with a non-empty
// direct text node and a non-zero rendered box, and returns the smallest
// getComputedStyle(el).fontSize plus up to 3 structural (never text-content)
// descriptors for elements under MIN_FONT_PX, smallest first. Runs inside
// the browser page context — must only be called on a page that already had
// PAGE_EVALUATE_KEEPNAMES_SHIM applied via addInitScript (DEC-411).
const FONT_FLOOR_MIN_PX = 10;

async function measureFontFloor(page: Page): Promise<{ minPx: number | null; offenders: string[] }> {
  return page.evaluate((minFontPx: number) => {
    const hasNonEmptyDirectText = (el: Element): boolean => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0) return true;
      }
      return false;
    };
    const describe = (el: Element, px: number): string => {
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).slice(0, 3);
      const base = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
      return `${base} ${px}px`;
    };

    const elements = Array.from(document.querySelectorAll("*"));
    let minPx: number | null = null;
    const under: { el: Element; px: number }[] = [];
    for (const el of elements) {
      if (!hasNonEmptyDirectText(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isNaN(px)) continue;
      if (minPx === null || px < minPx) minPx = px;
      if (px < minFontPx) under.push({ el, px });
    }
    under.sort((a, b) => a.px - b.px);
    const offenders = under.slice(0, 3).map(({ el, px }) => describe(el, Math.round(px)));
    return { minPx, offenders };
  }, FONT_FLOOR_MIN_PX);
}

// DEC-426: walks every rendered element, keeping only those with a non-empty
// direct text node and a non-zero rendered box, and returns the lowest
// observed foreground/background contrast ratio (against the applicable
// WCAG AA threshold — CONTRAST_MIN_RATIO_LARGE for >=24px text, or >=18.66px
// at font-weight >= 700, else CONTRAST_MIN_RATIO) plus up to 3 structural
// (never text-content, DEC-401) offender descriptors. Kept INLINE in the
// page.evaluate callback rather than a helper serialised across the
// boundary (DEC-411) — must only be called on a page that already had
// PAGE_EVALUATE_KEEPNAMES_SHIM applied via addInitScript.
async function measureContrast(page: Page): Promise<{ minRatio: number | null; offenders: string[] }> {
  return page.evaluate(
    ({ minRatioNormal, minRatioLarge }: { minRatioNormal: number; minRatioLarge: number }) => {
      const hasNonEmptyDirectText = (el: Element): boolean => {
        for (const node of Array.from(el.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0) return true;
        }
        return false;
      };

      const parseColor = (value: string): { rgb: [number, number, number]; alpha: number } | null => {
        const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
        if (!m) return null;
        return {
          rgb: [parseFloat(m[1]!), parseFloat(m[2]!), parseFloat(m[3]!)],
          alpha: m[4] !== undefined ? parseFloat(m[4]) : 1,
        };
      };

      const luminance = (rgb: [number, number, number]): number => {
        const channel = (c: number): number => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
      };
      const ratio = (fg: [number, number, number], bg: [number, number, number]): number => {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const backgroundFor = (el: Element): [number, number, number] => {
        let node: Element | null = el;
        while (node) {
          const parsed = parseColor(getComputedStyle(node).backgroundColor);
          if (parsed && parsed.alpha > 0) return parsed.rgb;
          node = node.parentElement;
        }
        return [255, 255, 255]; // default: white
      };

      const describe = (el: Element, r: number, fg: [number, number, number], bg: [number, number, number]): string => {
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 3);
        const base = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
        return `${base} ratio=${r.toFixed(2)} fg=rgb(${fg.map((c) => Math.round(c)).join(",")}) bg=rgb(${bg
          .map((c) => Math.round(c))
          .join(",")})`;
      };

      const elements = Array.from(document.querySelectorAll("*"));
      let minRatio: number | null = null;
      const under: { el: Element; ratio: number; fg: [number, number, number]; bg: [number, number, number] }[] = [];
      for (const el of elements) {
        if (!hasNonEmptyDirectText(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const style = getComputedStyle(el);
        const fgParsed = parseColor(style.color);
        if (!fgParsed) continue;
        const fg = fgParsed.rgb;
        const bg = backgroundFor(el);
        const r = ratio(fg, bg);
        if (minRatio === null || r < minRatio) minRatio = r;

        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const threshold = isLarge ? minRatioLarge : minRatioNormal;
        if (r < threshold) under.push({ el, ratio: r, fg, bg });
      }
      under.sort((a, b) => a.ratio - b.ratio);
      const offenders = under.slice(0, 3).map(({ el, ratio: r, fg, bg }) => describe(el, r, fg, bg));
      return { minRatio, offenders };
    },
    { minRatioNormal: CONTRAST_MIN_RATIO, minRatioLarge: CONTRAST_MIN_RATIO_LARGE },
  );
}

async function visitRoute(
  context: BrowserContext,
  baseUrl: string,
  entry: RouteManifestEntry,
  fontFloorResults?: FontFloorResult[],
  contrastResults?: ContrastResult[],
): Promise<RouteResult> {
  const page = await context.newPage();
  // DEC-411: must run before any in-page evaluation on this page.
  await page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err: Error) => {
    pageErrors.push(err.message);
  });

  let status = 0;
  try {
    const res = await page.goto(`${baseUrl}${entry.path}`, { waitUntil: "networkidle" });
    status = res ? res.status() : 0;
  } catch (err) {
    pageErrors.push(err instanceof Error ? err.message : String(err));
  }

  let bodyText = "";
  const isAdminSpaRoute = entry.path.startsWith("/admin");
  try {
    if (isAdminSpaRoute) {
      await page.waitForSelector("#root", { timeout: 5000 });
      bodyText = (await page.locator("#root").innerText()).trim();
    } else {
      bodyText = (await page.locator("body").innerText()).trim();
    }
  } catch {
    bodyText = "";
  }

  // DEC-421: advisory type-floor measurement, same page/session — never lets
  // an instrument failure (e.g. a missed keepNames shim) fail the desktop
  // render-sweep pass above.
  if (fontFloorResults) {
    try {
      const { minPx, offenders } = await measureFontFloor(page);
      fontFloorResults.push(evaluateFontFloor(entry, "desktop", { minFontPx: minPx, offenders }));
    } catch (err) {
      fontFloorResults.push(fontFloorErrorResult(entry, "desktop", err instanceof Error ? err.message : String(err)));
    }
  }

  // DEC-426: advisory WCAG AA contrast measurement, same page/session — never
  // lets an instrument failure fail the desktop render-sweep pass above.
  if (contrastResults) {
    try {
      const { minRatio, offenders } = await measureContrast(page);
      contrastResults.push(evaluateContrast(entry, { minRatio, offenders }));
    } catch (err) {
      contrastResults.push(contrastErrorResult(entry, err instanceof Error ? err.message : String(err)));
    }
  }

  await page.close();
  return evaluateRoute(entry, { status, bodyText, consoleErrors, pageErrors });
}

const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** DEC-253: visits one mobile-manifest route in a 390x844 context and
 * measures page-level horizontal overflow + the shortest primary control. */
async function visitMobileRoute(
  context: BrowserContext,
  baseUrl: string,
  entry: MobileRouteEntry,
  controlSelector: string = MOBILE_CONTROL_SELECTOR,
  fontFloorResults?: FontFloorResult[],
): Promise<MobileRouteResult> {
  const page = await context.newPage();
  // DEC-411: must run before the in-page evaluation below.
  await page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });
  let status = 0;
  try {
    const res = await page.goto(`${baseUrl}${entry.path}`, { waitUntil: "networkidle" });
    status = res ? res.status() : 0;
  } catch {
    status = 0;
  }

  const measured = await page.evaluate((selector: string) => {
    // DEC-401: structural-only descriptor — tag + up to 3 classes, never
    // text content (gate logs must not carry seed or user data).
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).slice(0, 3);
      return classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
    };

    // DEC-424: an element deliberately held inside a horizontal scroller
    // (DEC-414's remedy) is not an overflow bug — walk up to (but not
    // including) <body>/<html> and exclude elements whose overflow is
    // contained by an ancestor with overflow-x: auto|scroll.
    const inHorizontalScroller = (el: Element): boolean => {
      let p = el.parentElement;
      while (p && p !== document.body && p !== document.documentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };

    const scrollWidth = document.scrollingElement ? document.scrollingElement.scrollWidth : document.body.scrollWidth;
    const viewportWidth = window.innerWidth;

    const allElements = Array.from(document.body.querySelectorAll("*")) as HTMLElement[];
    const visibleElements = allElements.filter((el) => el.offsetParent !== null); // visible only (not display:none)

    let maxElementRight = 0;
    const overflowing: { el: HTMLElement; right: number }[] = [];
    for (const el of visibleElements) {
      if (inHorizontalScroller(el)) continue; // DEC-424
      const rect = el.getBoundingClientRect();
      if (rect.right > maxElementRight) maxElementRight = rect.right;
      if (rect.right > viewportWidth + 1) overflowing.push({ el, right: rect.right });
    }
    overflowing.sort((a, b) => b.right - a.right);
    let overflowOffenders = overflowing
      .slice(0, 3)
      .map(({ el, right }) => `${describe(el)} w=${Math.round(el.getBoundingClientRect().width)}px right=${Math.round(right)}px`);

    // DEC-424: content-spill attribution — when the page scrollWidth itself
    // overflows but no single element's rect.right exceeded the viewport
    // (e.g. a wide inline run bleeding past its ancestors), name the
    // spilling element(s) directly rather than reporting an empty offender
    // list.
    if (overflowOffenders.length === 0 && scrollWidth > viewportWidth + 1) {
      const spilling: { el: HTMLElement; spill: number; sw: number; cw: number }[] = [];
      for (const el of visibleElements) {
        if (inHorizontalScroller(el)) continue;
        const sw = el.scrollWidth;
        const cw = el.clientWidth;
        if (sw > cw + 1) spilling.push({ el, spill: sw - cw, sw, cw });
      }
      spilling.sort((a, b) => b.spill - a.spill);
      overflowOffenders = spilling
        .slice(0, 3)
        .map(({ el, spill, sw, cw }) => `${describe(el)} spill=${Math.round(spill)}px (scrollWidth ${Math.round(sw)} > clientWidth ${Math.round(cw)})`);
    }

    const controls = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    let minControlHeight: number | null = null;
    let minControlSelector: string | null = null;
    for (const el of controls) {
      if (el.offsetParent === null) continue; // visible only (not display:none)
      const height = el.getBoundingClientRect().height;
      if (minControlHeight === null || height < minControlHeight) {
        minControlHeight = height;
        minControlSelector = describe(el);
      }
    }

    return { scrollWidth, viewportWidth, minControlHeight, maxElementRight, overflowOffenders, minControlSelector };
  }, controlSelector);

  // DEC-421: advisory type-floor measurement at this route's viewport.
  if (fontFloorResults) {
    try {
      const { minPx, offenders } = await measureFontFloor(page);
      fontFloorResults.push(evaluateFontFloor(entry, "mobile", { minFontPx: minPx, offenders }));
    } catch (err) {
      fontFloorResults.push(fontFloorErrorResult(entry, "mobile", err instanceof Error ? err.message : String(err)));
    }
  }

  await page.close();
  return evaluateMobileRoute(entry, { status, ...measured });
}

async function main(): Promise<void> {
  ensureDevVars(REPO_ROOT); // DEC-187
  const port = await findFreePort();
  const baseUrl = `http://localhost:${port}`;

  console.log("render-sweep: building admin SPA bundle...");
  // DEC-268: a fresh worktree has no gitignored app/dist bundle unless something
  // built it first; wrangler dev serves static assets from that dir, so build it
  // here rather than relying on a prior `npm run build` having been run.
  runOrThrow("npx", ["vite", "build", "--config", "app/vite.config.ts"]);

  console.log("render-sweep: applying migrations + seed data...");
  runOrThrow("npx", ["wrangler", "d1", "migrations", "apply", "chautauqua", "--local"]);
  runOrThrow("npx", ["tsx", "scripts/seed.ts"]);
  runOrThrow("npx", ["wrangler", "d1", "execute", "chautauqua", "--local", "--file=.seed.sql"]);
  runOrThrow("npx", ["tsx", "scripts/seed-r2.ts"]);

  console.log(`render-sweep: starting wrangler dev on port ${port}...`);
  const server: ChildProcess = spawn("npx", ["wrangler", "dev", "--port", String(port)], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()));

  let browser: Browser | undefined;
  let failed = false;
  try {
    await waitForHealth(baseUrl);
    console.log("render-sweep: wrangler dev is up");

    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as FixtureData;

    browser = await chromium.launch();
    const contextByRole = new Map<RouteManifestEntry["role"], BrowserContext>();
    const loginErrorByRole = new Map<RouteManifestEntry["role"], string>();
    contextByRole.set("public", await browser.newContext());
    for (const role of ["organizer", "reviewer", "speaker"] as const) {
      const persona = personaForRole(role, fixture.identities);
      if (!persona) continue;
      console.log(`render-sweep: logging in as ${role} (${persona.email})...`);
      // DEC-389: a login failure (e.g. the dev server died mid-run) marks
      // every manifest entry for this role FAIL below instead of aborting
      // the whole gate uncaught.
      try {
        contextByRole.set(role, await loginContext(browser, baseUrl, persona));
      } catch (err) {
        loginErrorByRole.set(role, err instanceof Error ? err.message : String(err));
      }
    }

    // DEC-421: collects font-floor readings from every visitRoute/
    // visitMobileRoute call below into one flat list for the advisory
    // type-floor table printed after the three existing passes.
    const fontFloorResults: FontFloorResult[] = [];

    // DEC-426: collects contrast readings from every visitRoute call below
    // (desktop pass only) into one flat list for the advisory contrast table
    // printed after the type-floor pass.
    const contrastResults: ContrastResult[] = [];

    const results: RouteResult[] = [];
    for (const entry of ROUTE_MANIFEST) {
      const context = contextByRole.get(entry.role);
      if (!context) {
        const loginError = loginErrorByRole.get(entry.role);
        results.push(
          routeErrorResult(
            entry,
            loginError !== undefined
              ? `login failed for role '${entry.role}': ${loginError}`
              : `no browser context for role '${entry.role}'`,
          ),
        );
        continue;
      }
      try {
        results.push(await visitRoute(context, baseUrl, entry, fontFloorResults, contrastResults));
      } catch (err) {
        results.push(routeErrorResult(entry, err instanceof Error ? err.message : String(err)));
      }
    }

    console.log("");
    console.log(formatResultsTable(results));
    console.log("");
    console.log(formatSummary(results));

    if (!allPassed(results)) {
      failed = true;
    }

    // DEC-253: second pass at a 390x844 mobile viewport over the no-login/
    // portal surfaces. Separate contexts (viewport is fixed per-context in
    // Playwright) — the speaker persona logs in again inside its own mobile
    // context so /portal is exercised through the real cookie session.
    console.log("");
    console.log("render-sweep: mobile pass (390x844)...");
    const mobileContextByRole = new Map<MobileRouteEntry["role"], BrowserContext>();
    let speakerLoginError: string | undefined;
    mobileContextByRole.set("public", await browser.newContext({ viewport: MOBILE_VIEWPORT }));
    const speakerPersona = personaForRole("speaker", fixture.identities);
    if (!speakerPersona) throw new Error("render-sweep: fixture is missing the speaker identity");
    try {
      mobileContextByRole.set(
        "speaker",
        await loginContext(browser, baseUrl, speakerPersona, { viewport: MOBILE_VIEWPORT }),
      );
    } catch (err) {
      speakerLoginError = err instanceof Error ? err.message : String(err);
    }

    const mobileResults: MobileRouteResult[] = [];
    for (const entry of MOBILE_ROUTE_MANIFEST) {
      const context = mobileContextByRole.get(entry.role);
      if (!context) {
        mobileResults.push(
          mobileErrorResult(
            entry,
            speakerLoginError !== undefined
              ? `login failed for role '${entry.role}': ${speakerLoginError}`
              : `no mobile browser context for role '${entry.role}'`,
          ),
        );
        continue;
      }
      try {
        mobileResults.push(await visitMobileRoute(context, baseUrl, entry, MOBILE_CONTROL_SELECTOR, fontFloorResults));
      } catch (err) {
        mobileResults.push(mobileErrorResult(entry, err instanceof Error ? err.message : String(err)));
      }
    }
    for (const ctx of mobileContextByRole.values()) await ctx.close();

    console.log("");
    console.log(formatMobileResultsTable(mobileResults));
    console.log("");
    console.log(formatMobileSummary(mobileResults));

    if (!allMobilePassed(mobileResults)) {
      failed = true;
    }

    // DEC-387: admin mobile pass (390x844, advisory). Organizer + reviewer
    // contexts logged in fresh (viewport is fixed per-context) and visited
    // at the same 390x844 viewport as the public mobile pass, evaluated with
    // the same evaluateMobileRoute but the redesign's own control selector
    // (ADMIN_MOBILE_CONTROL_SELECTOR). Failures only flip the exit code when
    // ADMIN_MOBILE_PASS_BLOCKING is true (false on landing; see its comment
    // in render-sweep-lib.ts for the flip rule).
    console.log("");
    console.log("render-sweep: admin mobile pass (390x844, advisory)...");
    const adminMobileContextByRole = new Map<"organizer" | "reviewer", BrowserContext>();
    const adminLoginErrorByRole = new Map<"organizer" | "reviewer", string>();
    for (const role of ["organizer", "reviewer"] as const) {
      const persona = personaForRole(role, fixture.identities);
      if (!persona) throw new Error(`render-sweep: fixture is missing the ${role} identity`);
      try {
        adminMobileContextByRole.set(
          role,
          await loginContext(browser, baseUrl, persona, { viewport: MOBILE_VIEWPORT }),
        );
      } catch (err) {
        adminLoginErrorByRole.set(role, err instanceof Error ? err.message : String(err));
      }
    }

    const adminMobileResults: MobileRouteResult[] = [];
    for (const entry of ADMIN_MOBILE_ROUTE_MANIFEST) {
      const role = entry.role as "organizer" | "reviewer";
      const context = adminMobileContextByRole.get(role);
      if (!context) {
        const loginError = adminLoginErrorByRole.get(role);
        adminMobileResults.push(
          mobileErrorResult(
            entry,
            loginError !== undefined
              ? `login failed for role '${entry.role}': ${loginError}`
              : `no admin mobile browser context for role '${entry.role}'`,
          ),
        );
        continue;
      }
      try {
        adminMobileResults.push(
          await visitMobileRoute(context, baseUrl, entry, ADMIN_MOBILE_CONTROL_SELECTOR, fontFloorResults),
        );
      } catch (err) {
        adminMobileResults.push(mobileErrorResult(entry, err instanceof Error ? err.message : String(err)));
      }
    }
    for (const ctx of adminMobileContextByRole.values()) await ctx.close();

    console.log("");
    console.log(formatMobileResultsTable(adminMobileResults));
    console.log("");
    console.log(formatMobileSummary(adminMobileResults));

    if (!allMobilePassed(adminMobileResults) && ADMIN_MOBILE_PASS_BLOCKING) {
      failed = true;
    }

    // DEC-421: type-floor pass (advisory) — one reading per route+viewport
    // already visited above (desktop ROUTE_MANIFEST + mobile/admin-mobile
    // MOBILE_ROUTE_MANIFEST/ADMIN_MOBILE_ROUTE_MANIFEST passes), no separate
    // route list or extra page visits. Failures never flip the exit code
    // while FONT_FLOOR_BLOCKING is false (see its flip-rule comment in
    // render-sweep-lib.ts).
    console.log("");
    console.log("render-sweep: type-floor pass (10px minimum, advisory)...");
    console.log("");
    console.log(formatFontFloorTable(fontFloorResults));
    console.log("");
    console.log(formatFontFloorSummary(fontFloorResults));

    if (!allFontFloorPassed(fontFloorResults) && FONT_FLOOR_BLOCKING) {
      failed = true;
    }

    // DEC-426: WCAG AA contrast pass (advisory) — desktop ROUTE_MANIFEST
    // visits only, one reading per route from the same visitRoute pass
    // above (no separate route list or extra page visits). Failures never
    // flip the exit code while CONTRAST_BLOCKING is false (see its flip-rule
    // comment in scripts/render-sweep-contrast.ts).
    console.log("");
    console.log("render-sweep: contrast pass (WCAG AA, advisory)...");
    console.log("");
    console.log(formatContrastTable(contrastResults));
    console.log("");
    console.log(formatContrastSummary(contrastResults));

    if (!allContrastPassed(contrastResults) && CONTRAST_BLOCKING) {
      failed = true;
    }

    if (!failed) {
      console.log("gate:render-sweep OK");
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
    if (failed) {
      console.error("--- wrangler dev log (tail) ---");
      console.error(serverLog.split("\n").slice(-100).join("\n"));
    }
  }

  if (failed) process.exitCode = 1;
}

// Only run when executed directly (`tsx scripts/render-sweep.ts` /
// `npm run gate:render-sweep`), not when imported — test/render-sweep-lib.test.ts
// imports ADMIN_MOBILE_ROUTE_MANIFEST from this module for unit testing and
// must not trigger a full wrangler-dev boot as a side effect of that import.
const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
