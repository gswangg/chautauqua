// "stress" walkthrough (task w9-g / DEC-654): turns
// docs/mandates/scale-mandate.md's functional bars into an executable gate
// against the aie perf profile — `npx tsx scripts/walkthrough/stress.ts
// --url http://localhost:8787`. Does NOT reseed; precondition is
// `npm run perf:seed:aie` against a migrated + running dev server. Follows
// scripts/walkthrough/scale.ts's conventions verbatim: same CookieJar, same
// DEC-053 login flow, same fail-loudly assert helpers, fixture identity
// from docs/fixtures/sample-data.json.
//
// Evaluators live in scripts/stress-bars.ts (pure, unit-tested in
// test/stress-bars.test.ts); this file's only job is gathering the
// observation each evaluator needs from real HTTP calls, printing
// PASS/FAIL per bar, and exiting non-zero on the first failure with the
// observed numbers.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// fixture file directly are both fine here (same as scale.ts/producer.ts).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PERF_PROFILES } from "../perf-seed-lib";
import { chunkSelection } from "../../app/src/pages/submissions/bulk";
import {
  STRESS_BAR_EVALUATORS,
  type StressObservations,
  type BarResult,
} from "../stress-bars";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

const urlFlagIdx = process.argv.indexOf("--url");
const BASE_URL = urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : (process.env.WALKTHROUGH_URL ?? "http://localhost:8787");

const AIE_EVENT_SLUG = PERF_PROFILES.aie.eventSlug;
// "Bulk status over 500 selected submissions" (scale-mandate.md) — 600
// clears 500 with headroom and, at BULK_STATUS_CHUNK_SIZE=500 (DEC-193),
// forces a real multi-request chunked run (requestCount=2).
const BULK_SELECT_COUNT = 600;

interface FixtureData {
  identities: {
    organizer: { email: string; password: string };
  };
}

// ---------------------------------------------------------------------------
// Fail-loudly assertion helpers (verbatim pattern from scale.ts)
// ---------------------------------------------------------------------------

class CheckFailure extends Error {}

function fail(name: string, detail: string): never {
  throw new CheckFailure(`FAILED: ${name}\n  ${detail}`);
}

function assertStatus(name: string, res: Response, expected: number, body: string): void {
  if (res.status !== expected) {
    fail(name, `expected status ${expected}, got ${res.status}\n  body: ${body.slice(0, 500)}`);
  }
}

function assertTrue(name: string, condition: boolean, detail: string): void {
  if (!condition) fail(name, detail);
}

function pass(step: string): void {
  console.log(`PASS ${step}`);
}

// ---------------------------------------------------------------------------
// Cookie jar (matching scale.ts/producer.ts's convention)
// ---------------------------------------------------------------------------

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(res: Response): void {
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      if (!pair) continue;
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      this.cookies.set(name, value);
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function jarFetch(jar: CookieJar, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const existing = jar.header();
  if (existing) headers.set("cookie", existing);
  const res = await fetch(url, { ...init, headers, redirect: init.redirect ?? "manual" });
  jar.absorb(res);
  return res;
}

async function loginAs(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const getRes = await jarFetch(jar, `${BASE_URL}/login`);
  assertStatus("GET /login", getRes, 200, await getRes.text());
  const csrf = jar.get("chq_csrf");
  assertTrue("GET /login sets chq_csrf cookie", Boolean(csrf), "no chq_csrf cookie in response");

  const body = new URLSearchParams({ email, password, chq_csrf: csrf! });
  const postRes = await jarFetch(jar, `${BASE_URL}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  assertStatus("POST /login", postRes, 302, await postRes.text());
  assertTrue("POST /login sets chq_session cookie", Boolean(jar.get("chq_session")), "no chq_session cookie in response");
  return jar;
}

async function api(
  jar: CookieJar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ res: Response; json: any; text: string }> {
  const res = await jarFetch(jar, `${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json", "x-chq-csrf": "1" } : { "x-chq-csrf": "1" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // non-JSON response (e.g. HTML error page) — leave json undefined
  }
  return { res, json, text };
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${BASE_URL}/health did not become ready within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Bar runner — every evaluator is invoked by id from STRESS_BAR_EVALUATORS
// (scripts/stress-bars.ts), never hand-copied, so this file can't drift
// from the exported bar list. Exits non-zero on the FIRST failing bar,
// printing the observed numbers.
// ---------------------------------------------------------------------------

function runBar<K extends keyof StressObservations>(id: K, obs: StressObservations[K]): void {
  const result: BarResult = STRESS_BAR_EVALUATORS[id](obs as any);
  if (result.ok) {
    console.log(`PASS ${id}: ${result.detail}`);
  } else {
    fail(id, result.detail);
  }
}

// ---------------------------------------------------------------------------
// Observation gathering
// ---------------------------------------------------------------------------

async function gatherBulkStatus500(organizerJar: CookieJar, eventId: string): Promise<StressObservations["bulkStatus500"]> {
  const ids: string[] = [];
  let page = 1;
  while (ids.length < BULK_SELECT_COUNT) {
    const res = await api(
      organizerJar,
      "GET",
      `/api/v1/events/${eventId}/submissions?status=pending&perPage=200&page=${page}`,
    );
    assertStatus(`bulkStatus500: GET pending submissions page ${page}`, res.res, 200, res.text);
    const items = res.json.items as { id: string }[];
    if (items.length === 0) break;
    for (const item of items) ids.push(item.id);
    page += 1;
  }
  assertTrue(
    `bulkStatus500: found >= ${BULK_SELECT_COUNT} pending submissions in the aie profile`,
    ids.length >= BULK_SELECT_COUNT,
    `found ${ids.length}`,
  );
  const selected = ids.slice(0, BULK_SELECT_COUNT);

  const chunks = chunkSelection(selected);
  let updated = 0;
  let requestCount = 0;
  for (const chunk of chunks) {
    const res = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions/status`, {
      ids: chunk,
      status: "accepted",
    });
    assertStatus(`bulkStatus500: POST chunk ${requestCount + 1}/${chunks.length}`, res.res, 200, res.text);
    updated += res.json.updated as number;
    requestCount += 1;
  }

  return { selected: selected.length, updated, requestCount, rolledBack: false };
}

async function gatherAutoSchedule320(organizerJar: CookieJar, eventId: string): Promise<StressObservations["autoSchedule320"]> {
  const res = await api(organizerJar, "POST", `/api/v1/events/${eventId}/agenda/auto-schedule`, {});
  assertStatus("autoSchedule320: POST auto-schedule", res.res, 200, res.text);
  const unplacedTotal = res.json.summary.unplaced as number;
  const reasons = (res.json.unplacedReasons as { detail: string }[]).map((r) => r.detail);
  // DEC-615 (wave 43 amendment): runAutoSchedule now asserts this equality
  // server-side and throws on divergence, but the scale gate must fail
  // loudly too rather than silently reporting a mismatched pair of numbers.
  assertTrue(
    "autoSchedule320: unplacedTotal accounts for every unplacedReasons entry",
    unplacedTotal === reasons.length,
    `unplacedTotal=${unplacedTotal} reasons.length=${reasons.length} delta=${unplacedTotal - reasons.length}`,
  );
  return { unplacedTotal, reasons };
}

async function gatherRemindersHonesty(organizerJar: CookieJar, eventId: string): Promise<StressObservations["remindersHonesty"]> {
  const gridRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/onboarding?perPage=1`);
  assertStatus("remindersHonesty: GET onboarding grid counts", gridRes.res, 200, gridRes.text);
  const due = gridRes.json.counts.outstandingContacts as number;

  const remindRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/onboarding/remind`, {});
  assertStatus("remindersHonesty: POST onboarding/remind", remindRes.res, 200, remindRes.text);
  const { sent, skipped, remaining } = remindRes.json as { sent: number; skipped: number; remaining: number };
  return { due, sent, skipped, remaining };
}

async function gatherOverviewRowCap(organizerJar: CookieJar, eventId: string): Promise<StressObservations["overviewRowCap"]> {
  const res = await api(organizerJar, "GET", `/api/v1/events/${eventId}/overview`);
  assertStatus("overviewRowCap: GET overview", res.res, 200, res.text);
  const payload = res.json;
  return [
    { name: "overdueTasks", rowsLength: payload.overdueTasks.rows.length, total: payload.overdueTasks.total },
    { name: "triage", rowsLength: payload.triage.rows.length, total: payload.triage.total },
    { name: "contentApproval", rowsLength: payload.contentApproval.rows.length, total: payload.contentApproval.total },
    {
      name: "agendaWork.conflicts",
      rowsLength: payload.agendaWork.conflicts.length,
      total: payload.agendaWork.conflictTotal,
    },
    {
      name: "agendaWork.unplaced",
      rowsLength: payload.agendaWork.unplaced.length,
      total: payload.agendaWork.unplacedTotal,
    },
  ];
}

async function gatherDuplicatesLatency(organizerJar: CookieJar): Promise<StressObservations["duplicatesLatency"]> {
  const startedAt = Date.now();
  const res = await api(organizerJar, "GET", `/api/v1/contacts/duplicates`);
  const ms = Date.now() - startedAt;
  assertStatus("duplicatesLatency: GET contacts/duplicates", res.res, 200, res.text);
  return { ms };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await waitForHealth();

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  const { email, password } = fixture.identities.organizer;
  const organizerJar = await loginAs(email, password);

  const eventsRes = await api(organizerJar, "GET", "/api/v1/events");
  assertStatus("setup: GET /api/v1/events", eventsRes.res, 200, eventsRes.text);
  const aieEvent = (eventsRes.json.items as any[]).find((e) => e.slug === AIE_EVENT_SLUG);
  assertTrue(
    `setup: aie profile event (${AIE_EVENT_SLUG}) exists — run \`npm run perf:seed:aie\` first`,
    Boolean(aieEvent),
    eventsRes.text,
  );
  const eventId = aieEvent.id as string;
  pass(`setup (aie event ${AIE_EVENT_SLUG} resolved)`);

  console.log("Gathering bulkStatus500 observation...");
  runBar("bulkStatus500", await gatherBulkStatus500(organizerJar, eventId));

  console.log("Gathering autoSchedule320 observation...");
  runBar("autoSchedule320", await gatherAutoSchedule320(organizerJar, eventId));

  console.log("Gathering remindersHonesty observation...");
  runBar("remindersHonesty", await gatherRemindersHonesty(organizerJar, eventId));

  console.log("Gathering overviewRowCap observation...");
  runBar("overviewRowCap", await gatherOverviewRowCap(organizerJar, eventId));

  console.log("Gathering duplicatesLatency observation...");
  runBar("duplicatesLatency", await gatherDuplicatesLatency(organizerJar));

  console.log("");
  console.log("stress gate OK (all functional bars pass)");
}

main().catch((err) => {
  if (err instanceof CheckFailure) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
