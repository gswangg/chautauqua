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

import { chromium, type Browser, type BrowserContext, type ConsoleMessage } from "playwright";

import { ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";
import {
  allPassed,
  evaluateRoute,
  formatResultsTable,
  formatSummary,
  type RouteResult,
} from "./render-sweep-lib";
import { ensureDevVars } from "./ensure-dev-vars";

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
async function loginContext(browser: Browser, baseUrl: string, persona: Persona): Promise<BrowserContext> {
  const context = await browser.newContext();
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

async function visitRoute(context: BrowserContext, baseUrl: string, entry: RouteManifestEntry): Promise<RouteResult> {
  const page = await context.newPage();
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

  await page.close();
  return evaluateRoute(entry, { status, bodyText, consoleErrors, pageErrors });
}

async function main(): Promise<void> {
  ensureDevVars(REPO_ROOT); // DEC-187
  const port = await findFreePort();
  const baseUrl = `http://localhost:${port}`;

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
    contextByRole.set("public", await browser.newContext());
    for (const role of ["organizer", "reviewer", "speaker"] as const) {
      const persona = personaForRole(role, fixture.identities);
      if (!persona) continue;
      console.log(`render-sweep: logging in as ${role} (${persona.email})...`);
      contextByRole.set(role, await loginContext(browser, baseUrl, persona));
    }

    const results: RouteResult[] = [];
    for (const entry of ROUTE_MANIFEST) {
      const context = contextByRole.get(entry.role);
      if (!context) throw new Error(`render-sweep: no browser context for role '${entry.role}'`);
      results.push(await visitRoute(context, baseUrl, entry));
    }

    console.log("");
    console.log(formatResultsTable(results));
    console.log("");
    console.log(formatSummary(results));

    if (!allPassed(results)) {
      failed = true;
    } else {
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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
