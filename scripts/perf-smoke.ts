// Perf smoke harness (DEC-034): logs in as the seeded organizer against a
// running `wrangler dev` (PERF_URL, default http://localhost:8787), then
// times 5 warmup + 30 measured iterations of four representative admin
// reads against the 2k-row perf-seeded event, prints a p95 table, and
// exits 1 if any p95 exceeds the local budget.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// fixture file directly (like scripts/seed.ts does for the same organizer
// credentials) are both fine here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PERF_EVENT_ID } from "./perf-seed-lib";
import { PERF_P95_BUDGET_MS, computeP95 } from "./perf-smoke-lib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

const PERF_URL = process.env.PERF_URL ?? "http://localhost:8787";
const WARMUP_ITERATIONS = 5;
const MEASURED_ITERATIONS = 30;

interface FixtureData {
  identities: {
    organizer: { email: string; password: string };
  };
}

interface Cookies {
  chq_csrf?: string;
  chq_session?: string;
}

function parseSetCookies(res: Response, cookies: Cookies): void {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name === "chq_csrf") cookies.chq_csrf = value;
    if (name === "chq_session") cookies.chq_session = value;
  }
}

function cookieHeader(cookies: Cookies): string {
  return Object.entries(cookies)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function login(): Promise<Cookies> {
  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  const { email, password } = fixture.identities.organizer;

  const cookies: Cookies = {};

  const getRes = await fetch(`${PERF_URL}/login`);
  if (!getRes.ok) {
    throw new Error(`GET /login failed: ${getRes.status}`);
  }
  parseSetCookies(getRes, cookies);
  if (!cookies.chq_csrf) {
    throw new Error("GET /login did not set a chq_csrf cookie");
  }

  const body = new URLSearchParams({
    email,
    password,
    chq_csrf: cookies.chq_csrf,
  });
  const postRes = await fetch(`${PERF_URL}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(cookies),
    },
    body: body.toString(),
    redirect: "manual",
  });
  if (postRes.status !== 302) {
    throw new Error(`POST /login failed: expected 302, got ${postRes.status}`);
  }
  parseSetCookies(postRes, cookies);
  if (!cookies.chq_session) {
    throw new Error("POST /login did not set a chq_session cookie");
  }

  return cookies;
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${PERF_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${PERF_URL}/health did not become ready within ${timeoutMs}ms`);
}

interface TimedCheck {
  name: string;
  run: () => Promise<Response>;
  /** If true, a 404 is treated as "not yet landed" (skipped with a warning) rather than a failure. */
  optional?: boolean;
}

async function timeCheck(check: TimedCheck): Promise<number[] | null> {
  // Warmup (untimed, but still asserts the endpoint is healthy).
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    const res = await check.run();
    if (res.status === 404 && check.optional) {
      console.warn(`SKIP ${check.name}: 404 (not yet landed)`);
      return null;
    }
    if (!res.ok) {
      throw new Error(`${check.name} failed during warmup: ${res.status}`);
    }
    await res.arrayBuffer();
  }

  const samples: number[] = [];
  for (let i = 0; i < MEASURED_ITERATIONS; i++) {
    const start = performance.now();
    const res = await check.run();
    if (!res.ok) {
      throw new Error(`${check.name} failed during measurement: ${res.status}`);
    }
    await res.arrayBuffer();
    samples.push(performance.now() - start);
  }
  return samples;
}

async function main(): Promise<void> {
  await waitForHealth();
  const cookies = await login();
  const headers = { cookie: cookieHeader(cookies) };

  const checks: TimedCheck[] = [
    {
      name: "submissions list (page 1)",
      run: () =>
        fetch(`${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/submissions?page=1&perPage=50`, { headers }),
    },
    {
      name: "submissions list (q=Perf)",
      run: () =>
        fetch(`${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/submissions?page=1&perPage=50&q=Perf`, {
          headers,
        }),
    },
    {
      name: "submission detail",
      run: async () => {
        const listRes = await fetch(
          `${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/submissions?page=1&perPage=1`,
          { headers },
        );
        const list = (await listRes.json()) as { items: Array<{ id: string }> };
        const id = list.items[0]?.id;
        if (!id) throw new Error("no submissions found to time detail fetch against");
        return fetch(`${PERF_URL}/api/v1/submissions/${id}`, { headers });
      },
    },
    {
      name: "event overview",
      run: () => fetch(`${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/overview`, { headers }),
      optional: true,
    },
  ];

  const results: Array<{ name: string; p95: number }> = [];
  let overBudget = false;

  for (const check of checks) {
    const samples = await timeCheck(check);
    if (samples === null) continue;
    const p95 = computeP95(samples);
    results.push({ name: check.name, p95 });
    if (p95 > PERF_P95_BUDGET_MS) overBudget = true;
  }

  console.log("");
  console.log(`p95 over ${MEASURED_ITERATIONS} measured iterations (budget: ${PERF_P95_BUDGET_MS}ms):`);
  console.log("");
  const nameWidth = Math.max(...results.map((r) => r.name.length), 20);
  for (const r of results) {
    const status = r.p95 > PERF_P95_BUDGET_MS ? "FAIL" : "ok";
    console.log(`  ${r.name.padEnd(nameWidth)}  ${r.p95.toFixed(1).padStart(8)}ms  ${status}`);
  }
  console.log("");

  if (overBudget) {
    console.error(`perf:smoke FAILED — at least one check exceeded the ${PERF_P95_BUDGET_MS}ms p95 budget`);
    process.exitCode = 1;
  } else {
    console.log("perf:smoke OK");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
