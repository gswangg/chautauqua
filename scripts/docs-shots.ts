// Docs screenshot shoot (v12 intake section B; DEC-644 amendment;
// docs/design/DESIGN-RULINGS.md:308-316 "Screenshot rules"). An OPERATOR
// command, run at freeze time against an already-running, already-migrated,
// already-seeded `npm run dev` -- never in CI, never as part of `npm test`.
//
// Reuses scripts/render-sweep.ts's idioms verbatim rather than inventing a
// second harness vocabulary: Playwright chromium, the real /login HTML
// form for auth (never the JSON API), fixture credentials from
// docs/fixtures/sample-data.json, and scripts/walkthrough-lib.ts's
// parseUrlArg for the --url flag (same flag/default convention as the rest
// of scripts/ -- see scripts/walkthrough.ts).
//
// For each scripts/docs-shots-lib.ts DOCS_SHOTS row: resolves which persona
// (if any) the route needs by cross-referencing app/src/routeManifest.ts
// (the real route/role table render-sweep also drives off), logs in once
// per role, navigates at the declared 1600-wide viewport, runs the row's
// declarative `prep` steps (if any) so the page is in the STATE its caption
// names, and writes a PNG to public/docs/shots/<id>.png.
//
// CAPTURE (docs/design/DEVIATIONS.md, 2026-08-16 -- a user override of
// DESIGN-RULINGS.md:308-316 rule 3's "exactly 1600x900 frames"): the admin
// shell scrolls inside `.chq-main`, not on <body>, so the old
// `fullPage: false` clip cut long screens off mid-row. A shot is now taken
// at 1600 wide and TALL ENOUGH TO SHOW THE WHOLE SCREEN (growViewportToFit
// below), unless its row declares `capture: "frame"` -- the exception for
// position:fixed overlays (modal cards, .chq-toast), which a tall frame
// strands rather than shows.
//
// FOCUS (docs/design/DEVIATIONS.md, 2026-08-17 -- a second user override,
// this time of rule 5's "no drawn annotation"): a row may declare `clip` (a
// full-width vertical BAND around one element, so a figure about a 3px break
// strip is not a 1251px page) and/or `highlight` (a var(--chq-brand) outline
// + soft glow on the caption's subject, optionally dimming the rest). Both
// live entirely in this script -- injected with page.addStyleTag at shutter
// time, never in app code -- and both are layout-neutral, so the shot is the
// pixels the app really renders with an edge drawn on them. No arrows, no
// callouts, no text: only the subject's own edge.
//
// FAIL LOUDLY: a route that doesn't resolve to exactly one role in
// ROUTE_MANIFEST, a navigation that doesn't land on 200, a missing seeded
// DevFlow Conf 2027 event, or a shot id repeated within one run all ABORT
// the whole run with a named Error -- never a placeholder image, never
// catch-and-continue. No cropping, no drawn annotation, no image
// post-processing (rules 3 and 5).
//
// Serialized through scripts/with-test-lock.sh like the other heavy gates
// (`npm run shots:docs`).
//
// Scripts/ tooling (not src/ pure-core, DEC-002), so node:/playwright
// imports are fine here.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { parseUrlArg } from "./walkthrough-lib";
import {
  DOCS_SHOT_VIEWPORT,
  DOCS_SHOTS,
  DOCS_SHOTS_EVENT_SLUG,
  resolveRoleForRoute,
  type DocsShotClip,
  type DocsShotEntry,
  type DocsShotHighlight,
  type DocsShotStep,
} from "./docs-shots-lib";
import { ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";
// Pure data registry (JSX-free, DEC-518) -- importing it here adds no
// node:/playwright dependency to scripts/docs-shots-lib.ts, which stays
// dependency-free for its own vitest coverage. DOCS_SHOTS dropped its own
// `caption` field (the article's figure block is the one copy); this
// script reads the caption from the owning figure block for logging/alt
// text instead of restating it.
import { DOCS_ARTICLES } from "../src/routes/docs-content";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");
const SHOTS_DIR = join(REPO_ROOT, "public", "docs", "shots");
const SHOTS_AVAILABLE_PATH = join(REPO_ROOT, "src", "routes", "docs-content", "shots-available.ts");

/** Writes src/routes/docs-content/shots-available.ts with the sorted list
 * of ids actually captured this run -- the ONLY writer of that file (its
 * own header repeats this: never hand-extend it). Called after every id in
 * `ids` has a real PNG on disk in SHOTS_DIR. */
function writeShotsAvailable(ids: readonly string[]): void {
  const sorted = [...ids].sort();
  const body = `// WRITTEN BY scripts/docs-shots.ts after a successful shoot (DEC-518
// amendment, wave 4). This file must NEVER be hand-extended: the only
// legal edits are (a) the script overwriting it with the sorted list of
// shot ids it actually captured against a real, seeded \`npm run dev\`, or
// (b) emptying it back to \`[]\`, which is always legal (it just returns
// every docs figure to its named placeholder -- see
// src/routes/docs-site.tsx's figure block renderer). A hand-added id here
// with no PNG on disk would silently 404 an <img> the reader can't get
// back from; that's why this is generated, not maintained.

export const DOCS_SHOTS_AVAILABLE: readonly string[] = ${JSON.stringify(sorted)};
`;
  writeFileSync(SHOTS_AVAILABLE_PATH, body);
}

type PersonaRole = RouteManifestEntry["role"];

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

function personaForRole(role: PersonaRole, identities: FixtureData["identities"]): Persona | null {
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

/** Logs in via the real HTML /login form (not the JSON API), same idiom as
 * scripts/render-sweep.ts's loginContext -- so the shoot exercises the same
 * session a real browser would carry into a screenshot. */
async function loginContext(browser: Browser, baseUrl: string, persona: Persona): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: DOCS_SHOT_VIEWPORT });
  const page = await context.newPage();
  const getRes = await page.goto(`${baseUrl}/login`);
  if (!getRes || getRes.status() !== 200) {
    throw new Error(`docs-shots login: GET /login expected 200, got ${getRes?.status()}`);
  }
  await page.fill('input[name="email"]', persona.email);
  await page.fill('input[name="password"]', persona.password);
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(`docs-shots login: still on /login after submit for ${persona.email} (bad credentials or CSRF failure)`);
  }
  await page.close();
  return context;
}

async function assertServerReachable(baseUrl: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/health`);
  } catch (err) {
    throw new Error(
      `docs-shots: could not reach ${baseUrl} (${err instanceof Error ? err.message : String(err)}) -- ` +
        `is a migrated + seeded \`npm run dev\` running? (see README "Dev: docs screenshot shoot")`,
    );
  }
  if (!res.ok) {
    throw new Error(`docs-shots: ${baseUrl}/health returned ${res.status}, expected 2xx`);
  }
}

/** Fail-loud DevFlow Conf 2027 presence check (rule 2: "Seeded data only" --
 * every shot must resolve against the same deterministic seed). Probes the
 * event's own public hub page rather than an API route, since that's the
 * page every DOCS_SHOTS row ultimately depends on being real. */
async function assertSeededEventPresent(baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/e/${DOCS_SHOTS_EVENT_SLUG}/sessions`);
  if (res.status !== 200) {
    throw new Error(
      `docs-shots: seeded event "${DOCS_SHOTS_EVENT_SLUG}" not found (GET /e/${DOCS_SHOTS_EVENT_SLUG}/sessions ` +
        `returned ${res.status}) -- run \`npm run seed\` against the target server first`,
    );
  }
}

/** Looks up a shot's caption from the article registry it belongs to --
 * FAILS LOUDLY (never a blank/placeholder alt text) if no figure block
 * anywhere in DOCS_ARTICLES declares this shotId, since
 * test/docs-shots-manifest.test.ts is supposed to make that impossible by
 * asserting DOCS_SHOTS and DOCS_ARTICLES's figure shotIds are the same set
 * in both directions. */
function captionForShot(shotId: string): string {
  for (const article of DOCS_ARTICLES) {
    for (const block of article.blocks) {
      if (block.kind === "figure" && block.shotId === shotId) return block.caption;
    }
  }
  throw new Error(`docs-shots: no figure block in DOCS_ARTICLES declares shotId "${shotId}" (docs-shots-lib.ts and the article registry have drifted)`);
}

/** How long a step is given to land before it counts as failed. Same order
 * as playwright's own default; stated here so a prep flow's failure is a
 * named docs-shots error and not an anonymous timeout. */
const STEP_TIMEOUT_MS = 15_000;

/** Settle pause after each action, for the SPA's own re-render + fetch. */
const STEP_SETTLE_MS = 450;

/** A tall shot never grows past this -- a figure taller than this is a
 * signal that a page needs pagination, not a taller camera. */
const MAX_SHOT_HEIGHT = 6000;

/** Runs one declarative prep step. FAILS LOUDLY with the shot id in the
 * message: a prep step that can't run means the figure would have shown the
 * wrong state, which is worse than no figure at all. */
async function runStep(page: Page, entry: DocsShotEntry, index: number, step: DocsShotStep): Promise<void> {
  const where = `docs-shots: shot "${entry.id}" prep step ${index + 1} (${step.kind})`;
  try {
    switch (step.kind) {
      case "click":
        await page.click(step.selector, { timeout: STEP_TIMEOUT_MS });
        break;
      case "clickRole":
        await page
          .getByRole(step.role, { name: step.name })
          .first()
          .click({ timeout: STEP_TIMEOUT_MS });
        break;
      case "fill":
        await page.fill(step.selector, step.value, { timeout: STEP_TIMEOUT_MS });
        break;
      case "select":
        await page.selectOption(step.selector, { label: step.label }, { timeout: STEP_TIMEOUT_MS });
        break;
      case "upload":
        await page.setInputFiles(
          step.selector,
          { name: step.fileName, mimeType: "text/csv", buffer: Buffer.from(step.content, "utf8") },
          { timeout: STEP_TIMEOUT_MS },
        );
        break;
      case "waitFor":
        await page.waitForSelector(step.selector, { timeout: STEP_TIMEOUT_MS });
        break;
    }
  } catch (err) {
    throw new Error(`${where} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  await page.waitForTimeout(STEP_SETTLE_MS);
}

/**
 * Grows the viewport until nothing on the page is still scrolled out of
 * sight, so a `"fullPage"` capture really is the whole screen.
 *
 * `fullPage: true` alone is NOT enough here: the admin shell pins <body> to
 * the viewport and scrolls inside `.chq-main` (app/src/styles.css), so the
 * page's own scrollHeight is always exactly 900 and playwright happily
 * captures the same clipped frame. Growing the viewport by the tallest
 * overflow found (repeatedly -- revealing rows can reveal more rows) is what
 * actually un-clips it.
 */
async function growViewportToFit(page: Page): Promise<void> {
  for (let pass = 0; pass < 5; pass++) {
    const overflow = await page.evaluate(() => {
      let extra = 0;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const overflowY = getComputedStyle(el).overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          extra = Math.max(extra, el.scrollHeight - el.clientHeight);
        }
      }
      const doc = document.documentElement;
      return Math.max(extra, doc.scrollHeight - doc.clientHeight);
    });
    if (overflow < 2) return;
    const current = page.viewportSize() ?? DOCS_SHOT_VIEWPORT;
    const grown = Math.min(MAX_SHOT_HEIGHT, current.height + Math.ceil(overflow));
    if (grown <= current.height) return;
    await page.setViewportSize({ width: DOCS_SHOT_VIEWPORT.width, height: grown });
    await page.waitForTimeout(STEP_SETTLE_MS);
  }
}

/** The colour the focus outline is drawn in -- app/src/styles.css's
 * `--chq-brand`. Named as a fallback beside the custom property because the
 * public surfaces (`/e/...`) define their own theme block, and a shot whose
 * outline silently resolved to `currentColor` would be no highlight at all. */
const FOCUS_BRAND = "#4e5c31";

/** Opacity everything that is NOT the subject drops to under `dim: true`.
 * Low enough that the lit element is unmistakably the subject, high enough
 * that the screen behind it is still legible as the screen it is -- a figure
 * whose context has been erased is a crop with extra steps. */
const DIM_OPACITY = 0.34;

/** Attribute scripts/docs-shots.ts stamps on a highlight's resolved elements
 * so the injected CSS can be a single flat rule. Resolution goes through
 * playwright LOCATORS, not `document.querySelectorAll`, so a row may use
 * playwright's own engines (`:has-text("Afternoon break")`) to name ONE of
 * several same-class elements -- which is exactly the agenda case: three
 * `.chq-agenda-break-band`s on the day, and the figure is about one. */
const FOCUS_ATTR = "data-chq-docs-focus";

/**
 * Injects the focus treatment for a row's `highlight` (DEVIATIONS.md 4a,
 * USER RULING 2026-08-17): a `var(--chq-brand)` outline plus a soft glow on
 * the named element(s), and -- when `dim` is set -- a fade on everything
 * else.
 *
 * LAYOUT MUST NOT MOVE. `outline` and `box-shadow` both paint outside the
 * border box and are ignored by layout, and the dim is plain `opacity` on
 * elements that keep their own position -- nothing here sets `position`,
 * `z-index`, `margin` or `padding`, so the shot is the same pixels the app
 * really renders, with an edge drawn on them.
 *
 * FAILS LOUDLY when a selector matches nothing: a highlight that quietly
 * matched zero elements would ship exactly the indistinguishable figure this
 * whole mechanism exists to fix.
 */
async function applyHighlight(page: Page, entry: DocsShotEntry, highlight: DocsShotHighlight): Promise<void> {
  for (const selector of highlight.selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        `docs-shots: shot "${entry.id}" highlight selector "${selector}" matched no element after prep ` +
          `-- the figure would have shipped with no focus at all`,
      );
    }
    for (let i = 0; i < count; i++) {
      await locator.nth(i).evaluate((el, attr) => el.setAttribute(attr, ""), FOCUS_ATTR);
    }
  }

  await page.addStyleTag({
    content: `[${FOCUS_ATTR}] {
  outline: 3px solid var(--chq-brand, ${FOCUS_BRAND}) !important;
  outline-offset: 3px !important;
  box-shadow: 0 0 0 7px rgba(78, 92, 49, 0.14), 0 0 30px 12px rgba(78, 92, 49, 0.20) !important;
  border-radius: 3px !important;
}`,
  });

  if (highlight.dim === true) {
    await page.evaluate(
      ({ attr, opacity }) => {
        const targets = Array.from(document.querySelectorAll(`[${attr}]`));
        // Every ancestor of every target, so the spotlight walks down the
        // tree instead of fading the subject's own container out from
        // under it.
        const spine = new Set<Element>();
        for (const target of targets) {
          for (let node: Element | null = target; node !== null; node = node.parentElement) spine.add(node);
        }
        for (const node of spine) {
          // Stop at the subject itself: its own descendants stay lit.
          if (targets.some((target) => target === node || target.contains(node))) continue;
          for (const child of Array.from(node.children)) {
            if (spine.has(child)) continue;
            (child as HTMLElement).style.opacity = String(opacity);
          }
        }
      },
      { attr: FOCUS_ATTR, opacity: DIM_OPACITY },
    );
  }
}

/**
 * Resolves a row's `clip` to a screenshot rect -- a full-WIDTH band around
 * the named element, never a box crop (see DocsShotClip). The 1600 width is
 * kept verbatim so the doc set stays comparable; only the top and bottom
 * move.
 *
 * Coordinates come from `getBoundingClientRect()` plus the document's own
 * scroll offset. The admin shell pins `<body>` to the viewport and scrolls
 * inside `.chq-main`, so the document never scrolls and a viewport-relative
 * rect IS the page-relative rect -- and for a `"fullPage"` row
 * growViewportToFit has already removed the inner scroller's overflow before
 * this runs, so the whole element is laid out inside the frame.
 */
async function clipBandFor(
  page: Page,
  entry: DocsShotEntry,
  clip: DocsShotClip,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const locator = page.locator(clip.selector);
  if ((await locator.count()) === 0) {
    throw new Error(`docs-shots: shot "${entry.id}" clip selector "${clip.selector}" matched no element after prep`);
  }
  // .first() rather than a whole-selector union: a clip is one band around
  // ONE element, and a selector that matched three (three break bands on a
  // day) must name which one it means -- playwright's `:has-text()` is
  // available here precisely so it can.
  const measured = await locator.first().evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      pageHeight: Math.max(document.documentElement.scrollHeight, window.innerHeight),
    };
  });
  const top = Math.max(0, Math.floor(measured.top - clip.padding));
  const bottom = Math.min(measured.pageHeight, Math.ceil(measured.bottom + clip.padding));
  const height = bottom - top;
  if (height < 1) {
    throw new Error(
      `docs-shots: shot "${entry.id}" clip on "${clip.selector}" resolved to a ${height}px band ` +
        `-- the element is not laid out (display:none, or collapsed)`,
    );
  }
  return { x: 0, y: top, width: DOCS_SHOT_VIEWPORT.width, height };
}

async function shootOne(context: BrowserContext, baseUrl: string, entry: DocsShotEntry): Promise<string> {
  const page = await context.newPage();
  await page.setViewportSize(DOCS_SHOT_VIEWPORT);
  let status = 0;
  try {
    const res = await page.goto(`${baseUrl}${entry.route}`, { waitUntil: "networkidle" });
    status = res ? res.status() : 0;
  } catch (err) {
    await page.close();
    throw new Error(`docs-shots: navigation failed for shot "${entry.id}" (${entry.route}): ${err instanceof Error ? err.message : String(err)}`);
  }
  if (status !== 200) {
    await page.close();
    throw new Error(`docs-shots: shot "${entry.id}" route ${entry.route} returned status ${status}, expected 200`);
  }
  const steps = entry.prep ?? [];
  for (let i = 0; i < steps.length; i++) {
    await runStep(page, entry, i, steps[i]!);
  }

  const outPath = join(SHOTS_DIR, `${entry.id}.png`);
  // Still no cropping and still no annotation (rules 3 and 5) -- what
  // changed is only WHERE the frame stops: "fullPage" grows the camera to
  // the whole screen instead of clipping it at 900px, and "frame" keeps the
  // literal 1600x900 viewport for the fixed overlays that need it. See
  // docs/design/DEVIATIONS.md (2026-08-16).
  const fullPage = (entry.capture ?? "fullPage") === "fullPage";
  if (fullPage) await growViewportToFit(page);
  // Focus treatment last, so `dim`'s opacity and the outline are measured
  // and painted against the frame that is actually about to be shot. Both
  // are layout-neutral (see applyHighlight), so growing the viewport first
  // and highlighting second cannot disagree about where anything sits.
  if (entry.highlight) await applyHighlight(page, entry, entry.highlight);
  const clip = entry.clip ? await clipBandFor(page, entry, entry.clip) : undefined;
  await page.screenshot({ path: outPath, fullPage, ...(clip ? { clip } : {}) });
  await page.close();
  return outPath;
}

async function main(): Promise<void> {
  const url = parseUrlArg(process.argv.slice(2), "http://localhost:8787");

  await assertServerReachable(url);
  await assertSeededEventPresent(url);

  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

  const rolesNeeded = new Set(DOCS_SHOTS.map((entry) => resolveRoleForRoute(entry.route, ROUTE_MANIFEST)));

  const browser = await chromium.launch();
  const contextByRole = new Map<PersonaRole, BrowserContext>();
  try {
    for (const role of rolesNeeded) {
      const persona = personaForRole(role, fixture.identities);
      if (persona === null) {
        contextByRole.set(role, await browser.newContext({ viewport: DOCS_SHOT_VIEWPORT }));
      } else {
        contextByRole.set(role, await loginContext(browser, url, persona));
      }
    }

    const writtenIds = new Set<string>();
    console.log(
      `docs-shots: shooting ${DOCS_SHOTS.length} screenshots from ${url} at ${DOCS_SHOT_VIEWPORT.width} wide ` +
        `(starting viewport ${DOCS_SHOT_VIEWPORT.width}x${DOCS_SHOT_VIEWPORT.height}; fullPage shots grow taller)`,
    );
    for (const entry of DOCS_SHOTS) {
      if (writtenIds.has(entry.id)) {
        throw new Error(`docs-shots: duplicate shot id written this run: ${entry.id}`);
      }
      const role = resolveRoleForRoute(entry.route, ROUTE_MANIFEST);
      const context = contextByRole.get(role);
      if (!context) {
        throw new Error(`docs-shots: no browser context for role '${role}' (shot "${entry.id}")`);
      }
      const outPath = await shootOne(context, url, entry);
      writtenIds.add(entry.id);
      const how =
        `${entry.capture ?? "fullPage"}` +
        `${entry.prep ? `, ${entry.prep.length} prep steps` : ""}` +
        `${entry.clip ? `, clipped to a band around ${entry.clip.selector}` : ""}` +
        `${entry.highlight ? `, highlighting ${entry.highlight.selectors.join(" + ")}${entry.highlight.dim === true ? " (dimmed)" : ""}` : ""}`;
      console.log(`SHOT ${entry.id} -> ${outPath} (${entry.route}; ${how}) -- ${captionForShot(entry.id)}`);
    }

    writeShotsAvailable([...writtenIds]);
    console.log(`docs-shots OK: ${writtenIds.size} screenshots written to ${SHOTS_DIR}`);
    console.log(`docs-shots: ${SHOTS_AVAILABLE_PATH} updated with ${writtenIds.size} ids`);
  } finally {
    for (const ctx of contextByRole.values()) await ctx.close();
    await browser.close();
  }
}

// Only run when executed directly, not when imported (test/docs-shots-manifest.test.ts
// imports DOCS_SHOTS from ./docs-shots-lib, never from this module, but keep
// the same main-module guard as scripts/render-sweep.ts for consistency).
const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
