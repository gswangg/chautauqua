// Perf smoke harness (DEC-034, extended by DEC-086/DEC-088/DEC-089): logs in
// as the seeded organizer against a running `wrangler dev` (PERF_URL,
// default http://localhost:8787), then times 5 warmup + 30 measured
// iterations of representative admin, public, and reviewer reads/writes
// against the perf-seeded event (2k submissions, DEC-088's schedule/plan/
// reviewer fixtures), prints a p95 table, and exits 1 if any p95 exceeds
// the local budget. Also runs a one-shot untimed DEC-080 cap assertion
// (301-id schedule.ics -> exactly 400) before the timed loop.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// fixture file directly (like scripts/seed.ts does for the same organizer
// credentials) are both fine here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PERF_EVENT_ID, PERF_EVENT_SLUG, PERF_TOPICS } from "./perf-seed-lib";
import {
  PERF_P95_BUDGET_MS,
  assertContainsVevent,
  assertMinCsvLines,
  computeP95,
  joinIcsIds,
  planPerfPages,
} from "./perf-smoke-lib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

const PERF_URL = process.env.PERF_URL ?? "http://localhost:8787";
const WARMUP_ITERATIONS = 5;
const MEASURED_ITERATIONS = 30;

// DEC-088 is the single source for these literals (the perf-seed task owns
// scripts/perf-seed-lib.ts; this file hardcodes them locally per DEC-089's
// file-disjoint split rather than importing new exports from that module).
const PERF_PLAN_ID = "seed_perf_plan_0001";
const PERF_REVIEWER_EMAIL = "perf.reviewer.1@example-perf.test";
const PERF_REVIEWER_PASSWORD = "PerfReviewer!2027";

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

async function login(email: string, password: string): Promise<Cookies> {
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

// DEC-094: src/lib/pagination.ts clamps perPage to 200 server-side, so a
// single perPage=301 request (or any request above 200) silently gets
// clamped and returns fewer items than asked for. This helper paginates
// at PERF_MAX_PER_PAGE-per-page and accumulates ids until `count` is
// collected, matching the real client-side pagination contract instead of
// assuming an unbounded single-page fetch.
const PERF_MAX_PER_PAGE = 200;

/** Fetches N accepted submission ids via the organizer submissions API,
 * paginating at PERF_MAX_PER_PAGE per page (all accepted perf submissions
 * are scheduled, per DEC-088). */
async function fetchAcceptedSubmissionIds(headers: Record<string, string>, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (const { page, perPage } of planPerfPages(count, PERF_MAX_PER_PAGE)) {
    const res = await fetch(
      `${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/submissions?status=accepted&page=${page}&perPage=${perPage}`,
      { headers },
    );
    if (!res.ok) {
      throw new Error(`fetchAcceptedSubmissionIds: GET submissions?status=accepted (page=${page}) failed: ${res.status}`);
    }
    const body = (await res.json()) as { items: Array<{ id: string }> };
    const pageIds = body.items.map((item) => item.id);
    ids.push(...pageIds);
    // A short page (fewer than perPage rows) means the server has no more
    // matching rows beyond this page — stop paginating rather than
    // requesting an offset past the end of the data.
    if (pageIds.length < perPage) break;
  }
  if (ids.length < count) {
    throw new Error(`fetchAcceptedSubmissionIds: expected at least ${count} accepted submissions, got ${ids.length}`);
  }
  return ids.slice(0, count);
}

async function main(): Promise<void> {
  await waitForHealth();
  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  const cookies = await login(fixture.identities.organizer.email, fixture.identities.organizer.password);
  const headers = { cookie: cookieHeader(cookies) };

  // DEC-089 one-shot untimed assertion: 301 ids on the public, unauthenticated
  // schedule.ics route must be rejected with exactly 400 (DEC-080 cap). Uses
  // its own 301-id fetch (independent of the 150-id set the timed check below
  // uses) so this probe doesn't depend on check ordering.
  //
  // DEC-094: the DEC-088 seed has exactly 300 accepted submissions, so 301
  // real ids don't exist to fetch. The raw ?ids= length check fires before
  // any hydration/lookup (src/routes/public.tsx:580-583), so a 301st
  // syntactically-valid-but-nonexistent id still exercises the cap
  // predicate correctly.
  const capRealIds = await fetchAcceptedSubmissionIds(headers, 300);
  const capIds = [...capRealIds, "sub_cap_probe_nonexistent_0001"];
  const capRes = await fetch(`${PERF_URL}/e/${PERF_EVENT_SLUG}/schedule.ics?ids=${joinIcsIds(capIds)}`);
  if (capRes.status !== 400) {
    throw new Error(
      `DEC-080 cap assertion failed: schedule.ics with 301 ids expected 400, got ${capRes.status}`,
    );
  }
  await capRes.arrayBuffer();

  // DEC-105 one-shot untimed export size probes: exercise the CSV export
  // endpoints against the DEC-088 seed scale (2,000 submissions / 300
  // accepted, all scheduled), independent of the timed loop below.
  const submissionsCsvRes = await fetch(
    `${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/export/submissions?format=csv`,
    { headers },
  );
  if (submissionsCsvRes.status !== 200) {
    throw new Error(`export submissions.csv: expected 200, got ${submissionsCsvRes.status}`);
  }
  assertMinCsvLines("export submissions.csv", await submissionsCsvRes.text(), 2001);

  const showflowCsvRes = await fetch(`${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/exports/showflow.csv`, {
    headers,
  });
  if (showflowCsvRes.status !== 200) {
    throw new Error(`showflow.csv: expected 200, got ${showflowCsvRes.status}`);
  }
  assertMinCsvLines("showflow.csv", await showflowCsvRes.text(), 301);

  const icsIds = await fetchAcceptedSubmissionIds(headers, 150);
  const icsQuery = joinIcsIds(icsIds);
  const ratingSubmissionId = icsIds[0]!;

  const reviewerCookies = await login(PERF_REVIEWER_EMAIL, PERF_REVIEWER_PASSWORD);
  const reviewerHeaders = { cookie: cookieHeader(reviewerCookies) };

  const checks: TimedCheck[] = [
    {
      name: "submissions list (page 1)",
      run: () =>
        fetch(`${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/submissions?page=1&perPage=50`, { headers }),
    },
    {
      // A single topic word (not e.g. 'Perf', which every seeded title
      // contains) matches ~1/20th of the 2,000 rows, the way a real CFP
      // search term would.
      name: `submissions list (q=${PERF_TOPICS[0]})`,
      run: () =>
        fetch(
          `${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/submissions?page=1&perPage=50&q=${encodeURIComponent(PERF_TOPICS[0]!)}`,
          { headers },
        ),
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
    {
      name: "organizer agenda (300 accepted)",
      run: () => fetch(`${PERF_URL}/api/v1/events/${PERF_EVENT_ID}/agenda`, { headers }),
    },
    {
      name: "public sessions page",
      run: () => fetch(`${PERF_URL}/e/${PERF_EVENT_SLUG}/sessions`),
    },
    {
      name: "public agenda",
      run: () => fetch(`${PERF_URL}/e/${PERF_EVENT_SLUG}/agenda`),
    },
    {
      name: "schedule.ics 150 ids",
      run: async () => {
        const res = await fetch(`${PERF_URL}/e/${PERF_EVENT_SLUG}/schedule.ics?ids=${icsQuery}`);
        if (res.ok) {
          const body = await res.clone().text();
          assertContainsVevent("schedule.ics 150 ids", body);
        }
        return res;
      },
    },
    {
      name: "plan progress (12 reviewers)",
      run: () => fetch(`${PERF_URL}/api/v1/plans/${PERF_PLAN_ID}/progress`, { headers }),
    },
    {
      // DEC-266 q search against the 800-contact perf pool (SPEC's top-of-
      // range speaker network); every seeded contact's firstName is
      // 'Perf<n>', so q=perf matches every row and exercises the
      // full-width filter+sort+paginate path.
      name: "contacts list (q=perf)",
      run: () => fetch(`${PERF_URL}/api/v1/contacts?q=perf&page=1&perPage=50`, { headers }),
    },
    {
      name: "rating PUT",
      run: () =>
        fetch(`${PERF_URL}/api/v1/review/plans/${PERF_PLAN_ID}/evaluations/${ratingSubmissionId}`, {
          method: "PUT",
          headers: {
            ...reviewerHeaders,
            "content-type": "application/json",
            "x-chq-csrf": "1",
          },
          body: JSON.stringify({ scores: { overall: 4 } }),
        }),
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
