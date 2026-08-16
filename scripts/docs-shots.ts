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
// per role, navigates at exactly the declared 1600x900 viewport, and writes
// a full-frame (viewport-clipped, not page-scroll-clipped -- "full frames,
// not crops") PNG to public/docs/shots/<id>.png.
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

import { chromium, type Browser, type BrowserContext } from "playwright";

import { parseUrlArg } from "./walkthrough-lib";
import { DOCS_SHOT_VIEWPORT, DOCS_SHOTS, DOCS_SHOTS_EVENT_SLUG, type DocsShotEntry } from "./docs-shots-lib";
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

/**
 * Resolves the one role a DOCS_SHOTS route needs by looking it up in the
 * real app/src/routeManifest.ts route table (same table render-sweep
 * drives off). Fails loudly rather than guessing: a route absent from
 * ROUTE_MANIFEST, or present under more than one DIFFERENT role (e.g.
 * `/admin/review/plans/:id`, which PlanEditor and ReviewerQueue both mount
 * on), cannot be resolved to a single persona and must not be shot from
 * this manifest without disambiguating first.
 */
function resolveRoleForRoute(route: string): PersonaRole {
  const matches = ROUTE_MANIFEST.filter((entry) => entry.path === route);
  if (matches.length === 0) {
    throw new Error(`docs-shots: route not found in app/src/routeManifest.ts: ${route}`);
  }
  const roles = new Set(matches.map((entry) => entry.role));
  if (roles.size > 1) {
    throw new Error(
      `docs-shots: route ${route} resolves to more than one role in app/src/routeManifest.ts (${[...roles].join(
        ", ",
      )}) -- ambiguous, pick a route that names a single persona`,
    );
  }
  return matches[0]!.role;
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
  const outPath = join(SHOTS_DIR, `${entry.id}.png`);
  // Rule 3 ("full frames, not crops") + rule 5 ("no annotation drawn on
  // top"): fullPage is deliberately false -- the shot is exactly the
  // declared 1600x900 frame, never the whole scrollable page and never
  // post-processed.
  await page.screenshot({ path: outPath, fullPage: false });
  await page.close();
  return outPath;
}

async function main(): Promise<void> {
  const url = parseUrlArg(process.argv.slice(2), "http://localhost:8787");

  await assertServerReachable(url);
  await assertSeededEventPresent(url);

  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

  const rolesNeeded = new Set(DOCS_SHOTS.map((entry) => resolveRoleForRoute(entry.route)));

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
    console.log(`docs-shots: shooting ${DOCS_SHOTS.length} screenshots from ${url} at ${DOCS_SHOT_VIEWPORT.width}x${DOCS_SHOT_VIEWPORT.height}`);
    for (const entry of DOCS_SHOTS) {
      if (writtenIds.has(entry.id)) {
        throw new Error(`docs-shots: duplicate shot id written this run: ${entry.id}`);
      }
      const role = resolveRoleForRoute(entry.route);
      const context = contextByRole.get(role);
      if (!context) {
        throw new Error(`docs-shots: no browser context for role '${role}' (shot "${entry.id}")`);
      }
      const outPath = await shootOne(context, url, entry);
      writtenIds.add(entry.id);
      console.log(`SHOT ${entry.id} -> ${outPath} (${entry.route}) -- ${captionForShot(entry.id)}`);
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
